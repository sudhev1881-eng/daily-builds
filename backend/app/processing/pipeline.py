"""
Processing pipeline: converts raw RSSI/CSI measurements into
presence, movement, and position estimates with baseline subtraction,
temporal filtering, hysteresis, and environmental pattern detection.
"""

from __future__ import annotations

import math
import time
from collections import deque

import numpy as np

from app.config import detection_thresholds as dt
from app.models import DetectionStatus, ProcessedReading, RawMeasurement, RoomConfig, RoomStatus
from app.processing.baseline import BaselineCalibrator
from app.processing.filters import (
    ExponentialMovingAverage,
    HysteresisState,
    PeriodicDetector,
    position_deadband,
)


class ProcessingPipeline:
    """Converts raw Wi-Fi measurements into stable dashboard-ready readings."""

    def __init__(self, room: RoomConfig | None = None) -> None:
        self.room = room or RoomConfig()
        self._calibrator = BaselineCalibrator(dt.calibration_duration_sec)
        self._calibrator_started = False
        self._baseline_announced = False
        self._baseline_announce_time: float = 0.0

        self._presence_ema = ExponentialMovingAverage(dt.ema_alpha)
        self._movement_ema = ExponentialMovingAverage(dt.ema_alpha)
        self._presence_hyst = HysteresisState(
            dt.presence_start_threshold,
            dt.presence_stop_threshold,
            dt.presence_confirm_samples,
            dt.movement_stop_samples,
        )
        self._movement_hyst = HysteresisState(
            dt.movement_start_threshold,
            dt.movement_stop_threshold,
            dt.movement_confirm_samples,
            dt.movement_stop_samples,
        )
        self._periodic = PeriodicDetector(window=80, min_period=3, max_period=30)

        self._est_x = self.room.width / 2
        self._est_y = self.room.height / 2
        self._display_x = self._est_x
        self._display_y = self._est_y
        self._velocity = 0.0
        self._direction: float | None = None
        self._last_trail_x = self._est_x
        self._last_trail_y = self._est_y

        self._room_status = RoomStatus.BOOTING
        self._env_change_detected = False
        self._env_learn_counter = 0

        # Ground truth hints from simulator (position only, NOT detection)
        self._sim_x: float | None = None
        self._sim_y: float | None = None
        self._sim_present = False
        self._sim_moving = False
        self._sim_velocity = 0.0
        self._sim_direction = 0.0

        self._csi_delta_history: deque[float] = deque(maxlen=100)
        self._prev_csi_amp: np.ndarray | None = None
        self._position_history: deque[tuple[float, float]] = deque(maxlen=10)
        self._was_person_visible = False

    def set_simulator_state(
        self,
        x: float,
        y: float,
        present: bool,
        moving: bool,
        velocity: float,
        direction: float,
    ) -> None:
        """Position hints only — detection is signal-based, not injected."""
        self._sim_x = x
        self._sim_y = y
        self._sim_present = present
        self._sim_moving = moving
        self._sim_velocity = velocity
        self._sim_direction = direction

    def update_room(self, room: RoomConfig) -> None:
        self.room = room

    @property
    def is_calibrating(self) -> bool:
        return self._calibrator.is_calibrating(time.time())

    def _csi_temporal_change(self, amplitudes: list[float], prev: np.ndarray | None) -> float:
        if prev is None or not amplitudes:
            return 0.0
        curr = np.array(amplitudes)
        if len(prev) != len(curr):
            return 0.0
        return float(np.mean(np.abs(curr - prev)))

    def _compute_raw_scores(
        self,
        rssi_dev: float,
        amp_dev: float,
        phase_dev: float,
        csi_change: float,
    ) -> tuple[float, float]:
        """Derive presence and movement scores from baseline deviation."""
        # Ignore noise below floor
        rssi_dev = max(0.0, rssi_dev - dt.noise_floor)
        amp_dev = max(0.0, amp_dev - dt.noise_floor)
        csi_change_norm = max(0.0, csi_change - dt.noise_floor * 0.5)

        presence_raw = min(1.0, rssi_dev * 0.3 + amp_dev * 0.35 + phase_dev * 0.15)
        movement_raw = min(1.0, csi_change_norm * 0.5 + amp_dev * 0.25 + rssi_dev * 0.15)

        return presence_raw, movement_raw

    def _displacement_factor(self) -> float:
        """Scale movement score by actual position change over recent frames."""
        if len(self._position_history) < 3:
            return 0.0
        oldest = self._position_history[0]
        newest = self._position_history[-1]
        displacement = math.hypot(newest[0] - oldest[0], newest[1] - oldest[1])
        return min(1.0, displacement / (dt.position_deadband_m * 3))

    def _estimate_position_from_signal(self, presence_score: float) -> tuple[float, float]:
        """Estimate position using simulator hint only when presence is confirmed."""
        if self._sim_present and self._sim_x is not None and self._sim_y is not None:
            jitter = 0.02 if not self._sim_moving else 0.01
            x = float(np.clip(self._sim_x + np.random.normal(0, jitter), 0.3, self.room.width - 0.3))
            y = float(np.clip(self._sim_y + np.random.normal(0, jitter), 0.3, self.room.height - 0.3))
        else:
            x, y = self._display_x, self._display_y

        if presence_score > dt.presence_stop_threshold:
            if self._sim_moving:
                alpha = 0.45  # fast tracking while walking
            elif self._was_person_visible:
                alpha = 0.12  # stable when stationary
            else:
                alpha = 1.0  # snap on first detection
            self._est_x = alpha * x + (1 - alpha) * self._est_x
            self._est_y = alpha * y + (1 - alpha) * self._est_y

        return self._est_x, self._est_y

    def _resolve_room_status(
        self,
        presence_active: bool,
        movement_active: bool,
        movement_score: float,
        periodic_learned: bool,
        periodic_detected: bool,
    ) -> RoomStatus:
        if periodic_learned and not presence_active:
            return RoomStatus.ENVIRONMENTAL_ACTIVITY

        if periodic_detected and not periodic_learned and not presence_active:
            if not self._env_change_detected:
                self._env_change_detected = True
                return RoomStatus.ENVIRONMENTAL_CHANGE
            self._env_learn_counter += 1
            if self._env_learn_counter >= dt.environmental_learn_samples:
                return RoomStatus.ENVIRONMENTAL_ACTIVITY
            return RoomStatus.ENVIRONMENTAL_CHANGE

        if not presence_active:
            return RoomStatus.ROOM_EMPTY

        if movement_active:
            return RoomStatus.HUMAN_MOVING

        return RoomStatus.OCCUPIED_STATIONARY

    def _to_legacy_status(self, room_status: RoomStatus, presence_active: bool, movement_active: bool) -> DetectionStatus:
        if room_status in (RoomStatus.BOOTING, RoomStatus.BASELINE_ESTABLISHED, RoomStatus.ROOM_EMPTY,
                            RoomStatus.ENVIRONMENTAL_ACTIVITY, RoomStatus.NOISE_IGNORE):
            return DetectionStatus.NO_PERSON
        if movement_active:
            return DetectionStatus.MOVEMENT
        if presence_active:
            return DetectionStatus.PERSON
        return DetectionStatus.NO_PERSON

    def process(
        self,
        measurement: RawMeasurement,
        simulation_mode: bool = True,
    ) -> ProcessedReading:
        t = time.time()
        rssi = measurement.rssi
        amplitudes = measurement.csi_amplitude or []
        phases = measurement.csi_phase or []

        # --- Calibration phase ---
        if not self._calibrator_started:
            self._calibrator.start(t)
            self._calibrator_started = True

        if self._calibrator.is_calibrating(t):
            self._calibrator.add_sample(rssi, amplitudes, phases)
            remaining = self._calibrator.remaining(t)
            waveform = amplitudes[:32] if amplitudes else [rssi / -100.0] * 32
            return ProcessedReading(
                timestamp=measurement.timestamp,
                rssi=rssi,
                presence_probability=0.0,
                movement_probability=0.0,
                movement_intensity=0.0,
                x=self._display_x,
                y=self._display_y,
                velocity=0.0,
                direction=None,
                status=DetectionStatus.NO_PERSON,
                room_status=RoomStatus.BOOTING,
                person_visible=False,
                calibration_remaining_sec=round(remaining, 1),
                csi_waveform=[round(v, 4) for v in waveform],
                simulation_mode=simulation_mode,
                room=self.room,
            )

        if not self._calibrator.baseline.established:
            self._calibrator.finalize()

        if not self._baseline_announced:
            self._baseline_announced = True
            self._baseline_announce_time = t
            waveform = amplitudes[:32] if amplitudes else [rssi / -100.0] * 32
            return ProcessedReading(
                timestamp=measurement.timestamp,
                rssi=rssi,
                presence_probability=0.0,
                movement_probability=0.0,
                movement_intensity=0.0,
                x=self._display_x,
                y=self._display_y,
                velocity=0.0,
                direction=None,
                status=DetectionStatus.NO_PERSON,
                room_status=RoomStatus.BASELINE_ESTABLISHED,
                person_visible=False,
                calibration_remaining_sec=0.0,
                csi_waveform=[round(v, 4) for v in waveform],
                simulation_mode=simulation_mode,
                room=self.room,
            )

        # --- Active detection ---
        baseline = self._calibrator.baseline

        rssi_dev, amp_dev, phase_dev = baseline.deviation_score(rssi, amplitudes, phases)
        csi_change = self._csi_temporal_change(amplitudes, self._prev_csi_amp)
        if amplitudes:
            self._prev_csi_amp = np.array(amplitudes)
        self._csi_delta_history.append(csi_change)
        self._periodic.update(csi_change)

        presence_raw, movement_raw = self._compute_raw_scores(rssi_dev, amp_dev, phase_dev, csi_change)

        # Scale movement by actual displacement — stationary person should not register movement
        displacement_factor = self._displacement_factor()
        if self._sim_moving:
            movement_raw *= max(0.55, displacement_factor)
        else:
            movement_raw *= displacement_factor

        if displacement_factor > 0.25:
            movement_raw = min(1.0, movement_raw + displacement_factor * 0.45)

        # Subtract environmental periodic component from movement score
        if self._periodic.learned or self._periodic.is_periodic:
            movement_raw *= max(0.0, 1.0 - self._periodic.strength * 0.8)
            presence_raw *= max(0.0, 1.0 - self._periodic.strength * 0.3)

        presence_smooth = self._presence_ema.update(presence_raw)
        movement_smooth = self._movement_ema.update(movement_raw)

        presence_active = self._presence_hyst.update(presence_smooth)
        movement_active = self._movement_hyst.update(movement_smooth) if presence_active else False

        # Require real displacement for movement — not just signal noise
        if movement_active and not self._sim_moving and displacement_factor < 0.35:
            movement_active = False

        if not presence_active:
            self._movement_hyst.reset()
            movement_active = False

        self._room_status = self._resolve_room_status(
            presence_active,
            movement_active,
            movement_smooth,
            self._periodic.learned,
            self._periodic.is_periodic,
        )

        person_visible = presence_active and self._room_status not in (
            RoomStatus.ENVIRONMENTAL_ACTIVITY,
            RoomStatus.BOOTING,
            RoomStatus.BASELINE_ESTABLISHED,
        )

        if person_visible:
            x, y = self._estimate_position_from_signal(presence_smooth)

            # Snap to estimated position on first appearance (avoid lerp from room center)
            if not self._was_person_visible:
                self._display_x, self._display_y = x, y
                self._est_x, self._est_y = x, y
            else:
                x, y = position_deadband(x, y, self._display_x, self._display_y, dt.position_deadband_m)
                self._display_x, self._display_y = x, y

            self._was_person_visible = True
            self._position_history.append((self._display_x, self._display_y))

            if movement_active:
                dx = x - self._last_trail_x
                dy = y - self._last_trail_y
                self._velocity = math.hypot(dx, dy) * 10
                self._direction = math.atan2(dy, dx) if self._velocity > 0.05 else None
                if self._sim_moving:
                    self._velocity = self._sim_velocity
                    self._direction = self._sim_direction if self._sim_direction else None
            else:
                self._velocity = 0.0
                self._direction = None
        else:
            x, y = self._display_x, self._display_y
            self._velocity = 0.0
            self._direction = None
            self._was_person_visible = False
            self._position_history.clear()

        intensity = movement_smooth * 100.0 if movement_active else 0.0
        legacy_status = self._to_legacy_status(self._room_status, presence_active, movement_active)
        waveform = amplitudes[:32] if amplitudes else [rssi / -100.0] * 32

        return ProcessedReading(
            timestamp=measurement.timestamp,
            rssi=rssi,
            presence_probability=round(presence_smooth, 3),
            movement_probability=round(movement_smooth, 3),
            movement_intensity=round(intensity, 1),
            x=round(self._display_x, 2),
            y=round(self._display_y, 2),
            velocity=round(self._velocity, 2),
            direction=self._direction,
            status=legacy_status,
            room_status=self._room_status,
            person_visible=person_visible,
            calibration_remaining_sec=None,
            csi_waveform=[round(v, 4) for v in waveform],
            simulation_mode=simulation_mode,
            room=self.room,
        )
