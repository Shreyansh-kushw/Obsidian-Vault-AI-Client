# Obsidian-Vault-AI-Client 🔮

A standalone, high-performance background file watcher and sync client for **Obsidian-Vault-AI-Server**.

Monitors your local Obsidian vaults in real-time, debounces live note edits, automatically syncs new/updated markdown files with the vector database context engine, purges deleted notes, and provides a sleek dark glassmorphism dashboard UI.

---

## ✨ Features

- 🔑 **Owner Token Authentication**: Links seamlessly with your `Obsidian-Vault-AI-Server` account and isolates your vaults securely.
- 👁️ **Live Watchdog Engine**: Real-time file system observer watching all `.md` files with intelligent 1.0s debouncing so rapid note editing doesn't spam the server.
- ⚡ **Instant Incremental Sync**: Only changed/added notes are re-chunked and embedded using the server's single-file sync endpoint (`POST /vaults/{id}/sync-file`).
- 🗑️ **Automatic Cascade Cleanup**: Deleting notes in Obsidian instantly purges their graph nodes, text chunks, and embedding vectors from PostgreSQL (`DELETE /vaults/{id}/files`).
- ⚠️ **Missing Directory Detection**: If a vault was registered on the server but its folder doesn't exist locally, an interactive dialog prompts you to either **Remove it from the Database** or **Relocate the local folder**.
- 📶 **Offline Queue & Auto-Resume**: If the server or network connection drops, changes are queued safely in memory and automatically flushed when the connection is restored.
- ➕ **Direct Client Ingestion**: Add new local vaults directly from the client Web UI with live markdown note count verification.
- 📊 **Real-time UI Dashboard**: Sleek dark Obsidian theme with glowing status badges, live activity feed stream, and progress bars powered by WebSockets.

---

## 🚀 Quick Start

### 1. Requirements
- Python `>= 3.10`
- Node.js `>= 18`

### 2. Install Python Dependencies
```bash
cd Obsidian-Vault-AI-Client
pip install -e .
# or: pip install watchdog httpx fastapi uvicorn pydantic pydantic-settings rich websockets aiofiles python-multipart
```

### 3. Install Frontend Dependencies
```bash
cd frontend
npm install
```

### 4. Run the Client Watcher Daemon
```bash
# In one terminal:
python -m app.main
```
*Tip: On first run, it will ask for your **Owner Token** (which you can find in your server frontend Settings).*

### 5. Run the Frontend Dashboard
```bash
# In another terminal:
cd frontend
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

## ⚙️ Configuration (`client_config.json` or `.env`)

| Variable | Default | Description |
|---|---|---|
| `SERVER_URL` | `http://localhost:8000` | Backend Obsidian-Vault-AI-Server address |
| `OWNER_TOKEN` | `""` | User's unique Owner Token (`X-OWNER-TOKEN`) |
| `API_KEY` | `""` | Server API Key (`X-API-KEY`) if required |
| `CLIENT_PORT` | `5050` | Local daemon HTTP & WebSocket port |
| `DEBOUNCE_SECONDS` | `1.0` | Debounce delay for rapid typing/saving |
| `POLL_INTERVAL` | `5.0` | Server health check interval |

---

## 📁 Architecture

```
Obsidian-Vault-AI-Client/
├── app/
│   ├── api_client.py     # Async HTTP communication with backend server
│   ├── cli.py            # Rich interactive CLI setup & status output
│   ├── config.py         # Local JSON & env configuration persistence
│   ├── main.py           # Daemon runner entrypoint
│   ├── server.py         # Local FastAPI REST & WebSocket (:5050)
│   ├── state.py          # Central state & WebSocket subscriber hub
│   ├── syncer.py         # Sync engine, directory reconcile, offline queue
│   └── watcher.py        # Watchdog observer & debouncing handler
├── frontend/
│   ├── src/
│   │   ├── components/   # Navbar, VaultCard, MissingFolderDialog, ActivityFeed, etc.
│   │   ├── lib/          # REST & WebSocket API clients
│   │   └── App.tsx       # Main client dashboard
│   ├── tailwind.config.js
│   └── package.json
├── pyproject.toml
└── README.md
```
