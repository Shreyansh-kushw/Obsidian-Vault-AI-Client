import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.config import ClientConfig, config


class ServerApiClient:
    """Async HTTP client to communicate with Obsidian-Vault-AI-Server"""

    def __init__(self, cfg: Optional[ClientConfig] = None):
        self.cfg = cfg or config

    @property
    def headers(self) -> Dict[str, str]:
        hdrs: Dict[str, str] = {}
        if self.cfg.api_key:
            hdrs["X-API-KEY"] = self.cfg.api_key
        if self.cfg.owner_token:
            hdrs["X-OWNER-TOKEN"] = self.cfg.owner_token
        return hdrs

    @property
    def base_url(self) -> str:
        return self.cfg.server_url.rstrip("/")

    async def test_connection(self) -> Tuple[bool, str, Optional[int], float]:
        """
        Tests connection to the server.
        Returns: (is_online, message, status_code, latency_ms)
        """
        start = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(f"{self.base_url}/health", headers=self.headers)
                latency = round((time.perf_counter() - start) * 1000, 1)

                if res.status_code in (200, 204):
                    return True, "Connected to Server", res.status_code, latency
                elif res.status_code == 401:
                    return False, "Invalid API Key (HTTP 401)", res.status_code, latency
                elif res.status_code == 403:
                    return False, "Access Denied: Check Owner Token (HTTP 403)", res.status_code, latency
                elif res.status_code == 404:
                    return True, "Server reachable", res.status_code, latency
                else:
                    return False, f"Server responded with HTTP {res.status_code}", res.status_code, latency
        except httpx.ConnectError:
            return False, f"Cannot connect to server at {self.base_url}. Is it running?", None, 0.0
        except httpx.TimeoutException:
            return False, "Connection timed out reaching server.", None, 0.0
        except Exception as e:
            return False, f"Connection error: {str(e)}", None, 0.0

    async def fetch_vaults(self) -> Tuple[bool, List[Dict[str, Any]], str]:
        """Fetch all vaults associated with current owner token"""
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.get(f"{self.base_url}/vaults", headers=self.headers)
                if res.status_code == 200:
                    return True, res.json(), "Success"
                elif res.status_code == 401:
                    return False, [], "Unauthorized: Invalid API Key"
                elif res.status_code == 403:
                    return False, [], "Forbidden: Invalid Owner Token"
                else:
                    return False, [], f"Server returned {res.status_code}: {res.text}"
        except Exception as e:
            return False, [], f"Network error fetching vaults: {str(e)}"

    async def fetch_vault_files(self, vault_id: str) -> Tuple[bool, List[Dict[str, Any]], str]:
        """Fetch indexed notes for a specific vault"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(f"{self.base_url}/vaults/{vault_id}/files", headers=self.headers)
                if res.status_code == 200:
                    return True, res.json(), "Success"
                return False, [], f"Failed to fetch files: HTTP {res.status_code}"
        except Exception as e:
            return False, [], f"Network error fetching vault files: {str(e)}"

    async def sync_file(self, vault_id: str, rel_filepath: str, content: str) -> Tuple[bool, Dict[str, Any], str]:
        """Upload/sync a modified or new markdown note to the backend"""
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                payload = {
                    "rel_filepath": rel_filepath,
                    "content": content,
                }
                res = await client.post(
                    f"{self.base_url}/vaults/{vault_id}/sync-file",
                    headers=self.headers,
                    json=payload,
                )
                if res.status_code == 200:
                    return True, res.json(), "Synced"
                return False, {}, f"Sync failed with HTTP {res.status_code}: {res.text}"
        except Exception as e:
            return False, {}, f"Network error syncing file: {str(e)}"

    async def delete_file(self, vault_id: str, rel_filepath: str) -> Tuple[bool, Dict[str, Any], str]:
        """Delete a note and its chunks from the backend database"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.request(
                    "DELETE",
                    f"{self.base_url}/vaults/{vault_id}/files",
                    headers=self.headers,
                    json={"rel_filepath": rel_filepath},
                )
                if res.status_code == 200:
                    return True, res.json(), "Deleted"
                return False, {}, f"Delete failed with HTTP {res.status_code}: {res.text}"
        except Exception as e:
            return False, {}, f"Network error deleting file: {str(e)}"

    async def delete_vault(self, vault_id: str) -> Tuple[bool, str]:
        """Delete an entire vault and its cascading chunks from backend"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.delete(
                    f"{self.base_url}/vaults/{vault_id}",
                    headers=self.headers,
                )
                if res.status_code == 200:
                    return True, "Vault removed from database"
                return False, f"Failed: HTTP {res.status_code} - {res.text}"
        except Exception as e:
            return False, f"Network error deleting vault: {str(e)}"

    async def update_vault_path(self, vault_id: str, local_path: str) -> Tuple[bool, str]:
        """Update the registered local directory path for a vault"""
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.patch(
                    f"{self.base_url}/vaults/{vault_id}/path",
                    headers=self.headers,
                    json={"local_vault_path": local_path},
                )
                if res.status_code == 200:
                    return True, "Path updated successfully"
                return False, f"Failed: HTTP {res.status_code} - {res.text}"
        except Exception as e:
            return False, f"Network error updating vault path: {str(e)}"

    async def upload_vault(
        self,
        vault_name: str,
        local_path: str,
        file_paths: List[Path],
    ) -> Tuple[bool, Optional[str], str]:
        """Upload an entire local folder to create a new vault on the server"""
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                files_payload = []
                opened_files = []
                try:
                    for p in file_paths:
                        rel = p.relative_to(local_path).as_posix()
                        f = open(p, "rb")
                        opened_files.append(f)
                        files_payload.append(("files", (rel, f, "text/markdown")))

                    data = {
                        "job_name": vault_name,
                        "local_vault_path": str(local_path),
                    }

                    res = await client.post(
                        f"{self.base_url}/upload-files",
                        headers=self.headers,
                        data=data,
                        files=files_payload,
                    )

                    if res.status_code in (200, 201):
                        resp_data = res.json()
                        vault_id = resp_data.get("vault_id") or resp_data.get("job_id")
                        return True, vault_id, "Vault uploaded and ingestion started"
                    return False, None, f"Upload failed: HTTP {res.status_code} - {res.text}"
                finally:
                    for f in opened_files:
                        try:
                            f.close()
                        except Exception:
                            pass
        except Exception as e:
            return False, None, f"Network error uploading vault: {str(e)}"
