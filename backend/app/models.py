"""Pydantic models for sensor data and configuration."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class RoomStatus(str, Enum):
    BOOTING = "BOOTING"
    BASELINE_ESTABLISHED = "BASELINE ESTABLISHED"
    ROOM_EMPTY = "ROOM EMPTY"
    OCCUPIED_STATIONARY = "OCCUPIED — STATIONARY"
    HUMAN_MOVING = "HUMAN MOVING"
    ENVIRONMENTAL_ACTIVITY = "ENVIRONMENTAL ACTIVITY"
    ENVIRONMENTAL_CHANGE = "ENVIRONMENTAL CHANGE DETECTED"
    NOISE_IGNORE = "NOISE / IGNORE"


# Legacy alias kept for backward compatibility in frontend mapping
class DetectionStatus(str, Enum):
    NO_PERSON = "No Person Detected"
    PERSON = "Person Detected"
    MOVEMENT = "Movement Detected"


class SensorPosition(BaseModel):
    x: float = Field(ge=0)
    y: float = Field(ge=0)


class RoomConfig(BaseModel):
    width: float = Field(default=8.0, ge=2.0, le=30.0)
    height: float = Field(default=6.0, ge=2.0, le=30.0)
    router: SensorPosition = SensorPosition(x=1.0, y=5.5)
    receiver: SensorPosition = SensorPosition(x=7.0, y=0.5)


class RawMeasurement(BaseModel):
    """Raw Wi-Fi measurement — from simulator or real CSI hardware."""

    timestamp: datetime
    rssi: float
    csi_amplitude: Optional[list[float]] = None
    csi_phase: Optional[list[float]] = None
    source: str = "simulator"


class ProcessedReading(BaseModel):
    """Processed sensing output sent to the dashboard."""

    timestamp: datetime
    rssi: float
    presence_probability: float = Field(ge=0.0, le=1.0)
    movement_probability: float = Field(ge=0.0, le=1.0)
    movement_intensity: float = Field(ge=0.0, le=100.0)
    x: float
    y: float
    velocity: float = Field(ge=0.0)
    direction: Optional[float] = None
    status: DetectionStatus
    room_status: RoomStatus
    person_visible: bool = False
    calibration_remaining_sec: Optional[float] = None
    position_error_m: Optional[float] = None
    accuracy_radius_m: float = 0.5
    csi_waveform: list[float] = Field(default_factory=list)
    simulation_mode: bool = True
    room: RoomConfig
