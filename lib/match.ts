import {
  AUDIENCES,
  CAUSES,
  CAUSE_ADJACENCY,
  OBJECTIVES,
  REGIONS,
  SUPPORT_TYPES,
  US_STATES,
  label,
  type CauseId,
  type ObjectiveId,
} from "./taxonomy.ts";
import type { MatchResult, Opportunity, SponsorProfile, Tier } from "./types.ts";

// Points available per dimension. They sum to 100 so a score reads as a percentage.
export const WEIGHTS = {
  causes: 30,
  geography: 20,
  budget: 15,
  audience: 15,
  objectives: 15,
  timing: 5,
} as const;

const DAY_MS = 86_400_000;

// Maps sponsorship-package language to the sponsor objective it serves.
const BENEFIT_SIGNALS: [RegExp, ObjectiveId][] = [
  [/logo|brand|signage|banner|t-?shirt|website|naming|track car|recognition/i, "brand-visibility"],
  [/media|press|social|broadcast|livestream/i, "brand-visibility"],
  [/talent|recruit|career|intern|resume|job|database|hiring|workforce/i, "talent-pipeline"],
  [/stage|remarks|keynote|panel|speak|session|workshop|host/i, "thought-leadership"],
  [/leadership|advisory|council|vip|decision|executive|reception|board/i, "relationships"],
  [/activation|booth|table|sampling|demo|exhibit|display/i, "customer-reach"],
  [/volunteer|mentor|employee/i, "employee-engagement"],
];

// Lowercase for mid-sentence use without mangling acronyms ("Community impact / ESG").
export function lowerLabel(s: string): string {
  return s.replace(/\b([A-Z])(?=[a-z])/g, (c) => c.toLowerCase());
}

export function money(n: number): string {
  return n >= 1000 && n % 1000 === 0 ? `$${n / 1000}K` : `$${n.toLocaleString("en-US")}`;
}

export function objectivesOffered(opp: Opportunity): Set<ObjectiveId> {
  const offered = new Set<ObjectiveId>(["community-impact"]);
  for (const tier of opp.tiers) {
    for (const benefit of [tier.name, ...tier.benefits]) {
      for (const [pattern, objective] of BENEFIT_SIGNALS) {
        if (pattern.test(benefit)) offered.add(objective);
      }
    }
  }
  if (opp.asks.includes("volunteers") || opp.asks.includes("mentors")) offered.add("employee-engagement");
  if ((opp.expectedReach ?? 0) >= 1000) offered.add("brand-visibility");
  if (!opp.location.virtual && opp.location.state) offered.add("local-presence");
  if (opp.audiences.includes("teen-students") || opp.audiences.includes("young-adults")) {
    if (opp.causes.some((c) => c === "workforce-development" || c === "stem-education")) {
      offered.add("talent-pipeline");
    }
  }
  return offered;
}

// Sponsors list causes in priority order, so a hit on their first cause counts most.
const PRIORITY_WEIGHTS = [1, 0.9, 0.8, 0.7];
const ADJACENT_CREDIT = 0.4;

function scoreCauses(opp: Opportunity, sp: SponsorProfile) {
  const max = WEIGHTS.causes;
  const direct: CauseId[] = [];
  const adjacent: CauseId[] = [];
  const credits = sp.causes.map((s, i) => {
    const w = PRIORITY_WEIGHTS[Math.min(i, PRIORITY_WEIGHTS.length - 1)];
    if (opp.causes.includes(s)) {
      direct.push(s);
      return w;
    }
    const near = opp.causes.find((c) => CAUSE_ADJACENCY[s]?.includes(c));
    if (near) {
      if (!adjacent.includes(near)) adjacent.push(near);
      return w * ADJACENT_CREDIT;
    }
    return 0;
  });
  credits.sort((a, b) => b - a);
  const fit = 0.7 * (credits[0] ?? 0) + 0.3 * (credits[1] ?? 0);
  if (fit === 0) return { score: 0, fit, note: "No overlap with their focus areas" };
  const note = direct.length
    ? `Shared focus: ${direct.map((c) => label(CAUSES, c)).join(", ")}`
    : `Adjacent to their focus: ${adjacent.map((c) => label(CAUSES, c)).join(", ")}`;
  return { score: Math.round(max * fit), fit, note };
}

function statesInScope(sp: SponsorProfile): Set<string> {
  const states = new Set(sp.geography.states);
  if (sp.geography.scope === "regional") {
    for (const s of sp.geography.states) {
      for (const members of Object.values(REGIONS)) if (members.includes(s)) members.forEach((m) => states.add(m));
    }
  }
  return states;
}

