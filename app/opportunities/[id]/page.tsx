import Link from "next/link";
import { notFound } from "next/navigation";
import { placeLabel } from "@/components/CampaignCard";
import { CoverArt } from "@/components/CoverArt";
import { FundingStats } from "@/components/Funding";
import { MatchCard } from "@/components/MatchCard";
import { PeepMark } from "@/components/Peep";
import { ShareButton } from "@/components/ShareButton";
import { TierRail, type SponsorOption } from "@/components/TierRail";
import { Arrow, Eyebrow, Pill, SampleTag } from "@/components/ui";
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

  const details: [string, React.ReactNode][] = [
    ...(opp.startDate ? [["When", `${fmt(opp.startDate)}${opp.endDate && opp.endDate !== opp.startDate ? ` – ${fmt(opp.endDate)}` : ""}`] as [string, React.ReactNode]] : []),
    ["Where", placeLabel(opp)],
    ...(opp.reachNote || opp.expectedReach ? [["Reach", opp.reachNote ?? `${opp.expectedReach!.toLocaleString()} people`] as [string, React.ReactNode]] : []),
    ...(opp.audiences.length ? [["Serves", opp.audiences.map((a) => label(AUDIENCES, a)).join(", ")] as [string, React.ReactNode]] : []),
    ...(opp.asks.length ? [["Asking for", opp.asks.map((a) => label(SUPPORT_TYPES, a)).join(", ")] as [string, React.ReactNode]] : []),
    ...(opp.partners.length ? [["Partners", opp.partners.join(", ")] as [string, React.ReactNode]] : []),
    ...(opp.excludedIndustries.length
      ? [["Won't accept", `${opp.excludedIndustries.map((i) => label(INDUSTRIES, i)).join(", ")} sponsors`] as [string, React.ReactNode]]
      : []),
  ];

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
      {/* Title block */}
      <header className="animate-rise max-w-4xl">
        <Eyebrow>
          {KIND[opp.kind]} · {opp.causes[0] ? label(CAUSES, opp.causes[0]) : "Community"}
        </Eyebrow>
        <h1 className="display mt-4 text-4xl font-semibold sm:text-6xl">{opp.title}</h1>
        <p className="mt-4 max-w-3xl text-lg text-muted">{opp.summary}</p>
      </header>

      {/* Cover + funding */}
      <section className="mt-8 grid gap-8 lg:grid-cols-12 [&>*]:min-w-0">
        <CoverArt id={opp.id} cause={opp.causes[0]} image={opp.coverImage} className="group aspect-[16/9] rounded-[28px] lg:col-span-8" />
        <aside className="lg:col-span-4">
          <FundingStats f={f} />
          <div className="mt-6 space-y-2">
            <a href="#tiers" className="btn-primary group w-full py-3">
              Sponsor this campaign <Arrow />
            </a>
            <ShareButton />
          </div>
          <div className="mt-6 space-y-2 border-t border-line pt-5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{opp.orgName}</span>
              {opp.sample && <SampleTag />}
              {opp.featured && <span className="eyebrow rounded-full bg-ink px-2.5 py-1 text-[10px] text-bg">★ Featured</span>}
            </div>
            <p className="text-muted">
              {opp.orgType === "other" ? "Not a 501(c)(3)" : label(ORG_TYPES, opp.orgType)}
              {opp.ein && <span className="font-mono text-xs"> · EIN {opp.ein}</span>}
            </p>
            {opp.contact.website && (
              <a className="inline-block text-brand hover:underline" href={opp.contact.website} target="_blank" rel="noreferrer">
                {opp.contact.website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        </aside>
      </section>

      {/* Section nav */}
      <nav className="sticky top-[76px] z-20 mt-12 flex gap-1 overflow-x-auto rounded-full glass p-1.5 sm:top-[92px]">
        {[
          ["#story", "Story"],
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
            <h2 className="display text-3xl font-semibold">Story</h2>
            <div className="mt-4 space-y-4 text-lg leading-relaxed">
              {(opp.story ?? opp.summary).split(/\n{2,}/).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
            {opp.gallery && opp.gallery.length > 0 && (
              <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {opp.gallery.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src} alt={`${opp.title}, photo ${i + 1}`} className="aspect-[4/3] w-full rounded-2xl object-cover ring-1 ring-line" />
                ))}
              </div>
            )}
            <dl className="mt-8 border-t border-line">
              {details.map(([k, v]) => (
                <div key={k} className="grid gap-1 border-b border-line py-3 sm:grid-cols-[140px_1fr]">
                  <dt className="eyebrow text-[10px] text-muted">{k}</dt>
                  <dd className="text-sm">{v}</dd>
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
              <h2 className="display text-3xl font-semibold">Best-fit sponsors</h2>
              <p className="mt-1 text-sm text-muted">
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
            <h2 className="display text-3xl font-semibold">Sponsors</h2>
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
        </div>

        <aside id="tiers" className="scroll-mt-44 lg:col-span-4">
          <div className="lg:sticky lg:top-32">
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
