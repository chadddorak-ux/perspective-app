// Crowdfunding-style progress for a listing: goal, pledged, tiers left, days to go.

import type { Opportunity, Pledge, Tier } from "./types.ts";

const DAY_MS = 86_400_000;
const DEFAULT_SLOTS: Record<NonNullable<Tier["availability"]>, number> = { exclusive: 1, limited: 3, multiple: 10 };

export function tierSlots(t: Tier): number {
  return t.slots ?? DEFAULT_SLOTS[t.availability ?? "multiple"];
}

/** A realistic goal from the tiers: each top-ish slot filled once or twice, rounded up to $5K. */
export function suggestedGoal(tiers: Tier[]): number {
  const raw = tiers.reduce((sum, t) => sum + t.amount * Math.min(tierSlots(t), 2), 0);
  return raw ? Math.ceil(raw / 5000) * 5000 : 0;
}

export function goalFor(opp: Opportunity): number {
  return opp.goal ?? suggestedGoal(opp.tiers);
}

export type TierFunding = { tier: Tier; slots: number; taken: number; left: number };

export type Funding = {
  goal: number;
  pledged: number;
  percent: number; // can exceed 100
  sponsors: number;
  daysLeft?: number; // until the start date; undefined for ongoing programs
  state: "open" | "funded" | "closed";
  tiers: TierFunding[];
};

export function fundingFor(opp: Opportunity, pledges: Pledge[], now: Date = new Date()): Funding {
  const mine = pledges.filter((p) => p.opportunityId === opp.id);
  const pledged = mine.reduce((sum, p) => sum + p.amount, 0);
  const goal = goalFor(opp);
  const percent = goal ? Math.round((pledged / goal) * 100) : 0;
  const daysLeft = opp.startDate ? Math.ceil((Date.parse(opp.startDate) - now.getTime()) / DAY_MS) : undefined;
  const ended = opp.startDate !== undefined && Date.parse(opp.endDate ?? opp.startDate) < now.getTime() - DAY_MS;
  return {
    goal,
    pledged,
    percent,
    sponsors: new Set(mine.map((p) => p.sponsorId ?? p.sponsorName.toLowerCase())).size,
    daysLeft: daysLeft !== undefined ? Math.max(0, daysLeft) : undefined,
    state: ended ? "closed" : percent >= 100 ? "funded" : "open",
    tiers: opp.tiers.map((tier) => {
      const slots = tierSlots(tier);
      const taken = mine.filter((p) => p.tierName === tier.name).length;
      return { tier, slots, taken, left: Math.max(0, slots - taken) };
    }),
  };
}

/** Why a pledge can't be taken, or null when it can. */
export function pledgeProblem(opp: Opportunity, tierName: string, pledges: Pledge[], now: Date = new Date()): string | null {
  const f = fundingFor(opp, pledges, now);
  if (f.state === "closed") return "This campaign has ended";
  const t = f.tiers.find((x) => x.tier.name === tierName);
  if (!t) return "That tier doesn't exist";
  if (t.left === 0) return `${tierName} is fully sponsored`;
  return null;
}
