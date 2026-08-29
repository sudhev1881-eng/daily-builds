"""WebSocket connection manager."""

from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    """Manages active WebSocket clients."""

    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self.active_connections.append(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)

    async def broadcast(self, data: dict[str, Any]) -> None:
        message = json.dumps(data, default=str)
        async with self._lock:
            dead: list[WebSocket] = []
            for connection in self.active_connections:
                try:
                    await connection.send_text(message)
                except Exception:
                    dead.append(connection)
            for conn in dead:
                if conn in self.active_connections:
                    self.active_connections.remove(conn)

    @property
    def client_count(self) -> int:
        return len(self.active_connections)
