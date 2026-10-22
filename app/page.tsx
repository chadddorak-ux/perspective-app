import Link from "next/link";
import { CampaignCard } from "@/components/CampaignCard";
import { CoverArt } from "@/components/CoverArt";
import { HeroDemo, type DemoCampaign, type DemoSponsor } from "@/components/HeroDemo";
import { PitchDemo, type PitchExample } from "@/components/home/PitchDemo";
import { Radar } from "@/components/home/Radar";
import { ScrollWords } from "@/components/home/ScrollWords";
import { Marquee } from "@/components/Marquee";
import { CountUp, Reveal } from "@/components/Motion";
import { World } from "@/components/scene/World";
import type { Placement, SceneKind } from "@/components/scene/engine";
import { Arrow, Eyebrow } from "@/components/ui";
import { EXAMPLE_PITCHES } from "@/data/examples";
import { extractWithRules } from "@/lib/extract";
import { fundingFor, type Funding } from "@/lib/funding";
import { money, rankSponsors } from "@/lib/match";
import { directPitch } from "@/lib/outreach";
import { AUDIENCES, CAUSES, CAUSE_GROUPS, INDUSTRIES, SPONSOR_TYPES, label } from "@/lib/taxonomy";
import { listOpportunities, listPledges, listSponsors } from "@/lib/store";
import type { MatchResult, Opportunity } from "@/lib/types";

export const dynamic = "force-dynamic";

type Row = { opp: Opportunity; f: Funding };

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

function dateRange(o: Pick<Opportunity, "startDate" | "endDate">): string {
  if (!o.startDate) return "Ongoing";
  const f = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
  if (o.endDate && o.endDate !== o.startDate && o.startDate.slice(0, 7) === o.endDate.slice(0, 7)) {
    return `${f(o.startDate, { month: "short", day: "numeric" })}–${Number(o.endDate.slice(8))}`;
  }
  return f(o.startDate, { month: "short", day: "numeric", year: "numeric" });
}

function FullBleed({ children, className = "", ...rest }: { children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={`relative left-1/2 w-screen -translate-x-1/2 ${className}`} {...rest}>
      {children}
    </section>
  );
}

function SectionHead({ eyebrow, title, href, linkLabel = "See all" }: { eyebrow: string; title: string; href?: string; linkLabel?: string }) {
  return (
    <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="display mt-3 text-4xl sm:text-5xl">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="btn-secondary group shrink-0">
          {linkLabel} <Arrow />
        </Link>
      )}
    </Reveal>
  );
}

// The color each scene fades to at its bottom edge, so the frame around the card continues it.
const FRAME: Record<SceneKind, string> = { night: "#b8577f", day: "#e7b3c6", mountains: "#5a4580" };

/** A rounded window onto a 3D environment, with a cream card rising out of its lower edge. */
function EnvPanel({ kind, gremlin, title, sub, children }: { kind: SceneKind; gremlin?: { desktop: Placement; mobile?: Placement }; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <FullBleed className="px-2 sm:px-6">
      <div className="relative mx-auto max-w-[1320px] overflow-hidden rounded-[32px]" style={{ background: FRAME[kind] }}>
        <div className="relative h-[480px] sm:h-[600px]" data-scene-host>
          <World kind={kind} gremlin={gremlin} />
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-40" style={{ background: `linear-gradient(180deg, transparent, ${FRAME[kind]})` }} />
          <div className="pointer-events-none relative z-10 px-6 pt-12 sm:px-16 sm:pt-20">
            <h2 className="display max-w-3xl text-[clamp(2.4rem,5.6vw,4.6rem)] text-white [text-shadow:0_2px_30px_rgba(40,20,70,0.35)]">{title}</h2>
            {sub && <p className="mt-4 max-w-xl text-lg font-semibold text-white/90 [text-shadow:0_1px_12px_rgba(40,20,70,0.4)]">{sub}</p>}
          </div>
        </div>
        <div className="relative -mt-[150px] px-2 pb-2 sm:-mt-[170px] sm:px-8 sm:pb-8">
          <div className="relative rounded-[24px] bg-bg px-4 py-10 sm:px-12 sm:py-14">{children}</div>
        </div>
      </div>
    </FullBleed>
  );
}

