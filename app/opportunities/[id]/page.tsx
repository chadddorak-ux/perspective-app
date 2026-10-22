import Link from "next/link";
import { notFound } from "next/navigation";
import { placeLabel } from "@/components/CampaignCard";
import { CauseArt, LOOKS, artTheme } from "@/components/CauseArt";
import { FundingStats } from "@/components/Funding";
import { MatchCard } from "@/components/MatchCard";
import { PeepMark } from "@/components/Peep";
import { ShareButton } from "@/components/ShareButton";
import { TierRail, type SponsorOption } from "@/components/TierRail";
import { Reveal } from "@/components/Motion";
import { Arrow, Pill, SampleTag, Scribble } from "@/components/ui";
import { fundingFor } from "@/lib/funding";
import { money, rankSponsors, scoreMatch } from "@/lib/match";
import { AUDIENCES, CAUSES, INDUSTRIES, ORG_TYPES, SUPPORT_TYPES, label } from "@/lib/taxonomy";
import { getOpportunity, listPledges, listSponsors } from "@/lib/store";

export const dynamic = "force-dynamic";

const KIND = { event: "Event", program: "Program", campaign: "Campaign", general: "General support" };

function fmt(d: string) {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const justPosted = (await searchParams)?.new === "1";
  const opp = await getOpportunity(id);
  if (!opp) notFound();
  const [sponsors, pledges] = await Promise.all([listSponsors(), listPledges()]);
  const f = fundingFor(opp, pledges);
  const mine = pledges.filter((p) => p.opportunityId === opp.id).sort((a, b) => b.amount - a.amount);
  const ranked = rankSponsors(opp, sponsors);
  const eligible = ranked.filter((r) => r.match.grade !== "Not eligible");
  const ineligible = ranked.filter((r) => r.match.grade === "Not eligible");
  const strong = eligible.filter((r) => r.match.grade === "Excellent" || r.match.grade === "Strong");
  const options: SponsorOption[] = sponsors
    .map((s) => ({ id: s.id, name: s.name, blocked: scoreMatch(opp, s).blockers[0] }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const when = opp.startDate ? `${fmt(opp.startDate)}${opp.endDate && opp.endDate !== opp.startDate ? ` – ${fmt(opp.endDate)}` : ""}` : undefined;
  const reach = opp.reachNote ?? (opp.expectedReach ? `${opp.expectedReach.toLocaleString()} people` : undefined);
  const details: [Icon, string, string][] = [
    ...(when ? [["calendar", "When", when] as [Icon, string, string]] : []),
    ["pin", "Where", placeLabel(opp)],
    ...(reach ? [["people", "Reach", reach] as [Icon, string, string]] : []),
    ...(opp.audiences.length ? [["heart", "Serves", opp.audiences.map((a) => label(AUDIENCES, a)).join(", ")] as [Icon, string, string]] : []),
    ...(opp.asks.length ? [["hand", "Asking for", opp.asks.map((a) => label(SUPPORT_TYPES, a)).join(", ")] as [Icon, string, string]] : []),
    ...(opp.partners.length ? [["link", "Partners", opp.partners.join(", ")] as [Icon, string, string]] : []),
    ...(opp.excludedIndustries.length ? [["ban", "Won't accept", `${opp.excludedIndustries.map((i) => label(INDUSTRIES, i)).join(", ")} sponsors`] as [Icon, string, string]] : []),
  ];
  const theme = artTheme(opp);
  const look = LOOKS[theme];
  const paras = (opp.story ?? opp.summary).split(/\n{2,}/);
  const verified = opp.orgType !== "other" && !!opp.ein;

  return (
    <div className="-mt-2">
      {justPosted && (
        <div className="group animate-pop mb-8 flex flex-wrap items-center gap-4 rounded-3xl bg-mint-soft p-5 ring-1 ring-mint/40 sm:p-6" role="status">
          <PeepMark className="h-14 w-16 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-2xl font-semibold">Your campaign is live.</p>
            <p className="mt-1 text-sm text-muted">
              {strong.length
                ? `Peep found ${strong.length} strong sponsor fit${strong.length === 1 ? "" : "s"}, led by ${strong.slice(0, 3).map((r) => r.item.name).join(", ")}. Share your page, or reach out to them below.`
                : "Share your page to start collecting pledges. Peep will flag new sponsors that fit as they join."}
            </p>
          </div>
          <a href="#matches" className="btn-primary group">
            See your matches <Arrow />
          </a>
        </div>
      )}
      {/* The one-pager: every campaign gets the same polished poster, with art for its cause */}
      <section className="animate-rise relative overflow-hidden rounded-[36px] bg-card ring-1 ring-line">
        <div aria-hidden className="absolute inset-0 opacity-[0.5] [background-image:radial-gradient(var(--line)_1.2px,transparent_1.2px)] [background-size:22px_22px]" />
        <div className="relative grid lg:grid-cols-[1.12fr_1fr] [&>*]:min-w-0">
          <div className="flex flex-col p-6 sm:p-10 lg:p-12">
            <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-muted">
              <PeepMark className="h-6 w-7" />
              <span className="eyebrow text-[11px]">A Peep one-pager</span>
              <span aria-hidden>·</span>
              <span className="eyebrow text-[11px] text-brand">
                {KIND[opp.kind]} · {opp.causes[0] ? label(CAUSES, opp.causes[0]) : "Community"}
              </span>
            </p>
            <h1 className={`display mt-5 font-semibold leading-[0.98] ${opp.title.length > 30 ? "text-[clamp(2.3rem,4.4vw,3.7rem)]" : "text-[clamp(2.5rem,5.4vw,4.6rem)]"}`}>{opp.title}</h1>
            <p className="mt-5 max-w-xl text-xl text-muted">{opp.summary}</p>
            <p className="mt-6 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">by</span>
              <span className="font-bold">{opp.orgName}</span>
              {opp.sample && <SampleTag />}
              {verified && <span className="rounded-full bg-mint-soft px-2.5 py-1 text-[11px] font-bold text-good">✓ {label(ORG_TYPES, opp.orgType)}</span>}
              {opp.ein && <span className="font-mono text-xs text-muted">EIN {opp.ein}</span>}
              {opp.featured && <span className="eyebrow rounded-full bg-ink px-2.5 py-1 text-[10px] text-bg">★ Featured</span>}
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {details.filter(([, k]) => k === "When" || k === "Where").map(([icon, k, v]) => (
                <li key={k} className="flex max-w-full items-center gap-2 rounded-full bg-bg px-3.5 py-2 text-sm font-semibold ring-1 ring-line">
                  <Glyph name={icon} className="h-4 w-4 shrink-0 text-brand" />
                  <span className="truncate">{k === "When" && opp.startDate ? fmt(opp.startDate) : v}</span>
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-8">
              <div className="flex items-end justify-between gap-4">
                <p>
                  <span className="display text-4xl font-semibold">{money(f.pledged)}</span>
                  <span className="text-sm text-muted"> pledged of {money(f.goal)}</span>
                </p>
                <p className="text-right text-sm text-muted">
                  {f.state === "closed" ? "Ended" : f.daysLeft !== undefined ? <><b className="text-ink">{f.daysLeft}</b> days to go</> : "Ongoing"}
                </p>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-bg ring-1 ring-line">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(f.percent, 2))}%`, background: `linear-gradient(90deg, ${look.sky[1]}, ${look.accent})` }} />
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <a href="#tiers" className="btn-primary group px-6 py-3">
                  Sponsor this campaign <Arrow />
                </a>
                <ShareButton className="px-6 py-3" />
              </div>
            </div>
          </div>

          <div className="relative self-center p-4 pt-0 sm:p-8 sm:pt-8 lg:pl-0">
            <CauseArt theme={theme} className="mx-auto h-[340px] max-w-[460px] rounded-b-[28px] rounded-t-[999px] ring-1 ring-line sm:h-[440px] lg:h-[520px]" />
            {/* A round seal, like a sticker on a printed one-sheet */}
            <div className="absolute right-6 top-6 grid h-24 w-24 rotate-[10deg] place-items-center rounded-full text-center text-[#2a2826] shadow-[0_14px_30px_-12px_rgba(0,0,0,0.5)] sm:right-10 sm:top-10" style={{ background: look.accent }}>
              <span>
                <span className="display block text-3xl font-semibold leading-none">{f.percent}%</span>
                <span className="eyebrow text-[9px]">funded</span>
              </span>
            </div>
            {opp.coverImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <figure className="absolute bottom-2 left-2 w-[44%] max-w-[230px] rotate-[-6deg] rounded-xl bg-white p-2 pb-1.5 shadow-[0_20px_40px_-16px_rgba(0,0,0,0.55)] sm:bottom-6 lg:-left-6">
                <img src={opp.coverImage} alt={`${opp.title} cover`} className="aspect-[4/3] w-full rounded-lg object-cover" />
                <figcaption className="pt-1 text-center font-display text-xs italic text-[#6e6a64]">from the pitch</figcaption>
              </figure>
            )}
          </div>
        </div>
      </section>

      {/* Section nav */}
      <nav className="sticky top-[76px] z-20 mt-12 flex gap-1 overflow-x-auto rounded-full glass p-1.5 sm:top-[92px]">
        {[
          ["#story", "Story"],
          ["#glance", "At a glance"],
          ["#tiers", `Tiers (${opp.tiers.length})`],
          ["#matches", "Best-fit sponsors"],
          ["#sponsors", `Sponsors (${f.sponsors})`],
        ].map(([href, l]) => (
          <a key={href} href={href} className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold text-muted hover:bg-bg hover:text-ink">
            {l}
          </a>
        ))}
      </nav>

      <div className="mt-10 grid gap-12 lg:grid-cols-12 [&>*]:min-w-0">
        <div className="space-y-16 lg:col-span-8">
          <section id="story" className="scroll-mt-44">
            <Chapter n="01" title="The story" color={look.accent} />
            <p className="mt-6 font-display text-2xl leading-snug sm:text-[1.7rem]">{paras[0]}</p>
            <div className="mt-5 space-y-4 text-lg leading-relaxed text-muted">
              {paras.slice(1).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
            {opp.gallery && opp.gallery.length > 0 && (
              <div className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-3">
                {opp.gallery.map((src, i) => (
                  <figure key={i} className={`rounded-xl bg-white p-2 pb-3 shadow-[0_18px_36px_-18px_rgba(0,0,0,0.5)] transition-transform hover:rotate-0 ${["-rotate-2", "rotate-2", "-rotate-1"][i % 3]}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`${opp.title}, photo ${i + 1}`} className="aspect-[4/3] w-full rounded-lg object-cover" />
                  </figure>
                ))}
              </div>
            )}
          </section>

          <section id="glance" className="scroll-mt-44">
            <Chapter n="02" title="At a glance" color={look.accent} />
            <dl className="mt-6 grid gap-3 sm:grid-cols-2">
              {details.map(([icon, k, v]) => (
                <div key={k} className="flex gap-3 rounded-2xl bg-card p-4 ring-1 ring-line">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[#2a2826]" style={{ background: icon === "ban" ? "var(--line)" : look.sky[2] }}>
                    <Glyph name={icon} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <dt className="eyebrow text-[10px] text-muted">{k}</dt>
                    <dd className="mt-0.5 text-sm font-semibold">{v}</dd>
                  </div>
                </div>
              ))}
            </dl>
            <div className="mt-5 flex flex-wrap gap-1.5">
              {opp.causes.map((c) => (
                <Link key={c} href={`/opportunities?cause=${c}`}>
                  <Pill>{label(CAUSES, c)}</Pill>
                </Link>
              ))}
            </div>
          </section>

          <section id="matches" className="scroll-mt-44 space-y-4">
            <div>
              <Chapter n="03" title="Best-fit sponsors" color={look.accent} />
              <p className="mt-3 text-sm text-muted">
                {eligible.filter((r) => r.match.score >= 70).length} strong matches from the network. Draft a pitch, or request a warm intro and track it on the{" "}
                <Link href="/intros" className="text-brand hover:underline">Intros</Link> board.
              </p>
            </div>
            {eligible.slice(0, 5).map((r, i) => (
              <MatchCard key={r.item.id} opp={opp} sponsor={r.item} match={r.match} viewer="organization" rank={i + 1} />
            ))}
            {eligible.length > 5 && (
              <details className="group">
                <summary className="btn-secondary w-full cursor-pointer list-none">Show {eligible.length - 5} more matches</summary>
                <div className="mt-4 space-y-4">
                  {eligible.slice(5).map((r, i) => (
                    <MatchCard key={r.item.id} opp={opp} sponsor={r.item} match={r.match} viewer="organization" rank={i + 6} />
                  ))}
                </div>
              </details>
            )}
            {ineligible.length > 0 && (
              <details className="card p-5 text-sm">
                <summary className="cursor-pointer font-medium">{ineligible.length} not eligible</summary>
                <ul className="mt-3 space-y-1 text-muted">
                  {ineligible.map((r) => (
                    <li key={r.item.id}>
                      <span className="text-ink">{r.item.name}</span>: {r.match.blockers.join("; ")}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          <section id="sponsors" className="scroll-mt-44">
            <Chapter n="04" title="Backed by" color={look.accent} />
            {mine.length === 0 ? (
              <p className="mt-3 text-muted">No sponsors yet. Be the first to back this campaign.</p>
            ) : (
              <ul className="mt-4 divide-y divide-line border-y border-line">
                {mine.map((p) => (
                  <li key={p.id} className="flex items-center gap-4 py-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink font-mono text-xs text-bg">
                      {p.sponsorName.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      {p.sponsorId ? (
                        <Link href={`/sponsors/${p.sponsorId}`} className="font-medium hover:text-brand">{p.sponsorName}</Link>
                      ) : (
                        <span className="font-medium">{p.sponsorName}</span>
                      )}
                      <p className="text-xs text-muted">
                        {p.tierName}
                        {p.status === "pledged" && " · awaiting confirmation"}
                        {p.contact === "essentials" && " · essentials only"}
                      </p>
                    </div>
                    <span className="font-mono text-sm font-semibold">{money(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* The level playing field, said out loud */}
          <div className="group flex flex-wrap items-center gap-5 rounded-3xl p-6 ring-1 ring-line sm:p-8" style={{ background: `linear-gradient(120deg, color-mix(in srgb, ${look.sky[2]} 22%, var(--card)), var(--card))` }}>
            <PeepMark className="h-14 w-16 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl font-semibold">Built by Peep from {opp.orgName}&apos;s pitch.</p>
              <p className="mt-1 text-sm text-muted">Every campaign on Peep starts as the same polished one-pager, so ideas compete, not design budgets.</p>
            </div>
            <Link href="/import" className="btn-secondary group">
              Turn your pitch into one <Arrow />
            </Link>
          </div>
        </div>

        <aside id="tiers" className="scroll-mt-44 lg:col-span-4">
          <div className="lg:sticky lg:top-32">
            <div className="mb-6 rounded-3xl bg-card p-5 ring-1 ring-line">
              <FundingStats f={f} />
            </div>
            <h2 className="eyebrow mb-3 text-muted">Choose a tier</h2>
            {opp.tiers.length ? (
              <TierRail opportunityId={opp.id} tiers={f.tiers} sponsors={options} closed={f.state === "closed"} />
            ) : (
              <p className="card p-5 text-sm text-muted">This campaign hasn&apos;t listed sponsorship tiers yet.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Chapter({ n, title, color }: { n: string; title: string; color: string }) {
  return (
    <Reveal className="flex items-baseline gap-4">
      <span className="font-display text-5xl font-semibold leading-none" style={{ color }}>
        {n}
      </span>
      <h2 className="display text-3xl font-semibold sm:text-4xl">
        <Scribble color={color}>{title}</Scribble>
      </h2>
    </Reveal>
  );
}

type Icon = "calendar" | "pin" | "people" | "heart" | "hand" | "link" | "ban";
const GLYPHS: Record<Icon, string> = {
  calendar: "M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5ZM4 10h16M8.5 3v4M15.5 3v4",
  pin: "M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21Zm0-8.7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  people: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9c0-3.3 2.7-6 6-6s6 2.7 6 6M16.5 11a3 3 0 1 0-1.4-5.7M17.5 14.3c2 .7 3.5 2.9 3.5 5.7",
  heart: "M12 20s-7.5-4.6-9-9.2C2 7.4 4.2 4.5 7.4 4.5c2 0 3.4 1.1 4.6 2.8 1.2-1.7 2.6-2.8 4.6-2.8 3.2 0 5.4 2.9 4.4 6.3C19.5 15.4 12 20 12 20Z",
  hand: "M7 11V5.5a1.5 1.5 0 0 1 3 0V10m0-.5V4a1.5 1.5 0 0 1 3 0v6m0-4.5a1.5 1.5 0 0 1 3 0V11m0-3a1.5 1.5 0 0 1 3 0v6.5c0 4-2.7 6.5-6.5 6.5-2.6 0-4.3-1.2-5.6-3.3L5 14.5a1.5 1.5 0 0 1 2.4-1.8L9 14",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  ban: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM5.6 5.6l12.8 12.8",
};

function Glyph({ name, className = "" }: { name: Icon; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={GLYPHS[name]} />
    </svg>
  );
}
