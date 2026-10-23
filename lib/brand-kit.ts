// Brand kits: the asset vault behind every brand profile. When a brand hasn't
// uploaded its own, Peep drafts a starter kit from public information (in
// production, a logo API such as Brandfetch; here, generated from the name)
// that the brand can review and replace.

import type { BrandKit, Pledge, SponsorProfile } from "./types.ts";

const PALETTES = [
  ["#1f6feb", "#0b2e59"],
  ["#e8590c", "#5c2408"],
  ["#2f9e44", "#123d1d"],
  ["#7048e8", "#2b1a66"],
  ["#d6336c", "#5a1530"],
  ["#0c8599", "#063a43"],
  ["#f59f00", "#5c3c00"],
  ["#495057", "#1c1f22"],
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function initials(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 &]/g, " ").split(/\s+/).filter((w) => w && !/^(the|and|&|of|inc|llc|llp|co)$/i.test(w));
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase();
}

/** A square mark and a horizontal wordmark, as SVG markup. */
export function draftLogos(name: string): { mark: string; wordmark: string; colors: { name: string; hex: string }[] } {
  const [primary, deep] = PALETTES[hash(name) % PALETTES.length];
  const ini = esc(initials(name));
  const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="28" fill="${primary}"/><text x="60" y="76" text-anchor="middle" font-family="Georgia, serif" font-size="48" font-weight="700" fill="#fff">${ini}</text></svg>`;
  const label = name.length > 34 ? name.slice(0, 33) + "…" : name;
  // Shrink the type for long names so the wordmark never runs off the edge.
  const size = Math.min(34, Math.floor(352 / (label.length * 0.58)));
  const wordmark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 120"><rect x="8" y="16" width="88" height="88" rx="22" fill="${primary}"/><text x="52" y="74" text-anchor="middle" font-family="Georgia, serif" font-size="36" font-weight="700" fill="#fff">${ini}</text><text x="116" y="${60 + size * 0.38}" font-family="Helvetica, Arial, sans-serif" font-size="${size}" font-weight="700" fill="${deep}">${esc(label)}</text></svg>`;
  return { mark, wordmark, colors: [{ name: "Primary", hex: primary }, { name: "Deep", hex: deep }, { name: "Paper", hex: "#ffffff" }] };
}

export const DEFAULT_RULES = [
  "Use the full-color logo on light backgrounds and the white version on dark ones.",
  "Leave clear space around the logo at least the height of the mark's first letter.",
  "Don't stretch, recolor, rotate or add effects to the logo.",
  "Recognition only: name, logo and tagline. No product claims, prices or calls to action.",
];

/** The brand's kit, or a drafted starter kit if it hasn't set one up yet. */
export function kitFor(sp: SponsorProfile): BrandKit {
  if (sp.brandKit) return sp.brandKit;
  const logos = draftLogos(sp.name);
  return {
    ...logos,
    tagline: `Proud supporter of our community`,
    boilerplate: sp.about || `${sp.name} supports causes in its community.`,
    mission: undefined,
    rules: DEFAULT_RULES,
    origin: "drafted",
  };
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const KIT_ACCESS_DAYS = 365;

export type KitAccess = { open: boolean; reason: string; until?: string };

/**
 * Whether a nonprofit can pull this backer's kit: only once the money has
 * cleared, only for public or private recognition (anonymous means no logo),
 * for a year, and never after the brand revokes it.
 */
export function kitAccess(p: Pledge, now: Date = new Date()): KitAccess {
  if (p.recognition === "anonymous") return { open: false, reason: "Anonymous gift: no logo or name to display" };
  if (p.kitRevoked) return { open: false, reason: "The brand closed access to its kit" };
  if (!p.clearedAt) return { open: false, reason: "Unlocks when the transfer clears" };
  const until = new Date(Date.parse(p.clearedAt) + KIT_ACCESS_DAYS * 86_400_000);
  if (until < now) return { open: false, reason: "Access expired a year after the gift" };
  return { open: true, reason: "Unlocked by a cleared gift", until: until.toISOString().slice(0, 10) };
}
