import Link from "next/link";
import { FilterBar, toOptions } from "@/components/FilterBar";
import { Pill, PageHeader, SampleTag } from "@/components/ui";
import { money } from "@/lib/match";
import { CAUSES, INDUSTRIES, REGIONS, SPONSOR_TYPES, US_STATES, label } from "@/lib/taxonomy";
import { listSponsors } from "@/lib/store";
import type { SponsorProfile } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sponsors — Perspective" };

type Search = { q?: string; cause?: string; industry?: string; type?: string; state?: string };

function givesIn(sp: SponsorProfile, state: string): boolean {
  const { scope, states } = sp.geography;
  if (scope === "national") return true;
  if (scope === "regional") return states.some((s) => Object.values(REGIONS).some((r) => r.includes(s) && r.includes(state)));
  return states.includes(state);
}

export default async function SponsorsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { q, cause, industry, type, state } = await searchParams;
  const all = await listSponsors();
  const needle = q?.trim().toLowerCase();
  const sponsors = all.filter(
    (s) =>
      (!cause || s.causes.includes(cause as never)) &&
      (!industry || s.industry === industry) &&
      (!type || s.type === type) &&
      (!state || givesIn(s, state)) &&
      (!needle || `${s.name} ${s.about}`.toLowerCase().includes(needle)),
  );
  const industries = new Set(all.map((s) => s.industry).filter(Boolean) as string[]);

  return (
    <>
      <PageHeader art="workforce-development" eyebrow="Network" title="Sponsors & donors">
        Brands, local businesses, foundations, individual donors and agencies. Open a profile to see the opportunities that fit it best.
      </PageHeader>
      <FilterBar
        action="/sponsors"
        query={q}
        values={{ cause, industry, state }}
        placeholder="Search by name or focus"
        filters={[
          { name: "cause", label: "Any cause", options: toOptions(CAUSES) },
          { name: "industry", label: "Any industry", options: toOptions(INDUSTRIES, industries) },
          { name: "state", label: "Gives anywhere", options: toOptions(US_STATES) },
        ]}
      />
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">{sponsors.length} of {all.length} ·</span>
        {Object.entries(SPONSOR_TYPES).map(([id, l]) => (
          <Link
            key={id}
            href={{ pathname: "/sponsors", query: { ...(q && { q }), ...(cause && { cause }), ...(industry && { industry }), ...(state && { state }), ...(type !== id && { type: id }) } }}
            className={`eyebrow rounded-full border px-2 py-1 text-[10px] ${type === id ? "border-ink bg-ink text-bg" : "border-line"}`}
          >
            {l}
          </Link>
        ))}
      </div>
      {sponsors.length === 0 && <div className="card p-10 text-center text-muted">Nothing matches those filters yet.</div>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sponsors.map((s) => (
          <Link key={s.id} href={`/sponsors/${s.id}`} className="card p-5 transition hover:border-ink/30">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-lg font-semibold tracking-tight">{s.name}</h3>
              {s.sample && <SampleTag />}
            </div>
            <p className="text-xs text-muted">{s.industry ? label(INDUSTRIES, s.industry) : label(SPONSOR_TYPES, s.type)}</p>
            <p className="mt-2 line-clamp-2 text-sm text-muted">{s.about}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Pill tone="brand">{money(s.budget.min)}–{money(s.budget.max)}</Pill>
              {s.causes.slice(0, 2).map((c) => <Pill key={c}>{label(CAUSES, c)}</Pill>)}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
