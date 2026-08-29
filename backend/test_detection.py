"""
End-to-end detection accuracy test.

Drives the simulator + pipeline through a deterministic scenario with
synthetic time and asserts correct detection at every phase:

  0-10 s   calibration (empty room, fan running)
  10-35 s  empty room + fan       -> ROOM EMPTY, zero movement
  35-45 s  person enters, walking -> HUMAN MOVING within 2 s
  45-80 s  person stationary      -> OCCUPIED - STATIONARY, movement -> 0,
                                     position frozen, presence held
  80-88 s  person walks again     -> HUMAN MOVING again
  88-96 s  person leaves          -> ROOM EMPTY within ~6 s of exit

Run:  cd backend && python test_detection.py
"""

from __future__ import annotations

import math
import sys
from datetime import datetime, timezone

import app.processing.pipeline as pipeline_module
from app.models import RawMeasurement, RoomStatus
from app.sensors.simulator import WiFiSimulator


class FakeClock:
    def __init__(self, start: float = 1_000_000.0) -> None:
        self.t = start

    def time(self) -> float:
        return self.t


clock = FakeClock()
pipeline_module.time = clock  # type: ignore[assignment]

sim = WiFiSimulator()
pipe = pipeline_module.ProcessingPipeline(sim.room)

DT = 0.1
failures: list[str] = []


def step():
    clock.t += DT
    t = clock.t
    rssi = sim._compute_rssi(t)
    amps, phases = sim._generate_csi(t)
    m = RawMeasurement(
        timestamp=datetime.now(timezone.utc),
        rssi=rssi,
        csi_amplitude=amps,
        csi_phase=phases,
    )
    if not pipe.is_calibrating:
        pipe.set_simulator_state(
            sim.person_x, sim.person_y, sim.person_present,
            sim.person_moving, sim.velocity, sim.direction,
        )
    return pipe.process(m)


def run_phase(seconds: float, walk_to: tuple[float, float] | None = None, speed: float = 0.9):
    readings = []
    n = round(seconds / DT)
    for _ in range(n):
        if walk_to is not None:
            dx = walk_to[0] - sim.person_x
            dy = walk_to[1] - sim.person_y
            dist = math.hypot(dx, dy)
            if dist > 0.05:
                stepd = min(speed * DT, dist)
                sim.person_x += dx / dist * stepd
                sim.person_y += dy / dist * stepd
                sim.person_moving = True
                sim.velocity = speed
                sim.direction = math.atan2(dy, dx)
            else:
                sim.person_moving = False
                sim.velocity = 0.0
        readings.append(step())
    return readings


def check(name: str, condition: bool, detail: str = "") -> None:
    status = "PASS" if condition else "FAIL"
    print(f"  [{status}] {name}" + (f"  ({detail})" if detail else ""))
    if not condition:
        failures.append(name)


# ------------------------------------------------------------------
# Phase 0: calibration (empty, fan on)
# ------------------------------------------------------------------
print("Phase 0: calibration (10 s, empty room, fan running)")
sim.person_present = False
sim.person_moving = False
cal = run_phase(10.5)  # includes finalize + baseline-announce frames
check("only BOOTING/BASELINE/EMPTY during calibration window",
      all(r.room_status in (RoomStatus.BOOTING, RoomStatus.BASELINE_ESTABLISHED,
                            RoomStatus.ROOM_EMPTY) for r in cal))
check("thresholds were learned adaptively (not floor fallback)",
      pipe._thresholds_learned and pipe._motion_threshold.threshold > 0.1
      and pipe._presence_threshold.threshold > 0.6)
print(f"  learned motion threshold:   {pipe._motion_threshold.threshold:.4f}")
print(f"  learned presence threshold: {pipe._presence_threshold.threshold:.4f}")

# ------------------------------------------------------------------
# Phase 1: empty room + fan (25 s) — the false-positive test
# ------------------------------------------------------------------
print("\nPhase 1: empty room + fan (25 s) — must show NO movement, NO presence")
empty = run_phase(25)
false_movement = sum(1 for r in empty if r.movement_probability > 0)
false_presence = sum(1 for r in empty if r.person_visible)
non_empty = sum(1 for r in empty if r.room_status != RoomStatus.ROOM_EMPTY)
check("zero false movement frames", false_movement == 0, f"{false_movement}/{len(empty)}")
check("zero false presence frames", false_presence == 0, f"{false_presence}/{len(empty)}")
check("status is ROOM EMPTY", non_empty == 0, f"{non_empty} non-empty frames")

