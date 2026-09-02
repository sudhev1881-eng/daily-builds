"""Baseline calibration for Wi-Fi sensing signals."""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np


@dataclass
class SignalBaseline:
    """Stored baseline statistics from calibration period."""

    rssi_mean: float = -50.0
    rssi_std: float = 1.0
    csi_amp_mean: np.ndarray = field(default_factory=lambda: np.zeros(64))
    csi_amp_std: np.ndarray = field(default_factory=lambda: np.ones(64))
    csi_phase_mean: np.ndarray = field(default_factory=lambda: np.zeros(64))
    noise_level: float = 0.05
    signal_variance: float = 0.01
    sample_count: int = 0
    established: bool = False

    def deviation_score(
        self,
        rssi: float,
        csi_amp: list[float] | None,
        csi_phase: list[float] | None,
    ) -> tuple[float, float, float]:
        """
        Compare current signal against baseline.
        Returns (rssi_dev, csi_amp_dev, csi_phase_dev) as normalized scores.
        """
        rssi_dev = abs(rssi - self.rssi_mean) / max(self.rssi_std, 0.5)

        amp_dev = 0.0
        if csi_amp and len(csi_amp) == len(self.csi_amp_mean):
            arr = np.array(csi_amp)
            diff = np.abs(arr - self.csi_amp_mean)
            amp_dev = float(np.mean(diff / np.maximum(self.csi_amp_std, 0.01)))

        phase_dev = 0.0
        if csi_phase and len(csi_phase) == len(self.csi_phase_mean):
            arr = np.array(csi_phase)
            # Circular phase difference
            diff = np.abs(np.arctan2(np.sin(arr - self.csi_phase_mean), np.cos(arr - self.csi_phase_mean)))
            phase_dev = float(np.mean(diff))

        return rssi_dev, amp_dev, phase_dev


class BaselineCalibrator:
    """Collects samples during boot period and computes baseline."""

    def __init__(self, duration_sec: float = 10.0) -> None:
        self.duration_sec = duration_sec
        self._rssi_samples: list[float] = []
        self._csi_amp_samples: list[np.ndarray] = []
        self._csi_phase_samples: list[np.ndarray] = []
        self.baseline = SignalBaseline()
        self._start_time: float | None = None

    def start(self, t: float) -> None:
        self._start_time = t
        self._rssi_samples.clear()
        self._csi_amp_samples.clear()
        self._csi_phase_samples.clear()
        self.baseline = SignalBaseline()

    def add_sample(
        self,
        rssi: float,
        csi_amp: list[float] | None,
        csi_phase: list[float] | None,
    ) -> None:
        self._rssi_samples.append(rssi)
        if csi_amp:
            self._csi_amp_samples.append(np.array(csi_amp))
        if csi_phase:
            self._csi_phase_samples.append(np.array(csi_phase))

    def remaining(self, t: float) -> float:
        if self._start_time is None:
            return self.duration_sec
        elapsed = t - self._start_time
        return max(0.0, self.duration_sec - elapsed)

    def is_calibrating(self, t: float) -> bool:
        if self._start_time is None:
            return True
        return (t - self._start_time) < self.duration_sec

    def calibration_samples(self) -> tuple[list[float], list[np.ndarray]]:
        """Stored quiet-period samples, for adaptive threshold learning."""
        return self._rssi_samples, self._csi_amp_samples

    @property
    def sample_count(self) -> int:
        return len(self._rssi_samples)

    def validate_stationarity(self) -> tuple[bool, float]:
        """Check the calibration window was actually quiet.

        Splits the window in half and compares the mean CSI amplitude profile
        and RSSI level between halves. A person entering / moving during
        calibration shifts the second half away from the first, corrupting
        the baseline. Returns (ok, quality in 0..1).
        """
        if len(self._csi_amp_samples) < 20:
            return False, 0.0

        stacked = np.stack(self._csi_amp_samples)
        half = len(stacked) // 2
        first, second = stacked[:half], stacked[half:]

        per_sub_std = np.maximum(np.std(stacked, axis=0), 0.01)
        profile_shift = float(
            np.mean(np.abs(np.mean(second, axis=0) - np.mean(first, axis=0)) / per_sub_std)
        )

        rssi = np.array(self._rssi_samples, dtype=float)
        rssi_std = max(float(np.std(rssi)), 0.3)
        rssi_shift = abs(float(np.mean(rssi[len(rssi) // 2:]) - np.mean(rssi[: len(rssi) // 2]))) / rssi_std

        # Quiet room: halves agree within a fraction of the noise std.
        # A person entering shifts the profile by multiples of it.
        score = profile_shift + 0.5 * rssi_shift
        quality = float(max(0.0, min(1.0, 1.0 - score / 1.5)))
        return score < 0.75, quality

    def finalize(self) -> SignalBaseline:
        n = len(self._rssi_samples)
        if n == 0:
            self.baseline.established = True
            return self.baseline

        # Robust statistics: median / MAD resist transient outliers
        # (door slam, RF burst) that would inflate a mean/std baseline.
        rssi_arr = np.array(self._rssi_samples)
        rssi_median = float(np.median(rssi_arr))
        rssi_mad_std = float(1.4826 * np.median(np.abs(rssi_arr - rssi_median)))
        self.baseline.rssi_mean = rssi_median
        self.baseline.rssi_std = float(max(rssi_mad_std, np.std(rssi_arr) * 0.5, 0.3))
        self.baseline.signal_variance = float(np.var(rssi_arr))
        self.baseline.noise_level = float(np.std(rssi_arr))
        self.baseline.sample_count = n

        if self._csi_amp_samples:
            stacked = np.stack(self._csi_amp_samples)
            median = np.median(stacked, axis=0)
            mad_std = 1.4826 * np.median(np.abs(stacked - median), axis=0)
            self.baseline.csi_amp_mean = median
            # Use the larger of MAD-std and classic std so periodic
            # environmental swings (fans) stay fully inside the baseline.
            self.baseline.csi_amp_std = np.maximum(
                np.maximum(mad_std, np.std(stacked, axis=0)), 0.01
            )

        if self._csi_phase_samples:
            stacked = np.stack(self._csi_phase_samples)
            # Circular mean for phase
            self.baseline.csi_phase_mean = np.arctan2(
                np.mean(np.sin(stacked), axis=0),
                np.mean(np.cos(stacked), axis=0),
            )

        self.baseline.established = True
        return self.baseline
