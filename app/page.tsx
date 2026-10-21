import Link from "next/link";
import { CampaignCard } from "@/components/CampaignCard";
import { coverColors } from "@/components/CoverArt";
import { CountUp, Reveal } from "@/components/Motion";
import { Arrow, Eyebrow } from "@/components/ui";
import { fundingFor, type Funding } from "@/lib/funding";
import { money, WEIGHTS } from "@/lib/match";
import { CAUSE_GROUPS } from "@/lib/taxonomy";
import { listOpportunities, listPledges, listSponsors } from "@/lib/store";
import type { Opportunity } from "@/lib/types";

export const dynamic = "force-dynamic";

const FACTORS: { key: keyof typeof WEIGHTS; label: string; body: string }[] = [
  { key: "causes", label: "Cause fit", body: "Both sides' priorities, adjacent causes, industry credibility" },
  { key: "geography", label: "Geography", body: "Home metro, giving area, national reach" },
  { key: "budget", label: "Budget", body: "Picks the tier that fits the typical gift" },
  { key: "audience", label: "Audience", body: "Who it reaches vs. who they target" },
  { key: "objectives", label: "Objectives", body: "Reads the package: pipeline, visibility, access" },
  { key: "timing", label: "Timing", body: "Inside the sponsor's decision cycle" },
];

const STEPS = {
  organizations: [
    ["Start a campaign", "Answer a few questions, or paste the pitch email and deck you already have. Set a goal and tiers."],
    ["Get matched", "See the sponsors most likely to say yes, why each fits, and which tier to ask each one for."],
    ["Collect pledges", "Send tailored pitches or warm intros. Sponsors pledge to tiers and your progress bar fills up."],
  ],
  sponsors: [
    ["Set your goals", "Causes, area, budget, and what you want from a partnership: visibility, recruiting, volunteering."],
    ["See best-fit campaigns", "Ranked by fit, with your rules enforced: no causes you avoid, nothing outside your area."],
    ["Pledge to a tier", "Pick the tier that fits. The organizer confirms and sends an agreement. No payment through us."],
  ],
};

type Row = { opp: Opportunity; f: Funding };

function FullBleed({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`relative left-1/2 w-screen -translate-x-1/2 ${className}`}>{children}</section>;
}

