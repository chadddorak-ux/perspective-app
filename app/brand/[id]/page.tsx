import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/BrandAssets";
import { ApproveProof, BrandSettings, FinanceDownload, KitEditor, PitchReply, TeamVote } from "@/components/brand/DashboardParts";
import { PledgeBadge } from "@/components/brand/PledgeBadge";
import { More } from "@/components/More";
import { PledgeAction } from "@/components/PledgeActions";
import { Arrow, Pill, SampleTag } from "@/components/ui";
import { kitAccess, kitFor, svgDataUrl } from "@/lib/brand-kit";
import { digestFor, financeCsv } from "@/lib/giving-report";
import { money, rankOpportunities, scoreMatch, withSmallOrgSpotlight } from "@/lib/match";
import { DECLINE_REASONS, budgetCalendar } from "@/lib/pitch";
import { getSponsor, listOpportunities, listPitches, listPledges, listVotes } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Brand dashboard — Peep" };

const SECTIONS = [
  ["overview", "Overview"],
  ["inbox", "Pitch inbox"],
  ["gifts", "Gifts & receipts"],
  ["kit", "Brand kit"],
  ["request", "Request link"],
  ["vote", "Team vote"],
  ["settings", "Settings"],
] as const;

function Head({ id, title, children }: { id: string; title: string; children?: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-44">
      <h2 className="display text-3xl font-semibold">{title}</h2>
      {children && <p className="mt-1 max-w-2xl text-sm text-muted">{children}</p>}
    </div>
  );
}

