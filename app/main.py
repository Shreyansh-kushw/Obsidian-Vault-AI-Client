import argparse
import sys
import uvicorn

from app.cli import print_banner, prompt_owner_token_if_needed
from app.config import config


def main():
    parser = argparse.ArgumentParser(description="Obsidian Vault AI Client Watcher Daemon")
    parser.add_argument("--host", default=config.client_host, help="Host to bind the client daemon to")
    parser.add_argument("--port", type=int, default=config.client_port, help="Port to run client API on")
    parser.add_argument("--no-prompt", action="store_true", help="Skip terminal prompt for credentials")
    args = parser.parse_args()

    if not args.no_prompt and sys.stdin.isatty():
        prompt_owner_token_if_needed()

    print_banner(args.host, args.port)

    uvicorn.run(
        "app.server:app",
        host=args.host,
        port=args.port,
        log_level="info",
        reload=False,
    )


if __name__ == "__main__":
    main()