function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function CardRow({ index, eyebrow = "Discover", title, href, rows }: { index: string; eyebrow?: string; title: string; href: string; rows: Row[] }) {
  if (!rows.length) return null;
  return (
    <section className="py-12">
      <Reveal className="mb-6 flex items-end justify-between gap-4">
        <div>
          <Eyebrow index={index}>{eyebrow}</Eyebrow>
          <h2 className="display mt-3 text-3xl font-semibold sm:text-4xl">{title}</h2>
        </div>
        <Link href={href} className="btn-ghost group shrink-0">
          See all <Arrow />
        </Link>
      </Reveal>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ opp, f }, i) => (
          <Reveal key={opp.id} delay={i * 80}>
            <CampaignCard opp={opp} f={f} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export default async function Home() {
  const [opps, sponsors, pledges] = await Promise.all([listOpportunities(), listSponsors(), listPledges()]);
  const rows: Row[] = opps.map((opp) => ({ opp, f: fundingFor(opp, pledges) })).filter((r) => r.f.state !== "closed");
  const totalPledged = pledges.reduce((sum, p) => sum + p.amount, 0);
  const recent = [...pledges].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const titleOf = (id: string) => opps.find((o) => o.id === id)?.title ?? "";

  // Rows that don't repeat a campaign: featured first, then the rest.
  const featured = rows.filter((r) => r.opp.featured).slice(0, 3);
  const taken = new Set(featured.map((r) => r.opp.id));
  const nearly = rows
    .filter((r) => !taken.has(r.opp.id) && r.f.percent >= 50 && r.f.percent < 100)
    .sort((a, b) => b.f.percent - a.f.percent)
    .slice(0, 3);
  nearly.forEach((r) => taken.add(r.opp.id));
  const soon = rows
    .filter((r) => r.f.daysLeft !== undefined && !taken.has(r.opp.id))
    .sort((a, b) => a.f.daysLeft! - b.f.daysLeft!)
    .slice(0, 3);
  soon.forEach((r) => taken.add(r.opp.id));
  const fresh = rows
    .filter((r) => !taken.has(r.opp.id))
    .sort((a, b) => a.f.pledged - b.f.pledged || b.opp.createdAt.localeCompare(a.opp.createdAt))
    .slice(0, 3);

  return (
    <div className="-mt-10">
      {/* Hero */}
      <section className="relative grid gap-10 pb-14 pt-14 lg:grid-cols-12 lg:pt-20 [&>*]:min-w-0">
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-screen -translate-x-1/2 overflow-hidden">
          <div className="bg-warm animate-drift absolute -top-10 right-[-6rem] h-[28rem] w-[28rem] rounded-full opacity-25 blur-3xl lg:right-[8%]" />
        </div>
        <div className="relative lg:col-span-7">
          <Eyebrow className="animate-rise">Sponsorship for every cause</Eyebrow>
          <h1 className="display animate-rise mt-6 text-[clamp(3rem,11vw,5.75rem)] font-bold [animation-delay:80ms]">
            Sponsorship,
            <br />
            <span className="text-warm">matched.</span>
          </h1>
          <p className="animate-rise mt-6 max-w-xl text-lg text-muted [animation-delay:160ms]">
            Nonprofits launch campaigns with clear goals and tiers. Brands, foundations and donors find the ones that fit them, see exactly why, and pledge.
          </p>
          <div className="animate-rise mt-8 flex flex-wrap gap-3 [animation-delay:240ms]">
            <Link href="/find" className="btn-primary group px-5 py-3">
              Start a campaign <Arrow />
            </Link>
            <Link href="/opportunities" className="btn-secondary group px-5 py-3">
              Discover campaigns <Arrow />
            </Link>
          </div>
        </div>

        {/* Network totals + recent pledges */}
        <div className="animate-rise relative self-end lg:col-span-5 [animation-delay:200ms]">
          <div className="crosshair card bg-card/95 backdrop-blur">
            <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
              {[
                { v: <>{money(totalPledged)}</>, l: "pledged" },
                { v: <CountUp to={rows.length} />, l: "live campaigns" },
                { v: <CountUp to={sponsors.length} />, l: "sponsors" },
              ].map((s) => (
                <div key={s.l} className="px-4 py-4">
                  <p className="display text-2xl font-semibold sm:text-3xl">{s.v}</p>
                  <p className="eyebrow mt-1 text-[10px] text-muted">{s.l}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="eyebrow text-muted">Recent pledges</span>
              <span className="eyebrow flex items-center gap-1.5 text-brand">
                <span className="animate-blink h-1.5 w-1.5 rounded-full bg-accent" /> Live
              </span>
            </div>
            <ul className="divide-y divide-line">
              {recent.slice(0, 4).map((p) => (
                <li key={p.id}>
                  <Link href={`/opportunities/${p.opportunityId}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-bg">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink font-mono text-[10px] text-bg">{initials(p.sponsorName)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.sponsorName}</span>
                      <span className="block truncate text-xs text-muted">→ {titleOf(p.opportunityId)}</span>
                    </span>
                    <span className="font-mono text-sm font-semibold text-brand">{money(p.amount)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Pledge ticker */}
      <FullBleed className="overflow-hidden border-y border-line bg-[#111113] py-3 text-white">
        <div className="animate-marquee flex w-max gap-10 whitespace-nowrap font-mono text-xs uppercase tracking-wider">
          {[...recent, ...recent].map((p, i) => (
            <span key={i} className="flex items-center gap-3">
              <span className="text-[#ff5c93]">● {money(p.amount)}</span>
              <span>{p.sponsorName}</span>
              <span className="text-white/50">→</span>
              <span>{titleOf(p.opportunityId)}</span>
            </span>
          ))}
        </div>
      </FullBleed>

      <CardRow index="01" eyebrow="Featured" title="Featured campaigns" href="/opportunities?sort=featured" rows={featured} />

      {/* Categories */}
      <section className="py-14">
        <Reveal>
          <Eyebrow index="02">Explore by cause</Eyebrow>
        </Reveal>
        <div className="mt-6 grid grid-cols-2 border-l border-t border-line sm:grid-cols-4">
          {CAUSE_GROUPS.map((g, i) => {
            const { bg, fg } = coverColors(g.ids[0]);
            const count = rows.filter((r) => r.opp.causes.some((c) => g.ids.includes(c))).length;
            return (
              <Reveal key={g.label} delay={i * 40} className="border-b border-r border-line">
                <Link
                  href={`/opportunities?group=${encodeURIComponent(g.label)}`}
                  className="group relative block h-full overflow-hidden bg-card p-5"
                  style={{ ["--fg" as string]: fg }}
                >
                  <span aria-hidden className="absolute inset-0 translate-y-full transition-transform duration-300 group-hover:translate-y-0" style={{ background: bg }} />
                  <span className="relative block">
                    <span className="eyebrow block text-[10px] text-muted transition-colors group-hover:text-[var(--fg)]">{count} live</span>
                    <span className="display mt-8 block text-xl font-semibold transition-colors group-hover:text-[var(--fg)] sm:text-2xl">{g.label}</span>
                  </span>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>

      <CardRow index="03" title="Nearly funded" href="/opportunities?sort=nearly" rows={nearly} />
      <CardRow index="04" title="Happening soon" href="/opportunities?sort=soon" rows={soon} />
      <CardRow index="05" title="Just launched" href="/opportunities?sort=newest" rows={fresh} />

      {/* How it works */}
      <section className="py-16">
        <Reveal>
          <Eyebrow index="06">How it works</Eyebrow>
          <h2 className="display mt-4 max-w-3xl text-4xl font-semibold sm:text-5xl">Two sides. One yes.</h2>
        </Reveal>
        <div className="mt-10 grid gap-px border border-line bg-line lg:grid-cols-2">
          {(Object.keys(STEPS) as (keyof typeof STEPS)[]).map((side) => (
            <div key={side} className="bg-card p-6 sm:p-8">
              <p className="eyebrow text-brand">For {side}</p>
              <ol className="mt-6 space-y-6">
                {STEPS[side].map(([t, b], i) => (
                  <li key={t} className="grid grid-cols-[40px_1fr] gap-3">
                    <span className="font-mono text-sm text-muted">0{i + 1}</span>
                    <div>
                      <p className="font-display text-xl font-semibold">{t}</p>
                      <p className="mt-1 text-sm text-muted">{b}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link href={side === "organizations" ? "/find" : "/give"} className="btn-secondary group mt-8">
                {side === "organizations" ? "Start a campaign" : "Find campaigns to back"} <Arrow />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Scoring: dark band */}
      <FullBleed className="bg-[#111113] py-20 text-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 lg:grid-cols-12">
          <Reveal className="lg:col-span-5">
            <p className="eyebrow flex items-center gap-2 text-white/60">
              <span className="h-1.5 w-1.5 bg-accent" />
              <span className="text-white">07</span> / Why it matches
            </p>
            <h2 className="display mt-4 text-4xl font-semibold sm:text-5xl">
              Six factors. <span className="text-warm">Zero mystery.</span>
            </h2>
            <p className="mt-4 text-white/70">
              Every campaign shows its best-fit sponsors with a score out of 100, then applies hard rules on both sides: 501(c)(3) requirements, causes a sponsor won&apos;t fund, industries an organization won&apos;t accept, and giving areas.
            </p>
          </Reveal>
          <div className="lg:col-span-7">
            {FACTORS.map((f, i) => (
              <Reveal key={f.key} delay={i * 60} className="grid grid-cols-[1fr_auto] items-end gap-x-6 border-b border-white/15 py-4">
                <div>
                  <p className="font-medium">{f.label}</p>
                  <p className="text-sm text-white/60">{f.body}</p>
                  <div className="mt-3 h-1.5 bg-white/10">
                    <div className="bg-warm h-full" style={{ width: `${(WEIGHTS[f.key] / 30) * 100}%` }} />
                  </div>
                </div>
                <span className="display text-4xl font-semibold tabular-nums">{WEIGHTS[f.key]}</span>
              </Reveal>
            ))}
          </div>
        </div>
      </FullBleed>

      {/* Closing CTA */}
      <Reveal className="mt-20">
        <section className="bg-warm relative overflow-hidden px-6 py-16 text-[#111113] sm:px-12">
          <div aria-hidden className="absolute -right-10 -top-16 h-64 w-64 rotate-12 border-[28px] border-[#111113]/10" />
          <p className="eyebrow">Get the right people in the room</p>
          <h2 className="display mt-4 max-w-3xl text-4xl font-bold sm:text-6xl">When it matters most.</h2>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/find" className="btn group bg-[#111113] px-5 py-3 text-white hover:bg-white hover:text-[#111113]">
              Start a campaign <Arrow />
            </Link>
            <Link href="/give" className="btn group border border-[#111113] px-5 py-3 hover:bg-[#111113] hover:text-white">
              Back a campaign <Arrow />
            </Link>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
