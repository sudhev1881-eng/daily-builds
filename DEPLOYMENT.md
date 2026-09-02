# Deployment Guide

The Wi-Fi Sensing Dashboard runs as a **single service**: FastAPI serves the REST API, WebSocket (`/ws`), and the built React frontend on one port (default `8000`).

## Live URLs (Cloudflare Tunnel — quick public access)

Run from the repo root:

```bash
./scripts/serve-public.sh
```

When the script finishes, open the URL printed in `PUBLIC_URL.txt`:

| Service | URL |
|---------|-----|
| **Frontend (dashboard)** | `https://<random>.trycloudflare.com` |
| **Backend health** | `https://<random>.trycloudflare.com/api/health` |
| **WebSocket** | `wss://<random>.trycloudflare.com/ws` |

> **Note:** `trycloudflare.com` links are free and require no account, but they are **temporary** — they stop when the tunnel process exits.

## Frontend environment variables

Set at **build time** (Vite embeds them into the bundle):

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `{origin}/api` | REST API base URL |
| `VITE_WS_URL` | `{ws\|wss}://{host}/ws` | WebSocket endpoint |

Leave both empty when frontend and backend share the same host (Docker, Render, tunnel). See `frontend/.env.example`.

For split deployments (e.g. static frontend on Netlify + API on Render):

```bash
cd frontend
VITE_API_URL=https://your-api.onrender.com/api \
VITE_WS_URL=wss://your-api.onrender.com/ws \
npm run build
```

## Option 1: Docker (local or any container host)

```bash
docker build -t wifi-sensing-dashboard .
docker run -p 8000:8000 wifi-sensing-dashboard
```

Open **http://localhost:8000**.

## Option 2: Render (free tier, persistent URL)

1. Push this repo to GitHub.
2. In [Render](https://render.com), create a **New Blueprint** and point it at `render.yaml`.
3. Render builds the `Dockerfile` and assigns a stable URL like `https://wifi-sensing-dashboard.onrender.com`.

No extra env vars are required for same-origin API/WebSocket.

## Option 3: Manual production build

```bash
cd frontend && npm ci && npm run build
cp -r dist ../backend/static
cd ../backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Development (separate ports)

```bash
# Terminal 1 — backend
cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000

# Terminal 2 — frontend (proxies /api and /ws to :8000)
cd frontend && npm run dev
```

Open **http://localhost:5173**.
