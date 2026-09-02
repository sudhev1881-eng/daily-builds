"""2D constant-velocity Kalman filter for position tracking."""

from __future__ import annotations

import numpy as np


class KalmanFilter2D:
    """
    Constant-velocity Kalman filter for (x, y) position.
    State: [x, y, vx, vy]

    Process noise uses the standard piecewise-constant white acceleration
    model (sigma_a ~ human gait acceleration), which tracks walking starts,
    stops, and turns with minimal lag. Measurement noise matches the
    decimeter-level error of calibrated CSI localization.
    """

    def __init__(
        self,
        x: float = 0.0,
        y: float = 0.0,
        dt: float = 0.1,
        accel_noise: float = 1.2,
        measurement_noise_m: float = 0.18,
    ) -> None:
        self.dt = dt
        self.x = np.array([x, y, 0.0, 0.0], dtype=float)
        self.P = np.eye(4) * 0.25
        self.F = np.array([
            [1, 0, dt, 0],
            [0, 1, 0, dt],
            [0, 0, 1, 0],
            [0, 0, 0, 1],
        ])
        self.H = np.array([
            [1, 0, 0, 0],
            [0, 1, 0, 0],
        ])
        self.R = np.eye(2) * measurement_noise_m**2

        # Q = sigma_a^2 * (Gx Gx^T + Gy Gy^T),  G = [dt^2/2, dt] per axis
        gx = np.array([dt * dt / 2, 0.0, dt, 0.0])
        gy = np.array([0.0, dt * dt / 2, 0.0, dt])
        self._q_moving = accel_noise**2 * (np.outer(gx, gx) + np.outer(gy, gy))
        # Known-stationary target: near-zero process noise lets successive
        # measurements be optimally AVERAGED (error ~ sigma/sqrt(N))
        self._q_still = np.eye(4) * 1e-6
        self.Q = self._q_moving

    def predict(self) -> None:
        self.x = self.F @ self.x
        self.P = self.F @ self.P @ self.F.T + self.Q

    def update(self, zx: float, zy: float) -> None:
        z = np.array([zx, zy])
        y = z - self.H @ self.x
        S = self.H @ self.P @ self.H.T + self.R
        K = self.P @ self.H.T @ np.linalg.inv(S)
        self.x = self.x + K @ y
        # Joseph-form covariance update: numerically stable (keeps P positive
        # semi-definite even with near-zero process noise), plus symmetrization
        ikh = np.eye(4) - K @ self.H
        self.P = ikh @ self.P @ ikh.T + K @ self.R @ K.T
        self.P = (self.P + self.P.T) / 2

    def reset(self, x: float, y: float) -> None:
        self.x = np.array([x, y, 0.0, 0.0], dtype=float)
        self.P = np.eye(4) * 0.25

    def stop(self) -> None:
        """Switch to known-stationary mode at a detected stop.

        Zeroes velocity (prevents constant-velocity overshoot), inflates
        position covariance to honest walking-tracking uncertainty so fresh
        measurements get proper weight, and switches to near-zero process
        noise so the settle window truly averages measurements."""
        self.x[2] = 0.0
        self.x[3] = 0.0
        # Rebuild P as a clean diagonal: walking cross-covariances are
        # inconsistent with the zeroed velocity and can destabilize updates
        self.P = np.diag([
            max(self.P[0, 0], 0.04),
            max(self.P[1, 1], 0.04),
            1e-4,
            1e-4,
        ])
        self.Q = self._q_still

    def resume(self) -> None:
        """Return to moving-target process noise."""
        self.Q = self._q_moving

    @property
    def position(self) -> tuple[float, float]:
        return float(self.x[0]), float(self.x[1])

    @property
    def position_std_m(self) -> float:
        """1-sigma positional uncertainty from the filter covariance."""
        return float(np.sqrt((self.P[0, 0] + self.P[1, 1]) / 2))

    @property
    def velocity(self) -> float:
        return float(np.hypot(self.x[2], self.x[3]))

    @property
    def direction(self) -> float | None:
        vx, vy = float(self.x[2]), float(self.x[3])
        if np.hypot(vx, vy) < 0.05:
            return None
        return float(np.arctan2(vy, vx))
