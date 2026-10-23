// The rules for pitching a brand through its Peep profile. The point is to be
// narrower than email: only campaigns that fit what the brand said it funds,
// only in its budget window, with enough lead time, and at most one pitch per
// organization per brand per quarter. Brands get a feed, not a flood.

import type { Opportunity, Pitch, SponsorProfile } from "./types.ts";

const DAY_MS = 86_400_000;
export const MIN_LEAD_DAYS = 21;

export function quarterOf(d: Date): string {
  return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
}

/**
 * Why this campaign can't be pitched to this brand right now, or null when it can.
 * `opps` lets the quota count every campaign from the same organization.
 */
export function pitchProblem(opp: Opportunity, sp: SponsorProfile, pitches: Pitch[], opps: Opportunity[], now: Date = new Date()): string | null {
  if (sp.approach === "invite-only") return `${sp.name} only funds by invitation`;
  if (!opp.causes.some((c) => sp.causes.includes(c))) return `${sp.name} doesn't fund these causes`;
  if (opp.causes.some((c) => sp.excludedCauses.includes(c))) return `${sp.name} excludes one of this campaign's causes`;
  if (sp.requires501c3 && opp.orgType !== "501c3") return `${sp.name} only funds 501(c)(3) organizations`;
  if (sp.geography.scope !== "national" && !opp.location.virtual) {
    const inArea = (opp.location.state && sp.geography.states.includes(opp.location.state)) || (opp.location.metro && sp.geography.metros.includes(opp.location.metro));
    if (!inArea) return `${opp.location.city ?? "This location"} is outside ${sp.name}'s giving area`;
  }
  const amounts = opp.tiers.map((t) => t.amount);
  if (amounts.length && !amounts.some((a) => a >= sp.budget.min * 0.5 && a <= sp.budget.max * 1.25)) {
    return `None of the tiers fit ${sp.name}'s typical gift`;
  }
  if (opp.startDate) {
    const days = Math.floor((Date.parse(`${opp.startDate}T12:00:00Z`) - now.getTime()) / DAY_MS);
    const need = Math.max(MIN_LEAD_DAYS, Math.min(sp.leadTimeDays, 90));
    if (days < need) return `${sp.name} needs about ${need} days' notice; this campaign starts in ${Math.max(0, days)}`;
  }
  const mine = pitches.find((p) => p.sponsorId === sp.id && p.opportunityId === opp.id);
  if (mine) return `Already pitched to ${sp.name} (${mine.status === "sent" ? "waiting for a reply" : mine.status})`;
  // One pitch per organization per brand per quarter.
  const q = quarterOf(now);
  const org = opp.orgName.toLowerCase();
  const used = pitches.some(
    (p) => p.sponsorId === sp.id && quarterOf(new Date(p.createdAt)) === q && opps.find((o) => o.id === p.opportunityId)?.orgName.toLowerCase() === org,
  );
  return used ? `${opp.orgName} already pitched ${sp.name} this quarter. One pitch per brand per quarter keeps inboxes friendly.` : null;
}

export const DECLINE_REASONS = {
  "outside-causes": "Outside the causes we fund",
  "outside-area": "Outside our giving area",
  "budget-spent": "This year's budget is spent",
  timing: "The timing doesn't work",
  "not-now": "Not right now, but thank you",
} as const;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** When a brand's budget year ends and the best window to ask (the quarter before, plus the start of the new year). */
export function budgetCalendar(sp: SponsorProfile, now: Date = new Date()): { yearEnds: string; bestWindow: string; daysToYearEnd: number } | null {
  if (!sp.fiscalYearEnd) return null;
  const endMonth = sp.fiscalYearEnd - 1;
  let end = Date.UTC(now.getUTCFullYear(), endMonth + 1, 0);
  if (end < now.getTime()) end = Date.UTC(now.getUTCFullYear() + 1, endMonth + 1, 0);
  const before = MONTHS[(endMonth + 9) % 12];
  const after = MONTHS[(endMonth + 1) % 12];
  return {
    yearEnds: `${MONTHS[endMonth]} ${new Date(end).getUTCDate()}`,
    bestWindow: `${before}–${MONTHS[endMonth]}, or early ${after} when the new budget opens`,
    daysToYearEnd: Math.ceil((end - now.getTime()) / DAY_MS),
  };
}