/** Everything a brand does on Peep, in one place, without an inbox full of asks. */
export default async function BrandDashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sp = await getSponsor(id);
  if (!sp) notFound();
  const [opps, pledges, pitches, votes] = await Promise.all([listOpportunities(), listPledges(), listPitches(), listVotes()]);
  const mine = pledges.filter((p) => p.sponsorId === sp.id);
  const given = mine.reduce((s, p) => s + p.amount, 0);
  const inbox = pitches.filter((p) => p.sponsorId === sp.id);
  const waiting = inbox.filter((p) => p.status === "sent");
  const proofs = mine.flatMap((p) => (p.proofs ?? []).filter((x) => x.status === "submitted").map((x) => ({ p, x })));
  const digest = digestFor(sp, pledges, opps);
  const kit = kitFor(sp);
  const cal = budgetCalendar(sp);
  const options = withSmallOrgSpotlight(rankOpportunities(sp, opps))
    .filter((r) => r.match.grade !== "Not eligible")
    .slice(0, 3)
    .map((r) => r.item);
  const tallies = Object.fromEntries(options.map((o) => [o.id, votes.filter((v) => v.sponsorId === sp.id && v.opportunityId === o.id).length]));
  const oppOf = (oid: string) => opps.find((o) => o.id === oid);
  const requestPath = `/request/${sp.id}`;
  const budgetPct = sp.givingBudget ? Math.min(100, Math.round((given / sp.givingBudget) * 100)) : 0;

  return (
    <div>
      <header className="flex flex-wrap items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={svgDataUrl(kit.mark)} alt="" className="h-14 w-14 rounded-2xl shadow-lg" />
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-brand">Brand dashboard</p>
          <h1 className="display text-4xl font-semibold">{sp.name}</h1>
        </div>
        {sp.sample && <SampleTag />}
        <Link href={`/sponsors/${sp.id}`} className="btn-secondary group">
          View public profile <Arrow />
        </Link>
      </header>
      <p className="mt-3 text-sm text-muted">Prototype: anyone can open this dashboard. In the product it sits behind the brand&apos;s sign-in.</p>

      <nav className="sticky top-[76px] z-20 mt-8 flex gap-1 overflow-x-auto rounded-full glass p-1.5 sm:top-[92px]">
        {SECTIONS.map(([h, l]) => (
          <a key={h} href={`#${h}`} className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold text-muted hover:bg-bg hover:text-ink">
            {l}
            {h === "inbox" && waiting.length > 0 && <span className="ml-1.5 rounded-full bg-accent px-1.5 text-[10px] text-[#2a2826]">{waiting.length}</span>}
            {h === "gifts" && proofs.length > 0 && <span className="ml-1.5 rounded-full bg-accent px-1.5 text-[10px] text-[#2a2826]">{proofs.length}</span>}
          </a>
        ))}
      </nav>

      <div className="mt-10 space-y-16">
        {/* Overview */}
        <section className="space-y-6">
          <Head id="overview" title="Overview" />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl bg-card p-5 ring-1 ring-line md:col-span-2">
              <p className="eyebrow text-[10px] text-muted">This year</p>
              <p className="mt-1 font-display text-4xl font-semibold">
                {money(given)} <span className="text-lg font-normal text-muted">{sp.givingBudget ? `of ${money(sp.givingBudget)} budget` : "given"}</span>
              </p>
              {sp.givingBudget ? (
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-bg">
                  <div className="h-full rounded-full bg-mint" style={{ width: `${budgetPct}%` }} />
                </div>
              ) : null}
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {digest.stats.map((s) => (
                  <div key={s.label} className="rounded-2xl bg-bg p-3">
                    <p className="font-display text-xl font-semibold">{s.value}</p>
                    <p className="text-[11px] text-muted">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3 rounded-3xl bg-card p-5 ring-1 ring-line">
              {sp.peepPledge && <PledgeBadge pledge={sp.peepPledge} />}
              {cal && (
                <p className="text-sm">
                  <b>Budget year ends {cal.yearEnds}</b>
                  <span className="block text-muted">{cal.daysToYearEnd} days to go</span>
                </p>
              )}
              <p className="text-sm">
                <b>{waiting.length}</b> pitch{waiting.length === 1 ? "" : "es"} waiting · <b>{proofs.length}</b> photo{proofs.length === 1 ? "" : "s"} to approve
              </p>
              {sp.disasterPool ? <p className="text-sm text-muted">Disaster pool: {money(sp.disasterPool)} on standby</p> : null}
            </div>
          </div>
          <div className="rounded-3xl bg-card p-6 ring-1 ring-line">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-display text-xl font-semibold">Impact digest</p>
              <span className="text-[11px] text-muted">Drafted by Peep from what nonprofits already share. Nobody wrote you a report.</span>
            </div>
            <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
              {digest.paragraphs.slice(0, 2).map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            {digest.paragraphs.length > 2 && (
              <More label="Read the full digest" className="mt-2">
                <div className="space-y-2 text-sm leading-relaxed text-muted">
                  {digest.paragraphs.slice(2).map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                </div>
              </More>
            )}
            <div className="mt-5">
              <FinanceDownload csv={financeCsv(sp, pledges, opps)} name={sp.name} />
            </div>
          </div>
        </section>

        {/* Pitch inbox */}
        <section className="space-y-4">
          <Head id="inbox" title="Pitch inbox">
            Pitches only arrive as Peep one-pagers, only for causes and places you fund, with enough lead time, and at most one per organization per quarter.
          </Head>
          {inbox.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-line p-6 text-sm text-muted">
              No pitches yet. Share your <a href="#request" className="font-bold text-brand hover:underline">request link</a> and every ask that comes in lands here, already tidy.
            </div>
          ) : (
            inbox.map((pitch) => {
              const o = oppOf(pitch.opportunityId);
              if (!o) return null;
              const m = scoreMatch(o, sp);
              const amounts = o.tiers.map((t) => t.amount);
              return (
                <article key={pitch.id} className="rounded-3xl bg-card p-5 ring-1 ring-line">
                  <div className="flex flex-wrap items-start gap-4">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-mint-soft font-display text-lg font-semibold text-good">{m.score}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted">
                        {o.orgName} · {pitch.via === "request-link" ? "via your request link" : "via your profile"} · {pitch.createdAt.slice(0, 10)}
                      </p>
                      <Link href={`/opportunities/${o.id}`} className="font-display text-xl font-semibold hover:text-brand">
                        {o.title}
                      </Link>
                      <p className="mt-1 line-clamp-2 text-sm text-muted">{o.summary}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {amounts.length > 0 && <Pill>{amounts.length > 1 ? `${money(Math.min(...amounts))}–${money(Math.max(...amounts))}` : money(amounts[0])}</Pill>}
                        {o.location.city && <Pill>{o.location.city}</Pill>}
                        {m.reasons.slice(0, 2).map((r) => (
                          <Pill key={r} tone="brand">
                            {r}
                          </Pill>
                        ))}
                      </div>
                      {pitch.note && <p className="mt-3 rounded-xl bg-bg p-3 text-sm italic">&ldquo;{pitch.note}&rdquo;</p>}
                    </div>
                  </div>
                  <div className="mt-4">
                    {pitch.status === "sent" ? (
                      <PitchReply id={pitch.id} />
                    ) : (
                      <p className={`text-sm font-bold ${pitch.status === "interested" ? "text-good" : "text-muted"}`}>
                        {pitch.status === "interested" ? "✓ You're interested. " : `Declined: ${DECLINE_REASONS[pitch.reason ?? "not-now"]}. `}
                        {pitch.status === "interested" && (
                          <Link href={`/opportunities/${o.id}#tiers`} className="text-brand hover:underline">
                            Back it
                          </Link>
                        )}
                      </p>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </section>

        {/* Gifts & receipts */}
        <section className="space-y-4">
          <Head id="gifts" title="Gifts & receipts">
            Every transfer with proof it arrived, the right paperwork, who can use your kit, and the photos nonprofits sent of your recognition.
          </Head>
          {proofs.length > 0 && (
            <div className="rounded-3xl bg-accent-soft p-5 ring-1 ring-line">
              <p className="font-bold">Placement photos to approve</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {proofs.map(({ p, x }) => (
                  <div key={x.id} className="w-44 rounded-2xl bg-card p-2 ring-1 ring-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={x.image} alt="Placement" className="h-24 w-full rounded-xl object-cover" />
                    <p className="mt-1.5 truncate text-[11px] text-muted">{oppOf(p.opportunityId)?.title}</p>
                    <div className="mt-1.5">
                      <ApproveProof pledgeId={p.id} proofId={x.id} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {mine.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-line p-6 text-sm text-muted">No gifts yet.</div>
          ) : (
            <ul className="divide-y divide-line rounded-3xl bg-card ring-1 ring-line">
              {mine.map((p) => {
                const o = oppOf(p.opportunityId);
                const access = kitAccess(p);
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                    <div className="min-w-0 flex-1">
                      <Link href={`/opportunities/${p.opportunityId}`} className="font-bold hover:text-brand">
                        {o?.title ?? p.opportunityId}
                      </Link>
                      <p className="text-xs text-muted">
                        {p.kind === "sponsorship" ? "Sponsorship" : "Gift"} · {p.tierName}
                        {p.recognition && p.recognition !== "public" ? ` · ${p.recognition}` : ""} · {p.clearedAt ? "arrived" : "in transit"} · kit {access.open ? `open until ${access.until}` : "locked"}
                        {p.renews ? " · renews yearly" : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {access.open && <PledgeAction id={p.id} action="revoke-kit" label="Close kit" className="text-xs font-bold text-muted hover:text-bad" />}
                      {p.kitRevoked && <PledgeAction id={p.id} action="restore-kit" label="Reopen kit" className="text-xs font-bold text-brand hover:underline" />}
                      {p.renews ? (
                        <PledgeAction id={p.id} action="stop-renew" label="End kindly" className="text-xs font-bold text-muted hover:underline" />
                      ) : (
                        <PledgeAction id={p.id} action="renew" label="Renew yearly" className="text-xs font-bold text-brand hover:underline" />
                      )}
                      <Link href={`/receipts/${p.id}`} className="text-xs font-bold text-brand hover:underline">
                        {p.kind === "sponsorship" ? "Invoice" : "Receipt"}
                      </Link>
                      <span className="font-mono text-sm font-semibold">{money(p.amount)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Brand kit */}
        <section className="space-y-4">
          <Head id="kit" title="Brand kit">
            Upload once. Nonprofits you fund pull from it automatically when the gift clears, for a year, and you can close access anytime.
          </Head>
          <div className="rounded-3xl bg-card p-5 ring-1 ring-line sm:p-6">
            <KitEditor sponsor={sp} kit={kit} />
          </div>
        </section>

        {/* Request link */}
        <section className="space-y-4">
          <Head id="request" title="Request link">
            Put this on your website instead of a donations inbox. Every request arrives as a standard Peep one-pager, checked against what you fund.
          </Head>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl bg-card p-5 ring-1 ring-line">
              <p className="eyebrow text-[10px] text-muted">Your link</p>
              <p className="mt-2 break-all font-mono text-sm">peep.example{requestPath}</p>
              <div className="mt-3 flex gap-4">
                <CopyButton text={`https://peep.example${requestPath}`} label="Copy link" />
                <Link href={requestPath} className="text-xs font-bold text-brand hover:underline">
                  Preview the page
                </Link>
              </div>
            </div>
            <div className="rounded-3xl bg-card p-5 ring-1 ring-line">
              <p className="eyebrow text-[10px] text-muted">Button for your site</p>
              <code className="mt-2 block break-all rounded-xl bg-bg p-3 text-[11px] text-muted">{`<a href="https://peep.example${requestPath}">Request a sponsorship through Peep</a>`}</code>
              <div className="mt-3">
                <CopyButton text={`<a href="https://peep.example${requestPath}">Request a sponsorship through Peep</a>`} label="Copy HTML" />
              </div>
            </div>
          </div>
        </section>

        {/* Team vote */}
        <section className="space-y-4">
          <Head id="vote" title="Team vote">
            Let your team pick where a pool goes. Three good fits, one vote each, and you fund the winner in one click.
          </Head>
          <div className="rounded-3xl bg-card p-5 ring-1 ring-line sm:p-6">
            <TeamVote sponsor={sp} options={options} tallies={tallies} />
          </div>
        </section>

        {/* Settings */}
        <section className="space-y-4">
          <Head id="settings" title="Settings" />
          <div className="rounded-3xl bg-card p-5 ring-1 ring-line sm:p-6">
            <BrandSettings sponsor={sp} />
          </div>
        </section>
      </div>
    </div>
  );
}
