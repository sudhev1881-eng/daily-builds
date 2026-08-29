"""
Simulated Wi-Fi sensing data generator with physically-grounded CSI modeling
and MULTI-PERSON support.

Signal model (matches real Wi-Fi sensing physics):

- Each CSI subcarrier k has a slightly different wavelength. A reflection off a
  human body adds a multipath component whose phase is 2*pi*d/lambda_k, where d
  is the bistatic path length router -> person -> receiver.
- Multiple people superimpose: each body contributes its own reflection with
  its own frozen multipath signature and breathing rate.
- When a person moves even a few centimeters, their phases rotate at
  DIFFERENT rates per subcarrier -> large, decorrelated amplitude changes.
- When a person is stationary, their phases freeze -> a static amplitude
  offset (presence signature) plus a small ~0.3 Hz modulation from breathing.
- A fan is a small periodic reflector with a FIXED spatial profile. It runs
  during calibration, so its contribution is learned into the baseline.

Scenarios: empty room, up to MAX_PEOPLE entering/walking/idling/leaving
independently. Replace with a hardware adapter for real CSI devices.
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
CSI_SUBCARRIERS = 64


class SimPerson:
    """One simulated person with an independent behavior state machine."""

    def __init__(self, room: RoomConfig, person_id: int, wavelengths: np.ndarray) -> None:
        self.room = room
        self.id = person_id
        self.x = room.width / 2
        self.y = room.height / 2
        self.present = False
        self.moving = False
        self.velocity = 0.0
        self.direction = 0.0

        self.scenario = "away"  # away | entering | walking | stationary | leaving
        self.timer = 0.0
        self.target_x = self.x
        self.target_y = self.y
        self.walk_speed = 0.0
        # First person shows up quickly; later people join while room occupied
        self.away_duration = random.uniform(12, 20) if person_id == 0 else random.uniform(20, 45)

        rng = np.random.default_rng(1000 + person_id * 7)
        self._wavelengths = wavelengths
        # Frozen multipath signature unique to this body's geometry
        self.static_phase = rng.uniform(0, 2 * math.pi, CSI_SUBCARRIERS)
        self.breathing_freq = random.uniform(0.22, 0.34)
        self.breathing_phase = random.uniform(0, 2 * math.pi)
        self.breathing_amplitude_m = random.uniform(0.006, 0.010)
        # Gait: torso bob + limb swing modulate the reflected path by several
        # cm at ~2 Hz while walking, regardless of walking direction. This is
        # the primary walking signature in real CSI (otherwise a trajectory
        # along a constant-bistatic-path ellipse would be invisible).
        self.gait_freq = random.uniform(1.6, 2.2)
        self.gait_amplitude_m = random.uniform(0.04, 0.06)

    def update(self, dt: float) -> None:
        self.timer += dt

        if self.scenario == "away":
            self.present = False
            self.moving = False
            self.velocity = 0.0
            if self.timer > self.away_duration:
                self.scenario = "entering"
                self.timer = 0.0
                self.x = random.uniform(0.5, 1.5)
                self.y = random.uniform(0.5, 1.5)
                self.target_x = random.uniform(2, self.room.width - 1.5)
                self.target_y = random.uniform(2, self.room.height - 1.5)
                self.walk_speed = random.uniform(0.6, 1.2)
                self.present = True
                self.moving = True

        elif self.scenario == "entering":
            self._move_toward_target(dt)
            if self._at_target():
                self._become_stationary(random.uniform(15, 30))

        elif self.scenario == "stationary":
            self.present = True
            self.moving = False
            self.velocity = 0.0
            if self.timer > self.away_duration:
                if random.random() < 0.65:
                    self.scenario = "walking"
                    self.timer = 0.0
                    self.target_x = random.uniform(1.0, self.room.width - 1.0)
                    self.target_y = random.uniform(1.0, self.room.height - 1.0)
                    self.walk_speed = random.uniform(0.5, 1.0)
                    self.moving = True
                else:
                    self.scenario = "leaving"
                    self.timer = 0.0
                    self.moving = True
                    self.target_x = random.uniform(0.2, 0.8)
                    self.target_y = random.uniform(0.2, 0.8)
                    self.walk_speed = random.uniform(0.4, 0.8)

        elif self.scenario == "walking":
            self._move_toward_target(dt)
            if self._at_target():
                self._become_stationary(random.uniform(10, 25))

        elif self.scenario == "leaving":
            self._move_toward_target(dt)
            if self._at_target() or self.x < 0.5:
                self.scenario = "away"
                self.timer = 0.0
                self.present = False
                self.moving = False
                self.velocity = 0.0
                self.away_duration = random.uniform(25, 50)

    def _become_stationary(self, duration: float) -> None:
        self.scenario = "stationary"
        self.timer = 0.0
        self.moving = False
        self.velocity = 0.0
        self.away_duration = duration

    def _move_toward_target(self, dt: float) -> None:
        dx = self.target_x - self.x
        dy = self.target_y - self.y
        dist = math.hypot(dx, dy)
        if dist < 0.05:
            return
        self.moving = True
        self.velocity = self.walk_speed
        self.direction = math.atan2(dy, dx)
        step = min(self.walk_speed * dt, dist)
        self.x += (dx / dist) * step
        self.y += (dy / dist) * step

    def _at_target(self) -> bool:
        return math.hypot(self.target_x - self.x, self.target_y - self.y) < 0.15

    def bistatic_path_m(self, t: float) -> float:
        """Path length router -> body -> receiver, modulated by breathing."""
        d_tx = math.hypot(self.x - self.room.router.x, self.y - self.room.router.y)
        d_rx = math.hypot(self.x - self.room.receiver.x, self.y - self.room.receiver.y)
        breathing = self.breathing_amplitude_m * math.sin(
            2 * math.pi * self.breathing_freq * t + self.breathing_phase
        )
        gait = 0.0
        if self.moving:
            gait = self.gait_amplitude_m * math.sin(2 * math.pi * self.gait_freq * t)
        return d_tx + d_rx + breathing + gait

    def reflection(self, t: float) -> np.ndarray:
        """Multipath component reflected off this body, per subcarrier."""
        if not self.present:
            return np.zeros(CSI_SUBCARRIERS)
        d = self.bistatic_path_m(t)
        amplitude = 0.55 / (1.0 + 0.4 * d)
        phase = 2 * math.pi * d / self._wavelengths + self.static_phase
        return amplitude * np.cos(phase)


class WiFiSimulator(BaseSensor):
    """Generates physically realistic simulated Wi-Fi sensing measurements."""

    CSI_SUBCARRIERS = CSI_SUBCARRIERS
    FAN_FREQ_HZ = 2.5
    MAX_PEOPLE = 3

    def __init__(self, room: RoomConfig | None = None) -> None:
        self.room = room or RoomConfig()
        self._running = False
        self._start_time: float | None = None
        self._calibrating = True

        rng = np.random.default_rng(42)
        k = np.arange(CSI_SUBCARRIERS)
        freqs = CARRIER_HZ + (k - CSI_SUBCARRIERS / 2) * SUBCARRIER_SPACING_HZ
        self._wavelengths = SPEED_OF_LIGHT / freqs
        self._room_profile = 1.0 + 0.05 * np.sin(k / CSI_SUBCARRIERS * 2 * math.pi)
        self._fan_profile = np.cos(0.35 * k + rng.uniform(0, 2 * math.pi))

        self.persons = [SimPerson(self.room, i, self._wavelengths) for i in range(self.MAX_PEOPLE)]

        # Environmental: fan always running (calibrated into baseline)
        self.fan_running = True
        self._baseline_rssi = -48.0

    async def start(self) -> None:
        self._running = True
        self._start_time = datetime.now(timezone.utc).timestamp()

    async def stop(self) -> None:
        self._running = False

    def set_calibrating(self, calibrating: bool) -> None:
        self._calibrating = calibrating

    def update_room(self, room: RoomConfig) -> None:
        self.room = room
        for p in self.persons:
            p.room = room
            p.x = min(p.x, room.width - 0.5)
            p.y = min(p.y, room.height - 0.5)

    # ------------------------------------------------------------------
    # State access
    # ------------------------------------------------------------------

    @property
    def present_persons(self) -> list[SimPerson]:
        return [p for p in self.persons if p.present]

    def people_state(self) -> list[dict]:
        """Ground-truth hints for the pipeline (position only, NOT detection)."""
        return [
            {
                "id": p.id,
                "x": p.x,
                "y": p.y,
                "moving": p.moving,
                "velocity": p.velocity,
                "direction": p.direction,
            }
            for p in self.present_persons
        ]

    # Legacy single-person accessors (primary = first present person)
    @property
    def _primary(self) -> SimPerson | None:
        present = self.present_persons
        return present[0] if present else None

    @property
    def person_x(self) -> float:
        p = self._primary
        return p.x if p else self.room.width / 2

    @property
    def person_y(self) -> float:
        p = self._primary
        return p.y if p else self.room.height / 2

    @property
    def is_present(self) -> bool:
        return bool(self.present_persons)

    @property
    def is_moving(self) -> bool:
        return any(p.moving for p in self.present_persons)

    @property
    def current_velocity(self) -> float:
        return max((p.velocity for p in self.present_persons), default=0.0)

    @property
    def current_direction(self) -> float:
        moving = [p for p in self.present_persons if p.moving]
        return moving[0].direction if moving else 0.0

    @property
    def estimated_position(self) -> tuple[float, float]:
        return (self.person_x, self.person_y)

    # ------------------------------------------------------------------
    # Physical signal model
    # ------------------------------------------------------------------

    def _update_scenarios(self, dt: float) -> None:
        if self._calibrating:
            for p in self.persons:
                p.present = False
                p.moving = False
                p.velocity = 0.0
            return
        for p in self.persons:
            p.update(dt)

    def _fan_reflection(self, t: float) -> np.ndarray:
        if not self.fan_running:
            return np.zeros(CSI_SUBCARRIERS)
        modulation = math.sin(2 * math.pi * self.FAN_FREQ_HZ * t)
        return 0.045 * modulation * self._fan_profile

    def _line_of_sight_distance(self, p: SimPerson) -> float:
        rx, ry = self.room.router.x, self.room.router.y
        sx, sy = self.room.receiver.x, self.room.receiver.y
        line_len = math.hypot(sx - rx, sy - ry)
        if line_len < 0.01:
            return 99.0
        cross = abs((sx - rx) * (ry - p.y) - (rx - p.x) * (sy - ry))
        return cross / line_len

    def _compute_rssi(self, t: float) -> float:
        shadowing = 0.0
        for p in self.present_persons:
            d_los = self._line_of_sight_distance(p)
            shadowing += 6.0 * math.exp(-(d_los * d_los) / 1.5)
            d = p.bistatic_path_m(t)
            shadowing += 1.5 * math.cos(2 * math.pi * d / self._wavelengths[0])

        fan_effect = 0.3 * math.sin(2 * math.pi * self.FAN_FREQ_HZ * t)
        noise = random.gauss(0, 0.3)
        rssi = self._baseline_rssi - shadowing + fan_effect + noise
        return max(-95.0, min(-30.0, rssi))

    def _generate_csi(self, t: float) -> tuple[list[float], list[float]]:
        amplitudes = self._room_profile + self._fan_reflection(t) + np.random.normal(
            0, 0.012, CSI_SUBCARRIERS
        )
        for p in self.present_persons:
            amplitudes = amplitudes + p.reflection(t)

        k = np.arange(CSI_SUBCARRIERS)
        phases = k / CSI_SUBCARRIERS * 2 * math.pi + self._fan_reflection(t) * 0.5
        for p in self.present_persons:
            d = p.bistatic_path_m(t)
            phases = phases + 0.3 * np.sin(2 * math.pi * d / self._wavelengths + p.static_phase)

        return amplitudes.tolist(), phases.tolist()

    async def read_measurement(self) -> RawMeasurement:
        t = datetime.now(timezone.utc).timestamp()
        self._update_scenarios(0.1)

        rssi = self._compute_rssi(t)
        amplitudes, phases = self._generate_csi(t)

        return RawMeasurement(
            timestamp=datetime.now(timezone.utc),
            rssi=rssi,
            csi_amplitude=amplitudes,
            csi_phase=phases,
            source="simulator",
        )