# ------------------------------------------------------------------
# Phase 2: person enters walking (10 s)
# ------------------------------------------------------------------
print("\nPhase 2: person enters and walks (10 s)")
sim.person_present = True
sim.person_x, sim.person_y = 0.8, 0.8
walk = run_phase(10, walk_to=(7.0, 5.0), speed=0.9)  # 7.5 m -> walking full 8.3 s
first_moving = next((i for i, r in enumerate(walk) if r.room_status == RoomStatus.HUMAN_MOVING), None)
walking_window = walk[20:80]  # 2 s .. 8 s: person is definitely walking
moving_frames = sum(1 for r in walking_window if r.room_status == RoomStatus.HUMAN_MOVING)
check("HUMAN MOVING detected within 2 s",
      first_moving is not None and first_moving <= 20,
      f"first at {first_moving * DT if first_moving is not None else 'never'} s")
check("HUMAN MOVING sustained while walking",
      moving_frames >= 0.85 * len(walking_window),
      f"{moving_frames}/{len(walking_window)} frames")
errors = [r.position_error_m for r in walk[20:] if r.position_error_m is not None]
avg_err = sum(errors) / len(errors) if errors else 99
check("position error < 0.5 m while walking", avg_err < 0.5, f"avg {avg_err:.2f} m")

# ------------------------------------------------------------------
# Phase 3: person stops — stationary 35 s (breathing only)
# ------------------------------------------------------------------
print("\nPhase 3: person stationary for 35 s (breathing only)")
sim.person_moving = False
sim.velocity = 0.0
stat = run_phase(35)
settled = stat[30:]  # allow 3 s to settle after stopping
false_move_stat = sum(1 for r in settled if r.movement_probability > 0)
presence_held = sum(1 for r in settled if r.person_visible)
stationary_frames = sum(1 for r in settled if r.room_status == RoomStatus.OCCUPIED_STATIONARY)
positions = {(r.x, r.y) for r in settled}
check("movement shows 0 while person is still",
      false_move_stat == 0, f"{false_move_stat}/{len(settled)} frames with movement")
check("presence held for entire stationary period",
      presence_held == len(settled), f"{presence_held}/{len(settled)}")
check("status is OCCUPIED - STATIONARY",
      stationary_frames >= 0.95 * len(settled), f"{stationary_frames}/{len(settled)}")
check("position frozen while stationary", len(positions) == 1, f"{len(positions)} unique positions")
print(f"  breathing band ratio at end: {pipe._breathing.band_ratio:.2f}")

# ------------------------------------------------------------------
# Phase 4: person walks again (8 s)
# ------------------------------------------------------------------
print("\nPhase 4: person walks again (8 s)")
walk2 = run_phase(8, walk_to=(1.5, 1.0), speed=0.8)
first_moving2 = next((i for i, r in enumerate(walk2) if r.room_status == RoomStatus.HUMAN_MOVING), None)
check("movement re-detected within 2 s",
      first_moving2 is not None and first_moving2 <= 20,
      f"first at {first_moving2 * DT if first_moving2 is not None else 'never'} s")

# ------------------------------------------------------------------
# Phase 5: person leaves (10 s)
# ------------------------------------------------------------------
print("\nPhase 5: person leaves the room")
sim.person_present = False
sim.person_moving = False
sim.velocity = 0.0
leave = run_phase(10)
first_empty = next((i for i, r in enumerate(leave) if r.room_status == RoomStatus.ROOM_EMPTY), None)
tail = leave[70:]
tail_empty = sum(1 for r in tail if r.room_status == RoomStatus.ROOM_EMPTY)
check("ROOM EMPTY within 7 s of exit",
      first_empty is not None and first_empty <= 70,
      f"first at {first_empty * DT if first_empty is not None else 'never'} s")
check("stays ROOM EMPTY after exit", tail_empty == len(tail), f"{tail_empty}/{len(tail)}")

# ------------------------------------------------------------------
print("\n" + "=" * 50)
if failures:
    print(f"RESULT: {len(failures)} FAILED: {failures}")
    sys.exit(1)
print("RESULT: ALL CHECKS PASSED")
