import Link from "next/link";
import { CampaignCard } from "@/components/CampaignCard";
import { CoverArt } from "@/components/CoverArt";
import { MatchStory, type MatchStoryData } from "@/components/home/MatchStory";
import { PdfDropButton } from "@/components/home/PdfDropButton";
import { artTheme } from "@/components/CauseArt";
import { More } from "@/components/More";
import { PdfDropDemo, type DropDemoData } from "@/components/home/PdfDropDemo";
import { WatchFrame } from "@/components/home/WatchFrame";
import { WhyPeep, type WhyData } from "@/components/home/WhyPeep";
import { Marquee } from "@/components/Marquee";
import { CountUp, Reveal } from "@/components/Motion";
import { PeepMark } from "@/components/Peep";
import { World } from "@/components/scene/World";
import { Arrow, Eyebrow } from "@/components/ui";
import { fundingFor, type Funding } from "@/lib/funding";
import { money, rankSponsors } from "@/lib/match";
import { directPitch, optInAsk } from "@/lib/outreach";
import { AUDIENCES, CAUSES, CAUSE_GROUPS, INDUSTRIES, OBJECTIVES, SPONSOR_TYPES, label } from "@/lib/taxonomy";
import { listOpportunities, listPledges, listSponsors } from "@/lib/store";
import type { Opportunity, SponsorProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

type Row = { opp: Opportunity; f: Funding };

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

function sponsorKind(s: SponsorProfile): string {
  return s.industry ? label(INDUSTRIES, s.industry) : label(SPONSOR_TYPES, s.type);
}

function givingArea(s: SponsorProfile): string {
  const g = s.geography;
  const home = g.metros.length ? `${g.metros.join(", ")} first` : "";
  const reach = g.scope === "national" ? "nationwide" : g.states.join(", ");
  return [home, reach].filter(Boolean).join(", then ");
}

const FAQ = [
  {
    q: "What does Peep do?",
    a: "Peep turns your sponsorship pitch into a polished campaign page and pairs it with brands and donors whose funds are verified and whose giving goals your campaign meets. Upload your pitch PDF or start from scratch, fix anything Peep flags, post it free, and sponsors pledge to the tiers that fit them.",
  },
  {
    q: "What do brands get?",
    a: "A simple way to give. Set a giving budget, choose the causes and places that matter to your brand, and Peep matches you with campaigns that fit. Peep handles the transfer, confirms the funds reached the nonprofit, and sends your tax documentation as soon as they land. Stay in touch with the teams you fund, or keep it to the essentials.",
  },
  {
    q: "Why do all campaigns start with the same look?",
    a: "On purpose. Every campaign starts from the same polished layout, so a small team with a scrappy PDF gets the same shot as a big one with an agency deck. You can still add your own story, photos and details to make it yours.",
  },
  {
    q: "What does Peep do with my PDF?",
    a: "Peep reads the text and photos right in your browser and fills in every field it can: campaign name, organization, dates, place, causes, tiers and benefits, and a cover photo. Then it flags anything missing. Nothing is posted until you've fixed the flags and pressed Post. When the site is set up with AI, the PDF is also read by Claude, which handles scanned pages and complex layouts.",
  },
  {
    q: "Is it free?",
    a: "Yes. Posting a campaign is free.",
  },
  {
    q: "How is a match scored?",
    a: "Six factors out of 100: cause (30), geography (20), budget (15), audience (15), sponsor goals (15) and timing (5). Hard rules come first, so a sponsor that only funds 501(c)(3)s, or an industry you've turned down, is marked not eligible instead of ranked.",
  },
  {
    q: "Who's the gremlin?",
    a: "That's Peep, your campaign manager. She reads your pitch, flags what's missing, finds your sponsors and cheers when a pledge lands. She loves being petted. She does not love being left.",
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

  // Everything on this page runs on the lead featured campaign and its real matches.
  const lead = rows.find((r) => r.opp.featured)?.opp ?? rows[0].opp;
  const all = rankSponsors(lead, sponsors);
  const ranked = all.filter((r) => r.match.grade !== "Not eligible");
  const top = ranked[0];
  const sp = top.item;
  const place = lead.location.virtual ? "Virtual" : [lead.location.city, lead.location.state].filter(Boolean).join(", ");
  const budget = `${money(sp.budget.min)}–${money(sp.budget.max)}`;

  const goalRow = ({ opp, f }: (typeof barRows)[number]) => (
    <Link key={opp.id} href={`/opportunities/${opp.id}`} className="block rounded-2xl bg-bg p-4 transition hover:ring-1 hover:ring-ink/20">
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
  );
  const pledgeRow = (p: (typeof recent)[number]) => (
    <li key={p.id} className="flex items-center gap-3 py-3">
      <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-accent">
        ♥
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          <b>{p.sponsorName}</b> backed <b>{titleOf(p.opportunityId)}</b>
        </p>
        <p className="truncate text-xs text-muted">{p.tierName}</p>
      </div>
      <span className="shrink-0 font-extrabold tabular-nums">{money(p.amount)}</span>
    </li>
  );

  const giftTier = lead.tiers[1] ?? lead.tiers[0];
  const why: WhyData = {
    campaign: { title: lead.title, org: lead.orgName, when: dateRange(lead), where: place, theme: artTheme(lead) },
    receipt: {
      sponsor: ranked[0]?.item.name ?? "Your brand",
      org: lead.orgName,
      amount: giftTier ? money(giftTier.amount) : "$25K",
      tier: giftTier ? `${giftTier.name.replace(/\s*[—-].*$/, "")} · ${lead.title}` : lead.title,
    },
  };
  const dropDemo: DropDemoData = {
    fileName: `${lead.title.split(" ").slice(0, 2).join("-")}-Sponsorship.pdf`,
    pages: 6,
    id: lead.id,
    cause: lead.causes[0],
    title: lead.title,
    org: lead.orgName,
    when: dateRange(lead),
    where: place,
    kind: `${lead.kind === "event" ? "Event" : lead.kind === "program" ? "Program" : "Campaign"} · ${lead.causes[0] ? label(CAUSES, lead.causes[0]) : "Community"}`,
    theme: artTheme(lead),
    causes: lead.causes.slice(0, 3).map((c) => label(CAUSES, c)),
    tiers: lead.tiers.map((t) => ({ name: t.name.replace(/\s*[—-].*$/, ""), amount: t.amount })),
    story: lead.summary,
    goal: fundingFor(lead, pledges).goal,
    sponsors: ranked.slice(0, 3).map(({ item, match }) => ({ name: item.name, score: match.score })),
  };

  // Misfits are filtered both ways: a sponsor that won't fund this cause, and a campaign that turns down an industry.
  const blockedHere = all.find((r) => r.match.grade === "Not eligible" && r.match.blockers[0]?.includes(" excludes "));
  const rule = rows
    .map(({ opp }) => {
      const blocked = rankSponsors(opp, sponsors).find((x) => x.item.id !== blockedHere?.item.id && x.match.blockers.some((b) => b.includes("doesn't accept")));
      return blocked && { opp, blocked };
    })
    .find(Boolean);

  const warmIntro = sp.approach !== "open";
  const draft = warmIntro ? optInAsk(lead, sp, top.match) : directPitch(lead, sp, top.match);
  const story: MatchStoryData = {
    campaign: { id: lead.id, title: lead.title },
    sponsor: {
      name: sp.name,
      kind: sponsorKind(sp),
      budget,
      warmIntro,
      wants: [
        { label: "Causes", value: sp.causes.map((c) => label(CAUSES, c)).join(", ") },
        { label: "Where", value: givingArea(sp) },
        { label: "People", value: sp.audiences.map((a) => label(AUDIENCES, a)).join(", ") },
        { label: "Goals", value: sp.objectives.map((o) => label(OBJECTIVES, o)).join(", ") },
        { label: "Plans ahead", value: `About ${sp.leadTimeDays} days` },
      ],
    },
    match: top.match,
    ask: top.match.suggestedTier && { tier: top.match.suggestedTier.name.split(" — ")[0], amount: top.match.suggestedTier.amount },
    draft: {
      subject: draft.subject,
      lines: draft.body
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !/^(hi|hello)\b/i.test(l) && !/:$/.test(l))
        .slice(0, 4)
        .map((l) => (l.length > 170 ? `${l.slice(0, l.lastIndexOf(" ", 170))}…` : l)),
    },
    blocked: blockedHere && { name: blockedHere.item.name, why: blockedHere.match.blockers[0].replace(`${blockedHere.item.name} `, "") },
    declined: rule && {
      campaign: rule.opp.title,
      rule: rule.opp.excludedIndustries.map((i) => label(INDUSTRIES, i).toLowerCase()).join(", "),
      name: rule.blocked.item.name,
    },
  };

  const featured = rows.filter((r) => r.opp.featured).slice(0, 3);
  const taken = new Set(featured.map((r) => r.opp.id));
  const nearly = rows
    .filter((r) => !taken.has(r.opp.id) && r.f.percent >= 50 && r.f.percent < 100)
    .sort((a, b) => b.f.percent - a.f.percent)
    .slice(0, 3);
  const barRows = [...rows].sort((a, b) => b.f.percent - a.f.percent).slice(0, 4);

  return (
    <div>
      {/* Hero: the promise. Sponsors with verified funds are already looking for campaigns like yours. */}
      <section className="grid items-center gap-14 pb-20 pt-2 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10 lg:pb-24 lg:pt-6">
        <div className="animate-rise">
          <p className="inline-flex items-center gap-2 rounded-full bg-mint-soft px-3.5 py-1.5 text-xs font-bold text-good">
            <span className="h-2 w-2 animate-blink rounded-full bg-mint" />
            Free for nonprofits · {sponsors.length} sponsors ready to give
          </p>
          <h1 className="display mt-6 text-[clamp(2.7rem,5.6vw,4.7rem)]">
            Sponsors&nbsp;are <span className="text-brand">already looking for&nbsp;you.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted sm:text-xl">
            Find verified brands and donors ready to back your campaign with real capital, today. Post it free, and Peep pairs you with the ones whose goals you meet.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <PdfDropButton tone="light" className="px-7 py-3.5 text-base" />
            <Link href="/find" className="btn-secondary group px-7 py-3.5 text-base">
              Start a new campaign <Arrow />
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold">
            {["Verified funds", "Matched both ways", "Free to post"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span aria-hidden className="grid h-5 w-5 place-items-center rounded-full bg-mint text-[11px] text-[#2a2826]">
                  ✓
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* An arched window onto Peep's sky. Peep (PeepCompanion) stands in it while it's on screen; the proof floats above her and hangs below the arch, never over her. */}
        <div className="animate-rise relative mx-auto mb-16 w-full max-w-[500px] px-6 [animation-delay:120ms] sm:px-10 lg:mb-20">
          <div data-peep-anchor className="relative aspect-[5/6] overflow-hidden rounded-b-[40px] rounded-t-[999px] shadow-[0_40px_80px_-40px_rgba(60,30,90,0.6)] ring-1 ring-line">
            <World kind="day" nightKind="night" />
          </div>
          <div className="glass animate-float absolute left-0 top-[5%] w-[56%] rounded-2xl p-2.5 sm:p-3">
            <span className="rounded-full bg-mint-soft px-2 py-0.5 text-[10px] font-bold text-good">✓ Funds verified</span>
            <p className="mt-2 truncate text-sm font-bold">{sp.name}</p>
            <p className="truncate text-xs text-muted">
              Ready to give <b className="text-ink">{budget}</b>
            </p>
          </div>
          <div className="glass animate-float absolute right-0 top-[24%] w-[50%] rounded-2xl p-2.5 [animation-delay:1.4s] sm:p-3">
            <p className="eyebrow text-[10px] text-muted">Wants to support</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {[label(CAUSES, sp.causes[0]), sp.geography.metros[0], label(OBJECTIVES, sp.objectives[0]).split(" & ")[0]].filter(Boolean).map((w) => (
                <span key={w} className="rounded-full bg-sky-soft px-2 py-0.5 text-[11px] font-semibold text-ink">
                  {w}
                </span>
              ))}
            </div>
          </div>
          <div className="glass animate-float absolute -bottom-12 left-1/2 w-[78%] -translate-x-1/2 rounded-2xl p-2.5 [animation-delay:2.6s] sm:p-3">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-mint font-display text-lg font-semibold text-[#2a2826]">{top.match.score}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">Fit with your campaign</p>
                <p className="truncate text-sm font-bold">{lead.title}</p>
              </div>
              {story.ask && (
                <p className="hidden shrink-0 rounded-xl bg-accent-soft px-2.5 py-1.5 text-xs sm:block">
                  Ask <b>{money(story.ask.amount)}</b>
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Pledge ticker */}
      <FullBleed className="overflow-hidden border-y border-line bg-card py-4">
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

      {/* Step one: the PDF → campaign tool */}
      <FullBleed className="mt-16 px-2 sm:mt-24 sm:px-6" data-nav-dark>
        <div className="relative mx-auto max-w-[1320px] overflow-hidden rounded-[32px]">
          <World kind="night" />
          <div className="relative z-10 mx-auto max-w-6xl px-4 pb-24 pt-14 sm:px-8 sm:pb-36 sm:pt-20">
            <div className="mx-auto max-w-3xl text-center">
              <p className="eyebrow text-white/70">Start in a minute</p>
              <h2 className="display mt-4 text-[clamp(2.4rem,5.6vw,4.6rem)] text-[#fdf8f2]">Your pitch deck, turned into a funded campaign.</h2>
              <p className="mx-auto mt-5 max-w-2xl text-lg text-white/75">
                Drop in your sponsorship PDF. Peep builds your campaign page, flags anything missing, and posts it free once it&apos;s ready.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <PdfDropButton catchDrops={false} className="min-w-[230px] px-7 py-3.5 text-base" />
                <Link href="/find" className="btn-glass group min-w-[200px] px-7 py-3.5 text-base">
                  Start a new campaign <Arrow />
                </Link>
              </div>
              <p className="mt-4 text-sm text-white/60">Or drag your PDF anywhere on this page.</p>
            </div>
            <WatchFrame className="mx-auto mt-12 max-w-5xl" minScale={0.7}>
              <PdfDropDemo data={dropDemo} />
            </WatchFrame>
          </div>
        </div>
      </FullBleed>

      {/* Step two: how a match is made, on one real example */}
      <MatchStory data={story} />

      {/* Both sides of the table */}
      <WhyPeep data={why} />

      {/* Featured campaigns */}
      {featured.length > 0 && (
        <section className="pb-24">
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

      {/* Pledges, in the open */}
      <FullBleed className="px-2 sm:px-6">
        <div className="relative mx-auto max-w-[1320px] overflow-hidden rounded-[32px]">
          <World kind="mountains" />
          <div className="pointer-events-none relative z-10 flex min-h-[640px] flex-col justify-between gap-10 p-6 sm:min-h-[540px] sm:p-12">
            <div className="max-w-xl text-white [text-shadow:0_2px_24px_rgba(40,20,70,0.45)]">
              <p className="eyebrow text-white/80">Pledges</p>
              <h2 className="display mt-3 text-[clamp(2.3rem,5vw,4.2rem)]">Every yes, out in the open.</h2>
              <p className="mt-3 text-lg font-semibold text-white/90">Each pledge fills your bar and claims its tier, on a page you can share with your board.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { v: <>{money(totalPledged)}</>, l: "pledged so far" },
                { v: <CountUp to={rows.length} />, l: "live campaigns" },
                { v: <CountUp to={sponsors.length} />, l: "sponsors ready to give" },
                { v: <CountUp to={Object.keys(CAUSES).length} />, l: "cause areas" },
              ].map((x) => (
                <div key={x.l} className="glass rounded-2xl p-4 sm:p-5">
                  <p className="display text-3xl sm:text-5xl">{x.v}</p>
                  <p className="mt-1 text-sm text-muted">{x.l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </FullBleed>
      <section className="grid gap-6 pb-24 pt-8 md:grid-cols-2 [&>*]:min-w-0">
        <Reveal className="rounded-3xl bg-card p-6 ring-1 ring-line">
          <h3 className="text-2xl font-semibold">Closest to their goal</h3>
          <div className="mt-5 space-y-3">{barRows.slice(0, 3).map(goalRow)}</div>
          {barRows.length > 3 && (
            <More label={`Show ${barRows.length - 3} more`} className="mt-3">
              <div className="space-y-3">{barRows.slice(3).map(goalRow)}</div>
            </More>
          )}
        </Reveal>
        <Reveal delay={100} className="rounded-3xl bg-card p-6 ring-1 ring-line">
          <h3 className="text-2xl font-semibold">Latest pledges</h3>
          <ul className="mt-5 divide-y divide-line">{recent.slice(0, 3).map(pledgeRow)}</ul>
          {recent.length > 3 && (
            <More label={`Show ${Math.min(6, recent.length) - 3} more`} className="mt-1">
              <ul className="divide-y divide-line">{recent.slice(3, 6).map(pledgeRow)}</ul>
            </More>
          )}
        </Reveal>
      </section>

      {/* Causes */}
      <section className="pb-24">
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
        <h2 className="display text-center text-4xl sm:text-5xl">Questions, answered</h2>
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

      {/* Closing call to action */}
      <Reveal>
        <section className="group relative overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,#ffd9c2_0%,#f7b9cf_45%,#b9a6f0_100%)] px-6 py-16 text-center text-[#2a2826] sm:px-16 sm:py-20">
          <PeepMark className="animate-float mx-auto h-24 w-28" />
          <h2 className="display mx-auto mt-6 max-w-3xl text-[clamp(2.4rem,5.5vw,4.4rem)]">Get the right people in the room, when it matters most.</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-[#2a2826]/75">Post your campaign free, and let Peep make the introductions.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/import" className="btn-primary group px-7 py-3.5 text-base">
              Upload your pitch PDF <Arrow />
            </Link>
            <Link href="/find" className="btn-bright group px-7 py-3.5 text-base">
              Start a new campaign <Arrow />
            </Link>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
