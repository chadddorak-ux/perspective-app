// Crowdfunding-style progress for a listing: goal, pledged, tiers left, days to go.

import { GENERAL_SUPPORT, type Opportunity, type Pledge, type Tier } from "./types.ts";

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

/** `taken` counts circle shares as fractions; `circle` is how far the open giving circle is filled. */
export type TierFunding = { tier: Tier; slots: number; taken: number; left: number; circle?: number };

/** Tiers this size and up can be split four ways by a giving circle of small businesses. */
export const CIRCLE_MIN = 4000;
export const CIRCLE_SHARE = 0.25;

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
      const taken = mine.filter((p) => p.tierName === tier.name).reduce((sum, p) => sum + (p.share ?? 1), 0);
      const partial = Math.round((taken % 1) * 100) / 100;
      return { tier, slots, taken, left: Math.max(0, Math.round((slots - taken) * 100) / 100), ...(partial > 0 && { circle: partial }) };
    }),
  };
}

/** Why a pledge can't be taken, or null when it can. */
export function pledgeProblem(opp: Opportunity, tierName: string, pledges: Pledge[], now: Date = new Date(), share?: number): string | null {
  const f = fundingFor(opp, pledges, now);
  if (f.state === "closed") return "This campaign has ended";
  if (tierName === GENERAL_SUPPORT) return null; // always open
  const t = f.tiers.find((x) => x.tier.name === tierName);
  if (!t) return "That tier doesn't exist";
  if (t.left <= 0) return `${tierName} is fully sponsored`;
  if (share) {
    if (t.tier.amount < CIRCLE_MIN) return `${tierName} is too small to split into a circle`;
    if (t.left < share) return `${tierName} is fully sponsored`;
    return null;
  }
  // A whole slot can't be taken while only part of one is left (a circle is filling it).
  if (t.left < 1) return `Only giving-circle shares are left on ${tierName}`;
  return null;
}
