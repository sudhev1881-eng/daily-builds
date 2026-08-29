"""Temporal filtering utilities for stable movement detection."""

from __future__ import annotations

import math
from collections import deque


class ExponentialMovingAverage:
    """Exponential moving average filter."""

    def __init__(self, alpha: float = 0.15) -> None:
        self.alpha = alpha
        self._value: float | None = None

    def update(self, sample: float) -> float:
        if self._value is None:
            self._value = sample
        else:
            self._value = self.alpha * sample + (1 - self.alpha) * self._value
        return self._value

    @property
    def value(self) -> float:
        return self._value or 0.0

    def reset(self) -> None:
        self._value = None


class HysteresisState:
    """Hysteresis with separate start/stop thresholds and debounce."""

    def __init__(
        self,
        start_threshold: float,
        stop_threshold: float,
        start_confirm: int = 15,
        stop_confirm: int = 30,
    ) -> None:
        self.start_threshold = start_threshold
        self.stop_threshold = stop_threshold
        self.start_confirm = start_confirm
        self.stop_confirm = stop_confirm
        self.active = False
        self._above_count = 0
        self._below_count = 0

    def update(self, score: float) -> bool:
        if self.active:
            if score < self.stop_threshold:
                self._below_count += 1
                self._above_count = 0
                if self._below_count >= self.stop_confirm:
                    self.active = False
                    self._below_count = 0
            else:
                self._below_count = 0
        else:
            if score > self.start_threshold:
                self._above_count += 1
                self._below_count = 0
                if self._above_count >= self.start_confirm:
                    self.active = True
                    self._above_count = 0
            else:
                self._above_count = 0
        return self.active

    def reset(self) -> None:
        self.active = False
        self._above_count = 0
        self._below_count = 0


class PeriodicDetector:
    """Detect stable periodic environmental patterns (e.g. fan)."""

    def __init__(self, window: int = 80, min_period: int = 8, max_period: int = 40) -> None:
        self._history: deque[float] = deque(maxlen=window)
        self.min_period = min_period
        self.max_period = max_period
        self.is_periodic = False
        self.period: int | None = None
        self.strength = 0.0
        self._learned = False

    def update(self, value: float) -> None:
        self._history.append(value)
        if len(self._history) < self.max_period * 3:
            return

        data = list(self._history)
        n = len(data)
        mean = sum(data) / n
        var = sum((x - mean) ** 2 for x in data) / n
        if var < 1e-8:
            return

        best_corr = 0.0
        best_lag = 0
        for lag in range(self.min_period, self.max_period + 1):
            if lag >= n:
                break
            num = sum((data[i] - mean) * (data[i - lag] - mean) for i in range(lag, n))
            denom = (n - lag) * var
            corr = num / denom if denom > 0 else 0
            if corr > best_corr:
                best_corr = corr
                best_lag = lag

        if best_corr > 0.55:
            self.is_periodic = True
            self.period = best_lag
            self.strength = best_corr
            if best_corr > 0.7 and len(self._history) >= self.max_period * 4:
                self._learned = True
        elif self._learned:
            # Keep learned state unless correlation drops significantly
            if best_corr < 0.3:
                self._learned = False
                self.is_periodic = False

    @property
    def learned(self) -> bool:
        return self._learned

    def reset(self) -> None:
        self._history.clear()
        self.is_periodic = False
        self.period = None
        self.strength = 0.0
        self._learned = False


def low_pass(value: float, prev: float, alpha: float) -> float:
    return alpha * value + (1 - alpha) * prev


def position_deadband(
    new_x: float,
    new_y: float,
    prev_x: float,
    prev_y: float,
    deadband: float,
) -> tuple[float, float]:
    """Suppress sub-deadband position jitter."""
    dx = new_x - prev_x
    dy = new_y - prev_y
    if math.hypot(dx, dy) < deadband:
        return prev_x, prev_y
    return new_x, new_y
