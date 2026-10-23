// What a sponsor's money buys, in IRS terms. Under IRC 513(i), a payment is a
// "qualified sponsorship payment" when the sponsor gets only acknowledgment
// (name, logo, a value-neutral tagline). Tangible perks (tickets, tables) are
// fine but reduce the deductible gift and need disclosure; advertising
// (comparisons, prices, endorsements, calls to action) is taxable income for
// the nonprofit. Peep uses this to label tiers, guard brand taglines, and pick
// the right paperwork. It's a guide, not tax advice.

import type { Tier } from "./types.ts";

export type BenefitKind = "acknowledgment" | "tangible" | "advertising";

const ADVERTISING: [RegExp, string][] = [
  [/\b(best|better|#\s?1|number one|leading|top-rated|finest|unbeatable|world-class)\b/i, "a comparative or qualitative claim"],
  [/(\$\s?\d|\d+\s?% off|\bdiscount|\bcoupon|\bpromo code|\buse code|\bsale\b|\bfree trial|\bprice)/i, "a price or discount"],
  [/\b(buy|shop|order now|call now|visit (our|the) store|sign up|download the app|switch to|try)\b/i, "a call to action"],
  [/\b(endorse|recommended by|official .+ of|preferred (provider|partner|supplier)|exclusive (provider|supplier|vendor))\b/i, "an endorsement or exclusive-provider deal"],
  [/\b(product (placement|demo|sampling)|sampling|commercial|ad spot|advertis|sponsored post|social post(s)? promoting|email blast)\b/i, "advertising placement"],
];

const TANGIBLE: RegExp[] = [
  /\b(vip|tickets?|passes|seats?|table|dinner|lunch|reception|gala|hospitality|parking|swag|gift bag|merch|t-?shirt|golf|foursome|round|tour|meet and greet|suite|hotel|stay)\b/i,
  /\b(booth|exhibit|activation space|tent|table space|vendor space)\b/i,
  /\b(database|talent database|lead list|attendee list|contact list)\b/i,
];

/** Classify one benefit line from a tier. */
export function classifyBenefit(text: string): { kind: BenefitKind; why?: string } {
  for (const [re, why] of ADVERTISING) if (re.test(text)) return { kind: "advertising", why };
  for (const re of TANGIBLE) if (re.test(text)) return { kind: "tangible" };
  return { kind: "acknowledgment" };
}

export type TierCompliance = {
  /** Every benefit is acknowledgment only: a clean charitable gift. */
  giftReady: boolean;
  tangible: string[];
  advertising: { benefit: string; why: string }[];
  /** A short label for the tier card. */
  label: string;
  notes: string[];
};

export function tierCompliance(tier: Tier): TierCompliance {
  const tangible: string[] = [];
  const advertising: { benefit: string; why: string }[] = [];
  for (const b of tier.benefits) {
    const c = classifyBenefit(b);
    if (c.kind === "tangible") tangible.push(b);
    if (c.kind === "advertising") advertising.push({ benefit: b, why: c.why! });
  }
  const notes: string[] = [];
  if (tangible.length) {
    notes.push(
      `Includes perks (${tangible.length}). A gift receipt must state their fair market value, and only the amount above it is deductible${tier.amount > 75 ? " (quid pro quo disclosure applies over $75)" : ""}. If the perks are worth 2% of the payment or less, they can be ignored.`,
    );
  }
  if (advertising.length) {
    notes.push(
      `Reads as advertising: ${advertising.map((a) => `"${a.benefit}" (${a.why})`).join("; ")}. As a gift, reword it to plain acknowledgment. As a sponsorship, the nonprofit invoices it and the advertising part may be taxable income for them.`,
    );
  }
  const label = advertising.length ? "Sponsorship (has advertising)" : tangible.length ? "Gift with perks" : "Gift-ready";
  return { giftReady: !tangible.length && !advertising.length, tangible, advertising, label, notes };
}

/**
 * Check a brand tagline before it goes on a nonprofit's materials. Value-neutral
 * lines ("Proud supporter of youth aviation") are fine; claims, prices and calls
 * to action turn acknowledgment into advertising.
 */
export function checkTagline(text: string): { ok: boolean; problems: string[]; suggestion?: string } {
  const problems = ADVERTISING.filter(([re]) => re.test(text)).map(([, why]) => why);
  return problems.length
    ? { ok: false, problems, suggestion: "Try a neutral line instead, like \"Proud supporter of our community\" or your company name and website." }
    : { ok: true, problems: [] };
}

/** Reword the common advertising phrasings into acknowledgment. */
export function acknowledgmentWording(benefit: string): string {
  return benefit
    .replace(/\b(official|preferred|exclusive) [\w ]+? of\b/gi, "supporter of")
    .replace(/\bsponsored post(s)?\b/gi, "thank-you post$1")
    .replace(/\bproduct (placement|demo|sampling)\b/gi, "logo display")
    .replace(/\bad spot\b/gi, "recognition slide");
}
