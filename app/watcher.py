import asyncio
import os
import time
from pathlib import Path
from typing import Callable, Dict, Optional, Set

from watchdog.events import FileSystemEvent, FileSystemEventHandler
from watchdog.observers import Observer

from app.config import config
from app.state import state


def is_markdown_file(path_str: str) -> bool:
    """Check if the given path represents an Obsidian markdown file"""
    path = Path(path_str)
    if path.is_dir():
        return False

    # Ignore hidden folders / files (.obsidian, .git, .trash, .stversions, etc.)
    for part in path.parts:
        if part.startswith(".") and part not in (".", ".."):
            return False

    # Ignore common editor temp files
    name = path.name
    if name.startswith("~") or name.endswith(".tmp") or name.endswith(".swp") or name.endswith(".crswap"):
        return False

    return path.suffix.lower() in (".md", ".markdown")


class DebouncedEventHandler(FileSystemEventHandler):
    """
    Watchdog event handler with debouncing and Markdown filtering.
    Dispatches debounced actions to the syncer callback in a thread-safe manner.
    """

    def __init__(
        self,
        vault_id: str,
        vault_path: Path,
        on_change_callback: Callable[[str, str, str, Path], None],
        debounce_seconds: float = 1.0,
        loop: Optional[asyncio.AbstractEventLoop] = None,
    ):
        super().__init__()
        self.vault_id = vault_id
        self.vault_path = vault_path.resolve()
        self.on_change_callback = on_change_callback
        self.debounce_seconds = debounce_seconds
        self._loop = loop or state._main_loop

        # Map filepath -> asyncio.TimerHandle (managed on the event loop thread)
        self._pending_tasks: Dict[str, asyncio.TimerHandle] = {}

    def _get_target_loop(self) -> Optional[asyncio.AbstractEventLoop]:
        if self._loop and self._loop.is_running():
            return self._loop
        if state._main_loop and state._main_loop.is_running():
            self._loop = state._main_loop
            return self._loop
        try:
            loop = asyncio.get_running_loop()
            self._loop = loop
            return self._loop
        except RuntimeError:
            return None

    def _schedule_sync(self, action: str, filepath: Path):
        """Called from Watchdog background thread on file system events"""
        try:
            rel_path = Path(os.path.relpath(os.path.abspath(str(filepath)), os.path.abspath(str(self.vault_path)))).as_posix()
        except Exception:
            try:
                rel_path = filepath.relative_to(self.vault_path).as_posix()
            except Exception:
                rel_path = filepath.name

        loop = self._get_target_loop()
        if loop and loop.is_running():
            loop.call_soon_threadsafe(self._schedule_on_loop, action, rel_path, filepath)
        else:
            # Fallback if loop is somehow not available
            state._safe_async(self._direct_dispatch(action, rel_path, filepath))

    async def _direct_dispatch(self, action: str, rel_path: str, filepath: Path):
        await asyncio.sleep(self.debounce_seconds)
        self.on_change_callback(self.vault_id, action, rel_path, filepath)

    def _schedule_on_loop(self, action: str, rel_path: str, filepath: Path):
        """Executed safely on the main asyncio event loop"""
        path_str = str(filepath)
        loop = self._get_target_loop()
        if not loop:
            return

        if path_str in self._pending_tasks:
            try:
                self._pending_tasks[path_str].cancel()
            except Exception:
                pass

        def fire():
            self._pending_tasks.pop(path_str, None)
            self.on_change_callback(self.vault_id, action, rel_path, filepath)

        timer = loop.call_later(self.debounce_seconds, fire)
        self._pending_tasks[path_str] = timer

    def on_created(self, event: FileSystemEvent):
        if not event.is_directory and is_markdown_file(event.src_path):
            state.add_log("info", f"Detected new file: {Path(event.src_path).name}", self.vault_id)
            self._schedule_sync("modify", Path(event.src_path))

    def on_modified(self, event: FileSystemEvent):
        if not event.is_directory and is_markdown_file(event.src_path):
            self._schedule_sync("modify", Path(event.src_path))

    def on_deleted(self, event: FileSystemEvent):
        if not event.is_directory and is_markdown_file(event.src_path):
            state.add_log("warning", f"Detected file deletion: {Path(event.src_path).name}", self.vault_id)
            self._schedule_sync("delete", Path(event.src_path))

    def on_moved(self, event: FileSystemEvent):
        # When renamed/moved: delete old relative path and modify new path
        if not event.is_directory:
            if is_markdown_file(event.src_path):
                self._schedule_sync("delete", Path(event.src_path))
            if is_markdown_file(event.dest_path):
                self._schedule_sync("modify", Path(event.dest_path))


class VaultWatcher:
    """Manages an active Watchdog Observer on a single Obsidian Vault folder"""

    def __init__(
        self,
        vault_id: str,
        local_path: str,
        on_change_callback: Callable[[str, str, str, Path], None],
    ):
        self.vault_id = vault_id
        self.local_path = Path(local_path).resolve()
        self.on_change_callback = on_change_callback
        self.observer: Optional[Observer] = None
        self.handler: Optional[DebouncedEventHandler] = None
        self.is_running: bool = False

    def start(self, loop: Optional[asyncio.AbstractEventLoop] = None) -> bool:
        if not self.local_path.exists() or not self.local_path.is_dir():
            return False

        self.handler = DebouncedEventHandler(
            vault_id=self.vault_id,
            vault_path=self.local_path,
            on_change_callback=self.on_change_callback,
            debounce_seconds=config.debounce_seconds,
            loop=loop or state._main_loop,
        )
        self.observer = Observer()
        self.observer.schedule(self.handler, str(self.local_path), recursive=True)
        self.observer.start()
        self.is_running = True
        return True

    def stop(self):
        if self.observer and self.observer.is_alive():
            self.observer.stop()
            self.observer.join(timeout=2.0)
        self.is_running = False


class WatcherManager:
    """Coordinates watchers for all active user vaults"""

    def __init__(self, on_change_callback: Callable[[str, str, str, Path], None]):
        self.on_change_callback = on_change_callback
        self.watchers: Dict[str, VaultWatcher] = {}

    def attach_vault(self, vault_id: str, local_path: str, loop: Optional[asyncio.AbstractEventLoop] = None) -> bool:
        """Start or restart a watcher for a vault"""
        self.detach_vault(vault_id)

        watcher = VaultWatcher(vault_id, local_path, self.on_change_callback)
        success = watcher.start(loop=loop or state._main_loop)
        if success:
            self.watchers[vault_id] = watcher
        return success

    def detach_vault(self, vault_id: str):
        if vault_id in self.watchers:
            self.watchers[vault_id].stop()
            del self.watchers[vault_id]

    def stop_all(self):
        for watcher in self.watchers.values():
            watcher.stop()
        self.watchers.clear()

    def get_status(self, vault_id: str) -> str:
        if vault_id in self.watchers and self.watchers[vault_id].is_running:
            return "Watching"
        return "Stopped"

