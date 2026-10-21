import Link from "next/link";
import { CampaignCard } from "@/components/CampaignCard";
import { FilterBar, toOptions } from "@/components/FilterBar";
import { PageHeader } from "@/components/ui";
import { fundingFor, type Funding } from "@/lib/funding";
import { CAUSES, CAUSE_GROUPS, US_STATES } from "@/lib/taxonomy";
import { listOpportunities, listPledges } from "@/lib/store";
import type { Opportunity } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discover campaigns — Perspective" };

const KINDS = { event: "Events", program: "Programs", campaign: "Campaigns", general: "General support" };

type Row = { opp: Opportunity; f: Funding };

// Kickstarter-style sorts, adapted: "nearly funded" and "happening soon" are
// where a sponsor's yes makes the most difference.
const bySoonest = (a: Row, b: Row) => (a.f.daysLeft ?? 9999) - (b.f.daysLeft ?? 9999);

const SORTS: Record<string, { label: string; fn: (a: Row, b: Row) => number }> = {
  // Featured campaigns keep their curated order (the sort is stable); the rest follow by date.
  featured: {
    label: "Featured",
    fn: (a, b) => Number(!!b.opp.featured) - Number(!!a.opp.featured) || (a.opp.featured ? 0 : bySoonest(a, b)),
  },
  soon: { label: "Happening soon", fn: (a, b) => (a.f.daysLeft ?? 9999) - (b.f.daysLeft ?? 9999) },
  nearly: { label: "Nearly funded", fn: (a, b) => (b.f.percent < 100 ? b.f.percent : -1) - (a.f.percent < 100 ? a.f.percent : -1) },
  newest: { label: "Just launched", fn: (a, b) => b.opp.createdAt.localeCompare(a.opp.createdAt) },
  popular: { label: "Most sponsors", fn: (a, b) => b.f.sponsors - a.f.sponsors || b.f.pledged - a.f.pledged },
  goal: { label: "Biggest goals", fn: (a, b) => b.f.goal - a.f.goal },
};

type Search = { q?: string; cause?: string; group?: string; state?: string; kind?: string; sort?: string };

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const { q, cause, group, state, kind } = params;
  const sort = params.sort && SORTS[params.sort] ? params.sort : "featured";
  const [all, pledges] = await Promise.all([listOpportunities(), listPledges()]);
  const groupIds = CAUSE_GROUPS.find((g) => g.label === group)?.ids;
  const needle = q?.trim().toLowerCase();

  const rows: Row[] = all
    .filter(
      (o) =>
        (!cause || o.causes.includes(cause as never)) &&
        (!groupIds || o.causes.some((c) => groupIds.includes(c))) &&
        (!state || (state === "virtual" ? o.location.virtual : o.location.state === state)) &&
        (!kind || o.kind === kind) &&
        (!needle || `${o.title} ${o.orgName} ${o.summary} ${o.location.city ?? ""}`.toLowerCase().includes(needle)),
    )
    .map((opp) => ({ opp, f: fundingFor(opp, pledges) }))
    .filter((r) => r.f.state !== "closed")
    .sort(SORTS[sort].fn);
  const states = new Set(all.map((o) => o.location.state).filter(Boolean) as string[]);
  const link = (patch: Partial<Search>) => {
    const next = { ...params, ...patch };
    const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
    return `/opportunities${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <PageHeader eyebrow="Discover" title="Campaigns raising sponsorship">
        Events, programs and campaigns from nonprofits of every kind. Back a tier directly, or open a campaign to see which sponsors fit it best.
      </PageHeader>

      {/* Category tabs */}
      <nav className="mb-6 flex gap-1.5 overflow-x-auto pb-1">
        {[{ label: "All", value: undefined }, ...CAUSE_GROUPS.map((g) => ({ label: g.label, value: g.label }))].map((t) => (
          <Link
            key={t.label}
            href={link({ group: t.value, cause: undefined })}
            className={`whitespace-nowrap rounded-full border px-4 py-2 font-display text-sm font-semibold transition-colors ${group === t.value ? "border-ink bg-ink text-bg" : "border-line bg-card text-muted hover:border-ink hover:text-ink"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <FilterBar
        action="/opportunities"
        query={q}
        values={{ cause, state, kind }}
        placeholder="Search campaigns, organizations or cities"
        filters={[
          { name: "cause", label: "Any cause", options: toOptions(CAUSES) },
          { name: "state", label: "Anywhere", options: [{ value: "virtual", label: "Virtual / national" }, ...toOptions(US_STATES, states)] },
          { name: "kind", label: "Any type", options: toOptions(KINDS) },
        ]}
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          <span className="font-mono text-ink">{rows.length}</span> live campaigns
        </p>
        <div className="flex flex-wrap gap-1">
          {Object.entries(SORTS).map(([key, s]) => (
            <Link
              key={key}
              href={link({ sort: key })}
              className={`rounded-full border px-3 py-1.5 font-display text-xs font-semibold ${sort === key ? "border-ink bg-ink text-bg" : "border-line bg-card hover:border-ink"}`}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card p-10 text-center text-muted">Nothing matches those filters yet.</div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ opp, f }) => (
            <CampaignCard key={opp.id} opp={opp} f={f} />
          ))}
        </div>
      )}
    </>
  );
}
