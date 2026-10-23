// Server persistence: seed data plus a JSON file under .data/. Swap the
// backend for Postgres (or similar) before real users.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createStore, type DB } from "./store-core.ts";

const FILE = path.join(process.cwd(), ".data", "db.json");

// Next bundles pages and route handlers separately, so a module-level cache
// would give each its own copy. One process-wide cache keeps them in sync.
const globalCache = globalThis as unknown as { __perspectiveDB?: { db?: Promise<DB> } };
globalCache.__perspectiveDB ??= {};

const store = createStore(
  {
    async read() {
      try {
        return JSON.parse(await readFile(FILE, "utf8")) as Partial<DB>;
      } catch {
        return null;
      }
    },
    async write(userData) {
      try {
        await mkdir(path.dirname(FILE), { recursive: true });
        await writeFile(FILE, JSON.stringify(userData, null, 2));
      } catch {
        // Read-only filesystems (e.g. serverless): keep data in memory for this instance.
      }
    },
  },
  globalCache.__perspectiveDB,
);

export const {
  listOpportunities,
  getOpportunity,
  createOpportunity,
  listSponsors,
  getSponsor,
  createSponsor,
  listIntros,
  createIntro,
  updateIntroStatus,
  listPledges,
  createPledge,
  getPledge,
  updatePledge,
  updateSponsor,
  listPitches,
  createPitch,
  updatePitch,
  listVotes,
  createVote,
} = store;
