// The paperwork for a pledge, written for what the sponsor actually got.
// A gift gets a written acknowledgment from the nonprofit (required for gifts
// of $250 or more), with the quid pro quo statement the IRS asks for. A
// sponsorship gets an invoice from the nonprofit, for the sponsor's books as a
// business expense. Peep's fee is its own line: it isn't part of the gift.

import { tierCompliance } from "./compliance.ts";
import { GENERAL_SUPPORT, type Opportunity, type Pledge } from "./types.ts";

/** Peep's fee, paid by the sponsor on top so the nonprofit gets 100%. Bank transfer avoids card fees. */
export const FEE_RATE = 0.03;
export const feeFor = (amount: number) => Math.round(amount * FEE_RATE);

export type Step = { label: string; at?: string; done: boolean };

export function timelineFor(p: Pledge): Step[] {
  return [
    { label: "Pledge made", at: p.createdAt, done: true },
    { label: "Transfer reached the nonprofit", at: p.clearedAt, done: !!p.clearedAt },
    { label: "Nonprofit confirmed it arrived", at: p.acknowledgedAt, done: !!p.acknowledgedAt },
    { label: p.kind === "sponsorship" ? "Invoice issued" : "Tax receipt issued", at: p.acknowledgedAt, done: !!p.acknowledgedAt },
  ];
}

export type ReceiptDoc = {
  kind: "gift" | "sponsorship";
  title: string;
  number: string;
  issuer: string;
  issuerId?: string;
  to: string;
  date?: string;
  amount: number;
  fee: number;
  lines: [string, string][];
  statement: string;
  notes: string[];
  final: boolean;
};

export function receiptFor(p: Pledge, opp: Opportunity): ReceiptDoc {
  const kind = p.kind ?? "gift";
  const tier = opp.tiers.find((t) => t.name === p.tierName);
  const c = tier ? tierCompliance(tier) : null;
  const number = `PEEP-${(p.createdAt || "").slice(0, 4)}-${p.id.replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase()}`;
  const fee = p.fee ?? 0;
  const lines: [string, string][] = [
    ["Campaign", opp.title],
    ["Tier", p.share ? `${p.tierName} (${Math.round(p.share * 100)}% share of a giving circle)` : p.tierName],
    ["Recognition", p.recognition === "anonymous" ? "Anonymous" : p.recognition === "private" ? "Private (not shown publicly)" : "Name and logo"],
  ];
  if (kind === "gift") {
    const perks = p.tierName === GENERAL_SUPPORT ? [] : (c?.tangible ?? []);
    const statement = perks.length
      ? `In exchange for this contribution, ${opp.orgName} provided: ${perks.join("; ")}. ${opp.orgName} will state the fair market value of these items; only the amount above it is deductible.`
      : `No goods or services were provided in exchange for this contribution, other than acknowledgment of the donor's name${p.recognition === "anonymous" ? "" : " and logo"}.`;
    return {
      kind,
      title: "Charitable contribution acknowledgment",
      number,
      issuer: opp.orgName,
      issuerId: opp.ein,
      to: p.sponsorName,
      date: p.acknowledgedAt?.slice(0, 10),
      amount: p.amount,
      fee,
      lines,
      statement,
      notes: [
        opp.orgType === "501c3" ? `${opp.orgName} is a 501(c)(3) organization${opp.ein ? ` (EIN ${opp.ein})` : ""}.` : `${opp.orgName} is not a 501(c)(3); this gift may not be tax-deductible.`,
        "Corporations: charitable deductions in 2026 apply only above 1% of taxable income. Check the floor calculator on Peep's Give page.",
        fee ? "Peep's service fee is listed separately and is not part of the charitable gift." : "",
      ].filter(Boolean),
      final: !!p.acknowledgedAt,
    };
  }
  return {
    kind,
    title: "Sponsorship invoice",
    number,
    issuer: opp.orgName,
    issuerId: opp.ein,
    to: p.sponsorName,
    date: p.acknowledgedAt?.slice(0, 10) ?? p.createdAt.slice(0, 10),
    amount: p.amount,
    fee,
    lines: [...lines, ["Benefits", tier?.benefits.join("; ") || "As agreed"]],
    statement: `Sponsorship of ${opp.title}. For ${p.sponsorName}'s records as a business expense; this is not a charitable contribution receipt.`,
    notes: [
      "A sponsorship can be deducted as an ordinary business expense when it serves a business purpose. Keep a note of the purpose with this invoice, and confirm with your tax adviser.",
      c?.advertising.length ? `Some benefits read as advertising (${c.advertising.map((a) => a.benefit).join("; ")}); that portion may be taxable income for ${opp.orgName}.` : "",
      fee ? "Peep's service fee is listed separately." : "",
    ].filter(Boolean),
    final: !!p.acknowledgedAt,
  };
}
