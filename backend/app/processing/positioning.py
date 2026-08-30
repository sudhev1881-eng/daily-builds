"""
Position estimation from Wi-Fi RSSI using two fixed anchors (router + receiver).

For real hardware: calibrate RSSI_0 and path_loss_exponent per environment.
"""

from __future__ import annotations

import math

from app.models import RoomConfig


def rssi_to_distance(rssi: float, rssi_0: float = -40.0, n: float = 2.4) -> float:
    """Convert RSSI (dBm) to estimated distance (meters) via log-distance path loss."""
    return 10 ** ((rssi_0 - rssi) / (10.0 * n))


def bilaterate_2d(
    rssi_a: float,
    rssi_b: float,
    ax: float,
    ay: float,
    bx: float,
    by: float,
    rssi_0: float = -40.0,
    n: float = 2.4,
) -> tuple[float, float]:
    """
    Estimate position from two anchor RSSI readings.
    Uses circle intersection with weighted fallback to centroid.
    """
    da = max(0.5, rssi_to_distance(rssi_a, rssi_0, n))
    db = max(0.5, rssi_to_distance(rssi_b, rssi_0, n))

    # Distance between anchors
    d_ab = math.hypot(bx - ax, by - ay)
    if d_ab < 0.01:
        return (ax + bx) / 2, (ay + by) / 2

    # Circle-circle intersection along the line between anchors
    a = (da * da - db * db + d_ab * d_ab) / (2 * d_ab)
    h_sq = da * da - a * a

    mid_x = ax + a * (bx - ax) / d_ab
    mid_y = ay + a * (by - ay) / d_ab

    if h_sq <= 0:
        # Circles don't intersect — weighted centroid fallback
        wa = 1.0 / da
        wb = 1.0 / db
        return (wa * ax + wb * bx) / (wa + wb), (wa * ay + wb * by) / (wa + wb)

    h = math.sqrt(h_sq)
    # Perpendicular offset — pick the point closer to room center heuristic
    perp_x = -h * (by - ay) / d_ab
    perp_y = h * (bx - ax) / d_ab

    p1 = (mid_x + perp_x, mid_y + perp_y)
    p2 = (mid_x - perp_x, mid_y - perp_y)
    # Prefer point with smaller y if room origin is bottom-left (typical)
    return p1 if p1[1] >= p2[1] else p2


def simulate_localization_measurement(
    true_x: float,
    true_y: float,
    room: RoomConfig,
    noise_std_m: float = 0.18,
) -> tuple[float, float]:
    """
    Emulate one measurement from a calibrated CSI localization system.

    Published CSI-based localization (SpotFi-class and newer learned models)
    achieves decimeter-level per-measurement error; the Kalman tracker then
    smooths successive measurements to below that.
    """
    import random

    x = true_x + random.gauss(0, noise_std_m)
    y = true_y + random.gauss(0, noise_std_m)
    x = max(0.2, min(room.width - 0.2, x))
    y = max(0.2, min(room.height - 0.2, y))
    return x, y


def estimate_position(
    rssi: float,
    room: RoomConfig,
    prior_x: float,
    prior_y: float,
    sim_x: float | None = None,
    sim_y: float | None = None,
    sim_present: bool = False,
) -> tuple[float, float]:
    """
    Fuse RSSI bilateration with optional simulator ground truth.
    In simulation: 85% ground truth + 15% RSSI estimate for realistic error.
  Hardware: 100% RSSI estimate smoothed toward prior.
    """
    rx, ry = room.router.x, room.router.y
    sx, sy = room.receiver.x, room.receiver.y

    # Router and receiver see slightly different RSSI due to body shadowing
    rssi_router = rssi
    rssi_receiver = rssi + 2.0  # receiver typically slightly stronger path

    x_rssi, y_rssi = bilaterate_2d(rssi_router, rssi_receiver, rx, ry, sx, sy)

    if sim_present and sim_x is not None and sim_y is not None:
        x = 0.85 * sim_x + 0.15 * x_rssi
        y = 0.85 * sim_y + 0.15 * y_rssi
    else:
        # Hardware: blend RSSI with prior for stability
        x = 0.6 * x_rssi + 0.4 * prior_x
        y = 0.6 * y_rssi + 0.4 * prior_y

    x = max(0.3, min(room.width - 0.3, x))
    y = max(0.3, min(room.height - 0.3, y))
    return x, y
