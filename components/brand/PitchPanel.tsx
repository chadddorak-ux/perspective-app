"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { pitchProblem } from "@/lib/pitch";
import type { Opportunity, Pitch, SponsorProfile } from "@/lib/types";
import { Arrow } from "../ui";

/**
 * Pitch a brand through its profile: pick one of your campaigns, and Peep
 * checks it against what the brand funds, its lead time and the quarterly
 * quota before it's sent as a standard one-pager.
 */
export function PitchPanel({ sponsor, opps, pitches, via = "profile" }: { sponsor: SponsorProfile; opps: Opportunity[]; pitches: Pitch[]; via?: "profile" | "request-link" }) {
  const [oppId, setOppId] = useState(opps[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const opp = opps.find((o) => o.id === oppId);
  const problem = useMemo(() => (opp ? pitchProblem(opp, sponsor, pitches, opps) : "Pick a campaign"), [opp, sponsor, pitches, opps]);

  const send = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/pitches", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ opportunityId: oppId, sponsorId: sponsor.id, note: note || undefined, via }) });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "Couldn't send the pitch");
    setSent(opp?.title ?? "Your campaign");
  };

  if (sent) {
    return (
      <div className="rounded-3xl bg-mint-soft p-5 ring-1 ring-mint/40">
        <p className="font-display text-xl font-semibold">Sent to {sponsor.name}.</p>
        <p className="mt-1 text-sm text-muted">{sent} is in their inbox as a Peep one-pager. They reply with interest or a reason, so you&apos;re never left guessing.</p>
      </div>
    );
  }
  return (
    <div className="rounded-3xl bg-card p-5 ring-1 ring-line">
      <p className="font-bold">Pitch {sponsor.name}</p>
      <p className="mt-1 text-xs text-muted">One pitch per organization per quarter, only for campaigns that fit what they fund.</p>
      <label className="mt-4 block">
        <span className="label">Your campaign</span>
        <select className="field" value={oppId} onChange={(e) => setOppId(e.target.value)}>
          {opps.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title} · {o.orgName}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 block">
        <span className="label">A line for them (optional)</span>
        <textarea className="field min-h-16" maxLength={600} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this is a fit, in a sentence or two" />
      </label>
      {problem ? <p className="mt-3 text-sm text-warn">{problem}</p> : <p className="mt-3 text-sm text-good">✓ Fits what {sponsor.name} funds</p>}
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="btn-primary group" disabled={busy || !!problem} onClick={send}>
          {busy ? "Sending…" : "Send as a one-pager"} <Arrow />
        </button>
        {opp && (
          <Link href={`/opportunities/${opp.id}`} className="text-sm font-bold text-brand hover:underline">
            Preview
          </Link>
        )}
      </div>
    </div>
  );
}
