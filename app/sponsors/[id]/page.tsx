import { notFound } from "next/navigation";
import { MatchCard } from "@/components/MatchCard";
import { Pill, SampleTag } from "@/components/ui";
import { money, rankOpportunities } from "@/lib/match";
import { AUDIENCES, CAUSES, INDUSTRIES, OBJECTIVES, SPONSOR_TYPES, SUPPORT_TYPES, US_STATES, label } from "@/lib/taxonomy";
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
    <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] [&>*]:min-w-0">
      <aside className="card h-fit p-6 lg:sticky lg:top-20">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="brand">{label(SPONSOR_TYPES, sp.type)}</Pill>
          {sp.industry && <Pill>{label(INDUSTRIES, sp.industry)}</Pill>}
          {sp.sample && <SampleTag />}
        </div>
        <h1 className="display mt-4 text-4xl font-semibold">{sp.name}</h1>
        {sp.about && <p className="mt-2 text-sm leading-relaxed text-muted">{sp.about}</p>}
        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex gap-3"><dt className="w-24 shrink-0 text-muted">Typical gift</dt><dd>{money(sp.budget.min)} – {money(sp.budget.max)}</dd></div>
          <div className="flex gap-3"><dt className="w-24 shrink-0 text-muted">Where</dt><dd>{where}</dd></div>
          <div className="flex gap-3"><dt className="w-24 shrink-0 text-muted">Gives</dt><dd>{sp.supportTypes.map((t) => label(SUPPORT_TYPES, t)).join(", ")}</dd></div>
          <div className="flex gap-3"><dt className="w-24 shrink-0 text-muted">Decides</dt><dd>~{sp.leadTimeDays} days ahead</dd></div>
          <div className="flex gap-3"><dt className="w-24 shrink-0 text-muted">Approach</dt><dd>{APPROACH[sp.approach]}{sp.requires501c3 && " · 501(c)(3) only"}</dd></div>
        </dl>
        <h2 className="eyebrow mt-6 text-[10px] text-muted">Priorities</h2>
        <ol className="mt-2 flex flex-wrap gap-1.5">
          {sp.causes.map((c, i) => <Pill key={c}>{i + 1}. {label(CAUSES, c)}</Pill>)}
        </ol>
        {sp.excludedCauses.length > 0 && (
          <p className="mt-2 text-xs text-muted">Doesn&apos;t fund: {sp.excludedCauses.map((c) => label(CAUSES, c)).join(", ")}</p>
        )}
        <h2 className="eyebrow mt-4 text-[10px] text-muted">Wants</h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {sp.objectives.map((o) => <Pill key={o} tone="brand">{label(OBJECTIVES, o)}</Pill>)}
          {sp.audiences.map((a) => <Pill key={a} tone="accent">{label(AUDIENCES, a)}</Pill>)}
        </div>
      </aside>
      <section className="space-y-4">
        <h2 className="display text-4xl font-semibold">Best-fit opportunities</h2>
        {ranked.map((r, i) => (
          <MatchCard key={r.item.id} opp={r.item} sponsor={sp} match={r.match} viewer="sponsor" rank={i + 1} />
        ))}
      </section>
    </div>
  );
}
