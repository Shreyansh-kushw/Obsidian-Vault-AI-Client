import json
import os
from pathlib import Path
from pydantic import BaseModel, Field


CONFIG_FILE = Path(__file__).resolve().parent.parent / "client_config.json"


class ClientConfig(BaseModel):
    server_url: str = Field(default="https://obsidian-backend.salmonbay-c8abd56c.centralindia.azurecontainerapps.io")
    api_key: str = Field(default="")
    owner_token: str = Field(default="")
    client_port: int = Field(default=5050)
    client_host: str = Field(default="127.0.0.1")
    debounce_seconds: float = Field(default=1.0)
    poll_interval: float = Field(default=5.0)

    @classmethod
    def load(cls) -> "ClientConfig":
        """Load configuration from environment or persisted JSON file"""
        data = {}

        # 1. Load from file if exists
        if CONFIG_FILE.exists():
            try:
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception:
                data = {}

        # 2. Prefer non-empty environment variables or fallback to JSON file config
        server_url = (os.getenv("SERVER_URL") or data.get("server_url") or "https://obsidian-backend.salmonbay-c8abd56c.centralindia.azurecontainerapps.io").strip()
        api_key = (os.getenv("API_KEY") or data.get("api_key") or "").strip()
        owner_token = (os.getenv("OWNER_TOKEN") or data.get("owner_token") or "").strip()
        client_port = int(os.getenv("CLIENT_PORT") or data.get("client_port") or 5050)
        client_host = (os.getenv("CLIENT_HOST") or data.get("client_host") or "127.0.0.1").strip()
        debounce_seconds = float(os.getenv("DEBOUNCE_SECONDS") or data.get("debounce_seconds") or 1.0)
        poll_interval = float(os.getenv("POLL_INTERVAL") or data.get("poll_interval") or 5.0)

        return cls(
            server_url=server_url.rstrip("/"),
            api_key=api_key,
            owner_token=owner_token,
            client_port=client_port,
            client_host=client_host,
            debounce_seconds=debounce_seconds,
            poll_interval=poll_interval,
        )

    def save(self) -> None:
        """Persist configuration to JSON file"""
        CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(self.model_dump(), f, indent=2)

    def is_configured(self) -> bool:
        return bool(self.owner_token.strip() and self.server_url.strip())


config = ClientConfig.load()
