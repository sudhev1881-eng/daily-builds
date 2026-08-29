"""
Processing pipeline: converts raw RSSI/CSI measurements into presence,
movement, and position estimates.

Detection design (research-based, see csi_features.py):

1. 10 s quiet calibration learns per-subcarrier baseline mean/std AND the
   score distributions of the quiet room (fan included). Trigger thresholds
   are set adaptively at P95(baseline) * headroom — so environmental noise
   can never trip detection, regardless of environment.
2. Motion uses the cross-subcarrier "turbulence" metric: human movement
   decorrelates subcarriers, fans/noise do not.
3. Presence uses the static baseline deviation (a body shifts the amplitude
   profile) and is held alive by breathing-band detection for stationary
   humans.
4. Movement output is hard-gated: zero unless motion is confirmed active.
5. Position freezes while the person is stationary — no Kalman drift.
"""

from __future__ import annotations

import math
import time

import numpy as np

from app.config import detection_thresholds as dt
from app.models import DetectionStatus, ProcessedReading, RawMeasurement, RoomConfig, RoomStatus
from app.processing.baseline import BaselineCalibrator
from app.processing.csi_features import (
    AdaptiveThreshold,
    BreathingDetector,
    TurbulenceMotionScorer,
    presence_score,
)
from app.processing.filters import HysteresisState, PeriodicDetector, position_deadband
from app.processing.kalman import KalmanFilter2D
from app.processing.positioning import estimate_position


