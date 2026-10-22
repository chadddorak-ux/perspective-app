import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EXAMPLE_PITCHES } from "../data/examples.ts";
import { campaignGaps, readiness } from "./campaign-check.ts";
import { extractWithRules } from "./extract.ts";
import { makeOpp } from "./test-factories.ts";

const TODAY = "2026-10-21";
const fields = (gaps: ReturnType<typeof campaignGaps>, level?: "required" | "recommended") =>
  gaps.filter((g) => !level || g.level === level).map((g) => g.field);

describe("campaign gaps", () => {
  it("passes a complete campaign", () => {
    const opp = makeOpp({
      contact: { email: "hello@example.org" },
      goal: 40000,
      ein: "12-3456789",
      coverImage: "data:image/jpeg;base64,AAAA",
      story: "Why it matters.",
      summary: "A community food drive that stocks twelve pantries for the winter months.",
    });
    assert.deepEqual(campaignGaps(opp, TODAY), []);
    assert.equal(readiness(opp, TODAY), 100);
  });

  it("blocks posting until the essentials are there", () => {
    const opp = makeOpp({ orgName: "", title: " ", summary: "Short.", causes: [], location: {}, tiers: [], contact: {}, startDate: undefined });
    assert.deepEqual(fields(campaignGaps(opp, TODAY), "required"), ["orgName", "title", "summary", "causes", "location", "tiers", "email", "startDate"]);
  });

  it("accepts virtual campaigns without a city, and ongoing programs without a date", () => {
    const opp = makeOpp({ kind: "program", location: { virtual: true }, startDate: undefined, contact: { email: "a@b.org" } });
    const req = fields(campaignGaps(opp, TODAY), "required");
    assert.ok(!req.includes("location"));
    assert.ok(!req.includes("startDate"));
  });

  it("flags a date that has already passed", () => {
    const gap = campaignGaps(makeOpp({ startDate: "2026-03-01", contact: { email: "a@b.org" } }), TODAY).find((g) => g.field === "startDate");
    assert.equal(gap?.level, "required");
    assert.match(gap!.hint, /already passed/);
  });

  it("blocks a malformed EIN, which the server would reject", () => {
    const gap = campaignGaps(makeOpp({ ein: "123456789", contact: { email: "a@b.org" } }), TODAY).find((g) => g.field === "ein");
    assert.equal(gap?.level, "required");
  });

  it("suggests a goal from the tiers", () => {
    const gap = campaignGaps(makeOpp(), TODAY).find((g) => g.field === "goal");
    assert.equal(gap?.level, "recommended");
    assert.equal(gap?.suggestion, 60000); // 25K × 2 + 5K × 2
  });

  it("flags exactly what a parsed pitch is missing", () => {
    // The soccer pitch is signed by a coach with a website but no email, EIN or photo.
    const d = extractWithRules(EXAMPLE_PITCHES.find((p) => p.label === "Youth soccer season")!.text).draft;
    const gaps = campaignGaps(d, TODAY);
    assert.deepEqual(fields(gaps, "required"), ["email"]);
    assert.deepEqual(fields(gaps, "recommended"), ["goal", "ein", "cover", "story"]);
  });
});
