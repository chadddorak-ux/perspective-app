import Link from "next/link";
import { notFound } from "next/navigation";
import { PitchPanel } from "@/components/brand/PitchPanel";
import { PledgeBadge } from "@/components/brand/PledgeBadge";
import { MatchCard } from "@/components/MatchCard";
import { More } from "@/components/More";
import { Arrow, Pill, SampleTag } from "@/components/ui";
import { kitFor, svgDataUrl } from "@/lib/brand-kit";
import { fundingFor } from "@/lib/funding";
import { money, rankOpportunities, withSmallOrgSpotlight } from "@/lib/match";
import { budgetCalendar } from "@/lib/pitch";
import { AUDIENCES, CAUSES, INDUSTRIES, OBJECTIVES, SPONSOR_TYPES, SUPPORT_TYPES, US_STATES, label } from "@/lib/taxonomy";
import { getSponsor, listOpportunities, listPitches, listPledges } from "@/lib/store";

export const dynamic = "force-dynamic";

const APPROACH = { open: "Open to pitches on Peep", "intro-preferred": "Prefers warm introductions", "invite-only": "Invite-only" };

/** A brand's public profile: who it is, what it funds, when its budget opens, and how to pitch it. */
export default async function SponsorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sp = await getSponsor(id);
  if (!sp) notFound();
  const [opps, pledges, pitches] = await Promise.all([listOpportunities(), listPledges(), listPitches()]);
  const ranked = withSmallOrgSpotlight(rankOpportunities(sp, opps)).filter((r) => r.match.grade !== "Not eligible");
  const backed = pledges.filter((p) => p.sponsorId === sp.id && p.recognition !== "anonymous" && p.recognition !== "private");
  const backedTotal = backed.reduce((sum, p) => sum + p.amount, 0);
  const kit = kitFor(sp);
  const cal = budgetCalendar(sp);
  const where =
    sp.geography.scope === "national"
      ? "Nationwide"
      : [...sp.geography.metros, ...sp.geography.states.map((s) => US_STATES[s] ?? s)].join(", ") + ` (${sp.geography.scope})`;

  return (
    <div className="space-y-10">
      {/* The profile card, with a peek at the brand kit */}
      <section className="relative overflow-hidden rounded-[36px] bg-card ring-1 ring-line">
        <div aria-hidden className="absolute inset-0 opacity-50 [background-image:radial-gradient(var(--line)_1.2px,transparent_1.2px)] [background-size:22px_22px]" />
        <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] [&>*]:min-w-0">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="brand">{label(SPONSOR_TYPES, sp.type)}</Pill>
              {sp.industry && <Pill>{label(INDUSTRIES, sp.industry)}</Pill>}
              {sp.sample && <SampleTag />}
              {sp.givingBudget ? <span className="rounded-full bg-mint-soft px-2.5 py-1 text-[11px] font-bold text-good">✓ Funds verified</span> : null}
            </div>
            <div className="mt-5 flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={svgDataUrl(kit.mark)} alt="" className="h-16 w-16 rounded-2xl shadow-lg" />
              <div className="min-w-0">
                <h1 className="display text-4xl font-semibold leading-tight sm:text-5xl">{sp.name}</h1>
                {kit.tagline && <p className="mt-1 text-muted">{kit.tagline}</p>}
              </div>
            </div>
            {sp.about && <p className="mt-5 max-w-2xl text-lg text-muted">{sp.about}</p>}
            {sp.peepPledge && <PledgeBadge pledge={sp.peepPledge} className="mt-5" />}
            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              {[
                ["Typical gift", `${money(sp.budget.min)} – ${money(sp.budget.max)}`],
                ["Where", where],
                ["Gives", sp.supportTypes.map((t) => label(SUPPORT_TYPES, t)).join(", ")],
                ["Decides", `About ${sp.leadTimeDays} days ahead`],
                ["Approach", `${APPROACH[sp.approach]}${sp.requires501c3 ? " · 501(c)(3) only" : ""}`],
                ...(cal ? [["Budget year ends", `${cal.yearEnds} (${cal.daysToYearEnd} days)`]] : []),
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-bg p-3 ring-1 ring-line">
                  <dt className="eyebrow text-[9px] text-muted">{k}</dt>
                  <dd className="mt-0.5 font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            {cal && <p className="mt-3 text-sm text-muted">Best time to ask: {cal.bestWindow}.</p>}
            <div className="mt-5 flex flex-wrap gap-1.5">
              {sp.causes.map((c, i) => (
                <Pill key={c}>
                  {i + 1}. {label(CAUSES, c)}
                </Pill>
              ))}
            </div>
            <More label="What else they look for" className="mt-2">
              <div className="flex flex-wrap gap-1.5">
                {sp.objectives.map((o) => (
                  <Pill key={o} tone="brand">
                    {label(OBJECTIVES, o)}
                  </Pill>
                ))}
                {sp.audiences.map((a) => (
                  <Pill key={a} tone="accent">
                    {label(AUDIENCES, a)}
                  </Pill>
                ))}
              </div>
              {sp.excludedCauses.length > 0 && <p className="mt-2 text-xs text-muted">Doesn&apos;t fund: {sp.excludedCauses.map((c) => label(CAUSES, c)).join(", ")}</p>}
            </More>
          </div>

          {/* Brand kit: the public bits, with the rest locked until a gift clears */}
          <div className="self-start rounded-3xl bg-bg p-5 ring-1 ring-line">
            <p className="eyebrow text-[10px] text-brand">Brand kit</p>
            <div className="mt-3 rounded-2xl bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={svgDataUrl(kit.wordmark)} alt={`${sp.name} wordmark`} className="h-14 w-full object-contain" />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {kit.colors.map((c) => (
                <span key={c.hex} className="inline-flex items-center gap-1.5 rounded-full bg-card px-2 py-1 text-[11px] font-semibold ring-1 ring-line">
                  <span className="h-3 w-3 rounded-full ring-1 ring-black/10" style={{ background: c.hex }} />
                  {c.name}
                </span>
              ))}
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              {["Vector logos (SVG, light and dark)", "Approved boilerplate and tagline", "Usage rules and clear space", "Approved photos"].map((x) => (
                <li key={x} className="flex items-center gap-2 text-muted">
                  <span aria-hidden>🔒</span>
                  {x}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted">
              Funded by {sp.name}? The full kit unlocks on your campaign page the moment the gift clears. No more emailing for &ldquo;the logo, but as a vector.&rdquo;
            </p>
            {kit.origin === "drafted" && <p className="mt-2 text-[11px] text-muted">Drafted from public information until {sp.name} uploads its own.</p>}
          </div>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] [&>*]:min-w-0">
        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          {sp.approach !== "invite-only" ? (
            <PitchPanel sponsor={sp} opps={ranked.map((r) => r.item)} pitches={pitches} />
          ) : (
            <div className="rounded-3xl bg-card p-5 text-sm text-muted ring-1 ring-line">{sp.name} funds by invitation only, so it isn&apos;t taking pitches.</div>
          )}
          <Link href={`/brand/${sp.id}`} className="btn-secondary group w-full">
            Is this your brand? Open the dashboard <Arrow />
          </Link>
        </aside>

        <section className="space-y-4">
          {backed.length > 0 && (
            <div className="mb-10">
              <h2 className="display text-4xl font-semibold">Backed</h2>
              <p className="mt-1 text-sm text-muted">
                {backed.length} campaign{backed.length === 1 ? "" : "s"} · <span className="font-mono text-ink">{money(backedTotal)}</span> given publicly
              </p>
              <ul className="mt-4 divide-y divide-line border-y border-line">
                {backed.map((p) => {
                  const o = opps.find((x) => x.id === p.opportunityId);
                  return (
                    <li key={p.id} className="flex items-center gap-4 py-3">
                      <div className="min-w-0 flex-1">
                        <Link href={`/opportunities/${p.opportunityId}`} className="font-medium hover:text-brand">
                          {o?.title ?? p.opportunityId}
                        </Link>
                        <p className="text-xs text-muted">
                          {o?.orgName} · {p.tierName}
                          {p.clearedAt ? " · arrived" : ""}
                        </p>
                      </div>
                      <span className="font-mono text-sm font-semibold">{money(p.amount)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <h2 className="display text-4xl font-semibold">Best-fit campaigns</h2>
          <p className="text-sm text-muted">Every match shows why it fits. A small organization always gets a spot in the top five.</p>
          {ranked.slice(0, 5).map((r, i) => (
            <div key={r.item.id}>
              {r.spotlight && <p className="mb-1.5 text-xs font-bold text-good">★ Small-org spotlight: a smaller team that fits just as well</p>}
              <MatchCard opp={r.item} sponsor={sp} match={r.match} viewer="sponsor" rank={i + 1} funding={fundingFor(r.item, pledges)} />
            </div>
          ))}
          {ranked.length > 5 && (
            <More label={`Show ${ranked.length - 5} more`} openLabel="Show fewer">
              <div className="space-y-4">
                {ranked.slice(5).map((r, i) => (
                  <MatchCard key={r.item.id} opp={r.item} sponsor={sp} match={r.match} viewer="sponsor" rank={i + 6} funding={fundingFor(r.item, pledges)} />
                ))}
              </div>
            </More>
          )}
        </section>
      </div>
    </div>
  );
}
