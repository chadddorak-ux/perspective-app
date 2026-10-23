import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { seedOpportunities, seedSponsors } from "../data/seed.ts";
import { objectivesOffered, rankSponsors, scoreMatch, WEIGHTS } from "./match.ts";
import { CAUSES, CAUSE_GROUPS, CAUSE_ADJACENCY, INDUSTRIES, INDUSTRY_AFFINITY } from "./taxonomy.ts";
import { makeOpp, makeSponsor } from "./test-factories.ts";

const NOW = new Date("2026-10-21T12:00:00Z");

describe("taxonomy", () => {
  it("weights sum to 100 so scores read as percentages", () => {
    assert.equal(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 100);
  });

  it("every cause appears in exactly one display group", () => {
    const grouped = CAUSE_GROUPS.flatMap((g) => g.ids);
    assert.deepEqual([...grouped].sort(), Object.keys(CAUSES).sort());
  });

  it("adjacency and industry affinity only reference real causes", () => {
    for (const list of [...Object.values(CAUSE_ADJACENCY), ...Object.values(INDUSTRY_AFFINITY)]) {
      for (const c of list ?? []) assert.ok(c in CAUSES, c);
    }
    assert.deepEqual(Object.keys(INDUSTRY_AFFINITY).sort(), Object.keys(INDUSTRIES).sort());
  });
});

