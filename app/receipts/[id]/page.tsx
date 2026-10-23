import Link from "next/link";
import { notFound } from "next/navigation";
import { PledgeAction, PrintButton } from "@/components/PledgeActions";
import { PeepMark } from "@/components/Peep";
import { Arrow } from "@/components/ui";
import { money } from "@/lib/match";
import { receiptFor, timelineFor } from "@/lib/receipts";
import { getOpportunity, getPledge } from "@/lib/store";
import { verificationFor } from "@/lib/verify";

export const dynamic = "force-dynamic";
export const metadata = { title: "Receipt — Peep" };

const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "");

/** Where the money is, and the paperwork for it: the page a brand checks instead of emailing anyone. */
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pledge = await getPledge(id);
  if (!pledge) notFound();
  const opp = await getOpportunity(pledge.opportunityId);
  if (!opp) notFound();
  const doc = receiptFor(pledge, opp);
  const steps = timelineFor(pledge);
  const v = verificationFor(opp);
  const arrived = !!pledge.clearedAt;

  return (
    <div className="mx-auto max-w-4xl">
      <p className="eyebrow text-brand">{arrived ? "It arrived" : "On its way"}</p>
      <h1 className="display mt-3 text-[clamp(2.4rem,5vw,3.8rem)] font-semibold leading-[1.02]">
        {money(pledge.amount)} to {opp.orgName}
      </h1>
      <p className="mt-3 text-lg text-muted">
        From {pledge.recognition === "anonymous" ? "an anonymous donor" : pledge.sponsorName} for{" "}
        <Link href={`/opportunities/${opp.id}`} className="font-semibold text-ink hover:text-brand">
          {opp.title}
        </Link>
        .
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] [&>*]:min-w-0">
        <div className="space-y-6 print:hidden">
          <ol className="rounded-3xl bg-card p-6 ring-1 ring-line">
            {steps.map((s, i) => (
              <li key={s.label} className="relative flex gap-4 pb-6 last:pb-0">
                {i < steps.length - 1 && <span aria-hidden className={`absolute left-[13px] top-7 h-[calc(100%-20px)] w-0.5 ${steps[i + 1].done ? "bg-mint" : "bg-line"}`} />}
                <span className={`relative grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-extrabold ${s.done ? "bg-mint text-[#1d3b31]" : "bg-bg text-muted ring-1 ring-line"}`}>{s.done ? "✓" : i + 1}</span>
                <div>
                  <p className={`font-bold ${s.done ? "" : "text-muted"}`}>{s.label}</p>
                  <p className="text-xs text-muted">{s.done ? day(s.at) : "Waiting"}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="rounded-3xl bg-card p-6 ring-1 ring-line">
            <p className="eyebrow text-[10px] text-muted">Checked at payout</p>
            <ul className="mt-3 space-y-2.5 text-sm">
              {v.checks.map((c) => (
                <li key={c.label} className="flex gap-2.5">
                  <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-extrabold ${c.ok ? "bg-mint text-[#1d3b31]" : "bg-accent-soft text-warn"}`}>{c.ok ? "✓" : "!"}</span>
                  <span>
                    <b>{c.label}.</b> <span className="text-muted">{c.detail}{c.simulated ? " (simulated)" : ""}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Prototype controls: the nonprofit's side of the transfer. */}
          {(!pledge.clearedAt || !pledge.acknowledgedAt) && (
            <div className="rounded-3xl border border-dashed border-line p-5 text-sm">
              <p className="font-bold">Prototype: play the nonprofit</p>
              <p className="mt-1 text-muted">No money moves in this prototype. Use these to see what the sponsor sees as the transfer lands.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {!pledge.clearedAt && <PledgeAction id={pledge.id} action="clear" label="Mark the transfer received" />}
                {pledge.clearedAt && !pledge.acknowledgedAt && <PledgeAction id={pledge.id} action="acknowledge" label="Confirm it arrived and issue the receipt" className="btn-primary px-4 py-2 text-sm" />}
              </div>
            </div>
          )}
          {pledge.sponsorId && (
            <Link href={`/brand/${pledge.sponsorId}`} className="btn-secondary group w-full">
              Open the brand dashboard <Arrow />
            </Link>
          )}
        </div>

        {/* The document itself */}
        <article className="relative rounded-3xl bg-[#fffdf8] p-7 text-[#2a2826] shadow-[0_28px_60px_-28px_rgba(0,0,0,0.6)] sm:p-9">
          {!doc.final && <span className="absolute right-6 top-6 rotate-6 rounded-lg border-2 border-[#c2410c] px-2 py-0.5 text-xs font-extrabold uppercase tracking-wider text-[#c2410c]">Draft</span>}
          <div className="flex items-center gap-2">
            <PeepMark className="h-7 w-8" />
            <span className="font-display text-lg font-semibold">peep</span>
          </div>
          <p className="eyebrow mt-6 text-[10px] text-[#8a8478]">{doc.title}</p>
          <p className="font-display text-5xl font-semibold">{money(doc.amount)}</p>
          <p className="mt-1 font-mono text-xs text-[#8a8478]">No. {doc.number}{doc.date ? ` · ${doc.date}` : ""}</p>
          <dl className="mt-6 space-y-2 text-sm">
            {[["From", doc.issuer + (doc.issuerId ? ` (EIN ${doc.issuerId})` : "")], ["To", doc.to], ...doc.lines].map(([k, val]) => (
              <div key={k} className="grid grid-cols-[90px_1fr] gap-3">
                <dt className="text-[#8a8478]">{k}</dt>
                <dd className="font-semibold">{val}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 rounded-xl bg-[#f4efe4] p-4 text-sm leading-relaxed">{doc.statement}</p>
          {doc.fee > 0 && (
            <p className="mt-4 flex justify-between border-t border-dashed border-[#d8d1c4] pt-3 text-xs text-[#6e6a64]">
              <span>Peep service fee (separate, not part of the gift)</span>
              <span className="font-mono">{money(doc.fee)}</span>
            </p>
          )}
          <ul className="mt-4 space-y-1.5 text-xs text-[#6e6a64]">
            {doc.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <div className="mt-6">
            <PrintButton />
          </div>
        </article>
      </div>
    </div>
  );
}
