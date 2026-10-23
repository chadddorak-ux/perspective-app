// A tiny bus so any page can talk to Peep, the campaign manager who follows
// you around the site, without importing her.

import type { Reaction } from "@/components/scene/gremlin";

export type PeepLine = {
  text: string;
  /** A next step to offer, as a button in the speech bubble. */
  cta?: { label: string; href: string };
  react?: Reaction;
  /** Seconds to keep the bubble up (default 7). */
  hold?: number;
};

/** Peep reacts, and makes a noise. */
export function peepReact(kind: Reaction): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<Reaction>("peep", { detail: kind }));
}

/** Peep says something in her speech bubble. */
export function peepSay(line: PeepLine): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<PeepLine>("peep:say", { detail: line }));
}

/** Peep acts along with a demo, silently. */
export function peepDemo(kind: Reaction): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<Reaction>("peep:demo", { detail: kind }));
}
