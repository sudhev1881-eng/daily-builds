"""
Processing pipeline: converts raw RSSI/CSI measurements into
presence, movement, and position estimates.

For real hardware, extend CSI feature extraction here (e.g. Hampel filter,
PCA on CSI vectors, speed estimation from Doppler shift on subcarriers).
"""

from __future__ import annotations

import math
from collections import deque

import numpy as np

from app.models import DetectionStatus, ProcessedReading, RawMeasurement, RoomConfig


class ProcessingPipeline:
    """Converts raw Wi-Fi measurements into dashboard-ready readings."""

    PRESENCE_THRESHOLD = 0.55
    MOVEMENT_THRESHOLD = 0.45

    def __init__(self, room: RoomConfig | None = None) -> None:
        self.room = room or RoomConfig()
        self._rssi_history: deque[float] = deque(maxlen=50)
        self._csi_history: deque[np.ndarray] = deque(maxlen=30)
        self._position_history: deque[tuple[float, float]] = deque(maxlen=20)

        # Kalman-like smoothed position
        self._est_x = self.room.width / 2
        self._est_y = self.room.height / 2
        self._prev_x = self._est_x
        self._prev_y = self._est_y
        self._velocity = 0.0
        self._direction: float | None = None

        # Ground truth from simulator (used only in simulation for position hint)
        self._sim_position: tuple[float, float] | None = None
        self._sim_present = False
        self._sim_moving = False
        self._sim_velocity = 0.0
        self._sim_direction = 0.0

    def update_room(self, room: RoomConfig) -> None:
        self.room = room

    def set_simulator_state(
        self,
        x: float,
        y: float,
        present: bool,
        moving: bool,
        velocity: float,
        direction: float,
    ) -> None:
        """Inject simulator ground truth to produce realistic estimates."""
        self._sim_position = (x, y)
        self._sim_present = present
        self._sim_moving = moving
        self._sim_velocity = velocity
        self._sim_direction = direction

    def _csi_variance(self, amplitudes: list[float]) -> float:
        if len(amplitudes) < 2:
            return 0.0
        arr = np.array(amplitudes)
        return float(np.var(arr))

    def _csi_temporal_change(self, amplitudes: list[float]) -> float:
        if not self._csi_history:
            return 0.0
        prev = self._csi_history[-1]
        curr = np.array(amplitudes)
        if len(prev) != len(curr):
            return 0.0
        return float(np.mean(np.abs(curr - prev)))

    def _estimate_presence(self, rssi: float, csi_var: float, csi_change: float) -> float:
        if self._sim_position is not None:
            base = 0.92 if self._sim_present else 0.08
            noise = np.random.normal(0, 0.04)
            return float(np.clip(base + noise, 0.0, 1.0))

        rssi_range = max(self._rssi_history) - min(self._rssi_history) if len(self._rssi_history) > 5 else 0
        score = 0.3
        if rssi_range > 2:
            score += 0.25
        if csi_var > 0.01:
            score += 0.2
        if csi_change > 0.05:
            score += 0.25
        return float(np.clip(score, 0.0, 1.0))

    def _estimate_movement(self, csi_change: float, rssi_delta: float) -> float:
        if self._sim_position is not None:
            base = 0.85 if self._sim_moving else 0.12
            noise = np.random.normal(0, 0.06)
            return float(np.clip(base + noise, 0.0, 1.0))

        score = 0.1
        score += min(csi_change * 2.0, 0.4)
        score += min(abs(rssi_delta) * 0.15, 0.3)
        if len(self._position_history) >= 2:
            p1 = self._position_history[-1]
            p2 = self._position_history[-2]
            displacement = math.hypot(p1[0] - p2[0], p1[1] - p2[1])
            score += min(displacement * 0.5, 0.2)
        return float(np.clip(score, 0.0, 1.0))

    def _estimate_position(self, rssi: float, presence: float) -> tuple[float, float]:
        if self._sim_position is not None and presence > 0.3:
            tx, ty = self._sim_position
            noise_x = np.random.normal(0, 0.15 if self._sim_moving else 0.08)
            noise_y = np.random.normal(0, 0.15 if self._sim_moving else 0.08)
            x = float(np.clip(tx + noise_x, 0.3, self.room.width - 0.3))
            y = float(np.clip(ty + noise_y, 0.3, self.room.height - 0.3))
        else:
            # Triangulation-style estimate from RSSI at two sensors
            rx, ry = self.room.router.x, self.room.router.y
            sx, sy = self.room.receiver.x, self.room.receiver.y
            rssi_factor = (rssi + 90) / 60
            x = rx + (sx - rx) * rssi_factor + np.random.normal(0, 0.5)
            y = ry + (sy - ry) * (1 - rssi_factor) + np.random.normal(0, 0.5)
            x = float(np.clip(x, 0.3, self.room.width - 0.3))
            y = float(np.clip(y, 0.3, self.room.height - 0.3))

        # Smooth position
        alpha = 0.35 if presence > 0.5 else 0.1
        self._est_x = alpha * x + (1 - alpha) * self._est_x
        self._est_y = alpha * y + (1 - alpha) * self._est_y
        return self._est_x, self._est_y

    def process(
        self,
        measurement: RawMeasurement,
        simulation_mode: bool = True,
    ) -> ProcessedReading:
        rssi = measurement.rssi
        prev_rssi = self._rssi_history[-1] if self._rssi_history else rssi
        rssi_delta = rssi - prev_rssi
        self._rssi_history.append(rssi)

        amplitudes = measurement.csi_amplitude or []
        if amplitudes:
            self._csi_history.append(np.array(amplitudes))

        csi_var = self._csi_variance(amplitudes)
        csi_change = self._csi_temporal_change(amplitudes)

        presence = self._estimate_presence(rssi, csi_var, csi_change)
        movement = self._estimate_movement(csi_change, rssi_delta)

        if presence < self.PRESENCE_THRESHOLD:
            x, y = self._est_x, self._est_y
            velocity = 0.0
            direction = None
        else:
            x, y = self._estimate_position(rssi, presence)
            self._position_history.append((x, y))
            dx = x - self._prev_x
            dy = y - self._prev_y
            velocity = math.hypot(dx, dy) * 10
            direction = math.atan2(dy, dx) if velocity > 0.05 else None
            if self._sim_position is not None and self._sim_moving:
                velocity = self._sim_velocity + np.random.normal(0, 0.1)
                direction = self._sim_direction

        self._prev_x, self._prev_y = x, y
        self._velocity = max(0.0, velocity)
        self._direction = direction

        if presence < self.PRESENCE_THRESHOLD:
            status = DetectionStatus.NO_PERSON
        elif movement >= self.MOVEMENT_THRESHOLD:
            status = DetectionStatus.MOVEMENT
        else:
            status = DetectionStatus.PERSON

        intensity = movement * 100.0 if presence >= self.PRESENCE_THRESHOLD else 0.0

        waveform = amplitudes[:32] if amplitudes else [rssi / -100.0] * 32

        return ProcessedReading(
            timestamp=measurement.timestamp,
            rssi=rssi,
            presence_probability=round(presence, 3),
            movement_probability=round(movement, 3),
            movement_intensity=round(intensity, 1),
            x=round(x, 2),
            y=round(y, 2),
            velocity=round(self._velocity, 2),
            direction=direction,
            status=status,
            csi_waveform=[round(v, 4) for v in waveform],
            simulation_mode=simulation_mode,
            room=self.room,
        )
