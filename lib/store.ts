// Prototype persistence: seed data plus a JSON file under .data/. Swap this
// module for Postgres (or similar) before real users; nothing else touches storage.

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { seedOpportunities, seedPledges, seedSponsors } from "../data/seed.ts";
import type { IntroRequest, IntroStatus, Opportunity, Pledge, SponsorProfile } from "./types.ts";

type DB = { opportunities: Opportunity[]; sponsors: SponsorProfile[]; intros: IntroRequest[]; pledges: Pledge[] };

const FILE = path.join(process.cwd(), ".data", "db.json");

// Next bundles pages and route handlers separately, so a module-level variable
// would give each its own copy. One process-wide cache keeps them in sync.
const globalCache = globalThis as unknown as { __perspectiveDB?: Promise<DB> };

function load(): Promise<DB> {
  globalCache.__perspectiveDB ??= readDB();
  return globalCache.__perspectiveDB;
}

async function readDB(): Promise<DB> {
  let cache: DB;
  try {
    const saved = JSON.parse(await readFile(FILE, "utf8")) as Partial<DB>;
    cache = {
      opportunities: [...(saved.opportunities ?? []), ...seedOpportunities],
      sponsors: [...(saved.sponsors ?? []), ...seedSponsors],
      intros: saved.intros ?? [],
      pledges: [...(saved.pledges ?? []), ...seedPledges],
    };
  } catch {
    cache = { opportunities: [...seedOpportunities], sponsors: [...seedSponsors], intros: [], pledges: [...seedPledges] };
  }
  return cache;
}

async function save(db: DB): Promise<void> {
  const userData: DB = {
    opportunities: db.opportunities.filter((o) => o.source !== "seed"),
    sponsors: db.sponsors.filter((s) => s.source !== "seed"),
    intros: db.intros,
    pledges: db.pledges.filter((p) => !p.id.startsWith("seed-")),
  };
  try {
    await mkdir(path.dirname(FILE), { recursive: true });
    await writeFile(FILE, JSON.stringify(userData, null, 2));
  } catch {
    // Read-only filesystems (e.g. serverless): keep data in memory for this instance.
  }
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

export async function listOpportunities(): Promise<Opportunity[]> {
  return (await load()).opportunities;
}

export async function getOpportunity(id: string): Promise<Opportunity | undefined> {
  return (await load()).opportunities.find((o) => o.id === id);
}

export async function createOpportunity(
  input: Omit<Opportunity, "id" | "createdAt">,
): Promise<Opportunity> {
  const db = await load();
  const opp: Opportunity = {
    ...input,
    id: `${slugify(input.title || input.orgName) || "listing"}-${randomUUID().slice(0, 6)}`,
    createdAt: new Date().toISOString(),
  };
  db.opportunities.unshift(opp);
  await save(db);
  return opp;
}

export async function listSponsors(): Promise<SponsorProfile[]> {
  return (await load()).sponsors;
}

export async function getSponsor(id: string): Promise<SponsorProfile | undefined> {
  return (await load()).sponsors.find((s) => s.id === id);
}

export async function createSponsor(input: Omit<SponsorProfile, "id" | "createdAt">): Promise<SponsorProfile> {
  const db = await load();
  const sp: SponsorProfile = {
    ...input,
    id: `${slugify(input.name) || "sponsor"}-${randomUUID().slice(0, 6)}`,
    createdAt: new Date().toISOString(),
  };
  db.sponsors.unshift(sp);
  await save(db);
  return sp;
}

export async function listIntros(): Promise<IntroRequest[]> {
  return (await load()).intros;
}

export async function createIntro(
  input: Pick<IntroRequest, "opportunityId" | "sponsorId" | "score" | "note" | "requestedBy">,
): Promise<IntroRequest> {
  const db = await load();
  const existing = db.intros.find(
    (i) => i.opportunityId === input.opportunityId && i.sponsorId === input.sponsorId,
  );
  if (existing) return existing;
  const now = new Date().toISOString();
  const intro: IntroRequest = { ...input, id: randomUUID(), status: "requested", createdAt: now, updatedAt: now };
  db.intros.unshift(intro);
  await save(db);
  return intro;
}

export async function updateIntroStatus(id: string, status: IntroStatus): Promise<IntroRequest | undefined> {
  const db = await load();
  const intro = db.intros.find((i) => i.id === id);
  if (!intro) return undefined;
  intro.status = status;
  intro.updatedAt = new Date().toISOString();
  await save(db);
  return intro;
}

export async function listPledges(): Promise<Pledge[]> {
  return (await load()).pledges;
}

export async function createPledge(input: Omit<Pledge, "id" | "createdAt" | "status">): Promise<Pledge> {
  const db = await load();
  const pledge: Pledge = { ...input, id: randomUUID(), status: "pledged", createdAt: new Date().toISOString() };
  db.pledges.unshift(pledge);
  await save(db);
  return pledge;
}
