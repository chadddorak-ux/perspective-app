"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { money } from "@/lib/match";
import type { TierFunding } from "@/lib/funding";
import { Overlay } from "./Overlay";
import { Arrow } from "./ui";
import { peepReact, peepSay } from "@/lib/peep-events";

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
          <div
            key={t.tier.name}
            className={`group rounded-3xl border bg-card p-5 transition-all duration-300 ${soldOut || closed ? "border-line opacity-60" : "border-line hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-20px_rgba(60,30,90,0.45)]"}`}
          >
            <p className="eyebrow text-[10px] text-muted">Pledge {money(t.tier.amount)}</p>
            <h3 className="mt-1 font-display text-xl font-semibold tracking-tight">{t.tier.name}</h3>
            {t.tier.benefits.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-sm text-muted">
                {t.tier.benefits.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
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
  const [contact, setContact] = useState<"connect" | "essentials">("connect");
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
        contact,
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "Couldn't record the pledge");
    setDone(true);
    peepReact("pledge");
    peepSay({ text: "Thank yous! Literally obsessed with you. I'll handle the transfer, the confirmation and your tax receipt.", hold: 6 });
    router.refresh();
  };

  return (
    <Overlay onClose={onClose} label={`Sponsor ${tier.tier.name}`}>
      <div className="card max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="bg-accent px-6 py-5 text-[#2a2826]">
          <p className="eyebrow text-[10px]">Pledge {money(tier.tier.amount)}</p>
          <h2 className="display mt-1 text-3xl font-semibold">{tier.tier.name}</h2>
        </div>
        {done ? (
          <div className="space-y-4 p-6">
            <p className="font-display text-xl font-semibold">Thank you. Pledge recorded.</p>
            <p className="text-sm text-muted">
              Peep confirms the pledge with the organizer, moves the funds, checks they reached the nonprofit, and sends your tax receipt.{" "}
              {contact === "essentials" ? "You chose essentials only, so that's all you'll hear." : "The team may reach out to say thanks."}
            </p>
            <p className="hint">This prototype doesn&apos;t move money yet: pledges are commitments.</p>
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
            <fieldset>
              <legend className="label">After you give</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["connect", "Keep in touch", "Thank-yous, updates, a call if you'd like"],
                    ["essentials", "Just the essentials", "Confirmation and your tax receipt"],
                  ] as const
                ).map(([v, l, d]) => (
                  <label key={v} className={`cursor-pointer rounded-xl p-3 text-sm ring-1 transition ${contact === v ? "bg-mint-soft ring-mint" : "ring-line hover:ring-ink/30"}`}>
                    <input type="radio" name="contact" value={v} checked={contact === v} onChange={() => setContact(v)} className="sr-only" />
                    <span className="block font-bold">{l}</span>
                    <span className="block text-xs text-muted">{d}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block">
              <span className="label">Note to the organizer (optional)</span>
              <textarea className="field min-h-20" value={message} onChange={(e) => setMessage(e.target.value)} />
            </label>
            <p className="hint">Peep handles the transfer and the tax paperwork once the organizer confirms.</p>
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
    </Overlay>
  );
}