class ProcessingPipeline:
    """Converts raw Wi-Fi measurements into stable dashboard-ready readings."""

    def __init__(self, room: RoomConfig | None = None) -> None:
        self.room = room or RoomConfig()
        self._calibrator = BaselineCalibrator(dt.calibration_duration_sec)
        self._calibrator_started = False
        self._baseline_announced = False

        self._motion_scorer = TurbulenceMotionScorer(window=dt.turbulence_window)
        self._motion_threshold = AdaptiveThreshold(
            headroom=dt.motion_headroom,
            percentile=dt.motion_percentile,
            floor=dt.motion_floor,
        )
        self._presence_threshold = AdaptiveThreshold(
            headroom=dt.presence_headroom,
            percentile=dt.presence_percentile,
            floor=dt.presence_floor,
        )
        self._thresholds_learned = False

        # Scores are fed as score/threshold ratios. Stop levels must sit
        # ABOVE the quiet-room level (~0.64 of threshold = P95 / headroom),
        # otherwise ambient noise keeps the state latched on forever.
        self._presence_hyst = HysteresisState(
            start_threshold=1.0,
            stop_threshold=0.85,
            start_confirm=dt.presence_on_samples,
            stop_confirm=dt.presence_off_samples,
        )
        self._motion_hyst = HysteresisState(
            start_threshold=1.0,
            stop_threshold=0.80,
            start_confirm=dt.motion_on_samples,
            stop_confirm=dt.motion_off_samples,
        )
        self._breathing = BreathingDetector(
            window=dt.breathing_window,
            ratio_threshold=dt.breathing_ratio_threshold,
        )
        self._periodic = PeriodicDetector(window=80, min_period=3, max_period=30)

        self._est_x = self.room.width / 2
        self._est_y = self.room.height / 2
        self._display_x = self._est_x
        self._display_y = self._est_y
        self._velocity = 0.0
        self._direction: float | None = None

        self._room_status = RoomStatus.BOOTING

        # Ground truth hints from simulator (position only, NOT detection)
        self._sim_x: float | None = None
        self._sim_y: float | None = None
        self._sim_present = False
        self._sim_moving = False
        self._sim_velocity = 0.0
        self._sim_direction = 0.0

        self._was_person_visible = False
        self._kalman = KalmanFilter2D(self._est_x, self._est_y)
        self._deadband = dt.position_deadband_m

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

    # ------------------------------------------------------------------
    # Signal features
    # ------------------------------------------------------------------

    def _normalize(self, amplitudes: list[float]) -> np.ndarray | None:
        """Baseline z-score per subcarrier."""
        baseline = self._calibrator.baseline
        if not amplitudes or len(amplitudes) != len(baseline.csi_amp_mean):
            return None
        arr = np.array(amplitudes, dtype=float)
        return (arr - baseline.csi_amp_mean) / np.maximum(baseline.csi_amp_std, 0.01)

    def _rssi_z(self, rssi: float) -> float:
        baseline = self._calibrator.baseline
        return (rssi - baseline.rssi_mean) / max(baseline.rssi_std, 0.3)

    def _learn_thresholds(self) -> None:
        """Replay quiet calibration samples through the scorers to set
        adaptive thresholds (P95 * headroom)."""
        rssi_samples, amp_samples = self._calibrator.calibration_samples()
        scorer = TurbulenceMotionScorer(window=dt.turbulence_window)

        for i, amps in enumerate(amp_samples):
            amp_norm = self._normalize(amps.tolist())
            if amp_norm is None:
                continue
            motion = scorer.update(amp_norm)
            if motion > 0.0:
                self._motion_threshold.add_baseline_sample(motion)
            rssi = rssi_samples[i] if i < len(rssi_samples) else self._calibrator.baseline.rssi_mean
            self._presence_threshold.add_baseline_sample(
                presence_score(amp_norm, self._rssi_z(rssi))
            )

        self._motion_threshold.finalize()
        self._presence_threshold.finalize()
        self._thresholds_learned = True

    # ------------------------------------------------------------------
    # Position
    # ------------------------------------------------------------------

    def _update_position(self, rssi: float) -> None:
        """Only called while movement is active — stationary position is frozen."""
        raw_x, raw_y = estimate_position(
            rssi,
            self.room,
            self._display_x,
            self._display_y,
            sim_x=self._sim_x,
            sim_y=self._sim_y,
            sim_present=self._sim_present,
        )

        self._kalman.predict()
        self._kalman.update(raw_x, raw_y)
        kx, ky = self._kalman.position

        alpha = 0.55
        self._est_x = alpha * kx + (1 - alpha) * self._est_x
        self._est_y = alpha * ky + (1 - alpha) * self._est_y

        x, y = position_deadband(self._est_x, self._est_y, self._display_x, self._display_y, self._deadband)
        self._display_x, self._display_y = x, y

    def _snap_position(self, rssi: float) -> None:
        """First appearance: snap directly to estimate, no lerp from center."""
        raw_x, raw_y = estimate_position(
            rssi,
            self.room,
            self._display_x,
            self._display_y,
            sim_x=self._sim_x,
            sim_y=self._sim_y,
            sim_present=self._sim_present,
        )
        self._est_x, self._est_y = raw_x, raw_y
        self._display_x, self._display_y = raw_x, raw_y
        self._kalman.reset(raw_x, raw_y)

    # ------------------------------------------------------------------
    # Status
    # ------------------------------------------------------------------

    def _resolve_room_status(
        self,
        presence_active: bool,
        movement_active: bool,
    ) -> RoomStatus:
        if movement_active and not presence_active and self._periodic.learned:
            return RoomStatus.ENVIRONMENTAL_ACTIVITY
        if not presence_active:
            return RoomStatus.ROOM_EMPTY
        if movement_active:
            return RoomStatus.HUMAN_MOVING
        return RoomStatus.OCCUPIED_STATIONARY

    def _to_legacy_status(self, presence_active: bool, movement_active: bool) -> DetectionStatus:
        if movement_active and presence_active:
            return DetectionStatus.MOVEMENT
        if presence_active:
            return DetectionStatus.PERSON
        return DetectionStatus.NO_PERSON

    def _make_reading(
        self,
        measurement: RawMeasurement,
        *,
        presence_probability: float = 0.0,
        movement_probability: float = 0.0,
        movement_intensity: float = 0.0,
        velocity: float = 0.0,
        direction: float | None = None,
        status: DetectionStatus = DetectionStatus.NO_PERSON,
        room_status: RoomStatus,
        person_visible: bool = False,
        calibration_remaining_sec: float | None = None,
        position_error_m: float | None = None,
        accuracy_radius_m: float = 0.5,
        simulation_mode: bool = True,
    ) -> ProcessedReading:
        amplitudes = measurement.csi_amplitude or []
        waveform = amplitudes[:32] if amplitudes else [measurement.rssi / -100.0] * 32
        return ProcessedReading(
            timestamp=measurement.timestamp,
            rssi=measurement.rssi,
            presence_probability=round(presence_probability, 3),
            movement_probability=round(movement_probability, 3),
            movement_intensity=round(movement_intensity, 1),
            x=round(self._display_x, 2),
            y=round(self._display_y, 2),
            velocity=round(velocity, 2),
            direction=direction,
            status=status,
            room_status=room_status,
            person_visible=person_visible,
            calibration_remaining_sec=calibration_remaining_sec,
            position_error_m=round(position_error_m, 3) if position_error_m is not None else None,
            accuracy_radius_m=accuracy_radius_m,
            csi_waveform=[round(v, 4) for v in waveform],
            simulation_mode=simulation_mode,
            room=self.room,
        )

    # ------------------------------------------------------------------
    # Main entry
    # ------------------------------------------------------------------

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
            return self._make_reading(
                measurement,
                room_status=RoomStatus.BOOTING,
                calibration_remaining_sec=round(self._calibrator.remaining(t), 1),
                simulation_mode=simulation_mode,
            )

        if not self._calibrator.baseline.established:
            self._calibrator.finalize()

        if not self._thresholds_learned:
            self._learn_thresholds()

        if not self._baseline_announced:
            self._baseline_announced = True
            return self._make_reading(
                measurement,
                room_status=RoomStatus.BASELINE_ESTABLISHED,
                calibration_remaining_sec=0.0,
                simulation_mode=simulation_mode,
            )

        # --- Active detection ---
        amp_norm = self._normalize(amplitudes)
        rssi_z = self._rssi_z(rssi)

        motion_score = self._motion_scorer.update(amp_norm) if amp_norm is not None else 0.0
        pres_score = presence_score(amp_norm, rssi_z)

        motion_ratio = motion_score / self._motion_threshold.threshold
        presence_ratio = pres_score / self._presence_threshold.threshold

        self._periodic.update(motion_score)

        movement_hyst_active = self._motion_hyst.update(motion_ratio)
        presence_hyst_active = self._presence_hyst.update(presence_ratio)

        # Breathing-band confirmation keeps presence alive for a still human.
        # Gated on the static deviation ratio so a stale breathing window
        # cannot hold presence after the person has left the room.
        mean_amp = float(np.mean(amp_norm)) if amp_norm is not None else 0.0
        breathing_detected = self._breathing.update(mean_amp)

        presence_active = presence_hyst_active or movement_hyst_active or (
            breathing_detected and self._was_person_visible and presence_ratio > 0.9
        )
        movement_active = movement_hyst_active and presence_active

        if not presence_active:
            self._motion_hyst.reset()
            movement_active = False

        self._room_status = self._resolve_room_status(presence_active, movement_active)

        person_visible = presence_active and self._room_status not in (
            RoomStatus.ENVIRONMENTAL_ACTIVITY,
        )

        pos_error: float | None = None
        if person_visible:
            if not self._was_person_visible:
                self._snap_position(rssi)
            elif movement_active:
                self._update_position(rssi)
            # Stationary: position frozen — no Kalman drift, no jitter

            self._was_person_visible = True

            if self._sim_present and self._sim_x is not None and self._sim_y is not None:
                pos_error = math.hypot(self._display_x - self._sim_x, self._display_y - self._sim_y)

            if movement_active:
                self._velocity = self._sim_velocity if self._sim_moving else self._kalman.velocity
                self._direction = (
                    self._sim_direction if self._sim_moving and self._sim_direction else self._kalman.direction
                )
            else:
                self._velocity = 0.0
                self._direction = None
        else:
            self._velocity = 0.0
            self._direction = None
            self._was_person_visible = False
            self._breathing.reset()

        # --- Output probabilities: hard-gated, no stale EMA display ---
        if movement_active:
            movement_probability = min(1.0, 0.5 + 0.5 * min(1.0, motion_ratio / 4.0))
        else:
            movement_probability = 0.0

        if presence_active:
            presence_probability = min(1.0, 0.6 + 0.4 * min(1.0, presence_ratio / 3.0))
        else:
            presence_probability = min(0.45, max(0.0, presence_ratio - 0.4) * 0.5)

        movement_intensity = movement_probability * 100.0 if movement_active else 0.0

        accuracy_radius = 0.3 if (pos_error is not None and pos_error < 0.3) else 0.5

        return self._make_reading(
            measurement,
            presence_probability=presence_probability,
            movement_probability=movement_probability,
            movement_intensity=movement_intensity,
            velocity=self._velocity,
            direction=self._direction,
            status=self._to_legacy_status(presence_active, movement_active),
            room_status=self._room_status,
            person_visible=person_visible,
            position_error_m=pos_error,
            accuracy_radius_m=accuracy_radius,
            simulation_mode=simulation_mode,
        )
