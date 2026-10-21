import { notFound } from "next/navigation";
import { MatchCard } from "@/components/MatchCard";
import { Pill, SampleTag } from "@/components/ui";
import { money, rankOpportunities } from "@/lib/match";
import { AUDIENCES, CAUSES, OBJECTIVES, SPONSOR_TYPES, SUPPORT_TYPES, US_STATES, label } from "@/lib/taxonomy";
import { getSponsor, listOpportunities } from "@/lib/store";

export const dynamic = "force-dynamic";

const APPROACH = { open: "Open to direct pitches", "intro-preferred": "Prefers warm introductions", "invite-only": "Invite-only" };

export default async function SponsorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sp = await getSponsor(id);
  if (!sp) notFound();
  const ranked = rankOpportunities(sp, await listOpportunities()).filter((r) => r.match.grade !== "Not eligible");
  const where =
    sp.geography.scope === "national"
      ? "Nationwide"
      : [...sp.geography.metros, ...sp.geography.states.map((s) => US_STATES[s] ?? s)].join(", ") + ` (${sp.geography.scope})`;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <aside className="card h-fit p-6 lg:sticky lg:top-20">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="brand">{label(SPONSOR_TYPES, sp.type)}</Pill>
          {sp.sample && <SampleTag />}
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">{sp.name}</h1>
        {sp.about && <p className="mt-2 text-sm leading-relaxed text-muted">{sp.about}</p>}
        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex gap-3"><dt className="w-24 shrink-0 text-muted">Typical gift</dt><dd>{money(sp.budget.min)} – {money(sp.budget.max)}</dd></div>
          <div className="flex gap-3"><dt className="w-24 shrink-0 text-muted">Where</dt><dd>{where}</dd></div>
          <div className="flex gap-3"><dt className="w-24 shrink-0 text-muted">Gives</dt><dd>{sp.supportTypes.map((t) => label(SUPPORT_TYPES, t)).join(", ")}</dd></div>
          <div className="flex gap-3"><dt className="w-24 shrink-0 text-muted">Decides</dt><dd>~{sp.leadTimeDays} days ahead</dd></div>
          <div className="flex gap-3"><dt className="w-24 shrink-0 text-muted">Approach</dt><dd>{APPROACH[sp.approach]}{sp.requires501c3 && " · 501(c)(3) only"}</dd></div>
        </dl>
        <h2 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">Priorities</h2>
        <ol className="mt-2 flex flex-wrap gap-1.5">
          {sp.causes.map((c, i) => <Pill key={c}>{i + 1}. {label(CAUSES, c)}</Pill>)}
        </ol>
        <h2 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Wants</h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {sp.objectives.map((o) => <Pill key={o} tone="brand">{label(OBJECTIVES, o)}</Pill>)}
          {sp.audiences.map((a) => <Pill key={a} tone="accent">{label(AUDIENCES, a)}</Pill>)}
        </div>
      </aside>
      <section className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight">Best-fit opportunities</h2>
        {ranked.map((r, i) => (
          <MatchCard key={r.item.id} opp={r.item} sponsor={sp} match={r.match} viewer="sponsor" rank={i + 1} />
        ))}
      </section>
    </div>
  );
}
