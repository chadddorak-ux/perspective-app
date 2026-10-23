import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { EXAMPLE_PITCHES } from "../data/examples.ts";
import { extractWithRules, normalizeText, parseAmount, parseDates, parseTiers } from "./extract.ts";

const fixture = (name: string) => readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");
const example = (label: string) => extractWithRules(EXAMPLE_PITCHES.find((p) => p.label === label)!.text);

describe("extractWithRules on example pitches", () => {
  it("food bank gala: org, EIN, venue city, tiers, asks", () => {
    const { draft, warnings } = example("Food bank gala");
    assert.equal(draft.orgName, "Riverbend Community Food Bank");
    assert.equal(draft.ein, "68-0123456");
    assert.equal(draft.title, "Harvest Table Gala");
    assert.deepEqual(draft.location, { city: "Sacramento", state: "CA", metro: "Sacramento" });
    assert.equal(draft.causes[0], "food-security");
    assert.deepEqual(draft.tiers.map((t) => t.amount), [50000, 15000, 5000, 2500]);
    assert.ok(draft.asks.includes("matching"));
    assert.deepEqual(warnings, []);
  });

  it("animal rescue: names the event after the verb and strips bullets from tiers", () => {
    const { draft, warnings } = example("Animal rescue adoption weekend");
    assert.equal(draft.orgName, "Front Range Animal Rescue");
    assert.equal(draft.title, "Home for the Holidays");
    assert.deepEqual(draft.causes, ["animal-welfare"]);
    assert.ok(draft.audiences.includes("pet-owners"));
    assert.equal(draft.tiers[0].name, "Presenting Sponsor");
    assert.ok(warnings.some((w) => /501\(c\)\(3\)/.test(w)), "warns when nonprofit status is unclear");
  });

  it("youth soccer: picks up the sponsors the league won't accept", () => {
    const { draft } = example("Youth soccer season");
    assert.deepEqual([...draft.excludedIndustries].sort(), ["alcohol", "gaming-gambling", "tobacco-cannabis"]);
    assert.equal(draft.expectedReach, 1200);
    assert.ok(draft.audiences.includes("teen-students"));
  });
});

describe("extractWithRules on a real-world pitch email", () => {
  const { draft } = extractWithRules(fixture("eagles-soar-email.txt"));

  it("finds the organization, event, dates and venue city", () => {
    assert.equal(draft.orgName, "Richard P. Hall Eagles Foundation");
    assert.equal(draft.title, "EAGLES SOAR Aviation & STEM Expo");
    assert.equal(draft.startDate, "2026-12-11");
    assert.equal(draft.endDate, "2026-12-12");
    assert.deepEqual(draft.location, { city: "Homestead", state: "FL", metro: "Miami" });
    assert.equal(draft.expectedReach, 5000);
  });

  it("collects partners and asks", () => {
    for (const p of ["Amazon", "FPL", "City of Homestead", "Miami-Dade County Public Schools"]) assert.ok(draft.partners.includes(p), p);
    assert.deepEqual([...draft.asks].sort(), ["cash", "introductions", "mentors", "volunteers"]);
  });
});

describe("parseTiers", () => {
  it("reads a column layout from a PDF sponsorship package", () => {
    const tiers = parseTiers(fixture("eagles-soar-package.txt"));
    assert.deepEqual(tiers.map((t) => t.amount), [40000, 25000, 15000, 10000, 5000]);
    assert.equal(tiers[0].name, "Presenting — Visionary Level");
  });

  it("reads benefits listed in parentheses after the amount", () => {
    const [tier] = parseTiers("Presenting Sponsor – $50,000 (naming on all materials, stage remarks, two VIP tables)");
    assert.deepEqual(tier.benefits, ["Naming on all materials", "Stage remarks", "Two VIP tables"]);
  });

  it("reads benefits from the lines under a tier, and exclusivity", () => {
    const tiers = parseTiers("Presenting Sponsor — $15,000 (exclusive)\nLogo on all student T-shirts\nKeynote remarks at the fair\nTeam Sponsor — $1,000\nFund one team's robot kit\nContact");
    assert.equal(tiers[0].availability, "exclusive");
    assert.deepEqual(tiers[0].benefits, ["Logo on all student T-shirts", "Keynote remarks at the fair"]);
    assert.deepEqual(tiers[1].benefits, ["Fund one team's robot kit"]);
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

  it("rejoins letter-spaced headings from PDFs", () => {
    assert.equal(normalizeText("S P O N S O R S H I P  2 0 2 7"), "SPONSORSHIP  2027");
    assert.equal(normalizeText("a 5K in May"), "a 5K in May");
  });
});

describe("a sponsorship deck read from a PDF", () => {
  const { draft } = extractWithRules(fixture("sample-deck-pdf.txt"));

  it("finds the organization and campaign, not the headings or the venue", () => {
    assert.equal(draft.orgName, "Bayside Girls Who Build");
    assert.equal(draft.title, "Build Day 2027");
    assert.match(draft.summary, /^Bayside Girls Who Build is a 501\(c\)\(3\)/);
    assert.deepEqual(draft.location, { city: "Oakland", state: "CA", metro: "San Francisco" });
    assert.equal(draft.startDate, "2027-04-17");
  });

  it("reads every tier with its benefits", () => {
    assert.deepEqual(draft.tiers.map((t) => t.amount), [15000, 7500, 3000, 1000]);
    assert.equal(draft.tiers[0].availability, "exclusive");
    assert.ok(draft.tiers.every((t) => t.benefits.length >= 2));
  });
});
