import { NextResponse } from "next/server";
import { z } from "zod";
import { scoreMatch } from "@/lib/match";
import { firstError } from "@/lib/schemas";
import { createIntro, getOpportunity, getSponsor } from "@/lib/store";

const IntroInput = z.object({
  opportunityId: z.string().min(1),
  sponsorId: z.string().min(1),
  note: z.string().trim().max(1000).optional(),
  requestedBy: z.enum(["organization", "sponsor", "connector"]).default("connector"),
});

export async function POST(req: Request) {
  const parsed = IntroInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  const [opp, sp] = await Promise.all([getOpportunity(parsed.data.opportunityId), getSponsor(parsed.data.sponsorId)]);
  if (!opp || !sp) return NextResponse.json({ error: "Listing or sponsor not found" }, { status: 404 });
  const intro = await createIntro({ ...parsed.data, score: scoreMatch(opp, sp).score });
  return NextResponse.json({ intro }, { status: 201 });
}
