// Browser persistence for the static build: what a visitor creates (campaigns,
// pledges, intros) is kept in their own browser via localStorage.

import { createStore, type DB } from "../lib/store-core";

const KEY = "perspective:user-data:v1";

const store = createStore({
  async read() {
    try {
      const raw = window.localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as Partial<DB>) : null;
    } catch {
      return null; // private mode or blocked storage: start from the sample network
    }
  },
  async write(userData) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(userData));
    } catch {
      // Storage unavailable: changes last until the page is closed.
    }
  },
});

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

export function resetUserData() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing stored */
  }
}
