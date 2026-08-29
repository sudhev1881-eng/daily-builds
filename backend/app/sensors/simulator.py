"""
Simulated Wi-Fi sensing data generator.

Produces realistic RSSI and CSI-like variations for development without hardware.
Scenarios: empty room, fan environmental activity, person enter/walk/stop/leave.
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
    FAN_FREQ_HZ = 2.5  # Fan blade rotation frequency

    def __init__(self, room: RoomConfig | None = None) -> None:
        self.room = room or RoomConfig()
        self._running = False
        self._start_time: float | None = None

        # Person state — starts ABSENT (empty room)
        self.person_x = self.room.width / 2
        self.person_y = self.room.height / 2
        self.person_present = False
        self.person_moving = False
        self.velocity = 0.0
        self.direction = 0.0

        # Scenario state machine
        self._scenario = "empty"  # empty | entering | walking | stationary | leaving
        self._scenario_timer = 0.0
        self._target_x = self.person_x
        self._target_y = self.person_y
        self._walk_speed = 0.0
        self._idle_duration = random.uniform(20, 40)

        # Environmental: fan always running
        self.fan_running = True
        self.fan_x = self.room.width * 0.75
        self.fan_y = self.room.height * 0.3

        self._baseline_rssi = -48.0
        self._noise_seed = random.random() * 1000
        self._calibrating = True

    async def start(self) -> None:
        self._running = True
        self._start_time = datetime.now(timezone.utc).timestamp()

    async def stop(self) -> None:
        self._running = False

    def set_calibrating(self, calibrating: bool) -> None:
        self._calibrating = calibrating

    def update_room(self, room: RoomConfig) -> None:
        self.room = room
        self.person_x = min(self.person_x, room.width - 0.5)
        self.person_y = min(self.person_y, room.height - 0.5)
        self.fan_x = room.width * 0.75
        self.fan_y = room.height * 0.3

    def _update_scenario(self, dt: float, t: float) -> None:
        """Realistic scenario: long idle periods, occasional person activity."""
        if self._calibrating:
            # No person movement during calibration
            self.person_present = False
            self.person_moving = False
            self.velocity = 0.0
            return

        self._scenario_timer += dt

        if self._scenario == "empty":
            self.person_present = False
            self.person_moving = False
            self.velocity = 0.0
            if self._scenario_timer > self._idle_duration:
                # Person enters
                self._scenario = "entering"
                self._scenario_timer = 0.0
                self.person_x = random.uniform(0.5, 1.5)
                self.person_y = random.uniform(0.5, 1.5)
                self._target_x = random.uniform(2, self.room.width - 2)
                self._target_y = random.uniform(2, self.room.height - 2)
                self._walk_speed = random.uniform(0.6, 1.2)
                self.person_present = True
                self.person_moving = True

        elif self._scenario == "entering":
            self._move_toward_target(dt)
            if self._at_target():
                self._scenario = "stationary"
                self._scenario_timer = 0.0
                self.person_moving = False
                self.velocity = 0.0
                self._idle_duration = random.uniform(15, 30)

        elif self._scenario == "stationary":
            self.person_present = True
            self.person_moving = False
            self.velocity = 0.0
            if self._scenario_timer > self._idle_duration:
                if random.random() < 0.6:
                    self._scenario = "walking"
                    self._scenario_timer = 0.0
                    self._target_x = random.uniform(1.5, self.room.width - 1.5)
                    self._target_y = random.uniform(1.5, self.room.height - 1.5)
                    self._walk_speed = random.uniform(0.5, 1.0)
                    self.person_moving = True
                else:
                    self._scenario = "leaving"
                    self._scenario_timer = 0.0
                    self.person_moving = True
                    self._target_x = random.uniform(0.2, 0.8)
                    self._target_y = random.uniform(0.2, 0.8)
                    self._walk_speed = random.uniform(0.4, 0.8)

        elif self._scenario == "walking":
            self._move_toward_target(dt)
            if self._at_target():
                self._scenario = "stationary"
                self._scenario_timer = 0.0
                self.person_moving = False
                self.velocity = 0.0
                self._idle_duration = random.uniform(10, 25)

        elif self._scenario == "leaving":
            self._move_toward_target(dt)
            if self._at_target() or self.person_x < 0.5:
                self._scenario = "empty"
                self._scenario_timer = 0.0
                self.person_present = False
                self.person_moving = False
                self.velocity = 0.0
                self._idle_duration = random.uniform(25, 50)

    def _move_toward_target(self, dt: float) -> None:
        dx = self._target_x - self.person_x
        dy = self._target_y - self.person_y
        dist = math.hypot(dx, dy)
        if dist < 0.05:
            return
        self.person_moving = True
        self.velocity = self._walk_speed
        self.direction = math.atan2(dy, dx)
        step = min(self._walk_speed * dt, dist)
        self.person_x += (dx / dist) * step
        self.person_y += (dy / dist) * step

    def _at_target(self) -> bool:
        return math.hypot(self._target_x - self.person_x, self._target_y - self.person_y) < 0.15

    def _fan_signal(self, t: float, subcarrier_idx: int) -> float:
        """Periodic fan-induced multipath perturbation."""
        if not self.fan_running:
            return 0.0
        phase = t * self.FAN_FREQ_HZ * 2 * math.pi + subcarrier_idx * 0.1
        return 0.12 * math.sin(phase) + 0.05 * math.sin(phase * 2)

    def _distance_to_sensor(self, sx: float, sy: float) -> float:
        if not self.person_present:
            return 99.0
        return math.hypot(self.person_x - sx, self.person_y - sy)

    def _compute_rssi(self, t: float) -> float:
        router_dist = self._distance_to_sensor(self.room.router.x, self.room.router.y)

        body_attenuation = 0.0
        if self.person_present:
            body_attenuation = 6.0 / max(router_dist, 1.0)
            if self.person_moving:
                body_attenuation += 2.0 * math.sin(t * 8 + self._noise_seed)

        fan_effect = self._fan_signal(t, 0) * 3.0
        noise = random.gauss(0, 0.4)
        rssi = self._baseline_rssi - body_attenuation + fan_effect + noise
        return max(-95.0, min(-30.0, rssi))

    def _generate_csi(self, t: float) -> tuple[list[float], list[float]]:
        amplitudes: list[float] = []
        phases: list[float] = []

        for i in range(self.CSI_SUBCARRIERS):
            freq = i / self.CSI_SUBCARRIERS
            base_amp = 1.0 + 0.05 * math.sin(freq * math.pi * 2)

            # Fan environmental periodic signal
            base_amp += self._fan_signal(t, i)

            if self.person_present:
                dist_factor = self._distance_to_sensor(
                    self.room.router.x + (self.room.receiver.x - self.room.router.x) * freq,
                    self.room.router.y + (self.room.receiver.y - self.room.router.y) * freq,
                )
                perturbation = 0.08 / max(dist_factor, 1.0)
                if self.person_moving:
                    perturbation += 0.15 * math.sin(t * 6 + i * 0.3 + self.direction)
                base_amp += perturbation

            base_amp += random.gauss(0, 0.02)
            phase = freq * math.pi * 2 + self._fan_signal(t, i) * 0.5
            if self.person_moving:
                phase += 0.1 * math.sin(t * 6 + i * 0.3)

            amplitudes.append(base_amp)
            phases.append(phase)

        return amplitudes, phases

    async def read_measurement(self) -> RawMeasurement:
        t = datetime.now(timezone.utc).timestamp()
        dt = 0.1
        self._update_scenario(dt, t)

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
