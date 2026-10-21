import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scoreMatch } from "./match.ts";
import { directPitch, introEmail, optInAsk } from "./outreach.ts";
import { makeOpp, makeSponsor } from "./test-factories.ts";

const opp = makeOpp({
  orgName: "Front Range Animal Rescue",
  title: "Home for the Holidays",
  causes: ["animal-welfare", "community-development"],
  startDate: "2026-12-05",
  endDate: "2026-12-06",
  summary: "A two-day adoption event run by Dr. Lee's team. Free vet checks for every adopter.",
  contact: { name: "Sam Ortiz" },
});
const sp = makeSponsor({ name: "Pawsome Pet Co.", industry: "pets", causes: ["animal-welfare"], about: "National pet food brand." });
const match = scoreMatch(opp, sp, new Date("2026-10-21"));

describe("outreach drafts", () => {
  it("pitch names the event, the shared focus, the date range and the suggested tier", () => {
    const d = directPitch(opp, sp, match);
    assert.match(d.subject, /Home for the Holidays/);
    assert.match(d.body, /your focus on animal welfare/);
    assert.match(d.body, /December 5–6, 2026/);
    assert.match(d.body, /the Presenting Sponsor \(\$25K\)/);
  });

  it("opt-in ask speaks to the sponsor and keeps abbreviations intact", () => {
    const d = optInAsk(opp, sp, match);
    assert.match(d.body, /sits in your range/);
    assert.match(d.body, /run by Dr\. Lee's team\./);
  });

  it("intro email addresses both sides", () => {
    const d = introEmail(opp, sp, match);
    assert.match(d.body, /meet Sam Ortiz/);
    assert.match(d.body, /About Pawsome Pet Co\.: National pet food brand\./);
  });
});
