// Drafts the emails that turn a match into a conversation. Template-based on
// purpose: every sentence is traceable to the listing and the match reasons.

import { lowerLabel as lower, money } from "./match.ts";
import { CAUSES, label } from "./taxonomy.ts";
import type { MatchResult, Opportunity, SponsorProfile } from "./types.ts";

export type Draft = { subject: string; body: string };

function when(opp: Opportunity): string {
  if (!opp.startDate) return "";
  const fmt = (d: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
  const full = { month: "long", day: "numeric", year: "numeric" } as const;
  const { startDate: start, endDate: end } = opp;
  if (!end || end === start) return fmt(start, full);
  if (start.slice(0, 7) === end.slice(0, 7)) {
    return `${fmt(start, { month: "long", day: "numeric" })}–${Number(end.slice(8, 10))}, ${start.slice(0, 4)}`;
  }
  return `${fmt(start, full)} – ${fmt(end, full)}`;
}

function firstSentence(s: string): string {
  return s.split(/(?<=[.!?])(?<!\b(?:[A-Z]|Capt|Mr|Mrs|Ms|Dr|St|Lt|Col|Gen|Sgt|Maj|Inc|Jr|Sr)\.)\s+/)[0];
}

// Match reasons are written about the sponsor ("their home market"); rephrase for an email to them.
function toSponsor(reason: string): string {
  return reason.replace(/\btheir\b/g, "your").replace(/\bthey\b/g, "you");
}

function aboutSponsor(reason: string, sp: SponsorProfile): string {
  const possessive = sp.name.endsWith("s") ? `${sp.name}'` : `${sp.name}'s`;
  return reason.replace(/\btheir\b/g, possessive).replace(/\bthey\b/g, sp.name);
}

function where(opp: Opportunity): string {
  if (opp.location.virtual) return "online";
  return [opp.location.city, opp.location.state].filter(Boolean).join(", ");
}

function hook(opp: Opportunity, sp: SponsorProfile, match: MatchResult): string {
  const shared = opp.causes.filter((c) => sp.causes.includes(c)).map((c) => lower(label(CAUSES, c)));
  const bits: string[] = [];
  if (shared.length) bits.push(`your focus on ${shared.slice(0, 2).join(" and ")}`);
  if (sp.objectives.includes("talent-pipeline") && match.breakdown.find((d) => d.dimension === "objectives")!.score > 0) {
    bits.push("your interest in building a local talent pipeline");
  }
  return bits.length ? bits.join(" and ") : "your community investments";
}

function tierLine(match: MatchResult): string {
  const t = match.suggestedTier;
  if (!t) return "";
  const perks = t.benefits.slice(0, 3).map(lower).join(", ");
  const name = /level|tier|sponsor|partner/i.test(t.name) ? t.name : `${t.name} level`;
  return `\nBased on what you typically support, the ${name} (${money(t.amount)}) looks like the natural fit${perks ? `. It includes ${perks}` : ""}.\n`;
}

/** The organization writing directly to a sponsor. */
export function directPitch(opp: Opportunity, sp: SponsorProfile, match: MatchResult): Draft {
  const reach = opp.reachNote ?? (opp.expectedReach ? `${opp.expectedReach.toLocaleString()}+ people` : "");
  return {
    subject: `${opp.title} — partnership for ${sp.name}`,
    body: `Hi ${sp.name} team,

I'm reaching out from ${opp.orgName} because ${opp.title} lines up with ${hook(opp, sp, match)}.

${opp.summary}

${[when(opp), where(opp)].filter(Boolean).join(" · ")}${reach ? `\n${reach}` : ""}
${tierLine(match)}
Would you be open to a 15-minute call to see if there's a fit? Happy to send the full sponsorship package.

Thank you,
${opp.contact.name ?? opp.orgName}${opp.contact.website ? `\n${opp.contact.website}` : ""}`,
  };
}

/** A connector asking a sponsor contact for permission before making the intro (double opt-in). */
export function optInAsk(opp: Opportunity, sp: SponsorProfile, match: MatchResult): Draft {
  const why = match.reasons.slice(0, 3).map((r) => `• ${toSponsor(r)}`).join("\n");
  return {
    subject: `Intro? ${opp.orgName} × ${sp.name}`,
    body: `Hi —

I came across an opportunity that looks like a strong fit for ${sp.name}, and wanted to check before making an introduction.

${opp.orgName} is putting on ${opp.title}${when(opp) ? ` (${when(opp)}${where(opp) ? `, ${where(opp)}` : ""})` : ""}. ${firstSentence(opp.summary)}

Why I thought of you:
${why}
${tierLine(match)}
Would you like me to connect you with their team? No pressure either way — a quick yes or no is perfect.`,
  };
}

/** The intro itself, once both sides have said yes. */
export function introEmail(opp: Opportunity, sp: SponsorProfile, match: MatchResult): Draft {
  return {
    subject: `Introduction: ${sp.name} <> ${opp.orgName}`,
    body: `${sp.name} team, meet ${opp.contact.name ?? `the ${opp.orgName} team`}.
${opp.orgName} team, meet ${sp.name}.

${opp.orgName} is producing ${opp.title}. ${firstSentence(opp.summary)}
${sp.about ? `\nAbout ${sp.name}: ${sp.about}\n` : ""}

Why I think you two should talk:
${match.reasons.slice(0, 3).map((r) => `• ${aboutSponsor(r, sp)}`).join("\n")}
${tierLine(match)}
I'll let you two take it from here.`,
  };
}
