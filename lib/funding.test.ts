import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { seedOpportunities, seedPledges, seedSponsors } from "../data/seed.ts";
import { fundingFor, goalFor, pledgeProblem, suggestedGoal, tierSlots } from "./funding.ts";
import { scoreMatch } from "./match.ts";
import { makeOpp } from "./test-factories.ts";
import type { Pledge } from "./types.ts";

const NOW = new Date("2026-10-21T12:00:00Z");
const pledge = (p: Partial<Pledge>): Pledge => ({
  id: "p",
  opportunityId: "opp",
  sponsorName: "Someone",
  tierName: "Presenting Sponsor",
  amount: 25000,
  status: "pledged",
  createdAt: "2026-10-01T00:00:00Z",
  ...p,
});

describe("funding", () => {
  it("defaults tier slots from availability", () => {
    assert.equal(tierSlots({ name: "A", amount: 1, availability: "exclusive", benefits: [] }), 1);
    assert.equal(tierSlots({ name: "A", amount: 1, availability: "limited", benefits: [] }), 3);
    assert.equal(tierSlots({ name: "A", amount: 1, benefits: [] }), 10);
    assert.equal(tierSlots({ name: "A", amount: 1, availability: "exclusive", slots: 4, benefits: [] }), 4);
  });

  it("suggests a goal from the tiers, rounded up to $5K", () => {
    // 25K × 1 (exclusive would be 1, but no availability → 2 of 10) + 5K × 2
    assert.equal(suggestedGoal(makeOpp().tiers), 60000);
    assert.equal(goalFor(makeOpp({ goal: 42000 })), 42000);
  });

  it("totals pledges, sponsors, percent and days left", () => {
    const opp = makeOpp({ goal: 50000 });
    const f = fundingFor(opp, [pledge({}), pledge({ id: "q", sponsorName: "Other", tierName: "Supporting Sponsor", amount: 5000 }), pledge({ opportunityId: "else" })], NOW);
    assert.equal(f.pledged, 30000);
    assert.equal(f.percent, 60);
    assert.equal(f.sponsors, 2);
    assert.equal(f.daysLeft, 131);
    assert.equal(f.state, "open");
    assert.equal(f.tiers.find((t) => t.tier.name === "Supporting Sponsor")!.left, 9);
  });

  it("marks funded and closed campaigns", () => {
    assert.equal(fundingFor(makeOpp({ goal: 20000 }), [pledge({})], NOW).state, "funded");
    assert.equal(fundingFor(makeOpp({ startDate: "2026-09-01" }), [], NOW).state, "closed");
  });

  it("refuses pledges to full, unknown or closed tiers", () => {
    const opp = makeOpp({ tiers: [{ name: "Title", amount: 10000, availability: "exclusive", benefits: [] }] });
    assert.equal(pledgeProblem(opp, "Title", [], NOW), null);
    assert.match(pledgeProblem(opp, "Title", [pledge({ tierName: "Title" })], NOW)!, /fully sponsored/);
    assert.match(pledgeProblem(opp, "Gold", [], NOW)!, /doesn't exist/);
    assert.match(pledgeProblem(makeOpp({ startDate: "2026-01-01" }), "Presenting Sponsor", [], NOW)!, /ended/);
  });
});

describe("seed pledges", () => {
  it("are all valid: real tier, matching amount, within slots, never blocked", () => {
    for (const p of seedPledges) {
      const opp = seedOpportunities.find((o) => o.id === p.opportunityId);
      assert.ok(opp, p.opportunityId);
      const tier = opp.tiers.find((t) => t.name === p.tierName);
      assert.ok(tier, `${p.opportunityId}: ${p.tierName}`);
      assert.equal(p.amount, tier.amount, `${p.opportunityId}: ${p.tierName}`);
      const f = fundingFor(opp, seedPledges, NOW);
      assert.ok(f.tiers.every((t) => t.taken <= t.slots), `${opp.id} oversold`);
      if (p.sponsorId) {
        const sp = seedSponsors.find((s) => s.id === p.sponsorId)!;
        assert.deepEqual(scoreMatch(opp, sp, NOW).blockers, [], `${sp.id} → ${opp.id}`);
      }
    }
  });
});

describe("giving circles and general support", () => {
  const opp = makeOpp({ tiers: [{ name: "Big", amount: 8000, availability: "exclusive", benefits: [] }, { name: "Small", amount: 1000, benefits: [] }] });
  const NOW2 = new Date("2026-10-21T12:00:00Z");
  const share = (id: string): Pledge => ({ id, opportunityId: "opp", sponsorName: id, tierName: "Big", amount: 2000, share: 0.25, status: "pledged", createdAt: "2026-10-01T00:00:00Z" });

  it("counts circle shares as parts of a slot", () => {
    const f = fundingFor(opp, [share("a"), share("b")], NOW2);
    const big = f.tiers.find((t) => t.tier.name === "Big")!;
    assert.equal(big.taken, 0.5);
    assert.equal(big.left, 0.5);
    assert.equal(big.circle, 0.5);
  });

  it("only takes shares once a circle has started, and fills up at four", () => {
    assert.match(pledgeProblem(opp, "Big", [share("a")], NOW2) ?? "", /circle shares/);
    assert.equal(pledgeProblem(opp, "Big", [share("a")], NOW2, 0.25), null);
    assert.match(pledgeProblem(opp, "Big", ["a", "b", "c", "d"].map(share), NOW2, 0.25) ?? "", /fully sponsored/);
    assert.match(pledgeProblem(opp, "Small", [], NOW2, 0.25) ?? "", /too small/);
  });

  it("always accepts general operating support", () => {
    assert.equal(pledgeProblem(opp, "General operating support", [], NOW2), null);
  });
});
