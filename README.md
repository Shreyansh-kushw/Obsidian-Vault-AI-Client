# Obsidian Vault AI Client 🔮

> **An automated background sync client & live dashboard for your Obsidian notes.**  
> It watches your local markdown files in real time, debounces your edits, and automatically keeps your vector database and AI knowledge graph up to date.

---

## 📖 What Does This App Do?

Think of this app as the **bridge between your computer's Obsidian notes and your AI Server**:
1. **You write notes in Obsidian** as you normally do.
2. **This client watches your files in the background**.
3. Whenever you add, edit, or delete a note, **it automatically syncs changes to your AI Server** without you having to press any buttons.
4. It provides a **sleek web dashboard** to check connection status, manage vaults, and monitor live sync activity.

---

## 📋 What You Need Before Starting

You only need **one** of the following options on your computer:

* **Option A (Recommended & Easiest):** [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows, Mac, or Linux)
* **Option B (Manual / No Docker):** [Python 3.10+](https://www.python.org/downloads/) and [Node.js 18+](https://nodejs.org/)

---

## 🚀 Quick Start (Easiest Method: Docker)

### Step 1: Download / Open the Project Folder
Open your computer's terminal (or Command Prompt / PowerShell) and navigate to the project directory:
```bash
cd Obsidian-Vault-AI-Client
```

### Step 2: Start the Application
Run this single command:
```bash
docker compose up -d
```
*(Docker will automatically download requirements and start both the client daemon and the web dashboard in the background).*

### Step 3: Open the Dashboard in Your Browser
Open your web browser (Chrome, Firefox, Edge, Safari, etc.) and go to:
👉 **[http://localhost:5173](http://localhost:5173)**

---

## 🔑 Linking Your Account (First-Time Setup)

When you first open the dashboard at `http://localhost:5173`:

1. Click the **Settings (⚙️ Gear Icon)** in the top right.
2. Enter your **Owner Token**:
   > **Where do I get my Owner Token?**  
   > Open your main **Obsidian-Vault-AI-Server** web interface, go to **Settings**, and copy your `Owner Token` (e.g. `client_ae97e864...`).
3. The **Backend Server URL** is already pre-configured to the default deployed server:
   ```
   https://obsidian-backend.salmonbay-c8abd56c.centralindia.azurecontainerapps.io
   ```
   *(If you run your own server locally or elsewhere, you can change it here).*
4. Click **Save & Connect**. The badge in the top right will turn **Green (Connected)**.

---

## 📂 How to Add and Sync a Vault

1. Click **+ Add Vault** on the dashboard.
2. Give your vault a name (e.g. `My Notes`).
3. Enter the absolute path to your Obsidian vault folder on your computer (e.g. `/home/username/Documents/MyNotes` or `C:\Users\username\Documents\MyNotes`).
4. Click **Create & Ingest**.
5. **That's it!** The client will upload the initial markdown files, calculate vector embeddings, and start watching the folder. Any edits you make in Obsidian will now sync automatically within 1 second.

---

## 🛠️ Alternative Setup: Running Locally Without Docker

If you prefer running directly on your computer without Docker:

### 1. Install Backend Dependencies
```bash
# Create and activate a Python virtual environment (optional but recommended)
python3 -m venv .venv
source .venv/bin/activate   # On Windows: .venv\Scripts\activate

# Install Python packages
pip install -e .
```

### 2. Install Frontend Dependencies
```bash
cd frontend
npm install
cd ..
```

### 3. Start Both Services

**Terminal 1 (Backend Watcher Daemon):**
```bash
python -m app.main
```
*(Runs the background sync engine on `http://localhost:5050`)*

**Terminal 2 (Frontend Dashboard UI):**
```bash
cd frontend
npm run dev
```
*(Opens the interactive UI at `http://localhost:5173`)*

---

## 🌐 URLs & Ports Summary

| Component | URL | Description |
|---|---|---|
| **Client Web Dashboard** | `http://localhost:5173` | Interactive visual dashboard & settings |
| **Client Backend API** | `http://localhost:5050` | Local sync daemon and WebSocket service |
| **API Documentation (Swagger)** | `http://localhost:5050/docs` | Interactive Swagger API docs |
| **Backend Health Check** | `http://localhost:5050/api/status` | Live connection status in JSON |

---

## ⚙️ Configuration Reference

You can customize the client via environment variables, `.env` file, or the Web UI Settings modal:

| Setting | Default Value | Description |
|---|---|---|
| `SERVER_URL` | `https://obsidian-backend.salmonbay-c8abd56c.centralindia.azurecontainerapps.io` | Address of the central Obsidian AI server |
| `OWNER_TOKEN` | `""` | Your unique user key to isolate and sync your vaults |
| `API_KEY` | `""` | Optional server API key if required |
| `CLIENT_PORT` | `5050` | Local daemon HTTP & WebSocket port |
| `DEBOUNCE_SECONDS` | `1.0` | Wait delay (in seconds) while you type before uploading changes |
| `POLL_INTERVAL` | `5.0` | Health check and server check interval (seconds) |

---

## ❓ Frequently Asked Questions (FAQ) & Troubleshooting

### 1. The dashboard URL is not opening?
Make sure you are going to:
👉 **`http://localhost:5173`** *(5-1-7-3, seven before three)*

### 2. Why does a vault say "Folder Missing"?
This happens if:
* The folder path was moved, renamed, or deleted on your computer.
* You are running inside Docker and the vault is located outside your home directory. By default, Docker mounts your `${HOME}` directory. Make sure your vault is inside your user folder (e.g. `~/Documents` or `~/Downloads`).

### 3. What happens if my internet disconnects while editing notes?
The client has an **Offline Queue**. Edits and deletions are safely recorded in memory and will automatically flush and sync to the AI server as soon as the connection is restored.

### 4. How do I stop or restart the Docker client?
* **To stop:** Run `docker compose down`
* **To start:** Run `docker compose up -d`
* **To view live logs:** Run `docker compose logs -f`

---

## 🏗️ Project Structure

```
Obsidian-Vault-AI-Client/
├── app/
│   ├── api_client.py     # Async HTTP communication with AI backend server
│   ├── cli.py            # Terminal CLI interactive setup & status
│   ├── config.py         # JSON and environment variable configuration manager
│   ├── main.py           # Daemon runner & server startup entrypoint
│   ├── server.py         # FastAPI REST & WebSocket endpoints (:5050)
│   ├── state.py          # Central state & real-time WebSocket subscriber hub
│   ├── syncer.py         # Sync engine, folder reconciliation, offline queue
│   └── watcher.py        # Watchdog file system observer & 1.0s debouncer
├── frontend/
│   ├── src/
│   │   ├── components/   # UI Navbar, Vault cards, Activity feed, Settings modal
│   │   ├── lib/          # API and WebSocket client connections
│   │   └── App.tsx       # Main dashboard application
│   └── package.json
├── docker-compose.yml    # One-click Docker multi-container runner
├── Dockerfile.backend    # Docker image builder for Python daemon
└── pyproject.toml        # Python project and dependency metadata
```

---

## 📄 License
MIT License. Free and open source for personal and commercial use.
