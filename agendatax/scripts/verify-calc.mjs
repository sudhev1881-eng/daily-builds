/**
 * Lightweight sanity checks for the cost engine (no test runner required).
 */
import assert from "node:assert/strict";

const DEFAULT_WORKING_HOURS = 2080;

const FREQUENCY_META = {
  weekly: { meetingsPerYear: 52, perWeekFactor: 1 },
};

function hourlyRate(annualSalary, workingHoursPerYear = DEFAULT_WORKING_HOURS) {
  return annualSalary / workingHoursPerYear;
}

function calculate({ attendees, durationMinutes, frequency }) {
  const hourlyRateTotal = attendees.reduce(
    (sum, a) => sum + hourlyRate(a.annualSalary),
    0,
  );
  const costPerMeeting = hourlyRateTotal * (durationMinutes / 60);
  const yearlyCost = costPerMeeting * FREQUENCY_META[frequency].meetingsPerYear;
  return { hourlyRateTotal, costPerMeeting, yearlyCost };
}

const sample = calculate({
  durationMinutes: 60,
  frequency: "weekly",
  attendees: [{ annualSalary: 208000 }],
});

assert.equal(sample.hourlyRateTotal, 100);
assert.equal(sample.costPerMeeting, 100);
assert.equal(sample.yearlyCost, 5200);

const multi = calculate({
  durationMinutes: 30,
  frequency: "weekly",
  attendees: [{ annualSalary: 208000 }, { annualSalary: 104000 }],
});

assert.equal(multi.hourlyRateTotal, 150);
assert.equal(multi.costPerMeeting, 75);
assert.equal(multi.yearlyCost, 3900);

console.log("verify-calc: all assertions passed");