const FAQ = [
  {
    q: "What does Perspective do?",
    a: "It matches nonprofits with the brands, foundations and donors most likely to sponsor them. A nonprofit posts a campaign with a goal and sponsorship tiers; every sponsor in the network gets a fit score with the reasons behind it; sponsors pledge to the tier that fits.",
  },
  {
    q: "How is a match scored?",
    a: "Six factors out of 100: cause (30), geography (20), budget (15), audience (15), sponsor goals (15) and timing (5). Hard rules come first, so a sponsor that only funds 501(c)(3)s, or an industry a nonprofit has blocked, is marked not eligible instead of ranked.",
  },
  {
    q: "Who is Peep?",
    a: "Peep is our matchmaking gremlin. It reads pitches, scores fits and cheers when a pledge lands. Click it in the sky up top and see what happens.",
  },
  {
    q: "I already have a sponsorship deck. Do I start over?",
    a: "No. Paste the pitch email or deck text into Import a pitch. Perspective pulls out the goal, tiers, dates, location and audience, builds the campaign, and drafts outreach to the best-fit sponsors.",
  },
  {
    q: "Is the data real?",
    a: "EAGLES SOAR, from the Richard P. Hall Eagles Foundation, is a real campaign. Every other organization and sponsor is fictional demo data and labeled Sample.",
  },
];

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
  const sponsorKind = (s: (typeof sponsors)[number]) => (s.industry ? label(INDUSTRIES, s.industry) : label(SPONSOR_TYPES, s.type));
  const demoSponsors: DemoSponsor[] = ranked.slice(0, 3).map(({ item, match }) => ({
    name: item.name,
    kind: sponsorKind(item),
    score: match.score,
    reasons: shortReasons(match),
    ask: match.suggestedTier ? { name: match.suggestedTier.name, amount: match.suggestedTier.amount } : undefined,
  }));

  // Real parser output for the example pitches.
  const pitches: PitchExample[] = EXAMPLE_PITCHES.map((p) => {
    const d = extractWithRules(p.text).draft;
    const opening = p.text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !/^(hi|hello|dear)\b/i.test(l))
      .join(" ");
    return {
      label: p.label,
      text: opening.length > 210 ? `${opening.slice(0, opening.lastIndexOf(" ", 210))}…` : opening,
      fields: [
        { label: "Campaign", value: d.title || "—" },
        { label: "Organization", value: d.orgName || "—" },
        { label: "Where", value: [d.location.city, d.location.state].filter(Boolean).join(", ") || "—" },
        { label: "When", value: dateRange(d) },
        { label: "Tiers", value: d.tiers.length ? d.tiers.map((t) => money(t.amount)).join(" · ") : "—" },
        { label: "Causes", value: d.causes.slice(0, 2).map((c) => label(CAUSES, c)).join(", ") || "—" },
        { label: "Audience", value: d.audiences.slice(0, 2).map((a) => label(AUDIENCES, a)).join(", ") },
        { label: "Goal", value: d.tiers.length ? money(d.tiers.reduce((s, t) => s + t.amount, 0)) + "+" : "—" },
      ],
    };
  });

  // Drafted pitches to the top three sponsors.
  const proposals = ranked.slice(0, 3).map(({ item, match }) => ({ sponsor: item.name, kind: sponsorKind(item), draft: directPitch(lead, item, match), tier: match.suggestedTier }));

  const featured = rows.filter((r) => r.opp.featured).slice(0, 3);
  const taken = new Set(featured.map((r) => r.opp.id));
  const nearly = rows
    .filter((r) => !taken.has(r.opp.id) && r.f.percent >= 50 && r.f.percent < 100)
    .sort((a, b) => b.f.percent - a.f.percent)
    .slice(0, 3);
  const radar = recent.slice(0, 6).map((p) => `${p.sponsorName} pledged ${money(p.amount)} to ${titleOf(p.opportunityId)}`);
  const barRows = [...rows].sort((a, b) => b.f.percent - a.f.percent).slice(0, 3);

  // A real blocked pair: a campaign that turns down an industry, a sponsor it turned down, and its best eligible fit.
  const rule = rows
    .map(({ opp }) => {
      const r = rankSponsors(opp, sponsors);
      const blocked = r.find((x) => x.match.blockers.some((b) => b.includes("doesn't accept")));
      return blocked && { opp, blocked, best: r.find((x) => x.match.grade !== "Not eligible") };
    })
    .find(Boolean);

  return (
    <div>
      {/* Hero: a night sky, the product in one picture, and Peep in the clouds */}
      <FullBleed className="-mt-28 overflow-hidden sm:-mt-32" data-nav-dark data-scene-host>
        <World
          kind="night"
          listen
          gremlin={{ desktop: { x: 0.9, y: 0.955, size: 250 }, mobile: { x: 0.74, y: 0.975, size: 150 } }}
        />
        <div className="relative z-10 mx-auto max-w-6xl px-4 pb-[230px] pt-36 sm:pb-[230px] sm:pt-44">
          <div className="mx-auto max-w-4xl text-center">
            <p className="glass-dark animate-rise inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold text-white/85">
              <span className="h-2 w-2 animate-blink rounded-full bg-mint" />
              {rows.length} live campaigns · {sponsors.length} sponsors
            </p>
            <h1 className="display animate-rise mt-6 text-[clamp(2.6rem,6.8vw,5.4rem)] text-[#fdf8f2] [animation-delay:60ms]">
              Match your cause with sponsors who say yes.
            </h1>
            <p className="animate-rise mx-auto mt-5 max-w-2xl text-lg text-white/75 sm:text-xl [animation-delay:120ms]">
              Nonprofits post a campaign. Perspective finds the brands, foundations and donors that fit, shows exactly why, and they pledge.
            </p>
            <div className="animate-rise mt-8 flex flex-wrap justify-center gap-3 [animation-delay:180ms]">
              <Link href="/find" className="btn-bright group min-w-[200px] px-7 py-3.5 text-base">
                I&apos;m a nonprofit <Arrow />
              </Link>
              <Link href="/give" className="btn-glass group min-w-[200px] px-7 py-3.5 text-base">
                I&apos;m a sponsor <Arrow />
              </Link>
            </div>
          </div>
          <div className="animate-rise mx-auto mt-14 max-w-5xl [animation-delay:240ms]">
            <HeroDemo campaign={demoCampaign} sponsors={demoSponsors} />
          </div>
        </div>
      </FullBleed>

      {/* Pledge ticker */}
      <FullBleed className="overflow-hidden border-b border-line bg-card py-4">
        <Marquee className="gap-10 whitespace-nowrap text-sm">
          {[...recent, ...recent].map((p, i) => (
            <span key={i} className="flex items-center gap-2.5">
              <span className="text-accent">♥</span>
              <span className="font-extrabold">{money(p.amount)}</span>
              <span className="text-muted">from</span>
              <span className="font-bold">{p.sponsorName}</span>
              <span className="text-muted">to</span>
              <span>{titleOf(p.opportunityId)}</span>
            </span>
          ))}
        </Marquee>
      </FullBleed>

      {/* The why, in one sentence */}
      <section className="mx-auto max-w-4xl py-24 text-center sm:py-32">
        <ScrollWords
          className="display text-[clamp(1.9rem,4.4vw,3.4rem)] leading-[1.12]"
          accent="Perspective"
          text="“Sponsorship requests arrive every week. Most aren't a fit, and the few that are perfect get lost in the inbox.” So we built Perspective, to put the right people in the room when it matters most."
        />
      </section>

      {/* Meet Peep: from a pitch to matches to a drafted ask */}
      <EnvPanel
        kind="day"
        title="Meet Peep. Sponsorship, finally simple."
        sub="Our matchmaking gremlin reads the pitch, scores every sponsor and drafts the ask."
        gremlin={{ desktop: { x: 0.8, y: 0.72, size: 230 }, mobile: { x: 0.74, y: 0.74, size: 130 } }}
      >
        <Reveal className="text-center">
          <h3 className="display mx-auto max-w-2xl text-3xl sm:text-[2.6rem]">From a pitch email to a live campaign, in one paste</h3>
          <p className="mx-auto mt-3 max-w-xl text-muted">Paste any sponsorship ask. Peep pulls out the goal, tiers, dates and audience, then builds the campaign page.</p>
        </Reveal>
        <div className="mt-8">
          <PitchDemo examples={pitches} />
        </div>

        <div className="mt-14 grid border-t border-line pt-12 md:grid-cols-2 md:divide-x md:divide-line">
          <Reveal className="md:pr-10">
            <h3 className="display text-2xl sm:text-3xl">Find sponsors who already fund your cause</h3>
            <p className="mt-3 text-muted">Every sponsor in the network is scored on cause, place, budget, audience, goals and timing. Here are the top fits for {lead.title}.</p>
            <div className="mt-6 space-y-2">
              {ranked.slice(0, 5).map(({ item, match }, i) => (
                <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-line" style={{ opacity: 1 - i * 0.12 }}>
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-extrabold text-[#2a2826] ${["bg-mint", "bg-sky", "bg-accent-2", "bg-blush", "bg-mint-soft"][i]}`}>{item.name[0]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{item.name}</p>
                    <p className="truncate text-xs text-muted">{shortReasons(match).join(" · ") || sponsorKind(item)}</p>
                  </div>
                  <span className="rounded-full bg-mint-soft px-2.5 py-1 text-sm font-extrabold tabular-nums text-good">{match.score}</span>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={100} className="mt-12 md:mt-0 md:pl-10">
            <h3 className="display text-2xl sm:text-3xl">Pitch with the exact ask</h3>
            <p className="mt-3 text-muted">Peep drafts a pitch for each sponsor, built from the match: the shared cause, why now, and the tier that fits their budget.</p>
            <div className="relative mx-3 mt-8 h-[300px] [perspective:1200px] sm:mx-0">
              {proposals.map((pr, i) => (
                <div
                  key={pr.sponsor}
                  className="absolute inset-x-0 rounded-2xl bg-card p-4 shadow-[0_18px_40px_-20px_rgba(60,30,90,0.45)] ring-1 ring-line transition-transform duration-500 hover:-translate-y-2"
                  style={{ top: `${i * 46}px`, transform: `rotateX(14deg) rotateZ(${-3 + i * 1.5}deg) translateX(${i * 6}px)`, zIndex: i }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-bold">
                      {pr.sponsor} <span className="font-normal text-muted">· {pr.kind}</span>
                    </p>
                    {pr.tier && <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-warn">{money(pr.tier.amount)}</span>}
                  </div>
                  <p className="mt-2 truncate text-xs font-semibold">{pr.draft.subject}</p>
                  <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs text-muted">{pr.draft.body.split("\n").slice(2, 3).join(" ")}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        <div className="mt-12 border-t border-line pt-10 text-center">
          <p className="display text-xl sm:text-2xl">Built for every nonprofit and every brand</p>
          <div className="relative mt-6 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
            <Marquee speed={28} className="gap-3">
              {[...Object.values(CAUSES), ...Object.values(CAUSES)].map((c, i) => (
                <span key={i} className="whitespace-nowrap rounded-full bg-card px-4 py-2 text-sm font-semibold ring-1 ring-line">
                  {c}
                </span>
              ))}
            </Marquee>
          </div>
        </div>
      </EnvPanel>

      {/* Featured campaigns */}
      {featured.length > 0 && (
        <section className="py-24">
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

      {/* Mountains: pledges, rules and progress */}
      <EnvPanel
        kind="mountains"
        title="Fund campaigns, not spreadsheets."
        sub="Pledges land on a page everyone can see, with the rules both sides set."
        gremlin={{ desktop: { x: 0.83, y: 0.62, size: 150 }, mobile: { x: 0.8, y: 0.66, size: 96 } }}
      >
        <Reveal className="text-center">
          <h3 className="display mx-auto max-w-2xl text-3xl sm:text-[2.6rem]">Sponsors back the tiers that fit</h3>
          <p className="mx-auto mt-3 max-w-xl text-muted">Every pledge fills the bar, claims a tier and starts a warm intro. These are the latest.</p>
        </Reveal>
        <Radar messages={radar} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { v: <>{money(totalPledged)}</>, l: "pledged so far" },
            { v: <CountUp to={rows.length} />, l: "live campaigns" },
            { v: <CountUp to={sponsors.length} />, l: "sponsors in the network" },
            { v: <CountUp to={Object.keys(CAUSES).length} />, l: "cause areas" },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl bg-card p-5 text-center ring-1 ring-line">
              <p className="display text-4xl sm:text-5xl">{s.v}</p>
              <p className="mt-1 text-sm text-muted">{s.l}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 grid border-t border-line pt-12 md:grid-cols-2 md:divide-x md:divide-line">
          <Reveal className="md:pr-10">
            <h3 className="display text-2xl sm:text-3xl">Rules both ways</h3>
            <p className="mt-3 text-muted">Sponsors skip causes they avoid. Nonprofits block industries they won&apos;t take money from. Blocked pairs never show up as matches.</p>
            {rule && (
              <div className="mt-6 space-y-2">
                <p className="rounded-2xl bg-accent-soft px-4 py-3 text-sm font-semibold text-warn">
                  {rule.opp.title}: no {rule.opp.excludedIndustries.map((i) => label(INDUSTRIES, i).toLowerCase()).join(", ")} sponsors
                </p>
                <p className="flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 text-sm ring-1 ring-line">
                  <span className="truncate text-muted line-through">{rule.blocked.item.name}</span>
                  <span className="shrink-0 font-bold text-bad">Not eligible</span>
                </p>
                {rule.best && (
                  <p className="flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 text-sm ring-1 ring-line">
                    <span className="truncate">{rule.best.item.name}</span>
                    <span className="shrink-0 font-bold text-good">Eligible · {rule.best.match.score}</span>
                  </p>
                )}
              </div>
            )}
          </Reveal>
          <Reveal delay={100} className="mt-12 md:mt-0 md:pl-10">
            <h3 className="display text-2xl sm:text-3xl">Progress you can see</h3>
            <p className="mt-3 text-muted">Goals, tiers with limited spots, days to go. Sponsors see where their yes matters most.</p>
            <div className="mt-6 space-y-3">
              {barRows.map(({ opp, f }) => (
                <Link key={opp.id} href={`/opportunities/${opp.id}`} className="block rounded-2xl bg-card p-4 ring-1 ring-line transition hover:ring-ink/30">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate font-bold">{opp.title}</span>
                    <span className="shrink-0 font-extrabold tabular-nums">{f.percent}%</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-line">
                    <div className="bg-warm h-full rounded-full" style={{ width: `${Math.min(100, f.percent)}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs text-muted">
                    {money(f.pledged)} of {money(f.goal)}
                  </p>
                </Link>
              ))}
            </div>
          </Reveal>
        </div>
      </EnvPanel>

      {/* Causes */}
      <section className="py-24">
        <SectionHead eyebrow="Explore" title="Every cause has a home." href="/opportunities" linkLabel="Discover all" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {CAUSE_GROUPS.map((g, i) => {
            const count = rows.filter((r) => r.opp.causes.some((c) => g.ids.includes(c))).length;
            return (
              <Reveal key={g.label} delay={i * 40}>
                <Link
                  href={`/opportunities?group=${encodeURIComponent(g.label)}`}
                  className="group block overflow-hidden rounded-3xl bg-card ring-1 ring-line transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-20px_rgba(60,30,90,0.45)]"
                >
                  <CoverArt id={g.label} cause={g.ids[0]} className="aspect-[4/3] w-full" />
                  <div className="p-4">
                    <p className="font-display text-lg font-semibold leading-tight">{g.label}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {count} live · {g.ids.slice(0, 2).map((c) => CAUSES[c]).join(", ")}…
                    </p>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Nearly funded */}
      {nearly.length > 0 && (
        <section className="pb-24">
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

      {/* FAQ */}
      <section className="mx-auto max-w-3xl pb-24">
        <h2 className="display text-center text-4xl sm:text-5xl">Frequently asked questions</h2>
        <div className="mt-10 space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-2xl bg-card px-5 ring-1 ring-line open:shadow-[0_14px_30px_-20px_rgba(60,30,90,0.4)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-bold [&::-webkit-details-marker]:hidden">
                {f.q}
                <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-bg text-lg transition-transform duration-300 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="pb-5 text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Closing CTA under the stars */}
      <FullBleed className="px-2 sm:px-6" data-nav-dark>
        <div className="relative mx-auto max-w-[1320px] overflow-hidden rounded-[32px]" data-scene-host>
          <World kind="night" gremlin={{ desktop: { x: 0.8, y: 0.99, size: 240 }, mobile: { x: 0.5, y: 1.0, size: 150 } }} />
          <div className="pointer-events-none relative z-10 px-6 pb-[190px] pt-16 sm:px-16 sm:py-24">
            <p className="eyebrow text-white/70">Get the right people in the room</p>
            <h2 className="display mt-4 max-w-2xl text-[clamp(2.6rem,6vw,4.8rem)] text-white">When it matters most.</h2>
            <div className="pointer-events-auto mt-8 flex flex-wrap gap-3">
              <Link href="/find" className="btn-bright group px-7 py-3.5 text-base">
                Start a campaign <Arrow />
              </Link>
              <Link href="/opportunities" className="btn-glass group px-7 py-3.5 text-base">
                Discover campaigns <Arrow />
              </Link>
            </div>
          </div>
        </div>
      </FullBleed>
    </div>
  );
}
