import { NextResponse } from "next/server";
import { z } from "zod";
import { CIRCLE_SHARE, pledgeProblem } from "@/lib/funding";
import { scoreMatch } from "@/lib/match";
import { feeFor } from "@/lib/receipts";
import { GENERAL_SUPPORT } from "@/lib/types";
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
    kind: z.enum(["gift", "sponsorship"]).default("gift"),
    recognition: z.enum(["public", "private", "anonymous"]).default("public"),
    /** Join a giving circle: take a quarter of the tier instead of all of it. */
    circle: z.boolean().optional(),
    renews: z.boolean().optional(),
    /** Only for general operating support, where the sponsor picks the amount. */
    amount: z.coerce.number().int().min(25).max(10_000_000).optional(),
  })
  .refine((p) => p.sponsorId || p.sponsorName, { message: "Choose a sponsor or enter a name", path: ["sponsorName"] });

export async function POST(req: Request) {
  const parsed = PledgeInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  const { opportunityId, tierName, sponsorId, sponsorName, message, contact, kind, recognition, circle, renews } = parsed.data;

  const opp = await getOpportunity(opportunityId);
  if (!opp) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  const share = circle ? CIRCLE_SHARE : undefined;
  const problem = pledgeProblem(opp, tierName, await listPledges(), undefined, share);
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

  let amount: number;
  if (tierName === GENERAL_SUPPORT) {
    if (!parsed.data.amount) return NextResponse.json({ error: "Enter an amount (at least $25)" }, { status: 400 });
    amount = parsed.data.amount;
  } else {
    const tier = opp.tiers.find((t) => t.name === tierName)!;
    amount = Math.round(tier.amount * (share ?? 1));
  }
  const pledge = await createPledge({
    opportunityId,
    tierName,
    amount,
    fee: feeFor(amount),
    sponsorId,
    sponsorName: name,
    message,
    contact,
    kind,
    recognition,
    ...(share && { share }),
    ...(renews && { renews }),
  });
  return NextResponse.json({ pledge }, { status: 201 });
}
