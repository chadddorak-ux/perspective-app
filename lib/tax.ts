// The 2026 corporate charitable floor, in plain numbers. For tax years
// beginning after December 31, 2025, a C corporation can deduct charitable
// gifts only above 1% of taxable income, still capped at 10%. A sponsorship
// that serves a real business purpose can instead be deducted as a business
// expense (no floor), with the documentation to back it up. Pass-through
// businesses aren't subject to the corporate floor; their owners deduct at the
// individual level. Estimates only, not tax advice.

export type FloorInput = {
  taxableIncome: number;
  /** What the company plans to give this year. */
  budget: number;
  entity: "c-corp" | "pass-through";
};

export type FloorResult = {
  floor: number;
  cap: number;
  /** The part of the budget that's deductible as charitable gifts. */
  deductibleGifts: number;
  /** The part that earns no charitable deduction (below the floor or above the cap). */
  nonDeductibleGifts: number;
  underFloor: boolean;
  headline: string;
  tips: string[];
};

const pct = (x: number) => `${Math.round(x * 100)}%`;
const usd = (n: number) => (n >= 1000 ? `$${Math.round(n / 100) / 10}K`.replace(".0K", "K") : `$${Math.round(n)}`);

export function floorCalc({ taxableIncome, budget, entity }: FloorInput): FloorResult {
  const ti = Math.max(0, taxableIncome);
  const b = Math.max(0, budget);
  if (entity === "pass-through") {
    return {
      floor: 0,
      cap: 0,
      deductibleGifts: b,
      nonDeductibleGifts: 0,
      underFloor: false,
      headline: "The corporate 1% floor doesn't apply to pass-through businesses.",
      tips: ["Gifts flow through to the owners, who deduct them on their own returns under the individual rules.", "Ask your CPA how the 2026 individual changes apply to the owners."],
    };
  }
  const floor = ti * 0.01;
  const cap = ti * 0.1;
  const deductibleGifts = Math.max(0, Math.min(b, cap) - floor);
  const nonDeductibleGifts = b - deductibleGifts;
  const underFloor = b <= floor;
  const tips: string[] = [];
  if (underFloor) {
    tips.push(`Your budget is under the floor (${usd(floor)}), so plain gifts earn no charitable deduction this year.`);
    tips.push("A sponsorship with a documented business purpose can be deducted as a business expense instead. Peep invoices those through the nonprofit.");
    tips.push("Or bunch two or more years of giving into one tax year to clear the floor, and let Peep pay it out over time.");
  } else if (b > cap) {
    tips.push(`Gifts above the 10% cap (${usd(cap)}) carry forward for up to five years.`);
  } else {
    tips.push(`The first ${usd(floor)} of gifts isn't deductible; everything above it is, up to ${usd(cap)}.`);
    tips.push("Consider moving recognition-heavy deals to sponsorships, and keep acknowledgment-only gifts as gifts.");
  }
  const headline = underFloor
    ? `Under the 1% floor: ${usd(b)} in gifts earns no charitable deduction`
    : `${usd(deductibleGifts)} of ${usd(b)} is deductible as gifts (${pct(b ? deductibleGifts / b : 0)})`;
  return { floor, cap, deductibleGifts, nonDeductibleGifts, underFloor, headline, tips };
}

export type BunchPlan = {
  years: number;
  /** Given in one tax year instead of spread out. */
  bunched: number;
  deductibleBunched: number;
  /** What the same giving would deduct if spread evenly, year by year. */
  deductibleSpread: number;
  /** Quarterly payouts to nonprofits after the bunched year. */
  schedule: { quarter: string; amount: number }[];
};

/**
 * Bunching: give `years` worth of budget in one tax year (clearing the floor once)
 * and pay it out quarterly over those years. Assumes flat taxable income.
 */
export function bunchPlan(input: FloorInput, years: number, startYear = 2026): BunchPlan {
  const n = Math.max(1, Math.min(4, Math.round(years)));
  const bunched = input.budget * n;
  const one = floorCalc(input);
  const all = floorCalc({ ...input, budget: bunched });
  const quarters = n * 4;
  const schedule = Array.from({ length: quarters }, (_, i) => ({
    quarter: `Q${(i % 4) + 1} ${startYear + Math.floor(i / 4)}`,
    amount: Math.round(bunched / quarters),
  }));
  return { years: n, bunched, deductibleBunched: all.deductibleGifts, deductibleSpread: one.deductibleGifts * n, schedule };
}
