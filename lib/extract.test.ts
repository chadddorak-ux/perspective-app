import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { EAGLES_SOAR_EMAIL } from "../data/examples.ts";
import { extractWithRules, parseAmount, parseDates, parseTiers } from "./extract.ts";

const PACKAGE = readFileSync(new URL("./__fixtures__/eagles-soar-package.txt", import.meta.url), "utf8");

describe("extractWithRules on the EAGLES SOAR email", () => {
  const { draft, warnings } = extractWithRules(EAGLES_SOAR_EMAIL);

  it("finds the organization, event and type", () => {
    assert.equal(draft.orgName, "Richard P. Hall Eagles Foundation");
    assert.equal(draft.title, "EAGLES SOAR Aviation & STEM Expo");
    assert.equal(draft.orgType, "501c3");
    assert.equal(draft.kind, "event");
  });

  it("parses the date range, location and reach", () => {
    assert.equal(draft.startDate, "2026-12-11");
    assert.equal(draft.endDate, "2026-12-12");
    assert.deepEqual(draft.location, { city: "Homestead", state: "FL", metro: "Miami" });
    assert.equal(draft.expectedReach, 5000);
  });

  it("maps causes, audiences and asks onto the taxonomy", () => {
    assert.ok(draft.causes.includes("aviation-aerospace"));
    assert.ok(draft.causes.includes("stem-education"));
    assert.ok(draft.audiences.includes("teen-students"));
    assert.ok(draft.audiences.includes("families"));
    assert.deepEqual([...draft.asks].sort(), ["cash", "introductions", "mentors", "volunteers"]);
  });

  it("collects partners and the website", () => {
    for (const p of ["Amazon", "FPL", "City of Homestead", "Miami-Dade County Public Schools"]) {
      assert.ok(draft.partners.includes(p), p);
    }
    assert.equal(draft.contact.website, "https://eaglessoar.co");
  });

  it("warns that the email alone has no sponsorship tiers", () => {
    assert.ok(warnings.some((w) => /sponsorship levels/.test(w)));
  });
});

describe("parseTiers", () => {
  it("reads the column layout of the sponsorship package", () => {
    const tiers = parseTiers(PACKAGE);
    assert.deepEqual(tiers.map((t) => t.amount), [40000, 25000, 15000, 10000, 5000]);
    assert.equal(tiers[0].name, "Presenting — Visionary Level");
    assert.equal(tiers[4].name, "Bronze — Community Partner");
  });

  it("reads one-per-line tiers", () => {
    const tiers = parseTiers("Gold Sponsor – $10,000\nSilver Sponsor: $5,000\nFriend $500");
    assert.deepEqual(tiers.map((t) => [t.name, t.amount]), [["Gold Sponsor", 10000], ["Silver Sponsor", 5000], ["Friend", 500]]);
  });
});

describe("helpers", () => {
  it("parses amounts with separators and suffixes", () => {
    assert.equal(parseAmount("$40,000"), 40000);
    assert.equal(parseAmount("$2.5k"), 2500);
    assert.equal(parseAmount("$1M"), 1000000);
  });

  it("parses common date formats", () => {
    assert.deepEqual(parseDates("December 11 & 12, 2026"), { startDate: "2026-12-11", endDate: "2026-12-12" });
    assert.deepEqual(parseDates("on March 3, 2027 at noon"), { startDate: "2027-03-03", endDate: undefined });
    assert.deepEqual(parseDates("4/15/2027"), { startDate: "2027-04-15" });
  });
});
