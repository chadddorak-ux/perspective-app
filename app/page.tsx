import Link from "next/link";
import { CampaignCard } from "@/components/CampaignCard";
import { HeroDemo, type DemoCampaign, type DemoSponsor } from "@/components/HeroDemo";
import { CountUp, Reveal } from "@/components/Motion";
import { Playground, type FloatingShape } from "@/components/Playground";
import { CauseGlyph, LogoMark, Shape } from "@/components/Shapes";
import { Arrow, Eyebrow } from "@/components/ui";
import { fundingFor, type Funding } from "@/lib/funding";
import { money, rankSponsors } from "@/lib/match";
import { CAUSES, CAUSE_GROUPS, INDUSTRIES, SPONSOR_TYPES, label } from "@/lib/taxonomy";
import { listOpportunities, listPledges, listSponsors } from "@/lib/store";
import type { MatchResult, Opportunity } from "@/lib/types";

export const dynamic = "force-dynamic";

type Row = { opp: Opportunity; f: Funding };

const HERO_SHAPES: FloatingShape[] = [
  { kind: "half", color: "coral", top: "6%", left: "2%", size: 64, rotate: 0, depth: 1.4 },
  { kind: "circle", color: "sun", top: "2%", left: "86%", size: 54, depth: 1, mobile: true },
  { kind: "quarter", color: "sky", top: "34%", left: "93%", size: 58, rotate: 180, depth: 1.8 },
  { kind: "square", color: "mint", top: "40%", left: "-1%", size: 40, rotate: 12, depth: 0.8 },
  { kind: "triangle", color: "blush", top: "64%", left: "7%", size: 34, depth: 2 },
  { kind: "dot", color: "coral", top: "58%", left: "82%", size: 40, depth: 1.2 },
];

// Short labels for the reasons a sponsor fits, for the hero's chips.
const SHORT_REASON: Record<string, (note: string) => string> = {
  causes: () => "Same cause",
  geography: (n) => (/home market \((.+)\)/.exec(n)?.[1] ? `Local to ${/home market \((.+)\)/.exec(n)![1]}` : "In giving area"),
  budget: () => "Fits budget",
  audience: () => "Right audience",
  objectives: (n) => (/talent/.test(n) ? "Hiring pipeline" : "Meets goals"),
  timing: () => "Good timing",
};

function shortReasons(m: MatchResult): string[] {
  return [...m.breakdown]
    .filter((d) => d.score >= d.max * 0.7)
    .sort((a, b) => b.score / b.max - a.score / a.max)
    .slice(0, 3)
    .map((d) => SHORT_REASON[d.dimension](d.note));
}

function dateRange(o: Opportunity): string {
  if (!o.startDate) return "Ongoing";
  const f = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
  if (o.endDate && o.endDate !== o.startDate && o.startDate.slice(0, 7) === o.endDate.slice(0, 7)) {
    return `${f(o.startDate, { month: "short", day: "numeric" })}–${Number(o.endDate.slice(8))}`;
  }
  return f(o.startDate, { month: "short", day: "numeric" });
}

function FullBleed({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`relative left-1/2 w-screen -translate-x-1/2 ${className}`}>{children}</section>;
}

function SectionHead({ eyebrow, title, href, linkLabel = "See all" }: { eyebrow: string; title: string; href?: string; linkLabel?: string }) {
  return (
    <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="display mt-3 text-4xl font-bold sm:text-5xl">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="btn-secondary group shrink-0">
          {linkLabel} <Arrow />
        </Link>
      )}
    </Reveal>
  );
}

