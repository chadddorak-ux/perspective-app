"use client";

import Link from "next/link";
import { useState } from "react";
import type { Funding } from "@/lib/funding";
import { money } from "@/lib/match";
import { CAUSES, INDUSTRIES, SPONSOR_TYPES, label } from "@/lib/taxonomy";
import type { MatchResult, Opportunity, SponsorProfile } from "@/lib/types";
import { ProgressBar, daysLabel } from "./Funding";
import { OutreachModal } from "./OutreachModal";
import { Breakdown, GradeBadge, Pill, SampleTag, ScoreRing } from "./ui";

type Props = {
  opp: Opportunity;
  sponsor: SponsorProfile;
  match: MatchResult;
  /** Which side is looking: an organization sees sponsors, a sponsor sees opportunities. */
  viewer: "organization" | "sponsor";
  rank?: number;
  /** Campaign progress, shown when a sponsor is browsing campaigns. */
  funding?: Funding;
};

export function MatchCard({ opp, sponsor, match, viewer, rank, funding }: Props) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(false);
  const [intro, setIntro] = useState<"idle" | "saving" | "done" | "error">("idle");
  const saved = opp.id !== "draft" && sponsor.id !== "draft";
  const eligible = match.grade !== "Not eligible";

  const requestIntro = async () => {
    setIntro("saving");
    const res = await fetch("/api/intros", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ opportunityId: opp.id, sponsorId: sponsor.id, requestedBy: viewer }),
    });
    setIntro(res.ok ? "done" : "error");
  };

  const isOrg = viewer === "organization";
  const title = isOrg ? sponsor.name : opp.title;
  const href = isOrg ? `/sponsors/${sponsor.id}` : `/opportunities/${opp.id}`;
  const subtitle = isOrg
    ? `${sponsor.industry ? label(INDUSTRIES, sponsor.industry) : label(SPONSOR_TYPES, sponsor.type)} · gives ${money(sponsor.budget.min)}–${money(sponsor.budget.max)}`
    : `${opp.orgName} · ${opp.location.virtual ? "Virtual" : [opp.location.city, opp.location.state].filter(Boolean).join(", ")}`;
  const isSample = isOrg ? sponsor.sample : opp.sample;

  return (
    <article className={`card p-5 transition-colors hover:border-ink ${eligible ? "" : "opacity-70"}`}>
      <div className="flex gap-4">
        <ScoreRing score={match.score} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {rank !== undefined && <span className="font-mono text-xs text-muted">{String(rank).padStart(2, "0")}</span>}
            {saved || !isOrg ? (
              <Link href={href} className="truncate font-display text-lg font-semibold tracking-tight hover:text-brand">{title}</Link>
            ) : (
              <span className="truncate font-display text-lg font-semibold tracking-tight">{title}</span>
            )}
            <GradeBadge grade={match.grade} />
            {isSample && <SampleTag />}
          </div>
          <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(isOrg ? sponsor.causes : opp.causes).slice(0, 4).map((c) => (
              <Pill key={c}>{label(CAUSES, c)}</Pill>
            ))}
          </div>
        </div>
      </div>

      {match.blockers.length > 0 ? (
        <ul className="mt-4 space-y-1 text-sm text-bad">
          {match.blockers.map((b) => <li key={b}>⨯ {b}</li>)}
        </ul>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <h4 className="eyebrow mb-2 text-[10px] text-muted">Why it fits</h4>
            <ul className="space-y-1 text-sm">
              {match.reasons.slice(0, 4).map((r) => <li key={r} className="flex gap-2"><span className="text-good">✓</span>{r}</li>)}
              {match.reasons.length === 0 && <li className="text-muted">No strong signals</li>}
            </ul>
          </div>
          <div>
            <h4 className="eyebrow mb-2 text-[10px] text-muted">Watch for</h4>
            <ul className="space-y-1 text-sm">
              {match.gaps.slice(0, 4).map((g) => <li key={g} className="flex gap-2"><span className="text-warn">!</span>{g}</li>)}
              {match.gaps.length === 0 && <li className="text-muted">Nothing major</li>}
            </ul>
          </div>
        </div>
      )}

      {funding && !isOrg && (
        <div className="mt-4">
          <ProgressBar percent={funding.percent} />
          <div className="mt-1.5 flex justify-between text-xs text-muted">
            <span>
              <span className="font-mono text-ink">{money(funding.pledged)}</span> of {money(funding.goal)} · {funding.percent}%
            </span>
            <span className="eyebrow text-[10px]">{daysLabel(funding)}</span>
          </div>
        </div>
      )}

      {match.suggestedTier && eligible && (
        <p className="mt-4 rounded-lg bg-brand-soft px-3 py-2 text-sm">
          <span className="font-semibold">Suggested ask:</span> {match.suggestedTier.name} · {money(match.suggestedTier.amount)}
        </p>
      )}

      {open && <div className="mt-4 border-t border-line pt-4"><Breakdown match={match} /></div>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {eligible && isOrg && (
          <button className="btn-primary" onClick={() => setModal(true)}>Draft outreach</button>
        )}
        {!isOrg && eligible && <Link className="btn-primary" href={`${href}#tiers`}>Back this campaign</Link>}
        {!isOrg && <Link className={eligible ? "btn-secondary" : "btn-primary"} href={href}>View campaign</Link>}
        {!isOrg && opp.contact.website && (
          <a className="btn-secondary" href={opp.contact.website} target="_blank" rel="noreferrer">Website ↗</a>
        )}
        {eligible && saved && (
          <button className="btn-secondary" onClick={requestIntro} disabled={intro === "saving" || intro === "done"}>
            {intro === "done" ? "Intro requested ✓" : intro === "saving" ? "Requesting…" : "Request warm intro"}
          </button>
        )}
        {eligible && !saved && <span className="hint">Save your {isOrg ? "listing" : "giving profile"} to request intros</span>}
        {intro === "error" && <span className="text-sm text-bad">Couldn't request intro</span>}
        <button className="btn-ghost ml-auto" onClick={() => setOpen(!open)}>{open ? "Hide" : "Score"} breakdown</button>
      </div>

      {modal && <OutreachModal opp={opp} sponsor={sponsor} match={match} onClose={() => setModal(false)} />}
    </article>
  );
}
