"use client";

import { useState } from "react";
import type { IntroStatus as Status } from "@/lib/types";

export const STATUS_LABELS: Record<Status, string> = {
  requested: "Requested",
  "opted-in": "Sponsor opted in",
  introduced: "Introduced",
  won: "Won 🎉",
  passed: "Passed",
};

export function IntroStatus({ id, status }: { id: string; status: Status }) {
  const [value, setValue] = useState(status);
  const [saving, setSaving] = useState(false);
  const update = async (next: Status) => {
    const prev = value;
    setValue(next);
    setSaving(true);
    const res = await fetch(`/api/intros/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) setValue(prev);
    setSaving(false);
  };
  return (
    <select className="field w-auto py-1.5" value={value} onChange={(e) => update(e.target.value as Status)} disabled={saving}>
      {Object.entries(STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
    </select>
  );
}
