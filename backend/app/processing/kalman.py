"""Simple 2D Kalman filter for position smoothing with velocity estimation."""

from __future__ import annotations

import numpy as np


class KalmanFilter2D:
    """
    Constant-velocity Kalman filter for (x, y) position.
    State: [x, y, vx, vy]
    """

    def __init__(self, x: float = 0.0, y: float = 0.0) -> None:
        self.dt = 0.1
        self.x = np.array([x, y, 0.0, 0.0], dtype=float)
        self.P = np.eye(4) * 1.0
        self.F = np.array([
            [1, 0, self.dt, 0],
            [0, 1, 0, self.dt],
            [0, 0, 1, 0],
            [0, 0, 0, 1],
        ])
        self.H = np.array([
            [1, 0, 0, 0],
            [0, 1, 0, 0],
        ])
        self.R = np.eye(2) * 0.08   # measurement noise (meters^2)
        self.Q = np.eye(4) * 0.01   # process noise

    def predict(self) -> None:
        self.x = self.F @ self.x
        self.P = self.F @ self.P @ self.F.T + self.Q

    def update(self, zx: float, zy: float) -> None:
        z = np.array([zx, zy])
        y = z - self.H @ self.x
        S = self.H @ self.P @ self.H.T + self.R
        K = self.P @ self.H.T @ np.linalg.inv(S)
        self.x = self.x + K @ y
        self.P = (np.eye(4) - K @ self.H) @ self.P

    def reset(self, x: float, y: float) -> None:
        self.x = np.array([x, y, 0.0, 0.0], dtype=float)
        self.P = np.eye(4) * 1.0

    @property
    def position(self) -> tuple[float, float]:
        return float(self.x[0]), float(self.x[1])

    @property
    def velocity(self) -> float:
        return float(np.hypot(self.x[2], self.x[3]))

    @property
    def direction(self) -> float | None:
        vx, vy = float(self.x[2]), float(self.x[3])
        if np.hypot(vx, vy) < 0.05:
            return None
        return float(np.arctan2(vy, vx))
