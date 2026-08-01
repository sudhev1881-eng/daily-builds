"use client";

import { ROLE_SALARIES } from "@/lib/presets";
import type { Attendee, RolePreset } from "@/lib/types";

interface AttendeeEditorProps {
  attendees: Attendee[];
  onChange: (attendees: Attendee[]) => void;
  onAdd: () => void;
  disabled?: boolean;
}

const ROLE_OPTIONS = Object.entries(ROLE_SALARIES).map(([value, meta]) => ({
  value: value as Exclude<RolePreset, "custom">,
  label: meta.label,
}));

export function AttendeeEditor({
  attendees,
  onChange,
  onAdd,
  disabled,
}: AttendeeEditorProps) {
  const update = (id: string, patch: Partial<Attendee>) => {
    onChange(
      attendees.map((attendee) =>
        attendee.id === id ? { ...attendee, ...patch } : attendee,
      ),
    );
  };

  const remove = (id: string) => {
    onChange(attendees.filter((attendee) => attendee.id !== id));
  };

  if (attendees.length === 0) {
    return (
      <div className="empty-attendees" role="status">
        <p>Your invite list is empty.</p>
        <p className="muted">
          Add teammates to estimate salary-weighted meeting cost.
        </p>
        <button type="button" className="btn btn-primary" onClick={onAdd}>
          Add first attendee
        </button>
      </div>
    );
  }

  return (
    <div className="attendee-list">
      <ul aria-label="Meeting attendees">
        {attendees.map((attendee, index) => (
          <li key={attendee.id} className="attendee-row" style={{ animationDelay: `${index * 40}ms` }}>
            <label className="field">
              <span className="sr-only">Name</span>
              <input
                type="text"
                value={attendee.name}
                disabled={disabled}
                placeholder="Name"
                onChange={(e) => update(attendee.id, { name: e.target.value })}
                autoComplete="off"
              />
            </label>

            <label className="field">
              <span className="sr-only">Role preset</span>
              <select
                value={attendee.role}
                disabled={disabled}
                onChange={(e) => {
                  const role = e.target.value as RolePreset;
                  if (role === "custom") {
                    update(attendee.id, { role });
                    return;
                  }
                  update(attendee.id, {
                    role,
                    annualSalary: ROLE_SALARIES[role].annualSalary,
                  });
                }}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
                <option value="custom">Custom salary</option>
              </select>
            </label>

            <label className="field salary-field">
              <span className="sr-only">Annual salary</span>
              <input
                type="number"
                min={0}
                step={1000}
                value={attendee.annualSalary}
                disabled={disabled}
                onChange={(e) =>
                  update(attendee.id, {
                    role: "custom",
                    annualSalary: Number(e.target.value),
                  })
                }
              />
            </label>

            <button
              type="button"
              className="btn btn-ghost danger"
              onClick={() => remove(attendee.id)}
              aria-label={`Remove ${attendee.name || "attendee"}`}
              disabled={disabled}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="btn btn-secondary"
        onClick={onAdd}
        disabled={disabled}
      >
        Add attendee
      </button>
    </div>
  );
}
