import asyncio
import json
import time
from typing import Any, Dict, List, Optional, Set
from fastapi import WebSocket


class AppState:
    """Central state manager for the client watcher daemon and UI"""

    def __init__(self):
        self.is_online: bool = False
        self.connection_message: str = "Connecting to server..."
        self.server_latency_ms: float = 0.0
        self.last_checked: float = 0.0

        # vault_id -> dict of metadata & watcher status
        self.vaults: Dict[str, Dict[str, Any]] = {}

        # Vaults with missing local folder on this machine: vault_id -> dict
        self.missing_vault_folders: Dict[str, Dict[str, Any]] = {}

        # Offline / pending sync queue: list of event dicts
        self.pending_sync_queue: List[Dict[str, Any]] = []

        # Recent live event logs: list of log dicts
        self.activity_logs: List[Dict[str, Any]] = []
        self.max_logs: int = 100

        # Connected WebSocket clients
        self.active_websockets: Set[WebSocket] = set()

    def add_log(self, level: str, message: str, vault_id: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        """Append an event log and broadcast to UI"""
        entry = {
            "id": f"log_{int(time.time() * 1000)}_{len(self.activity_logs)}",
            "timestamp": time.time(),
            "level": level,  # 'info', 'success', 'warning', 'error', 'sync'
            "message": message,
            "vault_id": vault_id,
            "details": details or {},
        }
        self.activity_logs.insert(0, entry)
        if len(self.activity_logs) > self.max_logs:
            self.activity_logs.pop()

        asyncio.create_task(self.broadcast({"type": "log", "data": entry}))

    def update_connection(self, is_online: bool, message: str, latency: float = 0.0):
        changed = (self.is_online != is_online) or (self.connection_message != message)
        self.is_online = is_online
        self.connection_message = message
        self.server_latency_ms = latency
        self.last_checked = time.time()

        if changed:
            asyncio.create_task(self.broadcast({
                "type": "connection_status",
                "data": {
                    "is_online": self.is_online,
                    "message": self.connection_message,
                    "latency_ms": self.server_latency_ms,
                    "pending_queue_count": len(self.pending_sync_queue),
                }
            }))

    def set_vault(self, vault_id: str, vault_data: Dict[str, Any]):
        self.vaults[vault_id] = vault_data
        asyncio.create_task(self.broadcast({
            "type": "vault_update",
            "data": vault_data,
        }))

    def remove_vault(self, vault_id: str):
        if vault_id in self.vaults:
            del self.vaults[vault_id]
        if vault_id in self.missing_vault_folders:
            del self.missing_vault_folders[vault_id]
        asyncio.create_task(self.broadcast({
            "type": "vault_removed",
            "data": {"vault_id": vault_id},
        }))

    def add_missing_folder(self, vault_id: str, vault_name: str, local_path: str):
        self.missing_vault_folders[vault_id] = {
            "vault_id": vault_id,
            "vault_name": vault_name,
            "local_vault_path": local_path,
            "detected_at": time.time(),
        }
        asyncio.create_task(self.broadcast({
            "type": "missing_folder_alert",
            "data": self.missing_vault_folders[vault_id],
        }))

    def resolve_missing_folder(self, vault_id: str):
        if vault_id in self.missing_vault_folders:
            del self.missing_vault_folders[vault_id]
            asyncio.create_task(self.broadcast({
                "type": "missing_folder_resolved",
                "data": {"vault_id": vault_id},
            }))

    async def register_ws(self, ws: WebSocket):
        await ws.accept()
        self.active_websockets.add(ws)
        # Send initial snapshot
        await ws.send_json({
            "type": "initial_state",
            "data": {
                "is_online": self.is_online,
                "connection_message": self.connection_message,
                "server_latency_ms": self.server_latency_ms,
                "vaults": list(self.vaults.values()),
                "missing_folders": list(self.missing_vault_folders.values()),
                "pending_queue_count": len(self.pending_sync_queue),
                "activity_logs": self.activity_logs[:30],
            }
        })

    def unregister_ws(self, ws: WebSocket):
        self.active_websockets.discard(ws)

    async def broadcast(self, message: Dict[str, Any]):
        """Broadcast payload to all connected frontend WebSocket clients"""
        if not self.active_websockets:
            return
        dead = []
        for ws in self.active_websockets:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active_websockets.discard(ws)


state = AppState()
