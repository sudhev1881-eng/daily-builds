"""
Research-based CSI feature extraction for human presence and motion detection.

Techniques (from published Wi-Fi sensing systems):

MOTION — "turbulence" metric:
  Per packet, take the standard deviation of baseline-normalized amplitudes
  ACROSS subcarriers ("turbulence"). Human motion rotates per-subcarrier
  multipath phases at different rates, so turbulence fluctuates strongly over
  time. The motion score is the std of turbulence over a short sliding window.
  Fans and thermal noise produce stable or periodic turbulence -> low score.

ADAPTIVE THRESHOLDS:
  Fixed thresholds fail across environments. Instead, score the quiet
  calibration period (fan included), then set the trigger at the 95th
  percentile of baseline scores times a headroom factor.

PRESENCE — baseline deviation:
  A stationary body statically shifts the amplitude profile. Score is the mean
  absolute z-score across subcarriers plus the RSSI z-score.

BREATHING — spectral band energy:
  Chest displacement (~8 mm at 0.2-0.5 Hz) modulates the reflected path
  length. An FFT of the mean normalized amplitude over ~20 s shows a peak in
  the breathing band, confirming a living, stationary human.
"""

from __future__ import annotations

from collections import deque

import numpy as np


class TurbulenceMotionScorer:
    """Combined motion metric:

    1. Frame differential — mean |delta z-score| between consecutive packets.
       Walking rotates per-subcarrier multipath phases by many radians per
       frame, producing large decorrelated jumps. A stationary (breathing)
       body changes phase by <0.2 rad/frame; a fan is learned into the
       baseline std, so both stay near the quiet-room level.
    2. Turbulence variability — std over a sliding window of the per-packet
       cross-subcarrier std. Captures slower body-position changes.

    Output is EMA-smoothed; hysteresis on top handles on/off decisions.
    """

    def __init__(self, window: int = 15, ema_alpha: float = 0.35) -> None:
        self._turbulence: deque[float] = deque(maxlen=window)
        self._prev: np.ndarray | None = None
        self._ema_alpha = ema_alpha
        self._ema: float | None = None

    def update(self, amp_norm: np.ndarray) -> float:
        self._turbulence.append(float(np.std(amp_norm)))

        diff_score = 0.0
        if self._prev is not None and self._prev.shape == amp_norm.shape:
            diff_score = float(np.mean(np.abs(amp_norm - self._prev)))
        self._prev = amp_norm.copy()

        # Frame diff dominates: walking decorrelates phases within one frame,
        # while breathing (~0.3 Hz) changes them too slowly to register here.
        window_std = float(np.std(self._turbulence)) if len(self._turbulence) >= 5 else 0.0
        raw = diff_score + 0.5 * window_std

        if self._ema is None:
            self._ema = raw
        else:
            self._ema = self._ema_alpha * raw + (1 - self._ema_alpha) * self._ema
        return self._ema

    def reset(self) -> None:
        self._turbulence.clear()
        self._prev = None
        self._ema = None


class AdaptiveThreshold:
    """Learn a detection threshold from quiet-period score distribution."""

    def __init__(self, headroom: float = 1.4, percentile: float = 95.0, floor: float = 0.02) -> None:
        self.headroom = headroom
        self.percentile = percentile
        self.floor = floor
        self._samples: list[float] = []
        self.threshold = floor

    def add_baseline_sample(self, score: float) -> None:
        self._samples.append(score)

    def finalize(self) -> float:
        if self._samples:
            p = float(np.percentile(self._samples, self.percentile))
            self.threshold = max(p * self.headroom, self.floor)
        self._samples.clear()
        return self.threshold


def presence_score(amp_norm: np.ndarray | None, rssi_z: float) -> float:
    """Mean absolute z-score across subcarriers + RSSI deviation."""
    amp_component = float(np.mean(np.abs(amp_norm))) if amp_norm is not None and amp_norm.size else 0.0
    return amp_component + 0.35 * min(abs(rssi_z), 6.0)


class BreathingDetector:
    """Detect the 0.15-0.6 Hz breathing band in the mean CSI amplitude."""

    def __init__(
        self,
        sample_rate_hz: float = 10.0,
        window: int = 200,
        band_low_hz: float = 0.15,
        band_high_hz: float = 0.6,
        ratio_threshold: float = 0.42,
    ) -> None:
        self.sample_rate_hz = sample_rate_hz
        self.window = window
        self.band_low_hz = band_low_hz
        self.band_high_hz = band_high_hz
        self.ratio_threshold = ratio_threshold
        self._history: deque[float] = deque(maxlen=window)
        self.band_ratio = 0.0

    @property
    def ready(self) -> bool:
        return len(self._history) >= self.window

    def update(self, mean_amp: float) -> bool:
        """Returns True when a breathing-band peak dominates the spectrum."""
        self._history.append(mean_amp)
        if not self.ready:
            self.band_ratio = 0.0
            return False

        data = np.array(self._history, dtype=float)
        data = data - np.mean(data)
        data = data * np.hanning(len(data))

        spectrum = np.abs(np.fft.rfft(data)) ** 2
        freqs = np.fft.rfftfreq(len(data), d=1.0 / self.sample_rate_hz)

        # Exclude DC / ultra-slow drift below 0.08 Hz
        valid = freqs > 0.08
        band = valid & (freqs >= self.band_low_hz) & (freqs <= self.band_high_hz)

        total = float(np.sum(spectrum[valid]))
        if total <= 1e-12:
            self.band_ratio = 0.0
            return False

        self.band_ratio = float(np.sum(spectrum[band])) / total
        return self.band_ratio > self.ratio_threshold

    def reset(self) -> None:
        self._history.clear()
        self.band_ratio = 0.0
