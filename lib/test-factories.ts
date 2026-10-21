// Minimal builders so tests describe only the fields they care about.
import type { Opportunity, SponsorProfile } from "./types.ts";

export function makeOpp(o: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "opp",
    orgName: "Test Org",
    orgType: "501c3",
    title: "Test Event",
    kind: "event",
    summary: "A community event. It does good things.",
    causes: ["food-security"],
    audiences: ["families"],
    location: { city: "Denver", state: "CO", metro: "Denver" },
    startDate: "2027-03-01",
    expectedReach: 2000,
    tiers: [
      { name: "Presenting Sponsor", amount: 25000, benefits: ["Logo on all signage", "Stage remarks"] },
      { name: "Supporting Sponsor", amount: 5000, benefits: ["Booth"] },
    ],
    asks: ["cash"],
    excludedIndustries: [],
    partners: [],
    contact: {},
    source: "seed",
    createdAt: "2026-10-01T00:00:00Z",
    ...o,
  };
}

export function makeSponsor(s: Partial<SponsorProfile> = {}): SponsorProfile {
  return {
    id: "sponsor",
    name: "Test Brand",
    type: "brand",
    about: "Makes things.",
    causes: ["food-security"],
    audiences: ["families"],
    objectives: ["brand-visibility", "community-impact"],
    geography: { scope: "national", states: [], metros: [] },
    budget: { min: 5000, max: 30000 },
    supportTypes: ["cash"],
    leadTimeDays: 60,
    requires501c3: true,
    excludedCauses: [],
    approach: "open",
    source: "seed",
    createdAt: "2026-10-01T00:00:00Z",
    ...s,
  };
}