describe("scoreMatch", () => {
  it("rates a national sponsor with the same top cause and budget as Excellent", () => {
    const m = scoreMatch(makeOpp(), makeSponsor(), NOW);
    assert.equal(m.grade, "Excellent");
    assert.equal(m.suggestedTier?.amount, 25000);
  });

  it("weights the organization's primary cause above its secondary ones", () => {
    const primary = scoreMatch(makeOpp({ causes: ["food-security", "arts-culture"] }), makeSponsor(), NOW);
    const secondary = scoreMatch(makeOpp({ causes: ["arts-culture", "food-security"] }), makeSponsor(), NOW);
    assert.ok(primary.score > secondary.score, `${primary.score} vs ${secondary.score}`);
  });

  it("gives partial credit when a brand's industry fits the cause", () => {
    const opp = makeOpp({ causes: ["animal-welfare"] });
    const generic = scoreMatch(opp, makeSponsor({ causes: ["arts-culture"] }), NOW);
    const petBrand = scoreMatch(opp, makeSponsor({ causes: ["arts-culture"], industry: "pets" }), NOW);
    assert.ok(petBrand.score > generic.score);
    assert.match(petBrand.breakdown[0].note, /Natural fit for a pet products & services brand/);
  });

  it("blocks sponsors from industries the organization won't accept", () => {
    const m = scoreMatch(makeOpp({ excludedIndustries: ["alcohol"] }), makeSponsor({ industry: "alcohol" }), NOW);
    assert.equal(m.grade, "Not eligible");
    assert.match(m.blockers[0], /doesn't accept alcohol sponsors/);
  });

  it("blocks causes the sponsor excludes", () => {
    const m = scoreMatch(makeOpp({ causes: ["youth-development"] }), makeSponsor({ excludedCauses: ["youth-development"] }), NOW);
    assert.equal(m.grade, "Not eligible");
  });

  it("blocks non-501(c)(3) organizations for sponsors that require it", () => {
    assert.equal(scoreMatch(makeOpp({ orgType: "other" }), makeSponsor(), NOW).grade, "Not eligible");
    assert.notEqual(scoreMatch(makeOpp({ orgType: "other" }), makeSponsor({ requires501c3: false }), NOW).grade, "Not eligible");
  });

  it("caps local givers outside their area, however good the fit", () => {
    const local = makeSponsor({ geography: { scope: "local", states: ["IL"], metros: ["Chicago"] } });
    const m = scoreMatch(makeOpp(), local, NOW);
    assert.ok(m.score <= 45, `score ${m.score}`);
    assert.ok(m.adjustments.some((a) => a.label === "Outside their giving area (capped)"));
    assert.equal(scoreMatch(makeOpp({ location: { city: "Chicago", state: "IL", metro: "Chicago" } }), local, NOW).grade, "Excellent");
  });

  it("expands a regional sponsor's states to the whole region", () => {
    const regional = makeSponsor({ geography: { scope: "regional", states: ["CA"], metros: [] } });
    const m = scoreMatch(makeOpp({ location: { city: "Seattle", state: "WA" } }), regional, NOW);
    assert.match(m.breakdown.find((d) => d.dimension === "geography")!.note, /Inside their giving area/);
  });

  it("keeps off-mission sponsors in the long-shot range even when logistics fit", () => {
    const m = scoreMatch(makeOpp(), makeSponsor({ causes: ["arts-culture"] }), NOW);
    assert.equal(m.grade, "Long shot");
  });

  it("caps matches on a sponsor's low-priority cause below Excellent", () => {
    const sponsor = makeSponsor({ causes: ["food-security", "housing", "arts-culture", "poverty"] });
    const m = scoreMatch(makeOpp({ causes: ["poverty"] }), sponsor, NOW);
    assert.ok(m.score <= 84, `score ${m.score}`);
  });

  it("suggests the largest tier inside the budget and flags tiers above it", () => {
    assert.equal(scoreMatch(makeOpp(), makeSponsor({ budget: { min: 1000, max: 10000 } }), NOW).suggestedTier?.amount, 5000);
    const small = scoreMatch(makeOpp(), makeSponsor({ budget: { min: 100, max: 1000 } }), NOW);
    assert.equal(small.breakdown.find((d) => d.dimension === "budget")!.score, 0);
    assert.ok(small.gaps.some((g) => /above their typical/.test(g)));
  });

  it("penalizes events inside the sponsor's decision window and blocks past events", () => {
    const soon = scoreMatch(makeOpp({ startDate: "2026-11-15" }), makeSponsor({ leadTimeDays: 120 }), NOW);
    assert.match(soon.breakdown.find((d) => d.dimension === "timing")!.note, /120\+ days ahead/);
    assert.equal(scoreMatch(makeOpp({ startDate: "2026-09-01" }), makeSponsor(), NOW).grade, "Not eligible");
  });

  it("penalizes a support-type mismatch", () => {
    const m = scoreMatch(makeOpp({ asks: ["cash"] }), makeSponsor({ supportTypes: ["media"] }), NOW);
    assert.ok(m.adjustments.some((a) => a.label === "Support type mismatch"));
  });

  it("reads sponsor objectives out of tier benefits", () => {
    const offered = objectivesOffered(
      makeOpp({
        tiers: [{ name: "Title", amount: 10000, benefits: ["Resume book access", "Keynote", "VIP reception", "Product sampling", "Social video series", "Co-branded campaign"] }],
      }),
    );
    for (const o of ["talent-pipeline", "thought-leadership", "relationships", "customer-reach", "content", "cause-marketing"] as const) {
      assert.ok(offered.has(o), o);
    }
  });
});

describe("sample network", () => {
  it("scores are always within 0–100", () => {
    for (const o of seedOpportunities) for (const s of seedSponsors) {
      const { score } = scoreMatch(o, s, NOW);
      assert.ok(score >= 0 && score <= 100, `${o.id} × ${s.id} = ${score}`);
    }
  });

  it("finds a credible top sponsor across very different causes", () => {
    const top = (id: string) => rankSponsors(seedOpportunities.find((o) => o.id === id)!, seedSponsors, NOW)[0].item.id;
    assert.equal(top("holiday-adoption-weekend"), "pawsome-pet-co");
    assert.equal(top("gulf-coast-ready"), "summit-mutual");
    assert.equal(top("rural-health-tour"), "prairie-health");
    assert.equal(top("southside-code-camp"), "copperline-software");
  });

  it("features EAGLES SOAR as a real campaign with a local aerospace employer on top", () => {
    const eagles = seedOpportunities.find((o) => o.id === "eagles-soar-2026")!;
    assert.equal(eagles.featured, true);
    assert.equal(eagles.sample, false);
    const ranked = rankSponsors(eagles, seedSponsors, NOW);
    assert.equal(ranked[0].item.id, "aeronova");
    assert.equal(ranked[0].match.suggestedTier?.amount, 40000);
  });

  it("enforces both sides' exclusions", () => {
    const soccer = seedOpportunities.find((o) => o.id === "eastside-youth-soccer")!;
    const blocked = rankSponsors(soccer, seedSponsors, NOW).filter((r) => r.match.grade === "Not eligible").map((r) => r.item.id);
    assert.deepEqual(blocked.sort(), ["big-easy-brewing", "fastbreak-sportsbook"]);
  });
});

describe("small-org spotlight", () => {
  it("keeps a small organization in the top five", async () => {
    const { withSmallOrgSpotlight, rankOpportunities, isSmallOrg } = await import("./match.ts");
    const { makeOpp, makeSponsor } = await import("./test-factories.ts");
    const big = (i: number) => makeOpp({ id: `big${i}`, orgName: `Big ${i}`, tiers: [{ name: "Top", amount: 25000, benefits: [] }] });
    const small = makeOpp({ id: "small", orgName: "Tiny", expectedReach: 50, audiences: [], tiers: [{ name: "Friend", amount: 1000, benefits: [] }] });
    const sp = makeSponsor({ budget: { min: 1000, max: 30000 } });
    const ranked = rankOpportunities(sp, [...[1, 2, 3, 4, 5, 6].map(big), small], new Date("2026-10-21T12:00:00Z"));
    assert.ok(isSmallOrg(small));
    const out = withSmallOrgSpotlight(ranked);
    const idx = out.findIndex((r) => r.item.id === "small");
    assert.ok(idx > -1 && idx < 5, `small org at ${idx}`);
  });
});
