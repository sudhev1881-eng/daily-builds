"""
FastAPI application entry point.

WebSocket: ws://localhost:8000/ws
REST:
  POST /api/measurements  — ingest real CSI/RSSI from hardware
  GET  /api/config        — current room/sensor configuration
  PUT  /api/config        — update room dimensions and sensor positions
  GET  /api/health        — health check
"""

from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.models import ProcessedReading, RawMeasurement, RoomConfig
from app.processing.pipeline import ProcessingPipeline
from app.sensors.simulator import WiFiSimulator
from app.websocket.manager import ConnectionManager

manager = ConnectionManager()
room_config = RoomConfig(
    width=settings.default_room_width,
    height=settings.default_room_height,
)
simulator = WiFiSimulator(room_config)
pipeline = ProcessingPipeline(room_config)
_broadcast_task: asyncio.Task | None = None
_use_simulator = settings.simulation_mode


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _broadcast_task
    await simulator.start()
    _broadcast_task = asyncio.create_task(_broadcast_loop())
    yield
    await simulator.stop()
    if _broadcast_task:
        _broadcast_task.cancel()
        try:
            await _broadcast_task
        except asyncio.CancelledError:
            pass


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _broadcast_loop() -> None:
    """Continuously generate/process data and broadcast to WebSocket clients."""
    interval = settings.update_interval_ms / 1000.0
    while True:
        if manager.client_count > 0:
            if _use_simulator:
                raw = await simulator.read_measurement()
                calibrating = pipeline.is_calibrating
                simulator.set_calibrating(calibrating)

                if not calibrating:
                    pipeline.set_simulator_state(
                        simulator.person_x,
                        simulator.person_y,
                        simulator.is_present,
                        simulator.is_moving,
                        simulator.current_velocity,
                        simulator.current_direction,
                    )

                reading = pipeline.process(raw, simulation_mode=_use_simulator)
            else:
                await asyncio.sleep(interval)
                continue

            await manager.broadcast(reading.model_dump())

        await asyncio.sleep(interval)


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "simulation_mode": _use_simulator,
        "clients": manager.client_count,
    }


@app.get("/api/config")
async def get_config():
    return room_config.model_dump()


@app.put("/api/config")
async def update_config(config: RoomConfig):
    global room_config
    room_config = config
    simulator.update_room(config)
    pipeline.update_room(config)
    await manager.broadcast(
        {
            "type": "config_update",
            "room": config.model_dump(),
        }
    )
    return config.model_dump()


@app.post("/api/measurements")
async def ingest_measurement(measurement: RawMeasurement) -> ProcessedReading:
    """
    Receive real Wi-Fi sensing measurements from hardware.

    Set WIFI_SENSE_SIMULATION_MODE=false and push measurements here.
  Hardware adapters should POST RawMeasurement JSON at this endpoint.
    """
    global _use_simulator
    if measurement.source != "simulator":
        _use_simulator = False

    reading = pipeline.process(measurement, simulation_mode=False)
    await manager.broadcast(reading.model_dump())
    return reading


@app.post("/api/mode/simulation")
async def enable_simulation():
    global _use_simulator
    _use_simulator = True
    return {"simulation_mode": True}


@app.post("/api/mode/hardware")
async def enable_hardware():
    global _use_simulator
    _use_simulator = False
    return {"simulation_mode": False}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Send initial config
        await websocket.send_text(
            json.dumps(
                {
                    "type": "init",
                    "simulation_mode": _use_simulator,
                    "room": room_config.model_dump(),
                },
                default=str,
            )
        )
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "config_update":
                config = RoomConfig(**msg["room"])
                await update_config(config)
    except WebSocketDisconnect:
        await manager.disconnect(websocket)


STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
if STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="frontend")
