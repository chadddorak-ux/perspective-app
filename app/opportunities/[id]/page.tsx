import Link from "next/link";
import { notFound } from "next/navigation";
import { MatchCard } from "@/components/MatchCard";
import { Pill, SampleTag } from "@/components/ui";
import { money, rankSponsors } from "@/lib/match";
import { AUDIENCES, CAUSES, ORG_TYPES, SUPPORT_TYPES, label } from "@/lib/taxonomy";
import { getOpportunity, listSponsors } from "@/lib/store";

export const dynamic = "force-dynamic";

function fmt(d: string) {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opp = await getOpportunity(id);
  if (!opp) notFound();
  const ranked = rankSponsors(opp, await listSponsors());
  const eligible = ranked.filter((r) => r.match.grade !== "Not eligible");
  const ineligible = ranked.filter((r) => r.match.grade === "Not eligible");

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <aside className="space-y-6 lg:sticky lg:top-20 lg:h-fit">
        <div className="card p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="brand">{opp.kind}</Pill>
            {opp.sample && <SampleTag />}
            {opp.source === "import" && <Pill tone="accent">Imported pitch</Pill>}
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">{opp.title}</h1>
          <p className="mt-1 text-muted">{opp.orgName} · {label(ORG_TYPES, opp.orgType)}</p>

          <dl className="mt-5 space-y-2 text-sm">
            {opp.startDate && (
              <div className="flex gap-3"><dt className="w-20 shrink-0 text-muted">When</dt><dd>{fmt(opp.startDate)}{opp.endDate && opp.endDate !== opp.startDate && ` – ${fmt(opp.endDate)}`}</dd></div>
            )}
            <div className="flex gap-3"><dt className="w-20 shrink-0 text-muted">Where</dt><dd>{opp.location.virtual ? "Virtual" : [opp.location.city, opp.location.state].filter(Boolean).join(", ") || "—"}</dd></div>
            {(opp.reachNote || opp.expectedReach) && (
              <div className="flex gap-3"><dt className="w-20 shrink-0 text-muted">Reach</dt><dd>{opp.reachNote ?? `${opp.expectedReach!.toLocaleString()} people`}</dd></div>
            )}
            {opp.asks.length > 0 && (
              <div className="flex gap-3"><dt className="w-20 shrink-0 text-muted">Asking for</dt><dd>{opp.asks.map((a) => label(SUPPORT_TYPES, a)).join(", ")}</dd></div>
            )}
            {opp.partners.length > 0 && (
              <div className="flex gap-3"><dt className="w-20 shrink-0 text-muted">Partners</dt><dd>{opp.partners.join(", ")}</dd></div>
            )}
            {opp.contact.website && (
              <div className="flex gap-3"><dt className="w-20 shrink-0 text-muted">Website</dt><dd><a className="text-brand hover:underline" href={opp.contact.website} target="_blank" rel="noreferrer">{opp.contact.website.replace(/^https?:\/\//, "")}</a></dd></div>
            )}
          </dl>

          {opp.summary && <p className="mt-5 text-sm leading-relaxed">{opp.summary}</p>}

          <div className="mt-5 flex flex-wrap gap-1.5">
            {opp.causes.map((c) => <Pill key={c}>{label(CAUSES, c)}</Pill>)}
            {opp.audiences.map((a) => <Pill key={a} tone="accent">{label(AUDIENCES, a)}</Pill>)}
          </div>
        </div>

        {opp.tiers.length > 0 && (
          <div className="card overflow-hidden">
            <h2 className="border-b border-line px-6 py-3 font-semibold">Sponsorship levels</h2>
            <ul className="divide-y divide-line">
              {opp.tiers.map((t) => (
                <li key={t.name} className="px-6 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{t.name}</span>
                    <span className="font-semibold tabular-nums">{money(t.amount)}</span>
                  </div>
                  {t.availability && <p className="text-xs capitalize text-muted">{t.availability}</p>}
                  {t.benefits.length > 0 && <p className="mt-1 text-xs text-muted">{t.benefits.join(" · ")}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Who to bring in</h2>
          <p className="text-sm text-muted">
            {eligible.filter((r) => r.match.score >= 70).length} strong matches. Draft a direct pitch, or request a warm intro and track it on the <Link href="/intros" className="text-brand hover:underline">Intros</Link> board.
          </p>
        </div>
        {eligible.map((r, i) => (
          <MatchCard key={r.item.id} opp={opp} sponsor={r.item} match={r.match} viewer="organization" rank={i + 1} />
        ))}
        {ineligible.length > 0 && (
          <details className="card p-5 text-sm">
            <summary className="cursor-pointer font-medium">{ineligible.length} not eligible</summary>
            <ul className="mt-3 space-y-1 text-muted">
              {ineligible.map((r) => <li key={r.item.id}><span className="text-ink">{r.item.name}</span>: {r.match.blockers.join("; ")}</li>)}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}
