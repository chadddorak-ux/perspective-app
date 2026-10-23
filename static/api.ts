// Runs the app's real API route handlers in the browser: fetch("/api/...")
// calls are answered locally instead of by a server.

import * as extract from "../app/api/extract/route";
import * as introById from "../app/api/intros/[id]/route";
import * as intros from "../app/api/intros/route";
import * as match from "../app/api/match/route";
import * as opportunities from "../app/api/opportunities/route";
import * as pitchById from "../app/api/pitches/[id]/route";
import * as pitches from "../app/api/pitches/route";
import * as pledgeById from "../app/api/pledges/[id]/route";
import * as pledges from "../app/api/pledges/route";
import * as sponsorById from "../app/api/sponsors/[id]/route";
import * as sponsors from "../app/api/sponsors/route";
import * as votes from "../app/api/votes/route";

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

const ROUTES: [method: string, pattern: RegExp, handler: Handler][] = [
  ["POST", /^\/api\/extract$/, extract.POST as Handler],
  ["POST", /^\/api\/match$/, match.POST as Handler],
  ["POST", /^\/api\/opportunities$/, opportunities.POST as Handler],
  ["POST", /^\/api\/sponsors$/, sponsors.POST as Handler],
  ["POST", /^\/api\/intros$/, intros.POST as Handler],
  ["PATCH", /^\/api\/intros\/(?<id>[^/]+)$/, introById.PATCH as unknown as Handler],
  ["POST", /^\/api\/pledges$/, pledges.POST as Handler],
  ["PATCH", /^\/api\/pledges\/(?<id>[^/]+)$/, pledgeById.PATCH as unknown as Handler],
  ["PATCH", /^\/api\/sponsors\/(?<id>[^/]+)$/, sponsorById.PATCH as unknown as Handler],
  ["POST", /^\/api\/pitches$/, pitches.POST as Handler],
  ["PATCH", /^\/api\/pitches\/(?<id>[^/]+)$/, pitchById.PATCH as unknown as Handler],
  ["POST", /^\/api\/votes$/, votes.POST as Handler],
];

const networkFetch = window.fetch.bind(window);

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith("/api/")) return networkFetch(input, init);
  const method = (init?.method ?? "GET").toUpperCase();
  for (const [m, re, handler] of ROUTES) {
    const hit = url.match(re);
    if (hit && m === method) {
      const req = new Request(`https://perspective.local${url}`, init);
      return handler(req, { params: Promise.resolve(hit.groups ?? {}) });
    }
  }
  return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "content-type": "application/json" } });
};
