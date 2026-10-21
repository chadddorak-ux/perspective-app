import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { seedOpportunities, seedSponsors } from "../data/seed.ts";
import { objectivesOffered, rankSponsors, scoreMatch, WEIGHTS } from "./match.ts";
import type { Opportunity, SponsorProfile } from "./types.ts";

const NOW = new Date("2026-10-21T12:00:00Z");
const opp = (id: string) => seedOpportunities.find((o) => o.id === id)!;
const sponsor = (id: string) => seedSponsors.find((s) => s.id === id)!;

describe("scoreMatch", () => {
  it("weights sum to 100 so scores read as percentages", () => {
    assert.equal(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 100);
  });

  it("ranks an aerospace employer in the same metro first for EAGLES SOAR", () => {
    const ranked = rankSponsors(opp("eagles-soar-2026"), seedSponsors, NOW);
    assert.equal(ranked[0].item.id, "aeronova");
    assert.equal(ranked[0].match.grade, "Excellent");
    assert.equal(ranked[0].match.suggestedTier?.amount, 40000);
  });

  it("treats a sponsor's excluded cause as a hard blocker", () => {
    const m = scoreMatch(opp("eagles-soar-2026"), sponsor("redline-energy"), NOW);
    assert.equal(m.grade, "Not eligible");
    assert.equal(m.score, 0);
    assert.match(m.blockers[0], /excludes Youth development/);
  });

  it("blocks non-501(c)(3) orgs for sponsors that require it", () => {
    const school: Opportunity = { ...opp("eagles-soar-2026"), orgType: "other" };
    const m = scoreMatch(school, sponsor("aeronova"), NOW);
    assert.equal(m.grade, "Not eligible");
  });

  it("keeps off-mission sponsors out of the top grades even when logistics fit", () => {
    const m = scoreMatch(opp("eagles-soar-2026"), sponsor("coastal-grocers"), NOW);
    assert.equal(m.grade, "Long shot");
    assert.ok(m.adjustments.some((a) => a.label === "Outside their core causes"));
  });

  it("caps sponsors whose top cause isn't served below Excellent", () => {
    const m = scoreMatch(opp("eagles-soar-2026"), sponsor("coral-coast-cu"), NOW);
    assert.ok(m.score <= 84, `score ${m.score}`);
    assert.equal(m.grade, "Strong");
  });

  it("suggests the largest tier inside the sponsor's budget", () => {
    const m = scoreMatch(opp("eagles-soar-2026"), sponsor("alvarez-fund"), NOW);
    assert.equal(m.suggestedTier?.amount, 10000);
  });

  it("flags when the cheapest tier is above a sponsor's budget", () => {
    const small: SponsorProfile = { ...sponsor("alvarez-fund"), budget: { min: 500, max: 2000 } };
    const m = scoreMatch(opp("eagles-soar-2026"), small, NOW);
    assert.equal(m.breakdown.find((d) => d.dimension === "budget")!.score, 0);
    assert.ok(m.gaps.some((g) => /above their typical/.test(g)));
  });

  it("penalizes events inside the sponsor's decision window", () => {
    const m = scoreMatch(opp("eagles-soar-2026"), sponsor("atlas-defense"), NOW);
    const timing = m.breakdown.find((d) => d.dimension === "timing")!;
    assert.ok(timing.score < timing.max);
    assert.match(timing.note, /120\+ days ahead/);
  });

  it("marks past events as not eligible", () => {
    const later = new Date("2027-01-15T00:00:00Z");
    assert.equal(scoreMatch(opp("eagles-soar-2026"), sponsor("aeronova"), later).grade, "Not eligible");
  });

  it("penalizes a support-type mismatch", () => {
    const mediaOnly = sponsor("lumen-media");
    const cashOnly: Opportunity = { ...opp("tampa-hunger-5k"), asks: ["cash"] };
    const m = scoreMatch(cashOnly, mediaOnly, NOW);
    assert.ok(m.adjustments.some((a) => a.label === "Support type mismatch"));
  });

  it("reads sponsor-relevant objectives out of tier benefits", () => {
    const offered = objectivesOffered(opp("eagles-soar-2026"));
    for (const o of ["talent-pipeline", "brand-visibility", "thought-leadership", "relationships", "customer-reach"] as const) {
      assert.ok(offered.has(o), o);
    }
  });

  it("scores are always within 0–100", () => {
    for (const o of seedOpportunities) {
      for (const s of seedSponsors) {
        const { score } = scoreMatch(o, s, NOW);
        assert.ok(score >= 0 && score <= 100, `${o.id} × ${s.id} = ${score}`);
      }
    }
  });
});
