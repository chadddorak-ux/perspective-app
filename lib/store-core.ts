// Store logic shared by the server (JSON file) and the static build
// (localStorage). Each backend only supplies how to read and write user data.

import { seedOpportunities, seedPledges, seedSponsors } from "../data/seed.ts";
import type { IntroRequest, IntroStatus, Opportunity, Pledge, SponsorProfile } from "./types.ts";

export type DB = { opportunities: Opportunity[]; sponsors: SponsorProfile[]; intros: IntroRequest[]; pledges: Pledge[] };

export type Backend = {
  read(): Promise<Partial<DB> | null>;
  write(userData: DB): Promise<void>;
};

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function createStore(backend: Backend, cache: { db?: Promise<DB> } = {}) {
  const load = (): Promise<DB> => {
    cache.db ??= backend.read().then((saved) => ({
      opportunities: [...(saved?.opportunities ?? []), ...seedOpportunities],
      sponsors: [...(saved?.sponsors ?? []), ...seedSponsors],
      intros: saved?.intros ?? [],
      pledges: [...(saved?.pledges ?? []), ...seedPledges],
    }));
    return cache.db;
  };

  // Only what people created is persisted; seed data always comes from code.
  const save = (db: DB) =>
    backend.write({
      opportunities: db.opportunities.filter((o) => o.source !== "seed"),
      sponsors: db.sponsors.filter((s) => s.source !== "seed"),
      intros: db.intros,
      pledges: db.pledges.filter((p) => !p.id.startsWith("seed-")),
    });

  function slugify(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  }

  async function listOpportunities(): Promise<Opportunity[]> {
    return (await load()).opportunities;
  }

  async function getOpportunity(id: string): Promise<Opportunity | undefined> {
    return (await load()).opportunities.find((o) => o.id === id);
  }

  async function createOpportunity(
    input: Omit<Opportunity, "id" | "createdAt">,
  ): Promise<Opportunity> {
    const db = await load();
    const opp: Opportunity = {
      ...input,
      id: `${slugify(input.title || input.orgName) || "listing"}-${uuid().slice(0, 6)}`,
      createdAt: new Date().toISOString(),
    };
    db.opportunities.unshift(opp);
    await save(db);
    return opp;
  }

  async function listSponsors(): Promise<SponsorProfile[]> {
    return (await load()).sponsors;
  }

  async function getSponsor(id: string): Promise<SponsorProfile | undefined> {
    return (await load()).sponsors.find((s) => s.id === id);
  }

  async function createSponsor(input: Omit<SponsorProfile, "id" | "createdAt">): Promise<SponsorProfile> {
    const db = await load();
    const sp: SponsorProfile = {
      ...input,
      id: `${slugify(input.name) || "sponsor"}-${uuid().slice(0, 6)}`,
      createdAt: new Date().toISOString(),
    };
    db.sponsors.unshift(sp);
    await save(db);
    return sp;
  }

  async function listIntros(): Promise<IntroRequest[]> {
    return (await load()).intros;
  }

  async function createIntro(
    input: Pick<IntroRequest, "opportunityId" | "sponsorId" | "score" | "note" | "requestedBy">,
  ): Promise<IntroRequest> {
    const db = await load();
    const existing = db.intros.find(
      (i) => i.opportunityId === input.opportunityId && i.sponsorId === input.sponsorId,
    );
    if (existing) return existing;
    const now = new Date().toISOString();
    const intro: IntroRequest = { ...input, id: uuid(), status: "requested", createdAt: now, updatedAt: now };
    db.intros.unshift(intro);
    await save(db);
    return intro;
  }

  async function updateIntroStatus(id: string, status: IntroStatus): Promise<IntroRequest | undefined> {
    const db = await load();
    const intro = db.intros.find((i) => i.id === id);
    if (!intro) return undefined;
    intro.status = status;
    intro.updatedAt = new Date().toISOString();
    await save(db);
    return intro;
  }

  async function listPledges(): Promise<Pledge[]> {
    return (await load()).pledges;
  }

  async function createPledge(input: Omit<Pledge, "id" | "createdAt" | "status">): Promise<Pledge> {
    const db = await load();
    const pledge: Pledge = { ...input, id: uuid(), status: "pledged", createdAt: new Date().toISOString() };
    db.pledges.unshift(pledge);
    await save(db);
    return pledge;
  }

  return { listOpportunities, getOpportunity, createOpportunity, listSponsors, getSponsor, createSponsor, listIntros, createIntro, updateIntroStatus, listPledges, createPledge };
}
