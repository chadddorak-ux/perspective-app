import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { acknowledgmentWording, checkTagline, classifyBenefit, tierCompliance } from "./compliance.ts";

describe("compliance", () => {
  it("treats name and logo recognition as acknowledgment", () => {
    assert.equal(classifyBenefit("Logo on all signage").kind, "acknowledgment");
    assert.equal(classifyBenefit("Name on the event website").kind, "acknowledgment");
    assert.equal(classifyBenefit("Stage remarks").kind, "acknowledgment");
  });

  it("flags perks as tangible benefits", () => {
    assert.equal(classifyBenefit("VIP Lounge + 20 VIP passes").kind, "tangible");
    assert.equal(classifyBenefit("Table for 10 at the gala").kind, "tangible");
    assert.equal(classifyBenefit("Student Talent Database access").kind, "tangible");
  });

  it("flags advertising: claims, prices, calls to action, endorsements", () => {
    assert.equal(classifyBenefit("Ad spot in the program").kind, "advertising");
    assert.equal(classifyBenefit("20% off coupon in every swag bag").kind, "advertising");
    assert.equal(classifyBenefit("Official bank of the festival").kind, "advertising");
    assert.equal(classifyBenefit("Product sampling at the entrance").kind, "advertising");
  });

  it("labels a tier by its most restrictive benefit", () => {
    assert.equal(tierCompliance({ name: "Friend", amount: 500, benefits: ["Logo on website", "Thank-you post"] }).label, "Gift-ready");
    const perks = tierCompliance({ name: "Table", amount: 5000, benefits: ["Logo on signage", "Table for 10"] });
    assert.equal(perks.label, "Gift with perks");
    assert.match(perks.notes[0], /quid pro quo/);
    const ads = tierCompliance({ name: "Title", amount: 25000, benefits: ["Exclusive provider of drinks"] });
    assert.equal(ads.label, "Sponsorship (has advertising)");
    assert.equal(ads.giftReady, false);
  });

  it("guards taglines against advertising language", () => {
    assert.equal(checkTagline("Proud supporter of youth aviation").ok, true);
    const bad = checkTagline("The best bank in Miami. Visit our store!");
    assert.equal(bad.ok, false);
    assert.ok(bad.problems.length >= 2);
  });

  it("suggests acknowledgment wording", () => {
    assert.equal(acknowledgmentWording("Official bank of the festival"), "supporter of the festival");
  });
});
