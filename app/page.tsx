import Link from "next/link";
import { CountUp, Reveal } from "@/components/Motion";
import { Arrow, Eyebrow } from "@/components/ui";
import { money, rankSponsors, WEIGHTS } from "@/lib/match";
import { CAUSES, CAUSE_GROUPS, INDUSTRIES, label } from "@/lib/taxonomy";
import { listOpportunities, listSponsors } from "@/lib/store";

export const dynamic = "force-dynamic";

const ASK_TYPES = ["Galas", "5Ks", "Seasons", "Programs", "Campaigns", "Festivals"];

const FEATURES = [
  { title: "Explainable", body: "Every score breaks down into six factors and named rules. No black box, no guessing why." },
  { title: "Two-sided", body: "Sponsors set causes, budget and area. Organizations set who they won't accept. Both are enforced." },
  { title: "Warm", body: "Matches end in a tailored pitch or a double opt-in intro, not a cold list of logos." },
  { title: "Instant", body: "Paste a pitch email or deck and get a structured listing with ranked sponsors in seconds." },
];

const PATHS = [
  { href: "/find", n: "01", kicker: "Raising support", title: "Find sponsors", body: "Ranked sponsors, the right tier to ask each for, and a pitch you can send today." },
  { href: "/give", n: "02", kicker: "Looking to give", title: "Find causes", body: "Opportunities that deliver on your goals, inside your area and budget." },
  { href: "/import", n: "03", kicker: "Got a pitch", title: "Import a pitch", body: "Turn any sponsorship email or deck into a listing and see who to connect it to." },
];

const FACTORS: { key: keyof typeof WEIGHTS; label: string; body: string }[] = [
  { key: "causes", label: "Cause fit", body: "Both sides' priorities, adjacent causes, industry credibility" },
  { key: "geography", label: "Geography", body: "Home metro, giving area, national reach" },
  { key: "budget", label: "Budget", body: "Picks the tier that fits the typical gift" },
  { key: "audience", label: "Audience", body: "Who it reaches vs. who they target" },
  { key: "objectives", label: "Objectives", body: "Reads the package: pipeline, visibility, access" },
  { key: "timing", label: "Timing", body: "Inside the sponsor's decision cycle" },
];

function FullBleed({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`relative left-1/2 w-screen -translate-x-1/2 ${className}`}>{children}</section>;
}

