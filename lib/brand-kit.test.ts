import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { draftLogos, initials, kitAccess, kitFor } from "./brand-kit.ts";
import { makeSponsor } from "./test-factories.ts";
import type { Pledge } from "./types.ts";

const NOW = new Date("2026-10-23T12:00:00Z");
const pledge = (p: Partial<Pledge>): Pledge => ({ id: "p", opportunityId: "o", sponsorName: "B", tierName: "T", amount: 1000, status: "confirmed", createdAt: "2026-10-01T00:00:00Z", ...p });

describe("brand kits", () => {
  it("drafts a kit with logos and acknowledgment-only rules", () => {
    const kit = kitFor(makeSponsor({ name: "Coral Coast Credit Union" }));
    assert.equal(kit.origin, "drafted");
    assert.match(kit.mark, /<svg/);
    assert.ok(kit.rules.some((r) => /Recognition only/.test(r)));
    assert.equal(initials("Coral Coast Credit Union"), "CC");
    assert.equal(initials("The Chen Giving Fund"), "CG");
    assert.equal(draftLogos("Acme").colors.length, 3);
  });

  it("escapes names in the SVG", () => {
    assert.doesNotMatch(draftLogos("Hearth & Crumb <Bakery>").wordmark, /<Bakery>/);
  });

  it("opens only after the money clears, for a year, unless anonymous or revoked", () => {
    assert.equal(kitAccess(pledge({}), NOW).open, false);
    assert.equal(kitAccess(pledge({ clearedAt: "2026-10-05T00:00:00Z" }), NOW).open, true);
    assert.equal(kitAccess(pledge({ clearedAt: "2025-09-01T00:00:00Z" }), NOW).open, false);
    assert.equal(kitAccess(pledge({ clearedAt: "2026-10-05T00:00:00Z", recognition: "anonymous" }), NOW).open, false);
    assert.equal(kitAccess(pledge({ clearedAt: "2026-10-05T00:00:00Z", kitRevoked: true }), NOW).open, false);
  });
});
