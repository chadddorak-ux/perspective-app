// What a campaign still needs before it goes live. Required gaps block
// posting; recommended ones are flagged but can be skipped. Used by the PDF
// import review so a campaign is only created once its holes are filled.

import { suggestedGoal } from "./funding.ts";
import type { Opportunity } from "./types.ts";

export type CampaignDraft = Omit<Opportunity, "id" | "createdAt" | "source">;

export type GapField =
  | "orgName"
  | "title"
  | "summary"
  | "causes"
  | "location"
  | "tiers"
  | "email"
  | "startDate"
  | "goal"
  | "ein"
  | "cover"
  | "audiences"
  | "story";

export type Gap = {
  field: GapField;
  level: "required" | "recommended";
  label: string;
  hint: string;
  /** A value Peep can fill in for you, when it has one. */
  suggestion?: number;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function campaignGaps(d: CampaignDraft, today: string = new Date().toISOString().slice(0, 10)): Gap[] {
  const gaps: Gap[] = [];
  const need = (field: GapField, label: string, hint: string) => gaps.push({ field, level: "required", label, hint });
  const nice = (field: GapField, label: string, hint: string, suggestion?: number) => gaps.push({ field, level: "recommended", label, hint, suggestion });

  if (!d.orgName.trim()) need("orgName", "Organization name", "Who's running the campaign.");
  if (!d.title.trim()) need("title", "Campaign name", "The event, program or campaign sponsors are backing.");
  if (d.summary.trim().length < 40) need("summary", "Short pitch", "Two or three sentences sponsors read first.");
  if (!d.causes.length) need("causes", "Cause", "Pick at least one so Peep can find sponsors who fund it.");
  if (!d.location.virtual && (!d.location.city?.trim() || !d.location.state)) need("location", "Location", "City and state, or mark it virtual. Local sponsors match on this.");
  const tiers = d.tiers.filter((t) => t.amount > 0);
  if (!tiers.length) need("tiers", "Sponsorship tiers", "At least one level with a dollar amount, so sponsors know what to give.");
  if (!d.contact.email || !EMAIL.test(d.contact.email)) need("email", "Contact email", "Where sponsors send their yes.");
  if (d.kind === "event" && !d.startDate) need("startDate", "Event date", "Sponsors plan around it.");
  else if (d.startDate && (d.endDate ?? d.startDate) < today) need("startDate", "Event date", "This date has already passed. Is it this year's?");

  if (!d.goal) {
    const suggestion = suggestedGoal(tiers);
    nice("goal", "Fundraising goal", suggestion ? `Peep suggests $${suggestion.toLocaleString()} from your tiers.` : "Sponsors like to see how far along you are.", suggestion || undefined);
  }
  if (d.orgType === "501c3" && !d.ein) nice("ein", "EIN", "Many sponsors only fund verified 501(c)(3)s.");
  if (!d.coverImage) nice("cover", "Cover image", "Campaigns with a photo get more attention.");
  if (!d.audiences.length || (d.audiences.length === 1 && d.audiences[0] === "general-public")) nice("audiences", "Who it serves", "Sponsors match on the people you reach.");
  if (!d.story?.trim()) nice("story", "Your story", "A paragraph on why it matters, for your campaign page.");

  return gaps;
}

/** Share of checks a draft passes, 0–100, for a progress meter. */
export function readiness(d: CampaignDraft, today?: string): number {
  const TOTAL = 13;
  return Math.round(((TOTAL - campaignGaps(d, today).length) / TOTAL) * 100);
}
