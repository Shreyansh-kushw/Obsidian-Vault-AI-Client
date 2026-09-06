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
    Dispatches debounced actions to the syncer callback.
    """

    def __init__(
        self,
        vault_id: str,
        vault_path: Path,
        on_change_callback: Callable[[str, str, str, Path], None],
        debounce_seconds: float = 1.0,
    ):
        super().__init__()
        self.vault_id = vault_id
        self.vault_path = vault_path.resolve()
        self.on_change_callback = on_change_callback
        self.debounce_seconds = debounce_seconds

        # Map filepath -> (action, last_event_time, timer_handle)
        self._pending_tasks: Dict[str, asyncio.TimerHandle] = {}
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def _get_loop(self) -> asyncio.AbstractEventLoop:
        if self._loop is None or self._loop.is_closed():
            try:
                self._loop = asyncio.get_running_loop()
            except RuntimeError:
                self._loop = asyncio.get_event_loop()
        return self._loop

    def _schedule_sync(self, action: str, filepath: Path):
        path_str = str(filepath)
        loop = self._get_loop()

        # Cancel existing timer for this file if user is still typing/editing
        if path_str in self._pending_tasks:
            self._pending_tasks[path_str].cancel()

        try:
            rel_path = filepath.relative_to(self.vault_path).as_posix()
        except ValueError:
            rel_path = filepath.name

        def fire():
            self._pending_tasks.pop(path_str, None)
            self.on_change_callback(self.vault_id, action, rel_path, filepath)

        # Call fire after debounce_seconds in the event loop thread
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

    def start(self) -> bool:
        if not self.local_path.exists() or not self.local_path.is_dir():
            return False

        self.handler = DebouncedEventHandler(
            vault_id=self.vault_id,
            vault_path=self.local_path,
            on_change_callback=self.on_change_callback,
            debounce_seconds=config.debounce_seconds,
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

    def attach_vault(self, vault_id: str, local_path: str) -> bool:
        """Start or restart a watcher for a vault"""
        self.detach_vault(vault_id)

        watcher = VaultWatcher(vault_id, local_path, self.on_change_callback)
        success = watcher.start()
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
