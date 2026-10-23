import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { financeCsv, digestFor, storyKitFor } from "./giving-report.ts";
import { feeFor, receiptFor, timelineFor } from "./receipts.ts";
import { makeOpp, makeSponsor } from "./test-factories.ts";
import { GENERAL_SUPPORT, type Pledge } from "./types.ts";

const opp = makeOpp({ ein: "12-3456789", tiers: [{ name: "Table", amount: 5000, benefits: ["Logo on signage", "Table for 10"] }, { name: "Friend", amount: 500, benefits: ["Name on website"] }] });
const pledge = (p: Partial<Pledge>): Pledge => ({ id: "abc123def456", opportunityId: "opp", sponsorId: "sponsor", sponsorName: "Test Brand", tierName: "Friend", amount: 500, status: "confirmed", createdAt: "2026-10-01T00:00:00Z", ...p });

describe("receipts", () => {
  it("charges a 3% fee on top", () => assert.equal(feeFor(10000), 300));

  it("writes the no-goods statement for acknowledgment-only gifts", () => {
    const r = receiptFor(pledge({ acknowledgedAt: "2026-10-05T00:00:00Z" }), opp);
    assert.equal(r.title, "Charitable contribution acknowledgment");
    assert.match(r.statement, /No goods or services/);
    assert.equal(r.final, true);
  });

  it("lists perks for a quid pro quo gift", () => {
    const r = receiptFor(pledge({ tierName: "Table", amount: 5000 }), opp);
    assert.match(r.statement, /Table for 10/);
    assert.equal(r.final, false);
  });

  it("invoices sponsorships as a business expense", () => {
    const r = receiptFor(pledge({ tierName: "Table", amount: 5000, kind: "sponsorship" }), opp);
    assert.equal(r.title, "Sponsorship invoice");
    assert.match(r.statement, /not a charitable contribution receipt/);
  });

  it("treats general operating support as a plain gift", () => {
    assert.match(receiptFor(pledge({ tierName: GENERAL_SUPPORT, amount: 750 }), opp).statement, /No goods or services/);
  });

  it("tracks the transfer timeline", () => {
    const steps = timelineFor(pledge({ clearedAt: "2026-10-03T00:00:00Z" }));
    assert.deepEqual(steps.map((s) => s.done), [true, true, false, false]);
  });

  it("exports a finance CSV and drafts a digest and story kit", () => {
    const sp = makeSponsor();
    const csv = financeCsv(sp, [pledge({ kind: "gift" }), pledge({ id: "zzz", kind: "sponsorship", tierName: "Table", amount: 5000 })], [opp]);
    assert.equal(csv.split("\n").length, 3);
    assert.match(csv, /Business expense/);
    assert.match(digestFor(sp, [pledge({})], [opp]).paragraphs[0], /backed 1 campaign/);
    assert.ok(storyKitFor(opp).stats.length >= 2);
  });
});
