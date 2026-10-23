import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bunchPlan, floorCalc } from "./tax.ts";

describe("1% floor", () => {
  it("gives no deduction under the floor", () => {
    const r = floorCalc({ taxableIncome: 2_000_000, budget: 15_000, entity: "c-corp" });
    assert.equal(r.floor, 20_000);
    assert.equal(r.deductibleGifts, 0);
    assert.equal(r.underFloor, true);
    assert.match(r.tips.join(" "), /business expense/);
  });

  it("deducts only above the floor, up to the 10% cap", () => {
    const r = floorCalc({ taxableIncome: 1_000_000, budget: 50_000, entity: "c-corp" });
    assert.equal(r.deductibleGifts, 40_000);
    const capped = floorCalc({ taxableIncome: 1_000_000, budget: 150_000, entity: "c-corp" });
    assert.equal(capped.deductibleGifts, 90_000);
  });

  it("doesn't apply the corporate floor to pass-throughs", () => {
    assert.equal(floorCalc({ taxableIncome: 1_000_000, budget: 5_000, entity: "pass-through" }).deductibleGifts, 5_000);
  });

  it("bunching clears the floor once instead of every year", () => {
    const plan = bunchPlan({ taxableIncome: 2_000_000, budget: 15_000, entity: "c-corp" }, 2);
    assert.equal(plan.bunched, 30_000);
    assert.equal(plan.deductibleSpread, 0);
    assert.equal(plan.deductibleBunched, 10_000);
    assert.equal(plan.schedule.length, 8);
    assert.equal(plan.schedule[0].quarter, "Q1 2026");
  });
});