export default async function Home() {
  const [opps, sponsors] = await Promise.all([listOpportunities(), listSponsors()]);
  const matches = opps
    .map((o) => ({ opp: o, top: rankSponsors(o, sponsors)[0] }))
    .filter((x) => x.top && x.top.match.score >= 60)
    .sort((a, b) => b.top.match.score - a.top.match.score);
  // One per primary cause so the panel spans the network.
  const showcase = matches.filter((x, i, all) => all.findIndex((y) => y.opp.causes[0] === x.opp.causes[0]) === i).slice(0, 5);
  const causeCounts = new Map<string, number>();
  for (const o of opps) for (const c of o.causes) causeCounts.set(c, (causeCounts.get(c) ?? 0) + 1);
  const industries = [...new Set(sponsors.map((s) => s.industry).filter(Boolean))] as (keyof typeof INDUSTRIES)[];

  return (
    <div className="-mt-10">
      {/* Hero */}
      <section className="relative grid gap-10 pb-16 pt-14 lg:grid-cols-12 lg:pt-20 [&>*]:min-w-0">
        {/* Full-width clipped layer so the glow can cross the grid without causing sideways scroll. */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-screen -translate-x-1/2 overflow-hidden">
          <div className="bg-warm animate-drift absolute -top-10 right-[-6rem] h-[28rem] w-[28rem] rounded-full opacity-25 blur-3xl lg:right-[8%]" />
        </div>
        <div className="relative lg:col-span-7">
          <Eyebrow className="animate-rise">Sponsorship & donor matching</Eyebrow>
          <h1 className="display animate-rise mt-6 text-[clamp(3rem,11vw,5.75rem)] font-bold [animation-delay:80ms]">
            Sponsorship,
            <br />
            <span className="relative inline-block">
              <span className="text-warm">matched.</span>
              <span className="eyebrow absolute -right-16 top-1 hidden rotate-6 bg-ink px-2 py-1 text-[10px] text-bg sm:inline-block">
                {Object.keys(CAUSES).length} causes
              </span>
            </span>
          </h1>
          <ul className="animate-rise mt-6 flex flex-wrap gap-x-1 font-mono text-sm uppercase tracking-wider text-muted [animation-delay:160ms]">
            {ASK_TYPES.map((t, i) => (
              <li key={t}>
                {i > 0 && <span className="mr-1 text-line">/</span>}
                {t}
              </li>
            ))}
          </ul>
          <p className="animate-rise mt-6 max-w-xl text-lg text-muted [animation-delay:240ms]">
            Perspective connects nonprofits of every kind with the brands, foundations and donors whose goals they actually serve. It explains why each match fits and drafts the warm intro.
          </p>
          <div className="animate-rise mt-8 flex flex-wrap gap-3 [animation-delay:320ms]">
            <Link href="/find" className="btn-primary group px-5 py-3">
              Find sponsors <Arrow />
            </Link>
            <Link href="/give" className="btn-secondary group px-5 py-3">
              I want to give <Arrow />
            </Link>
          </div>
        </div>

        {/* Live match panel */}
        <div className="animate-rise relative self-end lg:col-span-5 [animation-delay:200ms]">
          <div className="crosshair card bg-card/95 backdrop-blur">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="eyebrow text-muted">Top matches</span>
              <span className="eyebrow flex items-center gap-1.5 text-brand">
                <span className="animate-blink h-1.5 w-1.5 rounded-full bg-accent" /> Live
              </span>
            </div>
            <div className="grid grid-cols-[44px_1fr_auto] border-b border-line px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-muted">
              <span>Fit</span>
              <span>Listing ↔ sponsor</span>
              <span>Ask</span>
            </div>
            <ul className="divide-y divide-line">
              {showcase.map(({ opp, top }) => (
                <li key={opp.id}>
                  <Link href={`/opportunities/${opp.id}`} className="group grid grid-cols-[44px_1fr_auto] items-center px-4 py-3 transition-colors hover:bg-bg">
                    <span className={`font-mono text-sm font-semibold ${top.match.score >= 85 ? "text-brand" : ""}`}>{top.match.score}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{opp.title}</span>
                      <span className="block truncate text-xs text-muted">↔ {top.item.name}</span>
                    </span>
                    <span className="font-mono text-xs text-muted">{top.match.suggestedTier ? money(top.match.suggestedTier.amount) : "—"}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/opportunities" className="group eyebrow flex items-center justify-between border-t border-line px-4 py-3 text-ink hover:bg-ink hover:text-bg">
              Browse {opps.length} opportunities <Arrow />
            </Link>
          </div>
        </div>
      </section>

      {/* Ticker: the one element that ignores the grid entirely */}
      <FullBleed className="overflow-hidden border-y border-line bg-[#111113] py-3 text-white">
        <div className="animate-marquee flex w-max gap-10 whitespace-nowrap font-mono text-xs uppercase tracking-wider">
          {[...matches, ...matches].map(({ opp, top }, i) => (
            <span key={i} className="flex items-center gap-3">
              <span className="text-[#ff5c93]">▲ {top.match.score}</span>
              <span>{opp.title}</span>
              <span className="text-white/50">↔</span>
              <span>{top.item.name}</span>
              {top.match.suggestedTier && <span className="text-[#ffc266]">{money(top.match.suggestedTier.amount)}</span>}
            </span>
          ))}
        </div>
      </FullBleed>

      {/* Stats */}
      <section className="grid grid-cols-2 border-b border-line lg:grid-cols-4">
        {[
          { n: Object.keys(CAUSES).length, label: "Cause areas", note: "Mapped to IRS NTEE groups" },
          { n: Object.keys(INDUSTRIES).length, label: "Sponsor industries", note: "From pet brands to law firms" },
          { n: 6, label: "Match factors", note: "Each one inspectable" },
          { n: 2, label: "Sides enforced", note: "Sponsor and nonprofit rules" },
        ].map((s, i) => (
          <Reveal key={s.label} delay={i * 80} className={`border-line px-5 py-10 ${i % 2 ? "border-l" : ""} ${i === 2 ? "lg:border-l" : ""} ${i < 2 ? "border-b lg:border-b-0" : ""}`}>
            <p className="eyebrow text-muted">{s.label}</p>
            <p className="display mt-3 text-6xl font-semibold sm:text-7xl">
              <CountUp to={s.n} />
            </p>
            <p className="mt-2 text-sm text-muted">{s.note}</p>
          </Reveal>
        ))}
      </section>

      {/* Features */}
      <section className="py-20">
        <Reveal>
          <Eyebrow index="01">Why it works</Eyebrow>
          <h2 className="display mt-4 max-w-3xl text-4xl font-semibold sm:text-6xl">Built for the yes, not the cold email.</h2>
        </Reveal>
        <div className="mt-12 grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 80} className="group relative border-b border-r border-line bg-card p-6 transition-colors hover:bg-ink hover:text-bg">
              <span className="eyebrow text-muted group-hover:text-bg/60">0{i + 1}</span>
              <h3 className="display mt-10 text-3xl font-semibold">{f.title}</h3>
              <p className="mt-3 text-sm text-muted group-hover:text-bg/70">{f.body}</p>
              <span aria-hidden className="bg-warm absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100" />
            </Reveal>
          ))}
        </div>
      </section>

      {/* Paths */}
      <section className="pb-20">
        <Reveal>
          <Eyebrow index="02">Start here</Eyebrow>
        </Reveal>
        <div className="mt-6 border-t border-ink">
          {PATHS.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="group grid items-center gap-2 border-b border-line py-7 transition-colors hover:bg-accent hover:text-[#111113] sm:grid-cols-[80px_1.1fr_1.6fr_40px] sm:px-2"
            >
              <span className="font-mono text-sm text-muted group-hover:text-[#111113]">{p.n}</span>
              <span>
                <span className="eyebrow block text-muted group-hover:text-[#111113]/70">{p.kicker}</span>
                <span className="display block text-3xl font-semibold sm:text-4xl">{p.title}</span>
              </span>
              <span className="text-muted group-hover:text-[#111113]/80">{p.body}</span>
              <Arrow className="hidden h-6 w-6 sm:block" />
            </Link>
          ))}
        </div>
      </section>

      {/* Scoring: dark band */}
      <FullBleed className="bg-ink py-20 text-bg">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 lg:grid-cols-12">
          <Reveal className="lg:col-span-5">
            <p className="eyebrow flex items-center gap-2 text-bg/60">
              <span className="h-1.5 w-1.5 bg-accent" />
              <span className="text-bg">03</span> / How scoring works
            </p>
            <h2 className="display mt-4 text-4xl font-semibold sm:text-5xl">
              Six factors. <span className="text-warm">Zero mystery.</span>
            </h2>
            <p className="mt-4 text-bg/70">
              Scores add up to 100, then pass through hard rules on both sides: 501(c)(3) requirements, causes a sponsor won&apos;t fund, industries an organization won&apos;t accept, and giving areas.
            </p>
          </Reveal>
          <div className="lg:col-span-7">
            {FACTORS.map((f, i) => (
              <Reveal key={f.key} delay={i * 60} className="grid grid-cols-[1fr_auto] items-end gap-x-6 border-b border-bg/15 py-4">
                <div>
                  <p className="font-medium">{f.label}</p>
                  <p className="text-sm text-bg/60">{f.body}</p>
                  <div className="mt-3 h-1.5 bg-bg/10">
                    <div className="bg-warm h-full" style={{ width: `${(WEIGHTS[f.key] / 30) * 100}%` }} />
                  </div>
                </div>
                <span className="display text-4xl font-semibold tabular-nums">{WEIGHTS[f.key]}</span>
              </Reveal>
            ))}
          </div>
        </div>
      </FullBleed>

      {/* Coverage */}
      <section className="grid gap-12 py-20 lg:grid-cols-2">
        <Reveal>
          <Eyebrow index="04">Every cause</Eyebrow>
          <h2 className="display mt-4 text-4xl font-semibold">{Object.keys(CAUSES).length} cause areas</h2>
          <p className="mt-2 text-muted">Aligned to the IRS nonprofit categories, from early childhood to international development.</p>
          <div className="mt-6 space-y-4">
            {CAUSE_GROUPS.map((g) => (
              <div key={g.label}>
                <p className="eyebrow mb-2 text-[10px] text-muted">{g.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {g.ids.map((c) => (
                    <Link key={c} href={`/opportunities?cause=${c}`} className="rounded-sm border border-line bg-card px-2 py-1 text-xs transition-colors hover:border-ink hover:bg-ink hover:text-bg">
                      {CAUSES[c]}
                      {causeCounts.get(c) ? <span className="ml-1.5 font-mono text-[10px] opacity-60">{causeCounts.get(c)}</span> : null}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
        <Reveal delay={100}>
          <Eyebrow index="05">Every kind of sponsor</Eyebrow>
          <h2 className="display mt-4 text-4xl font-semibold">{Object.keys(INDUSTRIES).length} industries</h2>
          <p className="mt-2 text-muted">
            National brands, local businesses, foundations, individual donors and public agencies. Industry matters: a pet brand is credible on animal welfare, and a youth league can rule out alcohol or betting sponsors.
          </p>
          <div className="mt-6 flex flex-wrap gap-1.5">
            {industries.map((i) => (
              <Link key={i} href={`/sponsors?industry=${i}`} className="rounded-sm border border-line bg-card px-2 py-1 text-xs transition-colors hover:border-ink hover:bg-ink hover:text-bg">
                {label(INDUSTRIES, i)}
              </Link>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Closing CTA: the warm block breaks out of the column grid */}
      <Reveal>
        <section className="bg-warm relative overflow-hidden px-6 py-16 text-[#111113] sm:px-12">
          <div aria-hidden className="absolute -right-10 -top-16 h-64 w-64 rotate-12 border-[28px] border-[#111113]/10" />
          <p className="eyebrow">Get the right people in the room</p>
          <h2 className="display mt-4 max-w-3xl text-4xl font-bold sm:text-6xl">When it matters most.</h2>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/find" className="btn group bg-[#111113] px-5 py-3 text-white hover:bg-white hover:text-[#111113]">
              Find sponsors <Arrow />
            </Link>
            <Link href="/import" className="btn group border border-[#111113] px-5 py-3 hover:bg-[#111113] hover:text-white">
              Import a pitch <Arrow />
            </Link>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
