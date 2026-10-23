// What a brand gets back without asking anyone for a report: a yearly impact
// digest drafted from what's already on Peep, a year-end finance pack for the
// CFO or CPA, and each campaign's story kit for its own posts.

import { goalFor } from "./funding.ts";
import { receiptFor } from "./receipts.ts";
import type { Opportunity, Pledge, SponsorProfile, StoryKit } from "./types.ts";

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
const shortUsd = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${n}`);

/** The campaign's story kit, or one drafted from the listing until the organization adds its own. */
export function storyKitFor(opp: Opportunity): StoryKit & { drafted: boolean } {
  if (opp.storyKit) return { ...opp.storyKit, drafted: false };
  const stats: StoryKit["stats"] = [];
  if (opp.expectedReach) stats.push({ label: opp.kind === "event" ? "people expected" : "people reached", value: opp.expectedReach.toLocaleString("en-US") });
  if (opp.location.city) stats.push({ label: "community", value: `${opp.location.city}${opp.location.state ? `, ${opp.location.state}` : ""}` });
  stats.push({ label: "goal", value: shortUsd(goalFor(opp)) });
  const first = (opp.story ?? opp.summary).split(/(?<=[.!?])\s/)[0];
  return { stats, quote: first ? { text: first, by: opp.orgName } : undefined, drafted: true };
}

export type Digest = { headline: string; paragraphs: string[]; stats: { label: string; value: string }[] };

export function digestFor(sp: SponsorProfile, pledges: Pledge[], opps: Opportunity[]): Digest {
  const mine = pledges.filter((p) => p.sponsorId === sp.id);
  const total = mine.reduce((s, p) => s + p.amount, 0);
  const cleared = mine.filter((p) => p.clearedAt);
  const proofs = mine.flatMap((p) => p.proofs ?? []).filter((x) => x.status === "approved");
  const campaigns = mine.map((p) => opps.find((o) => o.id === p.opportunityId)).filter((o): o is Opportunity => !!o);
  const reach = campaigns.reduce((s, o) => s + (o.expectedReach ?? 0), 0);
  const cities = [...new Set(campaigns.map((o) => o.location.city).filter(Boolean))];
  if (!mine.length) {
    return { headline: "Your digest fills in as you give", paragraphs: ["Once you back a campaign, Peep drafts a yearly summary from what nonprofits already share: progress, placement photos and their story kits. Nobody has to write you a report."], stats: [] };
  }
  const paragraphs = [
    `This year ${sp.name} backed ${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"}${cities.length ? ` in ${cities.slice(0, 3).join(", ")}${cities.length > 3 ? " and more" : ""}` : ""}, giving ${usd(total)} in all.`,
    reach ? `Together those campaigns expect to reach about ${reach.toLocaleString("en-US")} people.` : "",
    ...campaigns.slice(0, 3).map((o) => {
      const kit = storyKitFor(o);
      return `${o.title} (${o.orgName}): ${kit.quote?.text ?? o.summary}`;
    }),
    proofs.length ? `${proofs.length} placement photo${proofs.length === 1 ? " was" : "s were"} approved, so you can see your recognition in the wild.` : "",
    `${cleared.length} of ${mine.length} transfers have cleared, each with its receipt on file.`,
  ].filter(Boolean);
  return {
    headline: `${sp.name}'s giving, at a glance`,
    paragraphs,
    stats: [
      { label: "given", value: shortUsd(total) },
      { label: "campaigns", value: String(campaigns.length) },
      { label: "people reached", value: reach ? reach.toLocaleString("en-US") : "—" },
    ],
  };
}

const csvCell = (v: string | number | undefined) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Every gift and sponsorship for the year, classified, with receipt numbers: one file for the accountant. */
export function financeCsv(sp: SponsorProfile, pledges: Pledge[], opps: Opportunity[]): string {
  const header = ["Date", "Campaign", "Organization", "EIN", "Type", "Amount (USD)", "Peep fee (USD)", "Recognition", "Transfer cleared", "Document", "Document number", "Treatment"];
  const rows = pledges
    .filter((p) => p.sponsorId === sp.id)
    .map((p) => {
      const o = opps.find((x) => x.id === p.opportunityId);
      const r = o ? receiptFor(p, o) : null;
      const kind = p.kind ?? "gift";
      return [
        p.createdAt.slice(0, 10),
        o?.title ?? p.opportunityId,
        o?.orgName ?? "",
        o?.ein ?? "",
        kind === "gift" ? "Charitable gift" : "Sponsorship",
        p.amount,
        p.fee ?? 0,
        p.recognition ?? "public",
        p.clearedAt?.slice(0, 10) ?? "pending",
        r?.title ?? "",
        r?.number ?? "",
        kind === "gift" ? "Charitable contribution (subject to the 1% floor and 10% cap)" : "Business expense (document the business purpose)",
      ];
    });
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}
