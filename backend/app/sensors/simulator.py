"""
Simulated Wi-Fi sensing data generator.

Produces realistic RSSI and CSI-like variations for development without hardware.
Replace this module with a hardware adapter when connecting real CSI devices.
"""

from __future__ import annotations

import math
import random
from datetime import datetime, timezone

import numpy as np

from app.models import RawMeasurement, RoomConfig
from app.sensors.base import BaseSensor


class WiFiSimulator(BaseSensor):
    """Generates realistic simulated Wi-Fi sensing measurements."""

    CSI_SUBCARRIERS = 64

    def __init__(self, room: RoomConfig | None = None) -> None:
        self.room = room or RoomConfig()
        self._running = False

        # Person state
        self.person_x = self.room.width / 2
        self.person_y = self.room.height / 2
        self.person_present = True
        self.person_moving = False
        self.velocity = 0.0
        self.direction = 0.0

        # Movement pattern
        self._target_x = self.person_x
        self._target_y = self.person_y
        self._move_timer = 0
        self._state_timer = 0
        self._current_state = "idle"

        # Signal baseline
        self._baseline_rssi = -45.0
        self._noise_seed = random.random() * 1000

    async def start(self) -> None:
        self._running = True

    async def stop(self) -> None:
        self._running = False

    def update_room(self, room: RoomConfig) -> None:
        self.room = room
        self.person_x = min(self.person_x, room.width - 0.5)
        self.person_y = min(self.person_y, room.height - 0.5)

    def _update_person_state(self, dt: float) -> None:
        """Simulate person presence and movement patterns."""
        self._state_timer += dt

        if self._current_state == "idle":
            if self._state_timer > random.uniform(3, 8):
                action = random.choice(["move", "leave", "stay"])
                if action == "move":
                    self._current_state = "moving"
                    self._target_x = random.uniform(0.8, self.room.width - 0.8)
                    self._target_y = random.uniform(0.8, self.room.height - 0.8)
                    self._move_timer = random.uniform(2, 6)
                elif action == "leave":
                    self._current_state = "absent"
                    self.person_present = False
                    self.person_moving = False
                    self.velocity = 0.0
                self._state_timer = 0

        elif self._current_state == "moving":
            self.person_present = True
            self.person_moving = True
            dx = self._target_x - self.person_x
            dy = self._target_y - self.person_y
            dist = math.hypot(dx, dy)

            if dist < 0.1 or self._move_timer <= 0:
                self._current_state = "idle"
                self.person_moving = False
                self.velocity = 0.0
                self._state_timer = 0
            else:
                speed = random.uniform(0.4, 1.8)
                self.velocity = speed
                self.direction = math.atan2(dy, dx)
                step = min(speed * dt, dist)
                self.person_x += (dx / dist) * step
                self.person_y += (dy / dist) * step
                self._move_timer -= dt

        elif self._current_state == "absent":
            if self._state_timer > random.uniform(5, 15):
                self._current_state = "entering"
                self.person_x = random.uniform(1, self.room.width - 1)
                self.person_y = random.uniform(1, self.room.height - 1)
                self.person_present = True
                self._state_timer = 0

        elif self._current_state == "entering":
            self.person_moving = True
            self.velocity = random.uniform(0.3, 0.8)
            if self._state_timer > random.uniform(1, 3):
                self._current_state = "idle"
                self.person_moving = False
                self.velocity = 0.0
                self._state_timer = 0

    def _distance_to_sensor(self, sx: float, sy: float) -> float:
        if not self.person_present:
            return 99.0
        return math.hypot(self.person_x - sx, self.person_y - sy)

    def _compute_rssi(self, t: float) -> float:
        """RSSI varies with person position relative to router and receiver."""
        router_dist = self._distance_to_sensor(self.room.router.x, self.room.router.y)
        receiver_dist = self._distance_to_sensor(self.room.receiver.x, self.room.receiver.y)

        # Multipath fading model — person body affects signal paths
        path_loss = 20 * math.log10(max(router_dist, 0.5))
        body_attenuation = 0.0
        if self.person_present:
            body_attenuation = 8.0 / max(router_dist, 1.0)
            if self.person_moving:
                body_attenuation += 3.0 * math.sin(t * 12 + self._noise_seed)

        multipath = 4.0 * math.sin(t * 3.7 + router_dist) * math.cos(t * 2.1 + receiver_dist)

        noise = random.gauss(0, 1.2)
        rssi = self._baseline_rssi - path_loss * 0.3 - body_attenuation + multipath + noise
        return max(-95.0, min(-30.0, rssi))

    def _generate_csi(self, t: float) -> tuple[list[float], list[float]]:
        """Generate CSI-like amplitude and phase for 64 subcarriers."""
        amplitudes: list[float] = []
        phases: list[float] = []

        for i in range(self.CSI_SUBCARRIERS):
            freq = i / self.CSI_SUBCARRIERS
            base_amp = 1.0 + 0.3 * math.sin(freq * math.pi * 4 + t * 0.5)

            if self.person_present:
                dist_factor = self._distance_to_sensor(
                    self.room.router.x + (self.room.receiver.x - self.room.router.x) * freq,
                    self.room.router.y + (self.room.receiver.y - self.room.router.y) * freq,
                )
                perturbation = 0.15 * math.sin(t * 8 + i * 0.4) / max(dist_factor, 1.0)
                if self.person_moving:
                    perturbation += 0.25 * math.sin(t * 15 + i * 0.7 + self.direction)
                base_amp += perturbation

            base_amp += random.gauss(0, 0.05)
            phase = freq * math.pi * 2 + t * 0.3
            if self.person_moving:
                phase += 0.2 * math.sin(t * 10 + i * 0.5)

            amplitudes.append(base_amp)
            phases.append(phase)

        return amplitudes, phases

    async def read_measurement(self) -> RawMeasurement:
        t = datetime.now(timezone.utc).timestamp()
        dt = 0.1
        self._update_person_state(dt)

        rssi = self._compute_rssi(t)
        amplitudes, phases = self._generate_csi(t)

        return RawMeasurement(
            timestamp=datetime.now(timezone.utc),
            rssi=rssi,
            csi_amplitude=amplitudes,
            csi_phase=phases,
            source="simulator",
        )

    @property
    def estimated_position(self) -> tuple[float, float]:
        return (self.person_x, self.person_y)

    @property
    def is_present(self) -> bool:
        return self.person_present

    @property
    def is_moving(self) -> bool:
        return self.person_moving

    @property
    def current_velocity(self) -> float:
        return self.velocity

    @property
    def current_direction(self) -> float:
        return self.direction