export default async function Home() {
  const [opps, sponsors, pledges] = await Promise.all([listOpportunities(), listSponsors(), listPledges()]);
  const rows: Row[] = opps.map((opp) => ({ opp, f: fundingFor(opp, pledges) })).filter((r) => r.f.state !== "closed");
  const totalPledged = pledges.reduce((sum, p) => sum + p.amount, 0);
  const recent = [...pledges].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const titleOf = (id: string) => opps.find((o) => o.id === id)?.title ?? "";

  // The hero demo runs on the lead featured campaign and its real top matches.
  const lead = rows.find((r) => r.opp.featured)?.opp ?? rows[0].opp;
  const ranked = rankSponsors(lead, sponsors).filter((r) => r.match.grade !== "Not eligible");
  const demoCampaign: DemoCampaign = {
    id: lead.id,
    title: lead.title,
    org: lead.orgName,
    place: lead.location.virtual ? "Virtual" : [lead.location.city, lead.location.state].filter(Boolean).join(", "),
    when: dateRange(lead),
    cause: lead.causes[0],
    goal: fundingFor(lead, pledges).goal,
    tiers: lead.tiers.map((t) => ({ name: t.name, amount: t.amount })),
  };
  const demoSponsors: DemoSponsor[] = ranked.slice(0, 3).map(({ item, match }) => ({
    name: item.name,
    kind: item.industry ? label(INDUSTRIES, item.industry) : label(SPONSOR_TYPES, item.type),
    score: match.score,
    reasons: shortReasons(match),
    ask: match.suggestedTier ? { name: match.suggestedTier.name, amount: match.suggestedTier.amount } : undefined,
  }));

  const featured = rows.filter((r) => r.opp.featured).slice(0, 3);
  const taken = new Set(featured.map((r) => r.opp.id));
  const nearly = rows
    .filter((r) => !taken.has(r.opp.id) && r.f.percent >= 50 && r.f.percent < 100)
    .sort((a, b) => b.f.percent - a.f.percent)
    .slice(0, 3);

  return (
    <div className="-mt-10">
      {/* Hero: the whole product in one picture */}
      <Playground shapes={HERO_SHAPES} className="pb-14 pt-8 sm:pt-10">
        <div className="mx-auto max-w-4xl text-center">
          <p className="animate-rise inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5 font-display text-xs font-semibold text-muted">
            <span className="h-2 w-2 animate-blink rounded-full bg-mint" />
            {rows.length} live campaigns · {sponsors.length} sponsors
          </p>
          <h1 className="display animate-rise mt-5 text-[clamp(2.5rem,6.6vw,5.1rem)] font-bold [animation-delay:60ms]">
            Match your cause with <br className="hidden sm:inline" />
            sp
            <span aria-hidden className="group relative mx-[0.02em] inline-block h-[0.6em] w-[0.6em] cursor-pointer align-baseline">
              <LogoMark className="absolute inset-[-0.06em] h-[calc(100%+0.12em)] w-[calc(100%+0.12em)]" />
            </span>
            <span className="sr-only">o</span>nsors who say{" "}
            <span className="relative inline-block">
              yes.
              <span aria-hidden className="absolute -bottom-1 left-0 -z-10 h-[0.16em] w-full rounded-full bg-accent-2" />
            </span>
          </h1>
          <p className="animate-rise mx-auto mt-5 max-w-2xl text-lg text-muted sm:text-xl [animation-delay:120ms]">
            Nonprofits post a campaign. Perspective finds the brands, foundations and donors that fit, shows exactly why, and they pledge.
          </p>
          <div className="animate-rise mt-7 flex flex-wrap justify-center gap-3 [animation-delay:180ms]">
            <Link href="/find" className="btn-primary group px-6 py-3 text-base">
              I&apos;m a nonprofit <Arrow />
            </Link>
            <Link href="/give" className="btn-secondary group px-6 py-3 text-base">
              I&apos;m a sponsor <Arrow />
            </Link>
          </div>
        </div>
        <div className="animate-rise mx-auto mt-10 max-w-5xl [animation-delay:240ms]">
          <HeroDemo campaign={demoCampaign} sponsors={demoSponsors} />
        </div>
      </Playground>

      {/* Pledge ticker */}
      <FullBleed className="overflow-hidden border-y border-line bg-card py-3.5">
        <div className="animate-marquee flex w-max gap-10 whitespace-nowrap font-display text-sm">
          {[...recent, ...recent].map((p, i) => {
            const shapes = ["half", "circle", "square", "quarter"] as const;
            const colors = ["coral", "sky", "sun", "mint"] as const;
            return (
              <span key={i} className="flex items-center gap-2.5">
                <Shape kind={shapes[i % 4]} color={colors[i % 4]} className="h-4 w-4" />
                <span className="font-bold">{money(p.amount)}</span>
                <span className="text-muted">from</span>
                <span className="font-semibold">{p.sponsorName}</span>
                <span className="text-muted">to</span>
                <span>{titleOf(p.opportunityId)}</span>
              </span>
            );
          })}
        </div>
      </FullBleed>

      {/* Two doors */}
      <section className="grid gap-5 py-20 md:grid-cols-2">
        {[
          {
            who: "For nonprofits",
            title: "Raise sponsorship without the cold emails.",
            bg: "bg-brand-soft",
            points: ["Post a campaign in five steps, or paste a pitch you already have", "See which sponsors fit, why, and what to ask each for", "Collect pledges on a page you can share"],
            href: "/find",
            cta: "Start a campaign",
            art: (
              <div className="grid grid-cols-3 gap-1.5">
                <Shape kind="half" color="coral" className="h-12 w-12" />
                <Shape kind="square" color="sun" className="h-12 w-12" />
                <Shape kind="quarter" color="ink" rotate={90} className="h-12 w-12" />
              </div>
            ),
          },
          {
            who: "For sponsors",
            title: "Back causes that fit your goals and your market.",
            bg: "bg-sky-soft",
            points: ["Tell us your causes, area, budget and goals", "Get ranked campaigns, with your rules respected", "Pledge to a tier that delivers what you need"],
            href: "/give",
            cta: "Find campaigns to back",
            art: (
              <div className="grid grid-cols-3 gap-1.5">
                <Shape kind="circle" color="sky" className="h-12 w-12" />
                <Shape kind="triangle" color="mint" className="h-12 w-12" />
                <Shape kind="half" color="blush" rotate={180} className="h-12 w-12" />
              </div>
            ),
          },
        ].map((d, i) => (
          <Reveal key={d.who} delay={i * 100} className={`group flex flex-col rounded-[28px] p-7 sm:p-9 ${d.bg}`}>
            <div className="flex items-start justify-between gap-4">
              <p className="eyebrow text-muted">{d.who}</p>
              <div className="transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-105">{d.art}</div>
            </div>
            <h3 className="display mt-6 text-3xl font-bold sm:text-4xl">{d.title}</h3>
            <ul className="mt-6 flex-1 space-y-3">
              {d.points.map((p) => (
                <li key={p} className="flex gap-3">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-ink" />
                  {p}
                </li>
              ))}
            </ul>
            <Link href={d.href} className="btn-primary group mt-8 self-start">
              {d.cta} <Arrow />
            </Link>
          </Reveal>
        ))}
      </section>

      {/* What makes it work, shown rather than told */}
      <section className="pb-20">
        <SectionHead eyebrow="Why it works" title="Built for the yes." />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Reveal className="card flex flex-col p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-14 w-14 place-items-center rounded-full border-[6px] border-mint font-display text-lg font-bold">98</span>
              <div className="flex-1 space-y-1.5">
                {[30, 20, 15, 15, 15, 5].map((w, i) => (
                  <div key={i} className="h-1.5 rounded-full bg-line">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${[97, 100, 100, 100, 100, 100][i] * (w / 30)}%` }} />
                  </div>
                ))}
              </div>
            </div>
            <h3 className="mt-6 font-display text-xl font-bold">Every score explained</h3>
            <p className="mt-2 text-sm text-muted">Cause, location, budget, audience, goals and timing. Six factors, each one visible.</p>
          </Reveal>
          <Reveal delay={80} className="card flex flex-col p-6">
            <div className="space-y-2">
              <p className="rounded-full bg-accent-soft px-3 py-1 text-xs">Youth league: no alcohol or betting sponsors</p>
              <p className="flex items-center justify-between rounded-full border border-line px-3 py-1 text-xs">
                <span className="text-muted line-through">Big Easy Brewing</span>
                <span className="font-semibold text-bad">Not eligible</span>
              </p>
            </div>
            <h3 className="mt-6 font-display text-xl font-bold">Rules both ways</h3>
            <p className="mt-2 text-sm text-muted">Sponsors skip causes they avoid. Nonprofits block industries they won&apos;t take money from.</p>
          </Reveal>
          <Reveal delay={160} className="card flex flex-col p-6">
            <div className="relative h-[58px]">
              <div className="absolute inset-0 rounded-xl border border-line bg-bg p-2.5">
                <p className="truncate text-[11px] font-semibold">Intro? Eagles Foundation × Aeronova</p>
                <div className="mt-1.5 h-1.5 w-4/5 rounded-full bg-line" />
                <div className="mt-1 h-1.5 w-3/5 rounded-full bg-line" />
              </div>
              <Shape kind="triangle" color="sky" rotate={180} className="absolute -right-1 -top-2 h-7 w-7" />
            </div>
            <h3 className="mt-6 font-display text-xl font-bold">Warm intros, drafted</h3>
            <p className="mt-2 text-sm text-muted">A tailored pitch, an opt-in ask, and the intro itself, written from the match.</p>
          </Reveal>
          <Reveal delay={240} className="card flex flex-col p-6">
            <div>
              <div className="h-3 overflow-hidden rounded-full bg-line">
                <div className="h-full w-3/4 rounded-full bg-accent" />
              </div>
              <div className="mt-2 flex gap-1.5">
                <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] text-bg">75% funded</span>
                <span className="rounded-full border border-line px-2 py-0.5 text-[11px]">2 of 3 left</span>
              </div>
            </div>
            <h3 className="mt-6 font-display text-xl font-bold">Progress you can see</h3>
            <p className="mt-2 text-sm text-muted">Goals, tiers with limited spots, days to go. Sponsors see where their yes matters most.</p>
          </Reveal>
        </div>
      </section>

      {/* Featured campaigns */}
      {featured.length > 0 && (
        <section className="pb-20">
          <SectionHead eyebrow="Featured" title="Featured campaigns" href="/opportunities?sort=featured" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map(({ opp, f }, i) => (
              <Reveal key={opp.id} delay={i * 80}>
                <CampaignCard opp={opp} f={f} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* Causes */}
      <section className="pb-20">
        <SectionHead eyebrow="Explore" title="Every cause has a shape." href="/opportunities" linkLabel="Discover all" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {CAUSE_GROUPS.map((g, i) => {
            const count = rows.filter((r) => r.opp.causes.some((c) => g.ids.includes(c))).length;
            return (
              <Reveal key={g.label} delay={i * 40}>
                <Link href={`/opportunities?group=${encodeURIComponent(g.label)}`} className="group block rounded-3xl border border-line bg-card p-3 transition-all duration-300 hover:-translate-y-1 hover:border-ink">
                  <CauseGlyph group={g.label} className="aspect-square w-full overflow-hidden rounded-2xl" />
                  <p className="mt-3 px-1 font-display text-base font-bold leading-tight">{g.label}</p>
                  <p className="px-1 pb-1 text-xs text-muted">
                    {count} live · {g.ids.slice(0, 2).map((c) => CAUSES[c]).join(", ")}…
                  </p>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Nearly funded */}
      {nearly.length > 0 && (
        <section className="pb-20">
          <SectionHead eyebrow="Almost there" title="Nearly funded" href="/opportunities?sort=nearly" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {nearly.map(({ opp, f }, i) => (
              <Reveal key={opp.id} delay={i * 80}>
                <CampaignCard opp={opp} f={f} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* Numbers */}
      <section className="grid grid-cols-2 gap-4 pb-20 lg:grid-cols-4">
        {[
          { v: <>{money(totalPledged)}</>, l: "pledged so far", shape: "half" as const, color: "coral" as const },
          { v: <CountUp to={rows.length} />, l: "live campaigns", shape: "circle" as const, color: "sky" as const },
          { v: <CountUp to={sponsors.length} />, l: "sponsors in the network", shape: "square" as const, color: "sun" as const },
          { v: <CountUp to={Object.keys(CAUSES).length} />, l: "cause areas", shape: "quarter" as const, color: "mint" as const },
        ].map((s, i) => (
          <Reveal key={s.l} delay={i * 60} className="card relative overflow-hidden p-6">
            <Shape kind={s.shape} color={s.color} className="absolute -bottom-5 -right-5 h-16 w-16" />
            <p className="display relative text-5xl font-bold">{s.v}</p>
            <p className="relative mt-2 text-sm text-muted">{s.l}</p>
          </Reveal>
        ))}
      </section>

      {/* Closing CTA */}
      <Reveal>
        <section className="relative overflow-hidden rounded-[32px] bg-sky px-7 py-16 text-[#1f1a17] sm:px-14">
          <div aria-hidden className="absolute -right-8 bottom-0 flex items-end gap-2 opacity-95">
            <Shape kind="half" color="sun" className="h-32 w-32 sm:h-44 sm:w-44" />
            <Shape kind="quarter" color="coral" rotate={90} className="hidden h-28 w-28 sm:block sm:h-36 sm:w-36" />
          </div>
          <p className="eyebrow relative">Get the right people in the room</p>
          <h2 className="display relative mt-4 max-w-2xl text-4xl font-bold sm:text-6xl">When it matters most.</h2>
          <div className="relative mt-8 flex flex-wrap gap-3">
            <Link href="/find" className="btn group bg-[#1f1a17] px-6 py-3 text-white hover:bg-white hover:text-[#1f1a17]">
              Start a campaign <Arrow />
            </Link>
            <Link href="/opportunities" className="btn group border-2 border-[#1f1a17] px-6 py-3 hover:bg-[#1f1a17] hover:text-white">
              Discover campaigns <Arrow />
            </Link>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
