// Store logic shared by the server (JSON file) and the static build
// (localStorage). Each backend only supplies how to read and write user data.

import { seedOpportunities, seedPledges, seedSponsors } from "../data/seed.ts";
import type { IntroRequest, IntroStatus, Opportunity, Pitch, Pledge, SponsorProfile, Vote } from "./types.ts";

/** Edits people make to sample data (seed rows always come from code, so their changes live here). */
type Overrides = { pledges: Record<string, Partial<Pledge>>; sponsors: Record<string, Partial<SponsorProfile>> };

export type DB = {
  opportunities: Opportunity[];
  sponsors: SponsorProfile[];
  intros: IntroRequest[];
  pledges: Pledge[];
  pitches: Pitch[];
  votes: Vote[];
  overrides: Overrides;
};

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
    cache.db ??= backend.read().then((saved) => {
      const overrides: Overrides = { pledges: saved?.overrides?.pledges ?? {}, sponsors: saved?.overrides?.sponsors ?? {} };
      return {
        opportunities: [...(saved?.opportunities ?? []), ...seedOpportunities],
        sponsors: [...(saved?.sponsors ?? []), ...seedSponsors.map((sp) => ({ ...sp, ...overrides.sponsors[sp.id] }))],
        intros: saved?.intros ?? [],
        pledges: [...(saved?.pledges ?? []), ...seedPledges.map((p) => ({ ...p, ...overrides.pledges[p.id] }))],
        pitches: saved?.pitches ?? [],
        votes: saved?.votes ?? [],
        overrides,
      };
    });
    return cache.db;
  };

  // Only what people created is persisted; seed data always comes from code.
  const save = (db: DB) =>
    backend.write({
      opportunities: db.opportunities.filter((o) => o.source !== "seed"),
      sponsors: db.sponsors.filter((s) => s.source !== "seed"),
      intros: db.intros,
      pledges: db.pledges.filter((p) => !p.id.startsWith("seed-")),
      pitches: db.pitches,
      votes: db.votes,
      overrides: db.overrides,
    });

  /** Apply a patch to a row; for sample rows, remember the patch so it survives reloads. */
  function patchRow<T extends { id: string }>(row: T, patch: Partial<T>, seeded: boolean, bucket: Record<string, Partial<T>>) {
    Object.assign(row, patch);
    if (seeded) bucket[row.id] = { ...bucket[row.id], ...patch };
  }

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

  async function updateSponsor(id: string, patch: Partial<SponsorProfile>): Promise<SponsorProfile | undefined> {
    const db = await load();
    const sp = db.sponsors.find((s) => s.id === id);
    if (!sp) return undefined;
    patchRow(sp, patch, sp.source === "seed", db.overrides.sponsors);
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

  async function getPledge(id: string): Promise<Pledge | undefined> {
    return (await load()).pledges.find((p) => p.id === id);
  }

  async function updatePledge(id: string, patch: Partial<Pledge>): Promise<Pledge | undefined> {
    const db = await load();
    const pledge = db.pledges.find((p) => p.id === id);
    if (!pledge) return undefined;
    patchRow(pledge, patch, pledge.id.startsWith("seed-"), db.overrides.pledges);
    await save(db);
    return pledge;
  }

  async function listPitches(): Promise<Pitch[]> {
    return (await load()).pitches;
  }

  async function createPitch(input: Pick<Pitch, "opportunityId" | "sponsorId" | "note" | "via">): Promise<Pitch> {
    const db = await load();
    const now = new Date().toISOString();
    const pitch: Pitch = { ...input, id: uuid(), status: "sent", createdAt: now, updatedAt: now };
    db.pitches.unshift(pitch);
    await save(db);
    return pitch;
  }

  async function updatePitch(id: string, patch: Pick<Pitch, "status" | "reason">): Promise<Pitch | undefined> {
    const db = await load();
    const pitch = db.pitches.find((p) => p.id === id);
    if (!pitch) return undefined;
    Object.assign(pitch, patch, { updatedAt: new Date().toISOString() });
    await save(db);
    return pitch;
  }

  async function listVotes(): Promise<Vote[]> {
    return (await load()).votes;
  }

  async function createVote(input: Pick<Vote, "sponsorId" | "opportunityId" | "voter">): Promise<Vote> {
    const db = await load();
    // One vote per person per pool: a new vote replaces their old one.
    db.votes = db.votes.filter((v) => !(v.sponsorId === input.sponsorId && v.voter.toLowerCase() === input.voter.toLowerCase()));
    const vote: Vote = { ...input, id: uuid(), createdAt: new Date().toISOString() };
    db.votes.unshift(vote);
    await save(db);
    return vote;
  }

  return {
    listOpportunities,
    getOpportunity,
    createOpportunity,
    listSponsors,
    getSponsor,
    createSponsor,
    updateSponsor,
    listIntros,
    createIntro,
    updateIntroStatus,
    listPledges,
    createPledge,
    getPledge,
    updatePledge,
    listPitches,
    createPitch,
    updatePitch,
    listVotes,
    createVote,
  };
}
