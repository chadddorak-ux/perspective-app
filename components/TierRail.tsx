"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { tierCompliance } from "@/lib/compliance";
import { CIRCLE_MIN, CIRCLE_SHARE, type TierFunding } from "@/lib/funding";
import { money } from "@/lib/match";
import { peepReact, peepSay } from "@/lib/peep-events";
import { feeFor } from "@/lib/receipts";
import { GENERAL_SUPPORT, type Tier } from "@/lib/types";
import { More } from "./More";
import { Overlay } from "./Overlay";
import { Arrow } from "./ui";

export type SponsorOption = { id: string; name: string; blocked?: string };

/** What the sponsor is pledging to: a whole tier, a circle share of one, or general support. */
type Target = { tier: Tier; mode: "full" | "circle" | "general" };

const LABEL_TONE: Record<string, string> = {
  "Gift-ready": "bg-mint-soft text-good",
  "Gift with perks": "bg-accent-soft text-warn",
  "Sponsorship (has advertising)": "bg-sky-soft text-sky",
};

/** Reward-style tier cards, each with its own pledge button, plus unrestricted support at the end. */
export function TierRail({
  opportunityId,
  orgName,
  tiers,
  sponsors,
  closed,
}: {
  opportunityId: string;
  orgName: string;
  tiers: TierFunding[];
  sponsors: SponsorOption[];
  closed: boolean;
}) {
  const [open, setOpen] = useState<Target | null>(null);
  const [general, setGeneral] = useState(250);
  const benefit = (b: string) => (
    <li key={b} className="flex gap-2">
      <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
      {b}
    </li>
  );
  return (
    <div className="space-y-3">
      {tiers.map((t) => {
        const soldOut = t.left <= 0;
        const wholeLeft = Math.floor(t.left);
        const c = tierCompliance(t.tier);
        const canCircle = t.tier.amount >= CIRCLE_MIN && t.left >= CIRCLE_SHARE && !closed;
        return (
          <div
            key={t.tier.name}
            className={`group rounded-3xl border bg-card p-5 transition-all duration-300 ${soldOut || closed ? "border-line opacity-60" : "border-line hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-20px_rgba(60,30,90,0.45)]"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="eyebrow text-[10px] text-muted">Pledge {money(t.tier.amount)}</p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${LABEL_TONE[c.label]}`}>{c.label}</span>
            </div>
            <h3 className="mt-1 font-display text-xl font-semibold tracking-tight">{t.tier.name}</h3>
            {t.tier.benefits.length > 0 && (
              <>
                <ul className="mt-3 space-y-1.5 text-sm text-muted">{t.tier.benefits.slice(0, 3).map(benefit)}</ul>
                {t.tier.benefits.length > 3 && (
                  <More label={`+${t.tier.benefits.length - 3} more benefits`} className="mt-1.5">
                    <ul className="space-y-1.5 text-sm text-muted">{t.tier.benefits.slice(3).map(benefit)}</ul>
                  </More>
                )}
              </>
            )}
            {c.notes.length > 0 && (
              <More label="Tax details" openLabel="Hide tax details" className="mt-1">
                <ul className="space-y-1.5 text-xs text-muted">
                  {c.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </More>
            )}
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="eyebrow text-[10px] text-muted">
                {soldOut ? "Fully sponsored" : t.slots === 1 && wholeLeft === 1 ? "Exclusive · 1 spot" : `${wholeLeft} of ${t.slots} left`}
              </span>
              <button className="btn-primary group py-2" disabled={soldOut || closed || t.left < 1} onClick={() => setOpen({ tier: t.tier, mode: "full" })}>
                Sponsor <Arrow />
              </button>
            </div>
            {canCircle && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-bg px-3 py-2 text-xs">
                <span className="text-muted">
                  {t.circle ? (
                    <>
                      <b className="text-ink">Giving circle:</b> {Math.round(t.circle / CIRCLE_SHARE)} of 4 shares taken
                    </>
                  ) : (
                    <>
                      Split it with other local businesses: <b className="text-ink">4 × {money(t.tier.amount * CIRCLE_SHARE)}</b>
                    </>
                  )}
                </span>
                <button className="shrink-0 font-bold text-brand hover:underline" onClick={() => setOpen({ tier: t.tier, mode: "circle" })}>
                  Join the circle
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Unrestricted money: any amount, for whatever the organization needs most. */}
      <div className="rounded-3xl border border-dashed border-line bg-card p-5">
        <p className="eyebrow text-[10px] text-muted">Any amount</p>
        <h3 className="mt-1 font-display text-xl font-semibold tracking-tight">{GENERAL_SUPPORT}</h3>
        <p className="mt-2 text-sm text-muted">Unrestricted funds {orgName} can put toward rent, staff or whatever it needs most. Always a clean gift.</p>
        <div className="mt-4 flex items-center gap-2">
          <label className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
            <input type="number" min={25} step={25} className="field pl-7" aria-label="Amount" value={general} onChange={(e) => setGeneral(Math.max(0, Number(e.target.value)))} />
          </label>
          <button
            className="btn-primary group py-2.5"
            disabled={closed || general < 25}
            onClick={() => setOpen({ tier: { name: GENERAL_SUPPORT, amount: general, benefits: [] }, mode: "general" })}
          >
            Give <Arrow />
          </button>
        </div>
      </div>

      {open && <PledgeModal opportunityId={opportunityId} orgName={orgName} target={open} sponsors={sponsors} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Choice<T extends string>({ name, value, set, options }: { name: string; value: T; set: (v: T) => void; options: readonly (readonly [T, string, string])[] }) {
  return (
    <div className={`grid gap-2 ${options.length === 3 ? "grid-cols-3" : "sm:grid-cols-2"}`}>
      {options.map(([v, l, d]) => (
        <label key={v} className={`cursor-pointer rounded-xl p-3 text-sm ring-1 transition ${value === v ? "bg-mint-soft ring-mint" : "ring-line hover:ring-ink/30"}`}>
          <input type="radio" name={name} value={v} checked={value === v} onChange={() => set(v)} className="sr-only" />
          <span className="block font-bold">{l}</span>
          <span className="block text-xs text-muted">{d}</span>
        </label>
      ))}
    </div>
  );
}

function PledgeModal({
  opportunityId,
  orgName,
  target,
  sponsors,
  onClose,
}: {
  opportunityId: string;
  orgName: string;
  target: Target;
  sponsors: SponsorOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const c = tierCompliance(target.tier);
  const [who, setWho] = useState<string>("new");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState<"connect" | "essentials">("connect");
  // Suggest the paperwork that matches what the tier gives: advertising means a sponsorship.
  const [kind, setKind] = useState<"gift" | "sponsorship">(c.advertising.length ? "sponsorship" : "gift");
  const [recognition, setRecognition] = useState<"public" | "private" | "anonymous">("public");
  const [renews, setRenews] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);
  const chosen = sponsors.find((s) => s.id === who);
  const amount = target.mode === "circle" ? Math.round(target.tier.amount * CIRCLE_SHARE) : target.tier.amount;
  const fee = feeFor(amount);
  const isGeneral = target.mode === "general";

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/pledges", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        opportunityId,
        tierName: target.tier.name,
        ...(who === "new" ? { sponsorName: name } : { sponsorId: who }),
        message: message || undefined,
        contact,
        kind: isGeneral ? "gift" : kind,
        recognition,
        renews,
        ...(target.mode === "circle" && { circle: true }),
        ...(isGeneral && { amount }),
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "Couldn't record the pledge");
    setDoneId(json.pledge.id);
    peepReact("pledge");
    peepSay({ text: "Thank yous! Literally obsessed with you. I'll handle the transfer, the confirmation and your tax receipt.", hold: 6 });
    router.refresh();
  };

  return (
    <Overlay onClose={onClose} label={`Sponsor ${target.tier.name}`}>
      <div className="card max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="bg-accent px-6 py-5 text-[#2a2826]">
          <p className="eyebrow text-[10px]">
            {target.mode === "circle" ? `Circle share · ${money(amount)} of ${money(target.tier.amount)}` : isGeneral ? "Unrestricted gift" : `Pledge ${money(amount)}`}
          </p>
          <h2 className="display mt-1 text-3xl font-semibold">{target.tier.name}</h2>
        </div>
        {doneId ? (
          <div className="space-y-4 p-6">
            <p className="font-display text-xl font-semibold">Thank you. Pledge recorded.</p>
            <p className="text-sm text-muted">
              Peep moves the funds, checks they reached {orgName}, and sends your {kind === "sponsorship" && !isGeneral ? "sponsorship invoice" : "tax receipt"}.{" "}
              {contact === "essentials" ? "You chose essentials only, so that's all you'll hear." : "The team may reach out to say thanks."}
            </p>
            <p className="hint">This prototype doesn&apos;t move money yet: pledges are commitments.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link href={`/receipts/${doneId}`} className="btn-primary group flex-1" onClick={onClose}>
                Track it and get the receipt <Arrow />
              </Link>
              <button className="btn-secondary flex-1" onClick={onClose}>Done</button>
            </div>
          </div>
        ) : (
          <div className="space-y-5 p-6">
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

            {!isGeneral && (
              <fieldset>
                <legend className="label">How should Peep paper it?</legend>
                <Choice
                  name="kind"
                  value={kind}
                  set={setKind}
                  options={[
                    ["gift", "Charitable gift", "Tax receipt from the nonprofit. Recognition is name and logo only."],
                    ["sponsorship", "Sponsorship", "Invoiced as a business expense. Covers every benefit in the tier."],
                  ]}
                />
                <p className="hint mt-2">
                  {kind === "gift"
                    ? c.advertising.length
                      ? "Heads up: this tier includes advertising. As a gift, those benefits get reworded to plain acknowledgment."
                      : c.tangible.length
                        ? "This tier includes perks, so your receipt will list their value; only the amount above it is deductible."
                        : "Under the 2026 rules, corporate gifts count only above 1% of taxable income."
                    : "No 1% floor on business expenses. Keep a note of the business purpose; Peep stores it with the invoice."}
                </p>
              </fieldset>
            )}

            <fieldset>
              <legend className="label">Recognition</legend>
              <Choice
                name="recognition"
                value={recognition}
                set={setRecognition}
                options={[
                  ["public", "Public", "Name and logo"],
                  ["private", "Private", "Only the nonprofit knows"],
                  ["anonymous", "Anonymous", "No name anywhere"],
                ]}
              />
              {recognition !== "public" && <p className="hint mt-2">Your brand kit stays locked, so your logo won&apos;t appear.</p>}
            </fieldset>

            <fieldset>
              <legend className="label">After you give</legend>
              <Choice
                name="contact"
                value={contact}
                set={setContact}
                options={[
                  ["connect", "Keep in touch", "Thank-yous, updates, a call if you'd like"],
                  ["essentials", "Just the essentials", "Confirmation and your receipt"],
                ]}
              />
            </fieldset>

            <label className="flex items-center gap-2.5 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[var(--mint)]" checked={renews} onChange={(e) => setRenews(e.target.checked)} />
              Renew every year (you can switch causes or stop anytime)
            </label>

            <label className="block">
              <span className="label">Note to the organizer (optional)</span>
              <textarea className="field min-h-16" value={message} onChange={(e) => setMessage(e.target.value)} />
            </label>

            <div className="rounded-2xl bg-bg p-4 text-sm ring-1 ring-line">
              <div className="flex justify-between">
                <span>{isGeneral ? "Gift" : kind === "gift" ? "Gift" : "Sponsorship"}</span>
                <span className="font-semibold tabular-nums">{money(amount)}</span>
              </div>
              <div className="mt-1 flex justify-between text-muted">
                <span>Peep fee (3%, paid by you)</span>
                <span className="tabular-nums">{money(fee)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-line pt-2 font-bold">
                <span>You pay</span>
                <span className="tabular-nums">{money(amount + fee)}</span>
              </div>
              <p className="mt-2 text-xs text-muted">Paid by bank transfer, so there are no card fees. {orgName} receives the full {money(amount)}.</p>
            </div>

            {error && <p className="text-sm text-bad">{error}</p>}
            <div className="flex gap-2">
              <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
              <button className="btn-primary flex-1" onClick={submit} disabled={busy || (who === "new" ? name.trim().length < 2 : !!chosen?.blocked)}>
                {busy ? "Pledging…" : `Pledge ${money(amount)}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </Overlay>
  );
}
