import Link from "next/link";
import { notFound } from "next/navigation";
import { PitchPanel } from "@/components/brand/PitchPanel";
import { Arrow, Pill } from "@/components/ui";
import { kitFor, svgDataUrl } from "@/lib/brand-kit";
import { money, rankOpportunities } from "@/lib/match";
import { MIN_LEAD_DAYS, budgetCalendar } from "@/lib/pitch";
import { CAUSES, US_STATES, label } from "@/lib/taxonomy";
import { getSponsor, listOpportunities, listPitches } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Request a sponsorship — Peep" };

/** The page behind a brand's "Request a sponsorship through Peep" link. */
export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sp = await getSponsor(id);
  if (!sp) notFound();
  const [opps, pitches] = await Promise.all([listOpportunities(), listPitches()]);
  const kit = kitFor(sp);
  const cal = budgetCalendar(sp);
  const fits = rankOpportunities(sp, opps).filter((r) => r.match.grade !== "Not eligible").map((r) => r.item);
  const where = sp.geography.scope === "national" ? "Anywhere in the US" : [...sp.geography.metros, ...sp.geography.states.map((s) => US_STATES[s] ?? s)].join(", ");

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={svgDataUrl(kit.mark)} alt="" className="h-14 w-14 rounded-2xl shadow-lg" />
        <p className="eyebrow text-brand">Sponsorship requests</p>
      </div>
      <h1 className="display mt-4 text-[clamp(2.4rem,5vw,3.8rem)] font-semibold leading-[1.02]">{sp.name} takes requests through Peep</h1>
      <p className="mt-3 text-lg text-muted">Send your pitch deck as a free Peep one-pager. It goes straight to {sp.name}, and you&apos;ll hear back either way.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {[
          ["They fund", sp.causes.map((c) => label(CAUSES, c)).join(", ")],
          ["Where", where],
          ["Typical gift", `${money(sp.budget.min)} – ${money(sp.budget.max)}`],
          ["Notice needed", `At least ${Math.max(MIN_LEAD_DAYS, Math.min(sp.leadTimeDays, 90))} days before your event`],
          ...(cal ? [["Best time to ask", cal.bestWindow]] : []),
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-card p-4 ring-1 ring-line">
            <p className="eyebrow text-[9px] text-muted">{k}</p>
            <p className="mt-1 font-semibold">{v}</p>
          </div>
        ))}
      </div>
      {sp.requires501c3 && (
        <p className="mt-3">
          <Pill>501(c)(3) organizations only</Pill>
        </p>
      )}

      <div className="mt-10 grid gap-6 md:grid-cols-2 [&>*]:min-w-0">
        <div className="rounded-3xl bg-mint-soft p-6 ring-1 ring-line">
          <p className="font-display text-2xl font-semibold">New to Peep?</p>
          <p className="mt-2 text-sm text-muted">Drop in your pitch PDF. Peep builds your campaign page, flags anything missing, and sends it to {sp.name} when you post. Free.</p>
          <Link href={`/import?for=${sp.id}`} className="btn-primary group mt-5">
            Upload your pitch PDF <Arrow />
          </Link>
        </div>
        {fits.length > 0 && <PitchPanel sponsor={sp} opps={fits} pitches={pitches} via="request-link" />}
      </div>
    </div>
  );
}
