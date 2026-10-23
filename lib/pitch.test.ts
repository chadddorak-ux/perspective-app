import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { budgetCalendar, pitchProblem, quarterOf } from "./pitch.ts";
import { makeOpp, makeSponsor } from "./test-factories.ts";
import type { Pitch } from "./types.ts";

const NOW = new Date("2026-10-23T12:00:00Z");
const pitch = (p: Partial<Pitch>): Pitch => ({ id: "x", opportunityId: "opp", sponsorId: "sponsor", via: "profile", status: "sent", createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(), ...p });

describe("pitching", () => {
  const sp = makeSponsor({ budget: { min: 5000, max: 25000 }, leadTimeDays: 30 });

  it("allows a campaign that fits", () => {
    assert.equal(pitchProblem(makeOpp(), sp, [], [], NOW), null);
  });

  it("blocks causes the brand doesn't fund", () => {
    assert.match(pitchProblem(makeOpp({ causes: ["arts-culture"] }), sp, [], [], NOW) ?? "", /doesn't fund/);
  });

  it("needs enough lead time", () => {
    assert.match(pitchProblem(makeOpp({ startDate: "2026-11-01" }), sp, [], [], NOW) ?? "", /notice/);
  });

  it("allows one pitch per organization per brand per quarter", () => {
    const first = makeOpp({ id: "a", orgName: "Food Bank" });
    const second = makeOpp({ id: "b", orgName: "Food Bank" });
    assert.match(pitchProblem(first, sp, [pitch({ opportunityId: "a" })], [first, second], NOW) ?? "", /Already pitched/);
    assert.match(pitchProblem(second, sp, [pitch({ opportunityId: "a" })], [first, second], NOW) ?? "", /this quarter/);
    const nextQuarter = new Date("2027-01-15T12:00:00Z");
    assert.equal(pitchProblem(second, sp, [pitch({ opportunityId: "a" })], [first, second], nextQuarter), null);
  });

  it("respects invite-only brands", () => {
    assert.match(pitchProblem(makeOpp(), makeSponsor({ approach: "invite-only" }), [], [], NOW) ?? "", /invitation/);
  });

  it("knows the quarter and the budget calendar", () => {
    assert.equal(quarterOf(NOW), "2026-Q4");
    const cal = budgetCalendar(makeSponsor({ fiscalYearEnd: 6 }), NOW)!;
    assert.equal(cal.yearEnds, "June 30");
    assert.match(cal.bestWindow, /March–June/);
  });
});
