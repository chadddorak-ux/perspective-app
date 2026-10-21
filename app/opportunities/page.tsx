import Link from "next/link";
import { FilterBar, toOptions } from "@/components/FilterBar";
import { Pill, PageHeader, SampleTag } from "@/components/ui";
import { money } from "@/lib/match";
import { CAUSES, US_STATES, label } from "@/lib/taxonomy";
import { listOpportunities } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Opportunities — Perspective" };

const KINDS = { event: "Events", program: "Programs", campaign: "Campaigns", general: "General support" };

type Search = { q?: string; cause?: string; state?: string; kind?: string };

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { q, cause, state, kind } = await searchParams;
  const all = await listOpportunities();
  const needle = q?.trim().toLowerCase();
  const opps = all.filter(
    (o) =>
      (!cause || o.causes.includes(cause as never)) &&
      (!state || (state === "virtual" ? o.location.virtual : o.location.state === state)) &&
      (!kind || o.kind === kind) &&
      (!needle || `${o.title} ${o.orgName} ${o.summary} ${o.location.city ?? ""}`.toLowerCase().includes(needle)),
  );
  const states = new Set(all.map((o) => o.location.state).filter(Boolean) as string[]);

  return (
    <>
      <PageHeader eyebrow="Network" title="Opportunities raising support">
        Events, programs and campaigns from nonprofits of every kind. Open any listing to see the sponsors who fit best.
      </PageHeader>
      <FilterBar
        action="/opportunities"
        query={q}
        values={{ cause, state, kind }}
        placeholder="Search by name, organization or city"
        filters={[
          { name: "cause", label: "Any cause", options: toOptions(CAUSES) },
          { name: "state", label: "Anywhere", options: [{ value: "virtual", label: "Virtual / national" }, ...toOptions(US_STATES, states)] },
          { name: "kind", label: "Any type", options: toOptions(KINDS) },
        ]}
      />
      <p className="mb-3 text-sm text-muted">{opps.length} of {all.length} opportunities</p>
      {opps.length === 0 && <div className="card p-10 text-center text-muted">Nothing matches those filters yet.</div>}
      <div className="grid gap-4 md:grid-cols-2">
        {opps.map((o) => {
          const amounts = o.tiers.map((t) => t.amount);
          return (
            <Link key={o.id} href={`/opportunities/${o.id}`} className="card p-5 transition hover:border-ink">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-lg font-semibold tracking-tight">{o.title}</h3>
                {o.sample && <SampleTag />}
              </div>
              <p className="text-sm text-muted">
                {o.orgName} · {o.location.virtual ? "Virtual" : [o.location.city, o.location.state].filter(Boolean).join(", ")}
                {o.startDate && ` · ${new Date(`${o.startDate}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {o.causes.slice(0, 3).map((c) => <Pill key={c}>{label(CAUSES, c)}</Pill>)}
                {amounts.length > 0 && <Pill tone="brand">{money(Math.min(...amounts))}–{money(Math.max(...amounts))}</Pill>}
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
