import Link from "next/link";
import { Pill, PageHeader, SampleTag } from "@/components/ui";
import { money } from "@/lib/match";
import { CAUSES, label } from "@/lib/taxonomy";
import { listOpportunities, listSponsors } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Browse — Perspective" };

export default async function OpportunitiesPage() {
  const [opps, sponsors] = await Promise.all([listOpportunities(), listSponsors()]);
  return (
    <>
      <PageHeader eyebrow="Network" title="Browse the network">
        {opps.length} opportunities raising support and {sponsors.length} sponsor profiles. Open any one to see its best matches.
      </PageHeader>

      <h2 className="mb-3 font-semibold">Opportunities</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {opps.map((o) => {
          const amounts = o.tiers.map((t) => t.amount);
          return (
            <Link key={o.id} href={`/opportunities/${o.id}`} className="card p-5 transition hover:border-brand">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{o.title}</h3>
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

      <h2 className="mb-3 mt-12 font-semibold">Sponsors & donors</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sponsors.map((s) => (
          <Link key={s.id} href={`/sponsors/${s.id}`} className="card p-5 transition hover:border-brand">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{s.name}</h3>
              {s.sample && <SampleTag />}
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-muted">{s.about}</p>
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
