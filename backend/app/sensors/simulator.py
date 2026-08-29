"""
Simulated Wi-Fi sensing data generator with physically-grounded CSI modeling.

Signal model (matches real Wi-Fi sensing physics):

- Each CSI subcarrier k has a slightly different wavelength. A reflection off a
  human body adds a multipath component whose phase is 2*pi*d/lambda_k, where d
  is the bistatic path length router -> person -> receiver.
- When the person moves even a few centimeters, these phases rotate at
  DIFFERENT rates per subcarrier -> large, decorrelated amplitude changes.
- When the person is stationary, the phases freeze -> a static amplitude
  offset (presence signature) plus a small ~0.3 Hz modulation from breathing
  (chest displacement of ~8 mm modulates the path length).
- A fan is a small periodic reflector: it produces a FIXED spatial profile
  across subcarriers modulated periodically in time. Because it runs during
  calibration, its contribution is learned into the baseline.

Scenarios: empty room, person enter/walk/stop/leave, fan always running.
Replace this module with a hardware adapter when connecting real CSI devices.
"""

from __future__ import annotations

import math
import random
from datetime import datetime, timezone

import numpy as np

from app.models import RawMeasurement, RoomConfig
from app.sensors.base import BaseSensor

SPEED_OF_LIGHT = 3.0e8
CARRIER_HZ = 5.18e9
SUBCARRIER_SPACING_HZ = 312.5e3


class WiFiSimulator(BaseSensor):
    """Generates physically realistic simulated Wi-Fi sensing measurements."""

    CSI_SUBCARRIERS = 64
    FAN_FREQ_HZ = 2.5
    BREATHING_FREQ_HZ = 0.28
    BREATHING_AMPLITUDE_M = 0.008  # ~8 mm chest displacement

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
        self._idle_duration = random.uniform(12, 20)

        # Environmental: fan always running (calibrated into baseline)
        self.fan_running = True
        self.fan_x = self.room.width * 0.75
        self.fan_y = self.room.height * 0.3

        self._baseline_rssi = -48.0
        self._calibrating = True

        rng = np.random.default_rng(42)
        k = np.arange(self.CSI_SUBCARRIERS)
        # Per-subcarrier wavelength (20 MHz band around 5.18 GHz)
        freqs = CARRIER_HZ + (k - self.CSI_SUBCARRIERS / 2) * SUBCARRIER_SPACING_HZ
        self._wavelengths = SPEED_OF_LIGHT / freqs
        # Frozen multipath geometry: random static phase offset per subcarrier
        self._static_phase = rng.uniform(0, 2 * math.pi, self.CSI_SUBCARRIERS)
        # Static room frequency response
        self._room_profile = 1.0 + 0.05 * np.sin(k / self.CSI_SUBCARRIERS * 2 * math.pi)
        # Fan reflection: fixed spatial profile across subcarriers
        self._fan_profile = np.cos(0.35 * k + rng.uniform(0, 2 * math.pi))

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

    # ------------------------------------------------------------------
    # Scenario state machine
    # ------------------------------------------------------------------

    def _update_scenario(self, dt: float, t: float) -> None:
        """Realistic scenario: long idle periods, occasional person activity."""
        if self._calibrating:
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

    # ------------------------------------------------------------------
    # Physical signal model
    # ------------------------------------------------------------------

    def _bistatic_path_m(self, t: float) -> float:
        """Path length router -> person -> receiver, modulated by breathing."""
        d_tx = math.hypot(self.person_x - self.room.router.x, self.person_y - self.room.router.y)
        d_rx = math.hypot(self.person_x - self.room.receiver.x, self.person_y - self.room.receiver.y)
        breathing = self.BREATHING_AMPLITUDE_M * math.sin(2 * math.pi * self.BREATHING_FREQ_HZ * t)
        return d_tx + d_rx + breathing

    def _person_reflection(self, t: float) -> np.ndarray:
        """Multipath component reflected off the human body, per subcarrier."""
        if not self.person_present:
            return np.zeros(self.CSI_SUBCARRIERS)
        d = self._bistatic_path_m(t)
        amplitude = 0.55 / (1.0 + 0.4 * d)
        phase = 2 * math.pi * d / self._wavelengths + self._static_phase
        return amplitude * np.cos(phase)

    def _fan_reflection(self, t: float) -> np.ndarray:
        """Small periodic reflector: fixed spatial profile, periodic in time."""
        if not self.fan_running:
            return np.zeros(self.CSI_SUBCARRIERS)
        modulation = math.sin(2 * math.pi * self.FAN_FREQ_HZ * t)
        return 0.045 * modulation * self._fan_profile

    def _line_of_sight_distance(self) -> float:
        """Distance from person to the direct router->receiver line (Fresnel zone)."""
        rx, ry = self.room.router.x, self.room.router.y
        sx, sy = self.room.receiver.x, self.room.receiver.y
        line_len = math.hypot(sx - rx, sy - ry)
        if line_len < 0.01:
            return 99.0
        cross = abs((sx - rx) * (ry - self.person_y) - (rx - self.person_x) * (sy - ry))
        return cross / line_len

    def _compute_rssi(self, t: float) -> float:
        shadowing = 0.0
        if self.person_present:
            # Body shadowing is strongest near the direct LOS path
            d_los = self._line_of_sight_distance()
            shadowing = 6.0 * math.exp(-(d_los * d_los) / 1.5)
            # Moving body sweeps multipath phase -> RSSI fluctuation
            d = self._bistatic_path_m(t)
            shadowing += 1.5 * math.cos(2 * math.pi * d / self._wavelengths[0])

        fan_effect = 0.3 * math.sin(2 * math.pi * self.FAN_FREQ_HZ * t)
        noise = random.gauss(0, 0.3)
        rssi = self._baseline_rssi - shadowing + fan_effect + noise
        return max(-95.0, min(-30.0, rssi))

    def _generate_csi(self, t: float) -> tuple[list[float], list[float]]:
        amplitudes = (
            self._room_profile
            + self._person_reflection(t)
            + self._fan_reflection(t)
            + np.random.normal(0, 0.012, self.CSI_SUBCARRIERS)
        )

        k = np.arange(self.CSI_SUBCARRIERS)
        phases = k / self.CSI_SUBCARRIERS * 2 * math.pi + self._fan_reflection(t) * 0.5
        if self.person_present:
            d = self._bistatic_path_m(t)
            phases = phases + 0.3 * np.sin(2 * math.pi * d / self._wavelengths + self._static_phase)

        return amplitudes.tolist(), phases.tolist()

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