function scoreGeography(opp: Opportunity, sp: SponsorProfile) {
  const max = WEIGHTS.geography;
  const { scope, metros } = sp.geography;
  const loc = opp.location;
  if (loc.virtual) {
    return scope === "national"
      ? { score: max, note: "Virtual reach fits a national giver" }
      : { score: Math.round(max * 0.6), note: "Virtual — not specific to their home market" };
  }
  const metroHit =
    loc.metro && metros.some((m) => m.toLowerCase() === loc.metro!.toLowerCase());
  if (metroHit) return { score: max, note: `In their home market (${loc.metro})` };
  const inState = loc.state ? statesInScope(sp).has(loc.state) : false;
  const where = loc.state ? US_STATES[loc.state] ?? loc.state : "an unknown location";
  if (scope === "national") {
    return { score: Math.round(max * (inState ? 0.95 : 0.75)), note: `National giver; event is in ${where}` };
  }
  if (inState && scope !== "local") return { score: Math.round(max * 0.85), note: `Inside their giving area (${where})` };
  if (inState) return { score: Math.round(max * 0.5), note: `Same state, but outside their local market` };
  return { score: 0, note: `Outside their giving area (${where})` };
}

function scoreBudget(opp: Opportunity, sp: SponsorProfile) {
  const max = WEIGHTS.budget;
  const { min, max: cap } = sp.budget;
  if (opp.tiers.length === 0) {
    return { score: Math.round(max * 0.6), note: "No tiers listed — gift size is open", tier: undefined };
  }
  const sorted = [...opp.tiers].sort((a, b) => a.amount - b.amount);
  const fitting = sorted.filter((t) => t.amount >= min && t.amount <= cap);
  if (fitting.length) {
    const tier = fitting[fitting.length - 1];
    return { score: max, note: `${tier.name} (${money(tier.amount)}) sits in their range`, tier };
  }
  const cheapest = sorted[0];
  if (cheapest.amount > cap) {
    const stretch = cheapest.amount <= cap * 1.5;
    return {
      score: stretch ? Math.round(max * 0.4) : 0,
      note: `Lowest tier ${money(cheapest.amount)} is above their typical ${money(cap)}`,
      tier: stretch ? cheapest : undefined,
    };
  }
  // Every tier is below what they usually give — could still work as a custom package.
  const top = sorted[sorted.length - 1];
  return { score: Math.round(max * 0.6), note: `Top tier ${money(top.amount)} is below their usual ${money(min)}+ gift`, tier: top };
}

function scoreAudience(opp: Opportunity, sp: SponsorProfile) {
  const max = WEIGHTS.audience;
  if (sp.audiences.length === 0) return { score: Math.round(max * 0.6), note: "No audience preference" };
  const shared = opp.audiences.filter((a) => sp.audiences.includes(a));
  if (!shared.length) return { score: 0, note: "Reaches people they don't usually target" };
  const ratio = shared.length / Math.min(sp.audiences.length, 3);
  return {
    score: Math.round(max * Math.min(1, 0.4 + 0.6 * ratio)),
    note: `Reaches ${shared.map((a) => lowerLabel(label(AUDIENCES, a))).join(", ")}`,
  };
}

function scoreObjectives(opp: Opportunity, sp: SponsorProfile) {
  const max = WEIGHTS.objectives;
  if (sp.objectives.length === 0) return { score: Math.round(max * 0.6), note: "No stated objectives", met: [] as ObjectiveId[] };
  const offered = objectivesOffered(opp);
  const met = sp.objectives.filter((o) => offered.has(o));
  const score = Math.round(max * (met.length / sp.objectives.length));
  const note = met.length
    ? `Delivers on ${met.map((o) => lowerLabel(label(OBJECTIVES, o))).join(", ")}`
    : "Package doesn't speak to their goals";
  return { score, note, met };
}

function scoreTiming(opp: Opportunity, sp: SponsorProfile, now: Date) {
  const max = WEIGHTS.timing;
  if (!opp.startDate) return { score: Math.round(max * 0.6), note: "Ongoing / no date set", days: undefined };
  const days = Math.round((Date.parse(opp.startDate) - now.getTime()) / DAY_MS);
  if (days < 0) return { score: 0, note: "Already happened", days };
  if (days >= sp.leadTimeDays) return { score: max, note: `${days} days out — inside their planning window`, days };
  return {
    score: Math.round(max * (days / sp.leadTimeDays)),
    note: `${days} days out; they usually commit ${sp.leadTimeDays}+ days ahead`,
    days,
  };
}

// Logistics (location, budget, audience…) only count fully when the cause fits:
// a well-timed, in-budget event that's off-mission is still a long shot.
const CORE_CAUSE_FIT = 0.8;
const OFF_CORE_CAP = 84;
const SUPPORT_MISMATCH_PENALTY = 10;

