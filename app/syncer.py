import asyncio
import json
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import aiofiles

from app.api_client import ServerApiClient
from app.config import config
from app.state import state
from app.watcher import WatcherManager, is_markdown_file


def auto_find_local_vault_path(vault_name: str) -> Optional[str]:
    """Automatically locate the local vault path on disk by checking Obsidian configs and common user dirs"""
    target_name = vault_name.strip().lower()

    # 1. Check Obsidian App Config
    obsidian_config_paths = [
        Path.home() / ".config" / "obsidian" / "obsidian.json",
        Path.home() / "Library" / "Application Support" / "obsidian" / "obsidian.json",
        Path(os.getenv("APPDATA", "")) / "obsidian" / "obsidian.json" if os.getenv("APPDATA") else None,
    ]
    for cfg in obsidian_config_paths:
        if cfg and cfg.exists():
            try:
                with open(cfg, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for _, vinfo in data.get("vaults", {}).items():
                        vpath = vinfo.get("path")
                        if vpath:
                            p = Path(vpath).resolve()
                            if p.exists() and (p.name.lower() == target_name or target_name in p.name.lower()):
                                return str(p)
            except Exception:
                pass

    # 2. Search common user folder roots
    search_roots = [
        Path.home() / "Documents" / "Obsidian",
        Path.home() / "Documents",
        Path.home() / "Obsidian",
        Path.home() / "vault",
        Path.home() / "Notes",
        Path.home(),
    ]
    for s_root in search_roots:
        if s_root.exists() and s_root.is_dir():
            candidate = s_root / vault_name
            if candidate.exists() and candidate.is_dir():
                return str(candidate.resolve())

            try:
                for child in s_root.iterdir():
                    if child.is_dir() and not child.name.startswith("."):
                        if child.name.lower() == target_name:
                            return str(child.resolve())
            except Exception:
                pass

    return None


class VaultSyncer:
    """Manages synchronization between local vault folders and the backend server"""

    def __init__(self, api_client: Optional[ServerApiClient] = None):
        self.api = api_client or ServerApiClient()
        self.watcher_manager = WatcherManager(on_change_callback=self._on_watchdog_event)
        self.is_running: bool = False
        self._sync_lock = asyncio.Lock()
        self._background_tasks: List[asyncio.Task] = []

    def _on_watchdog_event(self, vault_id: str, action: str, rel_path: str, full_path: Path):
        """Dispatched from Watchdog event handler (thread-safe async dispatch)"""
        asyncio.create_task(self.process_change(vault_id, action, rel_path, full_path))

    async def start(self):
        """Start the background synchronization engine and health check loop"""
        if self.is_running:
            return
        self.is_running = True
        self._background_tasks.append(asyncio.create_task(self._health_and_sync_loop()))
        state.add_log("info", "Sync engine started")

    async def stop(self):
        """Stop watcher and background tasks"""
        self.is_running = False
        for task in self._background_tasks:
            task.cancel()
        self._background_tasks.clear()
        self.watcher_manager.stop_all()
        state.add_log("info", "Sync engine stopped")

    async def process_change(self, vault_id: str, action: str, rel_path: str, full_path: Path):
        """Process an individual file change event (with offline queueing support)"""
        if not state.is_online:
            state.pending_sync_queue.append({
                "vault_id": vault_id,
                "action": action,
                "rel_path": rel_path,
                "full_path": str(full_path),
                "queued_at": time.time(),
            })
            state.add_log(
                "warning",
                f"Server offline: Queued {action} for {rel_path} ({len(state.pending_sync_queue)} pending)",
                vault_id,
            )
            return

        # Perform sync
        if action == "modify":
            try:
                if not full_path.exists():
                    return
                async with aiofiles.open(full_path, mode="r", encoding="utf-8", errors="replace") as f:
                    content = await f.read()

                ok, resp, msg = await self.api.sync_file(vault_id, rel_path, content)
                if ok:
                    chunks_count = resp.get("chunks_count", 0)
                    total_files = resp.get("total_files")
                    state.add_log(
                        "success",
                        f"Synced {rel_path} ({chunks_count} chunks embedded)",
                        vault_id,
                    )
                    # Update local vault state
                    if vault_id in state.vaults and total_files is not None:
                        v = state.vaults[vault_id]
                        v["totalFiles"] = total_files
                        v["succeeded"] = total_files
                        v["last_synced"] = time.time()
                        state.set_vault(vault_id, v)
                else:
                    state.add_log("error", f"Sync error on {rel_path}: {msg}", vault_id)
            except Exception as e:
                state.add_log("error", f"Error reading {rel_path}: {str(e)}", vault_id)

        elif action == "delete":
            ok, resp, msg = await self.api.delete_file(vault_id, rel_path)
            if ok:
                total_files = resp.get("total_files")
                state.add_log("warning", f"Removed {rel_path} from database", vault_id)
                if vault_id in state.vaults and total_files is not None:
                    v = state.vaults[vault_id]
                    v["totalFiles"] = total_files
                    v["succeeded"] = total_files
                    v["last_synced"] = time.time()
                    state.set_vault(vault_id, v)
            else:
                state.add_log("error", f"Failed to delete {rel_path} in DB: {msg}", vault_id)

    async def flush_pending_queue(self):
        """Flush any changes queued during server offline periods"""
        if not state.pending_sync_queue or not state.is_online:
            return

        async with self._sync_lock:
            queue_copy = list(state.pending_sync_queue)
            state.pending_sync_queue.clear()
            state.add_log("info", f"Resuming sync: Flushing {len(queue_copy)} queued changes...")

            for item in queue_copy:
                vault_id = item["vault_id"]
                action = item["action"]
                rel_path = item["rel_path"]
                full_path = Path(item["full_path"])
                await self.process_change(vault_id, action, rel_path, full_path)

    async def sync_all_vaults_from_server(self):
        """
        Fetch all user vaults from backend and setup watchers.
        Automatically discovers local folder paths if path is missing or null in DB.
        """
        if not config.is_configured():
            state.update_connection(False, "Owner Token or Server URL not configured")
            return

        ok, vaults, msg = await self.api.fetch_vaults()
        if not ok:
            return

        current_vault_ids = set()
        for v in vaults:
            vault_id = v.get("vault_id") or v.get("id")
            if not vault_id:
                continue

            current_vault_ids.add(vault_id)
            vault_name = v.get("vault_name") or v.get("name") or vault_id[:8]
            local_path = v.get("local_vault_path")

            # Auto-detect local vault path if missing or invalid on disk
            if not local_path or not Path(local_path).exists() or not Path(local_path).is_dir():
                detected = auto_find_local_vault_path(vault_name)
                if detected:
                    local_path = detected
                    # Update server database with auto-detected path
                    asyncio.create_task(self.api.update_vault_path(vault_id, local_path))
                    state.add_log("success", f"Auto-detected and linked local folder: {local_path}", vault_id)

            v_entry = {
                "id": vault_id,
                "vault_id": vault_id,
                "name": vault_name,
                "vault_name": vault_name,
                "local_vault_path": local_path,
                "totalFiles": v.get("totalFiles", 0),
                "succeeded": v.get("succeeded", 0),
                "status": v.get("status", "Processing"),
                "watcher_status": "Stopped",
                "last_synced": time.time(),
            }

            # Check local folder path existence
            if not local_path or not Path(local_path).exists() or not Path(local_path).is_dir():
                v_entry["watcher_status"] = "Folder Missing"
                v_entry["folder_missing"] = True
                state.set_vault(vault_id, v_entry)
                state.add_missing_folder(vault_id, vault_name, local_path or "(no path specified)")
                self.watcher_manager.detach_vault(vault_id)
            else:
                # Folder exists on disk! Start Watchdog observer
                attached = self.watcher_manager.attach_vault(vault_id, local_path)
                v_entry["watcher_status"] = "Watching" if attached else "Error"
                v_entry["folder_missing"] = False
                state.resolve_missing_folder(vault_id)
                state.set_vault(vault_id, v_entry)

        # Cleanup removed vaults from state
        for existing_id in list(state.vaults.keys()):
            if existing_id not in current_vault_ids:
                self.watcher_manager.detach_vault(existing_id)
                state.remove_vault(existing_id)

    async def reconcile_vault(self, vault_id: str, local_path: str):
        """Scans local folder, checks against backend notes, and uploads any missing files"""
        path = Path(local_path).resolve()
        if not path.exists():
            return

        state.add_log("info", f"Reconciling vault '{vault_id}' with local folder...", vault_id)

        # 1. Fetch server notes
        ok, server_notes, _ = await self.api.fetch_vault_files(vault_id)
        server_files = {n.get("rel_filepath") for n in server_notes if n.get("rel_filepath")}

        # 2. Scan local markdown files
        local_files = []
        for root, _, files in os.walk(path):
            for file in files:
                fpath = Path(root) / file
                if is_markdown_file(str(fpath)):
                    try:
                        rel = fpath.relative_to(path).as_posix()
                        local_files.append((rel, fpath))
                    except ValueError:
                        pass

        # 3. Sync local files
        synced_count = 0
        for rel_path, full_path in local_files:
            try:
                async with aiofiles.open(full_path, mode="r", encoding="utf-8", errors="replace") as f:
                    content = await f.read()
                ok, _, _ = await self.api.sync_file(vault_id, rel_path, content)
                if ok:
                    synced_count += 1
            except Exception:
                pass

        state.add_log("success", f"Reconciliation complete: {synced_count} notes synced", vault_id)

    async def _health_and_sync_loop(self):
        """Periodic loop to monitor server health, reconcile vaults, and flush queues every 5s"""
        while self.is_running:
            try:
                if config.is_configured():
                    online, msg, code, latency = await self.api.test_connection()
                    state.update_connection(online, msg, latency)

                    if online:
                        # Auto-sync vaults from server periodically so newly added vaults appear immediately
                        await self.sync_all_vaults_from_server()

                        # Flush any offline queued events
                        await self.flush_pending_queue()
                else:
                    state.update_connection(False, "Owner Token required - please configure in settings")
            except Exception as e:
                state.update_connection(False, f"Connection error: {str(e)}")

            await asyncio.sleep(config.poll_interval)


syncer = VaultSyncer()
