/** Runtime API/WebSocket URLs — override at build time via VITE_* env vars. */

function wsProtocol(): "ws" | "wss" {
  return window.location.protocol === "https:" ? "wss" : "ws";
}

export const API_URL =
  import.meta.env.VITE_API_URL || `${window.location.origin}/api`;

export const WS_URL =
  import.meta.env.VITE_WS_URL ||
  `${wsProtocol()}://${window.location.host}/ws`;
