#!/usr/bin/env bash
# Build frontend, serve everything on :8000, and expose a public URL via Cloudflare Tunnel.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="$ROOT/.bin"
CLOUDFLARED="$BIN_DIR/cloudflared"
STATIC_DIR="$ROOT/backend/static"
PID_DIR="$ROOT/.run"
BACKEND_PID="$PID_DIR/backend.pid"
TUNNEL_PID="$PID_DIR/tunnel.pid"
TUNNEL_LOG="$PID_DIR/tunnel.log"
PUBLIC_URL_FILE="$ROOT/PUBLIC_URL.txt"

mkdir -p "$BIN_DIR" "$PID_DIR"

if [[ ! -x "$CLOUDFLARED" ]]; then
  echo "Installing cloudflared..."
  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64) CF_ARCH="amd64" ;;
    aarch64|arm64) CF_ARCH="arm64" ;;
    *) echo "Unsupported architecture: $ARCH" >&2; exit 1 ;;
  esac
  curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}" \
    -o "$CLOUDFLARED"
  chmod +x "$CLOUDFLARED"
fi

echo "Building frontend..."
cd "$ROOT/frontend"
npm ci --silent
npm run build

echo "Copying frontend build to backend/static..."
rm -rf "$STATIC_DIR"
cp -r dist "$STATIC_DIR"

stop_pid() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file")"
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
    rm -f "$pid_file"
  fi
}

stop_pid "$BACKEND_PID"
stop_pid "$TUNNEL_PID"

if command -v fuser >/dev/null 2>&1; then
  fuser -k 8000/tcp >/dev/null 2>&1 || true
  sleep 1
fi

echo "Starting backend on http://0.0.0.0:8000 ..."
cd "$ROOT/backend"
if [[ -f venv/bin/activate ]]; then
  # shellcheck disable=SC1091
  source venv/bin/activate
  UVICORN_CMD=(uvicorn)
else
  UVICORN_CMD=(python3 -m uvicorn)
fi
nohup "${UVICORN_CMD[@]}" app.main:app --host 0.0.0.0 --port 8000 >"$PID_DIR/backend.log" 2>&1 &
echo $! >"$BACKEND_PID"

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:8000/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

echo "Starting Cloudflare Tunnel..."
: >"$TUNNEL_LOG"
nohup "$CLOUDFLARED" tunnel --url "http://127.0.0.1:8000" >"$TUNNEL_LOG" 2>&1 &
echo $! >"$TUNNEL_PID"

PUBLIC_URL=""
for _ in $(seq 1 60); do
  PUBLIC_URL="$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" | head -1 || true)"
  if [[ -n "$PUBLIC_URL" ]]; then
    break
  fi
  sleep 1
done

if [[ -z "$PUBLIC_URL" ]]; then
  echo "Failed to obtain public URL. Tunnel log:" >&2
  cat "$TUNNEL_LOG" >&2
  exit 1
fi

cat >"$PUBLIC_URL_FILE" <<EOF
Wi-Fi Sensing Dashboard — Live URLs
===================================

Frontend (dashboard):  $PUBLIC_URL
Backend API:           $PUBLIC_URL/api/health
WebSocket:             ${PUBLIC_URL/https/wss}/ws

Local:                 http://localhost:8000

Note: trycloudflare.com URLs are ephemeral and stop when the tunnel process exits.
For a permanent host, deploy with Render using render.yaml (see DEPLOYMENT.md).
EOF

cat "$PUBLIC_URL_FILE"
