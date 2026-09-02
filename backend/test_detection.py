"""
End-to-end detection accuracy test (multi-person).

Drives the simulator + pipeline through a deterministic scenario with
synthetic time and asserts correct detection at every phase:

  0-10 s    calibration (empty room, fan running)
  10-35 s   empty room + fan        -> ROOM EMPTY, zero movement
  35-45 s   person 1 enters walking -> HUMAN MOVING within 2 s
  45-80 s   person 1 stationary     -> OCCUPIED - STATIONARY, movement -> 0,
                                       position frozen, presence held
  80-90 s   person 2 enters walking
            while person 1 still    -> HUMAN MOVING, person_count == 2,
                                       P1 frozen, P2 moving
  90-105 s  both stationary         -> OCCUPIED - STATIONARY, count 2, no movement
  105-115 s both leave              -> ROOM EMPTY within ~7 s

Run:  cd backend && venv/bin/python test_detection.py
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

# Manual control of simulated people (bypass the scenario state machine)
for p in sim.persons:
    p.present = False
    p.moving = False


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
        pipe.set_simulator_state(sim.people_state())
    return pipe.process(m)


def walk_step(person, target: tuple[float, float], speed: float) -> None:
    dx = target[0] - person.x
    dy = target[1] - person.y
    dist = math.hypot(dx, dy)
    if dist > 0.05:
        stepd = min(speed * DT, dist)
        person.x += dx / dist * stepd
        person.y += dy / dist * stepd
        person.moving = True
        person.velocity = speed
        person.direction = math.atan2(dy, dx)
    else:
        person.moving = False
        person.velocity = 0.0


def run_phase(seconds: float, walks: dict | None = None):
    """walks: {person_index: (target, speed)}"""
    readings = []
    for _ in range(round(seconds / DT)):
        if walks:
            for idx, (target, speed) in walks.items():
                walk_step(sim.persons[idx], target, speed)
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
# Phase 2: person 1 enters walking (10 s)
# ------------------------------------------------------------------
print("\nPhase 2: person 1 enters and walks (10 s)")
p1 = sim.persons[0]
p1.present = True
p1.x, p1.y = 0.8, 0.8
walk = run_phase(10, walks={0: ((7.0, 5.0), 0.9)})  # 7.5 m -> walking full 8.3 s
first_moving = next((i for i, r in enumerate(walk) if r.room_status == RoomStatus.HUMAN_MOVING), None)
walking_window = walk[20:80]
moving_frames = sum(1 for r in walking_window if r.room_status == RoomStatus.HUMAN_MOVING)
check("HUMAN MOVING detected within 2 s",
      first_moving is not None and first_moving <= 20,
      f"first at {first_moving * DT if first_moving is not None else 'never'} s")
check("HUMAN MOVING sustained while walking",
      moving_frames >= 0.85 * len(walking_window),
      f"{moving_frames}/{len(walking_window)} frames")
errors = [r.position_error_m for r in walk[20:] if r.position_error_m is not None]
avg_err = sum(errors) / len(errors) if errors else 99
check("position error < 0.20 m while walking", avg_err < 0.20, f"avg {avg_err:.2f} m")
check("person_count is 1", all(r.person_count == 1 for r in walk[20:] if r.person_visible))

# ------------------------------------------------------------------
# Phase 3: person 1 stops — stationary 35 s (breathing only)
# ------------------------------------------------------------------
print("\nPhase 3: person 1 stationary for 35 s (breathing only)")
p1.moving = False
p1.velocity = 0.0
stat = run_phase(35)
settled = stat[30:]  # allow 3 s to settle after stopping
false_move_stat = sum(1 for r in settled if r.movement_probability > 0)
presence_held = sum(1 for r in settled if r.person_visible)
stationary_frames = sum(1 for r in settled if r.room_status == RoomStatus.OCCUPIED_STATIONARY)
positions = {(r.people[0].x, r.people[0].y) for r in settled if r.people}
check("movement shows 0 while person is still",
      false_move_stat == 0, f"{false_move_stat}/{len(settled)} frames with movement")
check("presence held for entire stationary period",
      presence_held == len(settled), f"{presence_held}/{len(settled)}")
check("status is OCCUPIED - STATIONARY",
      stationary_frames >= 0.95 * len(settled), f"{stationary_frames}/{len(settled)}")
check("position frozen while stationary", len(positions) == 1, f"{len(positions)} unique positions")
stat_errors = [r.position_error_m for r in settled if r.position_error_m is not None]
avg_stat_err = sum(stat_errors) / len(stat_errors) if stat_errors else 99
check("position error < 0.15 m while stationary", avg_stat_err < 0.15, f"avg {avg_stat_err:.2f} m")
print(f"  breathing band ratio at end: {pipe._breathing.band_ratio:.2f}")

# ------------------------------------------------------------------
# Phase 4: person 2 enters while person 1 stays still (10 s)
# ------------------------------------------------------------------
print("\nPhase 4: person 2 enters walking while person 1 stationary (10 s)")
p2 = sim.persons[1]
p2.present = True
p2.x, p2.y = 7.5, 0.8
two = run_phase(10, walks={1: ((2.0, 4.5), 0.9)})
first_moving2 = next((i for i, r in enumerate(two) if r.room_status == RoomStatus.HUMAN_MOVING), None)
count_two = sum(1 for r in two[20:] if r.person_count == 2)
p1_frozen = all(
    not next((pp for pp in r.people if pp.id == 0), None).moving
    for r in two[20:] if r.people and any(pp.id == 0 for pp in r.people)
)
p2_moving_frames = sum(
    1 for r in two[20:80]
    if any(pp.id == 1 and pp.moving for pp in r.people)
)
check("movement detected within 2 s of person 2 entering",
      first_moving2 is not None and first_moving2 <= 20,
      f"first at {first_moving2 * DT if first_moving2 is not None else 'never'} s")
check("person_count is 2 with both in room",
      count_two >= 0.9 * len(two[20:]), f"{count_two}/{len(two[20:])}")
check("person 1 marker stays frozen (not moving)", p1_frozen)
check("person 2 marker shows moving",
      p2_moving_frames >= 0.8 * len(two[20:80]), f"{p2_moving_frames}/{len(two[20:80])}")

# ------------------------------------------------------------------
# Phase 5: both stationary (15 s)
# ------------------------------------------------------------------
print("\nPhase 5: both people stationary (15 s)")
p2.moving = False
p2.velocity = 0.0
both_stat = run_phase(15)
settled2 = both_stat[40:]  # allow 4 s to settle
false_move2 = sum(1 for r in settled2 if r.movement_probability > 0)
count_two2 = sum(1 for r in settled2 if r.person_count == 2)
stat_frames2 = sum(1 for r in settled2 if r.room_status == RoomStatus.OCCUPIED_STATIONARY)
check("movement shows 0 with both still",
      false_move2 == 0, f"{false_move2}/{len(settled2)}")
check("person_count stays 2", count_two2 == len(settled2), f"{count_two2}/{len(settled2)}")
check("status is OCCUPIED - STATIONARY",
      stat_frames2 >= 0.95 * len(settled2), f"{stat_frames2}/{len(settled2)}")

# ------------------------------------------------------------------
# Phase 6: both leave (12 s)
# ------------------------------------------------------------------
print("\nPhase 6: both people leave the room")
p1.present = False
p2.present = False
leave = run_phase(12)
first_empty = next((i for i, r in enumerate(leave) if r.room_status == RoomStatus.ROOM_EMPTY), None)
tail = leave[80:]
tail_empty = sum(1 for r in tail if r.room_status == RoomStatus.ROOM_EMPTY)
check("ROOM EMPTY within 7 s of exit",
      first_empty is not None and first_empty <= 70,
      f"first at {first_empty * DT if first_empty is not None else 'never'} s")
check("stays ROOM EMPTY after exit", tail_empty == len(tail), f"{tail_empty}/{len(tail)}")
check("person_count returns to 0", all(r.person_count == 0 for r in tail))

# ------------------------------------------------------------------
print("\n" + "=" * 50)
if failures:
    print(f"RESULT: {len(failures)} FAILED: {failures}")
    sys.exit(1)
print("RESULT: ALL CHECKS PASSED")
