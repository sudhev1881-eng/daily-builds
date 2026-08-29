# Wi-Fi Sensing Dashboard

A real-time web application that visualizes human movement and presence in a room using Wi-Fi signal data (RSSI/CSI). Built for research and engineering monitoring with a simulated sensor layer that can be replaced by real CSI hardware.

## Architecture

```
wifi-sensing-dashboard/
├── backend/                  # Python FastAPI server
│   ├── app/
│   │   ├── main.py           # API + WebSocket endpoints
│   │   ├── config.py         # Settings
│   │   ├── models.py         # Pydantic data models
│   │   ├── sensors/
│   │   │   ├── base.py       # Abstract sensor interface
│   │   │   └── simulator.py  # Simulated Wi-Fi CSI/RSSI generator
│   │   ├── processing/
│   │   │   └── pipeline.py   # RSSI/CSI → presence/movement estimates
│   │   └── websocket/
│   │       └── manager.py    # WebSocket broadcast manager
│   └── requirements.txt
├── frontend/                 # React + TypeScript dashboard
│   └── src/
│       ├── components/       # UI components
│       ├── hooks/            # WebSocket hook
│       └── types/            # TypeScript interfaces
└── README.md
```

## Features

- **2D room visualization** with drag/zoom, walls, sensor nodes, person indicator
- **Movement trails** with fading animation and heatmap overlay
- **Real-time status**: No Person / Person / Movement Detected
- **Movement intensity meter** (0–100%)
- **RSSI signal graph** and **CSI waveform** visualization
- **Configurable room dimensions** and sensor positions
- **Simulation mode** with clear UI indicator
- **WebSocket** real-time data streaming

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `WS` | `/ws` | Real-time sensor data stream |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/config` | Current room/sensor config |
| `PUT` | `/api/config` | Update room dimensions & sensor positions |
| `POST` | `/api/measurements` | Ingest real CSI/RSSI from hardware |
| `POST` | `/api/mode/simulation` | Enable simulation mode |
| `POST` | `/api/mode/hardware` | Enable hardware mode |

### Example measurement payload

```json
{
  "timestamp": "2026-08-29T15:40:00Z",
  "rssi": -48,
  "csi_amplitude": [1.0, 1.1, 0.9, ...],
  "csi_phase": [0.1, 0.2, 0.15, ...],
  "source": "hardware"
}
```

### Example WebSocket output

```json
{
  "timestamp": "2026-08-29T15:40:00.123Z",
  "rssi": -48,
  "presence_probability": 0.94,
  "movement_probability": 0.82,
  "movement_intensity": 82.0,
  "x": 3.2,
  "y": 2.7,
  "velocity": 1.1,
  "direction": 0.78,
  "status": "Movement Detected",
  "csi_waveform": [1.0, 1.1, 0.9, ...],
  "simulation_mode": true,
  "room": { "width": 8, "height": 6, "router": {"x": 1, "y": 5.5}, "receiver": {"x": 7, "y": 0.5} }
}
```

## Connecting Real CSI Hardware

The system is designed so the simulator can be swapped for real hardware:

1. **Implement `BaseSensor`** in `backend/app/sensors/base.py` — create a class that reads CSI frames from your device (Intel 5300, Atheros, ESP32-S3, etc.).

2. **POST measurements** to `/api/measurements` with `source: "hardware"`, or register your sensor in `main.py` instead of `WiFiSimulator`.

3. **Extend the processing pipeline** in `backend/app/processing/pipeline.py` with device-specific feature extraction (Hampel filtering, PCA on CSI vectors, Doppler speed estimation).

4. **Disable simulation**: set `WIFI_SENSE_SIMULATION_MODE=false` or call `POST /api/mode/hardware`.

5. The frontend automatically hides the "SIMULATION MODE" banner when `simulation_mode` is `false`.

## Configuration

Environment variables (prefix `WIFI_SENSE_`):

| Variable | Default | Description |
|----------|---------|-------------|
| `SIMULATION_MODE` | `true` | Use simulated sensor data |
| `UPDATE_INTERVAL_MS` | `100` | Data broadcast interval |
| `DEFAULT_ROOM_WIDTH` | `8.0` | Room width in meters |
| `DEFAULT_ROOM_HEIGHT` | `6.0` | Room height in meters |

## Disclaimer

Person location displayed on the dashboard is an **estimate** derived from Wi-Fi channel state information and RSSI measurements. It is not a camera image and does not guarantee exact positioning. Accuracy depends on environment, hardware calibration, and multipath conditions.

## License

MIT
