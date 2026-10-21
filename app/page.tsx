import Link from "next/link";
import { rankSponsors, money } from "@/lib/match";
import { listOpportunities, listSponsors } from "@/lib/store";
import { WEIGHTS } from "@/lib/match";

export const dynamic = "force-dynamic";

const PATHS = [
  {
    href: "/find",
    kicker: "I'm raising support",
    title: "Find sponsors for my event or program",
    body: "Describe what you're doing. See ranked sponsors, the right tier to ask each one for, and a pitch you can send today.",
  },
  {
    href: "/give",
    kicker: "I'm looking to give",
    title: "Find causes that fit my goals",
    body: "Tell us your causes, market, budget and what you want from a partnership. See opportunities that actually deliver it.",
  },
  {
    href: "/import",
    kicker: "Someone sent me a pitch",
    title: "Turn a pitch email into matches",
    body: "Paste the email and attach the sponsorship deck. We'll build the listing and show who in the network to connect it to.",
  },
];

const FACTORS: { key: keyof typeof WEIGHTS; label: string; body: string }[] = [
  { key: "causes", label: "Cause fit", body: "Weighted by the sponsor's priorities, with credit for adjacent causes." },
  { key: "geography", label: "Geography", body: "Home metro beats home state beats national reach." },
  { key: "budget", label: "Budget", body: "Matches tiers to typical gift size and picks the right ask." },
  { key: "audience", label: "Audience", body: "Students, families, professionals, veterans and more." },
  { key: "objectives", label: "Objectives", body: "Reads the package: talent pipeline, visibility, access, volunteering." },
  { key: "timing", label: "Timing", body: "Flags events inside a sponsor's decision cycle." },
];

export default async function Home() {
  const [opps, sponsors] = await Promise.all([listOpportunities(), listSponsors()]);
  const featured = opps.find((o) => o.id === "eagles-soar-2026") ?? opps[0];
  const top = rankSponsors(featured, sponsors).slice(0, 3);

  return (
    <div className="space-y-20">
      <section className="grid items-center gap-10 pt-6 lg:grid-cols-[1.2fr_1fr] [&>*]:min-w-0">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand">Sponsorship & donor matching</p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Get the right people in the room <span className="text-brand">when it matters most.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Perspective matches nonprofits and events with the brands, foundations and donors whose goals they actually serve. It explains why each match fits and drafts the warm intro.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/find" className="btn-primary px-5 py-3 text-base">Find sponsors</Link>
            <Link href="/give" className="btn-secondary px-5 py-3 text-base">I want to give</Link>
          </div>
          <p className="mt-6 text-sm text-muted">
            {opps.length} open opportunities · {sponsors.length} sponsor profiles · free to try, no account needed
          </p>
        </div>

        <div className="card p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Live example</p>
          <Link href={`/opportunities/${featured.id}`} className="mt-1 block text-lg font-semibold hover:underline">{featured.title}</Link>
          <p className="text-sm text-muted">{featured.orgName}</p>
          <ul className="mt-4 divide-y divide-line">
            {top.map(({ item, match }) => (
              <li key={item.id} className="flex items-center gap-3 py-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand">{match.score}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="truncate text-xs text-muted">{match.reasons[0]}</p>
                </div>
                {match.suggestedTier && <span className="text-xs font-semibold text-muted">{money(match.suggestedTier.amount)}</span>}
              </li>
            ))}
          </ul>
          <Link href={`/opportunities/${featured.id}`} className="btn-ghost mt-2 w-full">See all matches →</Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {PATHS.map((p) => (
          <Link key={p.href} href={p.href} className="card group p-6 transition hover:border-brand">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">{p.kicker}</p>
            <h2 className="mt-2 text-lg font-semibold">{p.title}</h2>
            <p className="mt-2 text-sm text-muted">{p.body}</p>
            <p className="mt-4 text-sm font-semibold text-brand group-hover:underline">Start →</p>
          </Link>
        ))}
      </section>

      <section>
        <h2 className="text-2xl font-bold tracking-tight">Every match comes with its reasons</h2>
        <p className="mt-2 max-w-2xl text-muted">
          No black box. Each score is built from six factors you can inspect, plus hard rules like 501(c)(3) requirements and excluded causes.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FACTORS.map((f) => (
            <div key={f.key} className="card p-5">
              <div className="flex items-baseline justify-between">
                <h3 className="font-semibold">{f.label}</h3>
                <span className="text-sm tabular-nums text-muted">{WEIGHTS[f.key]} pts</span>
              </div>
              <p className="mt-1 text-sm text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card grid gap-8 p-8 md:grid-cols-3">
        {[
          ["1. Describe", "Fill a short form, or forward the pitch email and deck you already have."],
          ["2. Match", "See who fits, why, what to ask for, and what might get in the way."],
          ["3. Connect", "Send a tailored pitch, or request a double opt-in warm intro through a connector."],
        ].map(([t, b]) => (
          <div key={t}>
            <h3 className="font-semibold">{t}</h3>
            <p className="mt-1 text-sm text-muted">{b}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
