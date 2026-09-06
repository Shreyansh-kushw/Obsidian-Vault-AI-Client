import asyncio
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.api_client import ServerApiClient
from app.config import ClientConfig, config
from app.state import state
from app.syncer import syncer
from app.watcher import is_markdown_file


class UpdateConfigRequest(BaseModel):
    server_url: str = Field(description="Obsidian-Vault-AI-Server URL")
    api_key: Optional[str] = Field(default="", description="Server API Key")
    owner_token: str = Field(description="User Owner Token")


class AddVaultRequest(BaseModel):
    vault_name: str = Field(description="Display name for the vault")
    local_vault_path: str = Field(description="Absolute path to the local Obsidian vault folder")


class UpdateVaultPathRequest(BaseModel):
    local_vault_path: str = Field(description="New absolute path to the local Obsidian vault folder")


class ValidatePathRequest(BaseModel):
    path: str = Field(description="Directory path to test")


def discover_obsidian_vaults() -> List[Dict[str, Any]]:
    """Automatically detect Obsidian vaults from Obsidian app config and common directories"""
    vaults_found = []
    seen_paths = set()

    # 1. Official Obsidian config paths
    obsidian_config_paths = [
        Path.home() / ".config" / "obsidian" / "obsidian.json",
        Path.home() / "Library" / "Application Support" / "obsidian" / "obsidian.json",
        Path(os.getenv("APPDATA", "")) / "obsidian" / "obsidian.json" if os.getenv("APPDATA") else None,
    ]

    for cfg_path in obsidian_config_paths:
        if cfg_path and cfg_path.exists():
            try:
                with open(cfg_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    vaults_dict = data.get("vaults", {})
                    for v_id, v_info in vaults_dict.items():
                        v_path_str = v_info.get("path")
                        if v_path_str:
                            p = Path(v_path_str).resolve()
                            if p.exists() and p.is_dir() and str(p) not in seen_paths:
                                seen_paths.add(str(p))
                                md_count = sum(1 for root, _, files in os.walk(p) for f in files if is_markdown_file(os.path.join(root, f)))
                                vaults_found.append({
                                    "name": p.name,
                                    "path": str(p),
                                    "markdown_count": md_count,
                                    "is_obsidian": (p / ".obsidian").exists(),
                                    "source": "Obsidian App Config",
                                })
            except Exception:
                pass

    # 2. Search common user directories
    search_roots = [
        Path.home() / "Documents",
        Path.home() / "Obsidian",
        Path.home() / "Documents" / "Obsidian",
        Path.home() / "Notes",
        Path.home() / "vault",
    ]

    for s_root in search_roots:
        if s_root.exists() and s_root.is_dir():
            # Check if s_root itself is an Obsidian vault
            if (s_root / ".obsidian").exists() and str(s_root.resolve()) not in seen_paths:
                p = s_root.resolve()
                seen_paths.add(str(p))
                md_count = sum(1 for root, _, files in os.walk(p) for f in files if is_markdown_file(os.path.join(root, f)))
                vaults_found.append({
                    "name": p.name,
                    "path": str(p),
                    "markdown_count": md_count,
                    "is_obsidian": True,
                    "source": "Auto-detected Folder",
                })

            # Check immediate children of s_root
            try:
                for child in s_root.iterdir():
                    if child.is_dir() and not child.name.startswith("."):
                        if ((child / ".obsidian").exists() or any(child.glob("*.md"))) and str(child.resolve()) not in seen_paths:
                            p = child.resolve()
                            seen_paths.add(str(p))
                            md_count = sum(1 for root, _, files in os.walk(p) for f in files if is_markdown_file(os.path.join(root, f)))
                            if md_count > 0:
                                vaults_found.append({
                                    "name": p.name,
                                    "path": str(p),
                                    "markdown_count": md_count,
                                    "is_obsidian": (p / ".obsidian").exists(),
                                    "source": "Discovered in Documents",
                                })
            except Exception:
                pass

    return vaults_found


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Register main event loop for threadsafe state broadcasts
    state.set_loop(asyncio.get_running_loop())
    # Startup: start background syncer
    await syncer.start()
    yield
    # Shutdown: stop watchers
    await syncer.stop()


app = FastAPI(
    title="Obsidian-Vault-AI-Client Daemon",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/status")
async def get_status():
    return {
        "is_online": state.is_online,
        "connection_message": state.connection_message,
        "server_latency_ms": state.server_latency_ms,
        "is_configured": config.is_configured(),
        "server_url": config.server_url,
        "pending_queue_count": len(state.pending_sync_queue),
        "vaults_count": len(state.vaults),
        "missing_folders_count": len(state.missing_vault_folders),
        "active_watchers_count": len(syncer.watcher_manager.watchers),
    }


@app.get("/api/config")
async def get_config():
    return {
        "server_url": config.server_url,
        "api_key": config.api_key,
        "owner_token": config.owner_token,
        "is_configured": config.is_configured(),
    }


@app.post("/api/config")
async def update_config(req: UpdateConfigRequest):
    config.server_url = req.server_url.strip().rstrip("/")
    config.api_key = req.api_key.strip() if req.api_key else ""
    config.owner_token = req.owner_token.strip()
    config.save()

    # Reconnect & sync with new credentials
    syncer.api.cfg = config
    online, msg, code, latency = await syncer.api.test_connection()
    state.update_connection(online, msg, latency)

    if online:
        asyncio.create_task(syncer.sync_all_vaults_from_server())

    return {
        "status": "updated",
        "is_online": state.is_online,
        "message": state.connection_message,
        "latency_ms": state.server_latency_ms,
    }


@app.get("/api/vaults")
async def list_vaults():
    return list(state.vaults.values())


@app.get("/api/discovered-vaults")
async def list_discovered_vaults():
    """Automatically return detected Obsidian vaults on this computer"""
    return discover_obsidian_vaults()


@app.get("/api/fs/browse")
async def browse_filesystem(path: Optional[str] = None):
    """Browse local directory hierarchy for visual folder picker in UI"""
    target = Path(path).expanduser().resolve() if path and path.strip() else Path.home() / "Documents"
    if not target.exists() or not target.is_dir():
        target = Path.home()

    directories = []
    try:
        for entry in sorted(target.iterdir(), key=lambda x: x.name.lower()):
            if entry.is_dir() and not entry.name.startswith("."):
                is_vault = (entry / ".obsidian").exists()
                md_count = sum(1 for root, _, files in os.walk(entry) for f in files if is_markdown_file(os.path.join(root, f)))
                directories.append({
                    "name": entry.name,
                    "path": str(entry.resolve()),
                    "is_vault": is_vault,
                    "markdown_count": md_count,
                })
    except PermissionError:
        pass

    parent = str(target.parent.resolve()) if target.parent != target else None
    current_md_count = sum(1 for root, _, files in os.walk(target) for f in files if is_markdown_file(os.path.join(root, f)))

    return {
        "current_path": str(target),
        "parent_path": parent,
        "directories": directories,
        "markdown_count": current_md_count,
        "is_vault": (target / ".obsidian").exists(),
    }


@app.get("/api/missing-folders")
async def list_missing_folders():
    return list(state.missing_vault_folders.values())


@app.post("/api/vaults/sync-all")
async def trigger_sync_all():
    await syncer.sync_all_vaults_from_server()
    return {"status": "ok", "message": "Synced all vaults from server"}


@app.post("/api/vaults/{vault_id}/reconcile")
async def reconcile_vault_endpoint(vault_id: str):
    if vault_id not in state.vaults:
        raise HTTPException(status_code=404, detail="Vault not found")
    local_path = state.vaults[vault_id].get("local_vault_path")
    if not local_path or not Path(local_path).exists():
        raise HTTPException(status_code=400, detail="Local vault folder does not exist")

    asyncio.create_task(syncer.reconcile_vault(vault_id, local_path))
    return {"status": "started", "message": "Reconciliation initiated in background"}


@app.post("/api/validate-path")
async def validate_local_path(req: ValidatePathRequest):
    p = Path(req.path.strip()).expanduser().resolve()
    if not p.exists():
        return {"exists": False, "is_dir": False, "markdown_count": 0, "path": str(p)}
    if not p.is_dir():
        return {"exists": True, "is_dir": False, "markdown_count": 0, "path": str(p)}

    md_count = sum(1 for root, _, files in os.walk(p) for f in files if is_markdown_file(os.path.join(root, f)))
    return {
        "exists": True,
        "is_dir": True,
        "markdown_count": md_count,
        "path": str(p),
    }


@app.post("/api/vaults/add")
async def add_vault_directly(req: AddVaultRequest):
    """Register and ingest a new local vault directly from client UI"""
    if not config.is_configured():
        raise HTTPException(status_code=400, detail="Owner token is not configured yet")

    p = Path(req.local_vault_path.strip()).expanduser().resolve()
    if not p.exists() or not p.is_dir():
        raise HTTPException(status_code=400, detail=f"Directory '{req.local_vault_path}' does not exist.")

    # Gather local markdown files
    md_files = []
    for root, _, files in os.walk(p):
        for file in files:
            fpath = Path(root) / file
            if is_markdown_file(str(fpath)):
                md_files.append(fpath)

    if not md_files:
        raise HTTPException(status_code=400, detail=f"No Markdown files found in '{req.local_vault_path}'.")

    state.add_log("info", f"Uploading new vault '{req.vault_name}' with {len(md_files)} files...")

    ok, vault_id, msg = await syncer.api.upload_vault(
        vault_name=req.vault_name.strip(),
        local_path=str(p),
        file_paths=md_files,
    )

    if not ok or not vault_id:
        raise HTTPException(status_code=500, detail=f"Failed to create vault on server: {msg}")

    # Attach watcher
    syncer.watcher_manager.attach_vault(vault_id, str(p))

    v_entry = {
        "id": vault_id,
        "vault_id": vault_id,
        "name": req.vault_name.strip(),
        "vault_name": req.vault_name.strip(),
        "local_vault_path": str(p),
        "totalFiles": len(md_files),
        "succeeded": len(md_files),
        "status": "Processing",
        "watcher_status": "Watching",
        "last_synced": 0.0,
    }
    state.set_vault(vault_id, v_entry)
    state.add_log("success", f"Vault '{req.vault_name}' added & Watchdog active!", vault_id)

    return v_entry


@app.delete("/api/vaults/{vault_id}")
async def delete_vault_endpoint(vault_id: str):
    """Remove vault from server database and stop local watcher"""
    syncer.watcher_manager.detach_vault(vault_id)
    ok, msg = await syncer.api.delete_vault(vault_id)
    if not ok:
        raise HTTPException(status_code=500, detail=msg)

    state.remove_vault(vault_id)
    state.add_log("warning", f"Vault '{vault_id}' deleted from database", vault_id)
    return {"status": "deleted", "vault_id": vault_id}


@app.patch("/api/vaults/{vault_id}/path")
async def update_vault_path_endpoint(vault_id: str, req: UpdateVaultPathRequest):
    """Update local vault path on server and re-attach watcher"""
    p = Path(req.local_vault_path.strip()).expanduser().resolve()
    if not p.exists() or not p.is_dir():
        raise HTTPException(status_code=400, detail="Provided directory does not exist on disk.")

    ok, msg = await syncer.api.update_vault_path(vault_id, str(p))
    if not ok:
        raise HTTPException(status_code=500, detail=msg)

    # Attach watcher to new path
    syncer.watcher_manager.attach_vault(vault_id, str(p))
    state.resolve_missing_folder(vault_id)

    if vault_id in state.vaults:
        v = state.vaults[vault_id]
        v["local_vault_path"] = str(p)
        v["watcher_status"] = "Watching"
        v["folder_missing"] = False
        state.set_vault(vault_id, v)

    state.add_log("info", f"Updated path for vault '{vault_id}' -> {str(p)}", vault_id)
    return {"status": "updated", "vault_id": vault_id, "local_vault_path": str(p)}


@app.get("/api/logs")
async def get_activity_logs():
    return state.activity_logs


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await state.register_ws(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        state.unregister_ws(websocket)
    except Exception:
        state.unregister_ws(websocket)
