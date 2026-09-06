import asyncio
import os
import sys
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt
from rich.table import Table

from app.config import config
from app.syncer import syncer


console = Console()


def prompt_owner_token_if_needed():
    """Prompt user for Owner Token and Server URL if not yet configured"""
    if not config.is_configured():
        console.print(
            Panel.fit(
                "[bold cyan]Obsidian Vault AI Client Setup[/bold cyan]\n\n"
                "[dim]Please configure your credentials to connect to your backend server.[/dim]\n"
                "[italic]Tip: You can find your Owner Token in the Server Web UI Settings.[/italic]",
                border_style="violet",
            )
        )

        server_url = Prompt.ask("Backend Server URL", default=config.server_url)
        api_key = Prompt.ask("API Key (X-API-KEY, optional)", default=config.api_key)
        owner_token = Prompt.ask("Owner Token (X-OWNER-TOKEN, required)")

        config.server_url = server_url.strip().rstrip("/")
        config.api_key = api_key.strip()
        config.owner_token = owner_token.strip()
        config.save()

        console.print("[bold green]✓ Configuration saved successfully![/bold green]\n")


def print_banner(host: str, port: int):
    console.print(
        Panel(
            f"[bold magenta]🔮 Obsidian Vault AI Watcher & Client Daemon[/bold magenta]\n\n"
            f"📡 Local Daemon API: [cyan]http://{host}:{port}[/cyan]\n"
            f"🌐 Server URL:      [cyan]{config.server_url}[/cyan]\n"
            f"🔑 Owner Token:    [dim]{config.owner_token[:8]}...{config.owner_token[-4:] if len(config.owner_token) > 12 else ''}[/dim]\n"
            f"⚡ Watcher Status:  [green]Active (Debounce: {config.debounce_seconds}s)[/green]",
            title="Obsidian-Vault-AI-Client",
            border_style="blue",
        )
    )
