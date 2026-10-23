// "Peep Verified": the checks a brand would otherwise pay someone to run.
// In production these come from the IRS Business Master File, Pub 78 and the
// auto-revocation list (free monthly downloads), an OFAC sanctions screen,
// and Candid. In the prototype they're computed from what's on the listing,
// and the screens are marked as simulated.

import type { Opportunity } from "./types.ts";

export type Check = { label: string; ok: boolean; detail: string; simulated?: boolean };

export function verificationFor(opp: Opportunity): { verified: boolean; checks: Check[] } {
  const einOk = !!opp.ein && /^\d{2}-\d{7}$/.test(opp.ein);
  const charity = opp.orgType === "501c3";
  const checks: Check[] = [
    {
      label: "Tax-exempt status",
      ok: charity && einOk,
      detail: charity ? (einOk ? `EIN ${opp.ein} listed as a 501(c)(3)` : "Add an EIN to confirm 501(c)(3) status") : "Not a 501(c)(3): gifts aren't tax-deductible",
      simulated: charity && einOk,
    },
    { label: "Not revoked", ok: charity && einOk, detail: einOk ? "Not on the IRS auto-revocation list" : "Needs an EIN", simulated: einOk },
    { label: "Sanctions screen", ok: true, detail: "No OFAC matches for the organization name", simulated: true },
    {
      label: "Page approved by the organization",
      ok: opp.source === "seed" || !!opp.consent,
      detail: opp.consent ? `Approved by ${opp.consent.by} on ${opp.consent.at.slice(0, 10)}` : opp.source === "seed" ? "Sample listing" : "Waiting for the organization's approval",
    },
  ];
  return { verified: checks.every((c) => c.ok), checks };
}
