// In-browser router for the static build. Routes map to short URL tokens
// ("#discover", "#campaign-<id>") so a view can be linked; filters and other
// query state live in memory.

import { useSyncExternalStore } from "react";

export type Route = { path: string; query: Record<string, string>; anchor?: string; version: number };

const TOKENS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^\/$/, () => ""],
  [/^\/opportunities$/, () => "discover"],
  [/^\/opportunities\/([^/]+)$/, (m) => `campaign-${m[1]}`],
  [/^\/sponsors$/, () => "sponsors"],
  [/^\/sponsors\/([^/]+)$/, (m) => `sponsor-${m[1]}`],
  [/^\/find$/, () => "start"],
  [/^\/give$/, () => "give"],
  [/^\/import$/, () => "import"],
  [/^\/intros$/, () => "intros"],
];

export function tokenFor(path: string): string | null {
  for (const [re, fn] of TOKENS) {
    const m = path.match(re);
    if (m) return fn(m);
  }
  return null;
}

export function pathForToken(token: string): string | null {
  if (token === "") return "/";
  if (token.startsWith("campaign-")) return `/opportunities/${token.slice(9)}`;
  if (token.startsWith("sponsor-")) return `/sponsors/${token.slice(8)}`;
  const plain: Record<string, string> = { discover: "/opportunities", sponsors: "/sponsors", start: "/find", give: "/give", import: "/import", intros: "/intros" };
  return plain[token] ?? null;
}

export function parseUrl(url: string): Omit<Route, "version"> {
  const [beforeHash, anchor] = url.split("#");
  const [path, qs] = beforeHash.split("?");
  return { path: path || "/", query: Object.fromEntries(new URLSearchParams(qs ?? "")), anchor: anchor || undefined };
}

export function hrefFor(url: string): string {
  const token = tokenFor(parseUrl(url).path);
  return token === null ? url : `#${token}`;
}

function fromLocation(): Omit<Route, "version"> {
  let raw = "";
  try {
    raw = decodeURIComponent(window.location.hash.slice(1));
  } catch {
    /* unreadable hash: start at home */
  }
  if (raw.startsWith("/")) return parseUrl(raw);
  return { path: pathForToken(raw) ?? "/", query: {} };
}

let current: Route = { ...fromLocation(), version: 0 };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function navigate(url: string, opts: { replace?: boolean } = {}) {
  current = { ...parseUrl(url), version: current.version + 1 };
  const token = tokenFor(current.path);
  try {
    const target = token ? `#${token}` : window.location.pathname + window.location.search;
    window.history[opts.replace ? "replaceState" : "pushState"]({ url }, "", target);
  } catch {
    // Some embedded frames refuse history updates; routing still works in memory.
  }
  emit();
}

/** Re-render the current view with fresh data, like Next's router.refresh(). */
export function refresh() {
  current = { ...current, anchor: undefined, version: current.version + 1 };
  emit();
}

if (typeof window !== "undefined") {
  window.addEventListener("popstate", (e) => {
    const url = (e.state as { url?: string } | null)?.url;
    current = { ...(url ? parseUrl(url) : fromLocation()), version: current.version + 1 };
    emit();
  });
}

export function useRoute(): Route {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}
