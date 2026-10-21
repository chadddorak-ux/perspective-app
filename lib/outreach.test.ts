import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { seedOpportunities, seedSponsors } from "../data/seed.ts";
import { scoreMatch } from "./match.ts";
import { directPitch, introEmail, optInAsk } from "./outreach.ts";

const opp = seedOpportunities[0];
const sp = seedSponsors.find((s) => s.id === "aeronova")!;
const match = scoreMatch(opp, sp, new Date("2026-10-21"));

describe("outreach drafts", () => {
  it("pitch names the event, the shared focus and the suggested tier", () => {
    const d = directPitch(opp, sp, match);
    assert.match(d.subject, /EAGLES SOAR/);
    assert.match(d.body, /aviation & aerospace and STEM education/);
    assert.match(d.body, /the Presenting — Visionary Level \(\$40K\)/);
    assert.match(d.body, /December 11–12, 2026/);
  });

  it("opt-in ask lists the match reasons", () => {
    const d = optInAsk(opp, sp, match);
    assert.match(d.body, /• In your home market \(Miami\)/);
    assert.match(d.body, /Capt\. Richard P\. Hall\./);
  });

  it("intro email addresses both sides", () => {
    const d = introEmail(opp, sp, match);
    assert.match(d.body, /meet Aeronova Systems/);
    assert.match(d.body, /meet LaTéssa Dotson Hall/);
  });
});
