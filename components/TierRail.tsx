"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { money } from "@/lib/match";
import type { TierFunding } from "@/lib/funding";
import { Arrow } from "./ui";

export type SponsorOption = { id: string; name: string; blocked?: string };

/** Reward-style tier cards, each with its own pledge button. */
export function TierRail({
  opportunityId,
  tiers,
  sponsors,
  closed,
}: {
  opportunityId: string;
  tiers: TierFunding[];
  sponsors: SponsorOption[];
  closed: boolean;
}) {
  const [open, setOpen] = useState<TierFunding | null>(null);
  return (
    <div className="space-y-3">
      {tiers.map((t) => {
        const soldOut = t.left === 0;
        return (
          <div key={t.tier.name} className={`group border bg-card p-5 transition-colors ${soldOut || closed ? "border-line opacity-60" : "border-line hover:border-ink"}`}>
            <p className="eyebrow text-[10px] text-muted">Pledge {money(t.tier.amount)}</p>
            <h3 className="mt-1 font-display text-xl font-semibold tracking-tight">{t.tier.name}</h3>
            {t.tier.benefits.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-sm text-muted">
                {t.tier.benefits.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 bg-accent" />
                    {b}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="eyebrow text-[10px] text-muted">
                {soldOut ? "Fully sponsored" : t.slots === 1 ? "Exclusive · 1 spot" : `${t.left} of ${t.slots} left`}
              </span>
              <button className="btn-primary group py-2" disabled={soldOut || closed} onClick={() => setOpen(t)}>
                Sponsor <Arrow />
              </button>
            </div>
          </div>
        );
      })}
      {open && <PledgeModal opportunityId={opportunityId} tier={open} sponsors={sponsors} onClose={() => setOpen(null)} />}
    </div>
  );
}

function PledgeModal({
  opportunityId,
  tier,
  sponsors,
  onClose,
}: {
  opportunityId: string;
  tier: TierFunding;
  sponsors: SponsorOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [who, setWho] = useState<string>("new");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const chosen = sponsors.find((s) => s.id === who);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/pledges", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        opportunityId,
        tierName: tier.tier.name,
        ...(who === "new" ? { sponsorName: name } : { sponsorId: who }),
        message: message || undefined,
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "Couldn't record the pledge");
    setDone(true);
    router.refresh();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Sponsor ${tier.tier.name}`}>
      <div className="card w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="bg-warm px-6 py-5 text-[#111113]">
          <p className="eyebrow text-[10px]">Pledge {money(tier.tier.amount)}</p>
          <h2 className="display mt-1 text-3xl font-semibold">{tier.tier.name}</h2>
        </div>
        {done ? (
          <div className="space-y-4 p-6">
            <p className="font-display text-xl font-semibold">Pledge recorded.</p>
            <p className="text-sm text-muted">
              The organizer will confirm details and send an agreement. Nothing is charged here: pledges are commitments, not payments.
            </p>
            <button className="btn-primary w-full" onClick={onClose}>Done</button>
          </div>
        ) : (
          <div className="space-y-4 p-6">
            <label className="block">
              <span className="label">Pledging as</span>
              <select className="field" value={who} onChange={(e) => setWho(e.target.value)}>
                <option value="new">Someone new (enter a name)</option>
                <optgroup label="Sponsors in the network">
                  {sponsors.map((s) => (
                    <option key={s.id} value={s.id} disabled={!!s.blocked}>
                      {s.name}
                      {s.blocked ? " — not eligible" : ""}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
            {who === "new" && (
              <label className="block">
                <span className="label">Business, foundation or your name</span>
                <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Hardware" />
              </label>
            )}
            {chosen?.blocked && <p className="text-sm text-bad">{chosen.blocked}</p>}
            <label className="block">
              <span className="label">Note to the organizer (optional)</span>
              <textarea className="field min-h-20" value={message} onChange={(e) => setMessage(e.target.value)} />
            </label>
            <p className="hint">Pledges are commitments, not payments. The organizer confirms and sends an agreement.</p>
            {error && <p className="text-sm text-bad">{error}</p>}
            <div className="flex gap-2">
              <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
              <button className="btn-primary flex-1" onClick={submit} disabled={busy || (who === "new" ? name.trim().length < 2 : !!chosen?.blocked)}>
                {busy ? "Pledging…" : `Pledge ${money(tier.tier.amount)}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
