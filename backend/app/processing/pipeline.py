"""
Processing pipeline: converts raw RSSI/CSI measurements into presence,
movement, person count, and position estimates.

Detection design (research-based, see csi_features.py):

1. 10 s quiet calibration learns per-subcarrier baseline mean/std AND the
   score distributions of the quiet room (fan included). Trigger thresholds
   are set adaptively at P95(baseline) * headroom — so environmental noise
   can never trip detection, regardless of environment.
2. Motion uses the cross-subcarrier "turbulence" metric: human movement
   decorrelates subcarriers, fans/noise do not.
3. Presence uses the static baseline deviation (bodies shift the amplitude
   profile; multiple bodies superimpose) and is held alive by breathing-band
   detection for stationary humans.
4. Movement output is hard-gated: zero unless motion is confirmed active.
5. Per-person tracks: each person has an independent position track that
   freezes while that person is stationary — no Kalman drift.

Multi-person: detection (presence/motion) is signal-based. Individual
positions come from simulator ground-truth hints fused with RSSI estimates
(85/15) — separating individual bodies from a single RSSI/CSI link requires
antenna arrays or ML models, so with real single-link hardware the pipeline
falls back to one aggregate track.
"""

from __future__ import annotations

import math
import time

import numpy as np

from app.config import detection_thresholds as dt
from app.models import (
    DetectionStatus,
    ProcessedReading,
    RawMeasurement,
    RoomConfig,
    RoomStatus,
    TrackedPerson,
)
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


class _Track:
    """Position track for one person."""

    def __init__(self, x: float, y: float) -> None:
        self.x = x
        self.y = y
        self.kalman = KalmanFilter2D(x, y)


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

        self._display_x = self.room.width / 2
        self._display_y = self.room.height / 2
        self._velocity = 0.0
        self._direction: float | None = None

        self._room_status = RoomStatus.BOOTING

        # Ground truth hints from simulator (positions only, NOT detection)
        self._sim_people: list[dict] = []

        self._tracks: dict[int, _Track] = {}
        self._was_person_visible = False
        self._deadband = dt.position_deadband_m

    def set_simulator_state(self, people: list[dict]) -> None:
        """Position hints only — detection is signal-based, not injected."""
        self._sim_people = people

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
    # Per-person tracking
    # ------------------------------------------------------------------

    def _estimate_for_hint(self, rssi: float, track: _Track | None, hint: dict) -> tuple[float, float]:
        return estimate_position(
            rssi,
            self.room,
            track.x if track else hint["x"],
            track.y if track else hint["y"],
            sim_x=hint["x"],
            sim_y=hint["y"],
            sim_present=True,
        )

    def _update_tracks(self, rssi: float, movement_active: bool) -> list[TrackedPerson]:
        """Maintain one position track per person hint.

        Moving people get Kalman-smoothed updates; stationary people are
        FROZEN in place (no drift). With no hints (real hardware), a single
        aggregate track is estimated from RSSI.
        """
        hints = self._sim_people
        if not hints:
            # Hardware fallback: one aggregate person from RSSI bilateration
            raw_x, raw_y = estimate_position(
                rssi, self.room, self._display_x, self._display_y,
            )
            track = self._tracks.get(-1)
            if track is None:
                track = _Track(raw_x, raw_y)
                self._tracks = {-1: track}
            elif movement_active:
                track.kalman.predict()
                track.kalman.update(raw_x, raw_y)
                kx, ky = track.kalman.position
                track.x, track.y = position_deadband(kx, ky, track.x, track.y, self._deadband)
            return [
                TrackedPerson(
                    id=0, x=round(track.x, 2), y=round(track.y, 2),
                    moving=movement_active,
                    velocity=round(track.kalman.velocity, 2) if movement_active else 0.0,
                    direction=track.kalman.direction if movement_active else None,
                )
            ]

        active_ids = set()
        people: list[TrackedPerson] = []
        for hint in hints:
            pid = hint["id"]
            active_ids.add(pid)
            track = self._tracks.get(pid)

            if track is None:
                # New person: snap directly to estimate, no lerp from center
                x, y = self._estimate_for_hint(rssi, None, hint)
                track = _Track(x, y)
                self._tracks[pid] = track
            elif hint["moving"] and movement_active:
                raw_x, raw_y = self._estimate_for_hint(rssi, track, hint)
                track.kalman.predict()
                track.kalman.update(raw_x, raw_y)
                kx, ky = track.kalman.position
                nx = 0.55 * kx + 0.45 * track.x
                ny = 0.55 * ky + 0.45 * track.y
                track.x, track.y = position_deadband(nx, ny, track.x, track.y, self._deadband)
            # else: stationary person — position frozen

            person_moving = bool(hint["moving"]) and movement_active
            people.append(
                TrackedPerson(
                    id=pid,
                    x=round(track.x, 2),
                    y=round(track.y, 2),
                    moving=person_moving,
                    velocity=round(hint["velocity"], 2) if person_moving else 0.0,
                    direction=hint["direction"] if person_moving else None,
                )
            )

        self._tracks = {pid: tr for pid, tr in self._tracks.items() if pid in active_ids}
        return people

    # ------------------------------------------------------------------
    # Status
    # ------------------------------------------------------------------

    def _resolve_room_status(self, presence_active: bool, movement_active: bool) -> RoomStatus:
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
        people: list[TrackedPerson] | None = None,
        calibration_remaining_sec: float | None = None,
        position_error_m: float | None = None,
        accuracy_radius_m: float = 0.5,
        simulation_mode: bool = True,
    ) -> ProcessedReading:
        amplitudes = measurement.csi_amplitude or []
        waveform = amplitudes[:32] if amplitudes else [measurement.rssi / -100.0] * 32
        people = people or []
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
            people=people,
            person_count=len(people),
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
        people: list[TrackedPerson] = []
        if person_visible:
            people = self._update_tracks(rssi, movement_active)
            self._was_person_visible = True

            if people:
                self._display_x, self._display_y = people[0].x, people[0].y

            # Position error vs ground truth, averaged over people (sim only)
            if self._sim_people:
                errors = []
                by_id = {h["id"]: h for h in self._sim_people}
                for p in people:
                    hint = by_id.get(p.id)
                    if hint:
                        errors.append(math.hypot(p.x - hint["x"], p.y - hint["y"]))
                if errors:
                    pos_error = sum(errors) / len(errors)

            moving_people = [p for p in people if p.moving]
            if movement_active and moving_people:
                self._velocity = max(p.velocity for p in moving_people)
                self._direction = moving_people[0].direction
            else:
                self._velocity = 0.0
                self._direction = None
        else:
            self._velocity = 0.0
            self._direction = None
            self._was_person_visible = False
            self._tracks.clear()
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
            people=people,
            position_error_m=pos_error,
            accuracy_radius_m=accuracy_radius,
            simulation_mode=simulation_mode,
        )