function grade(score: number): MatchResult["grade"] {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 55) return "Possible";
  return "Long shot";
}

export function scoreMatch(opp: Opportunity, sp: SponsorProfile, now: Date = new Date()): MatchResult {
  const blockers: string[] = [];
  if (sp.requires501c3 && opp.orgType !== "501c3" && opp.orgType !== "fiscally-sponsored") {
    blockers.push(`${sp.name} only funds 501(c)(3) organizations`);
  }
  const excluded = opp.causes.filter((c) => sp.excludedCauses.includes(c));
  if (excluded.length) {
    blockers.push(`${sp.name} excludes ${excluded.map((c) => label(CAUSES, c)).join(", ")}`);
  }
  if (opp.startDate && Date.parse(opp.endDate ?? opp.startDate) < now.getTime() - DAY_MS) {
    blockers.push("This opportunity has already ended");
  }

  const causes = scoreCauses(opp, sp);
  const geo = scoreGeography(opp, sp);
  const budget = scoreBudget(opp, sp);
  const audience = scoreAudience(opp, sp);
  const objectives = scoreObjectives(opp, sp);
  const timing = scoreTiming(opp, sp, now);

  const breakdown: MatchResult["breakdown"] = [
    { dimension: "causes", score: causes.score, max: WEIGHTS.causes, note: causes.note },
    { dimension: "geography", score: geo.score, max: WEIGHTS.geography, note: geo.note },
    { dimension: "budget", score: budget.score, max: WEIGHTS.budget, note: budget.note },
    { dimension: "audience", score: audience.score, max: WEIGHTS.audience, note: audience.note },
    { dimension: "objectives", score: objectives.score, max: WEIGHTS.objectives, note: objectives.note },
    { dimension: "timing", score: timing.score, max: WEIGHTS.timing, note: timing.note },
  ];

  const base = breakdown.reduce((sum, d) => sum + d.score, 0);
  const adjustments: MatchResult["adjustments"] = [];
  const gaps: string[] = [];

  const logistics = base - causes.score;
  const relevance = 0.5 + 0.5 * Math.min(1, causes.fit / CORE_CAUSE_FIT);
  const offMission = Math.round(logistics * (1 - relevance));
  if (offMission > 0) adjustments.push({ label: "Outside their core causes", points: -offMission });

  const supportOverlap = opp.asks.filter((a) => sp.supportTypes.includes(a));
  if (opp.asks.length && supportOverlap.length === 0) {
    adjustments.push({ label: "Support type mismatch", points: -SUPPORT_MISMATCH_PENALTY });
    gaps.push(
      `They give ${sp.supportTypes.map((t) => label(SUPPORT_TYPES, t).toLowerCase()).join(" / ")}, ` +
        `but the ask is for ${opp.asks.map((t) => label(SUPPORT_TYPES, t).toLowerCase()).join(" / ")}`,
    );
  }

  let score = base + adjustments.reduce((sum, a) => sum + a.points, 0);
  if (causes.fit < CORE_CAUSE_FIT && score > OFF_CORE_CAP) {
    adjustments.push({ label: "Not their primary cause (capped)", points: OFF_CORE_CAP - score });
    score = OFF_CORE_CAP;
  }

  for (const d of breakdown) {
    if (d.score <= d.max * 0.4) gaps.push(d.note);
  }
  if (sp.approach === "intro-preferred") gaps.push("Prefers a warm introduction over cold outreach");
  if (sp.approach === "invite-only") gaps.push("Invite-only — an introduction is required");

  const reasons = breakdown
    .filter((d) => d.score >= d.max * 0.7)
    .sort((a, b) => b.score / b.max - a.score / a.max)
    .map((d) => d.note);

  score = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: blockers.length ? 0 : score,
    grade: blockers.length ? "Not eligible" : grade(score),
    breakdown,
    adjustments,
    reasons,
    gaps,
    blockers,
    suggestedTier: budget.tier as Tier | undefined,
  };
}

export type Ranked<T> = { item: T; match: MatchResult };

export function rankSponsors(opp: Opportunity, sponsors: SponsorProfile[], now?: Date): Ranked<SponsorProfile>[] {
  return sponsors
    .map((item) => ({ item, match: scoreMatch(opp, item, now) }))
    .sort((a, b) => b.match.score - a.match.score);
}

export function rankOpportunities(sp: SponsorProfile, opps: Opportunity[], now?: Date): Ranked<Opportunity>[] {
  return opps
    .map((item) => ({ item, match: scoreMatch(item, sp, now) }))
    .sort((a, b) => b.match.score - a.match.score);
}

export function primaryCause(ids: CauseId[]): string {
  return ids.length ? label(CAUSES, ids[0]) : "community";
}
