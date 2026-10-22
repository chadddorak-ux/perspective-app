import { NextResponse } from "next/server";
import { z } from "zod";
import { pledgeProblem } from "@/lib/funding";
import { scoreMatch } from "@/lib/match";
import { firstError } from "@/lib/schemas";
import { createPledge, getOpportunity, getSponsor, listPledges } from "@/lib/store";

const PledgeInput = z
  .object({
    opportunityId: z.string().min(1),
    tierName: z.string().min(1).max(120),
    sponsorId: z.string().min(1).optional(),
    sponsorName: z.string().trim().min(2).max(160).optional(),
    message: z.string().trim().max(500).optional(),
    contact: z.enum(["connect", "essentials"]).optional(),
  })
  .refine((p) => p.sponsorId || p.sponsorName, { message: "Choose a sponsor or enter a name", path: ["sponsorName"] });

export async function POST(req: Request) {
  const parsed = PledgeInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  const { opportunityId, tierName, sponsorId, sponsorName, message, contact } = parsed.data;

  const opp = await getOpportunity(opportunityId);
  if (!opp) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  const problem = pledgeProblem(opp, tierName, await listPledges());
  if (problem) return NextResponse.json({ error: problem }, { status: 409 });

  // A sponsor in the network is held to the same rules as matching: no
  // pledging into a cause they exclude or an industry the organization declines.
  let name = sponsorName!;
  if (sponsorId) {
    const sp = await getSponsor(sponsorId);
    if (!sp) return NextResponse.json({ error: "Sponsor not found" }, { status: 404 });
    const blockers = scoreMatch(opp, sp).blockers;
    if (blockers.length) return NextResponse.json({ error: blockers[0] }, { status: 409 });
    name = sp.name;
  }

  const tier = opp.tiers.find((t) => t.name === tierName)!;
  const pledge = await createPledge({ opportunityId, tierName, amount: tier.amount, sponsorId, sponsorName: name, message, contact });
  return NextResponse.json({ pledge }, { status: 201 });
}
