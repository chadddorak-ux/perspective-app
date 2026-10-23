import { NextResponse } from "next/server";
import { z } from "zod";
import { firstError } from "@/lib/schemas";
import { createVote, getOpportunity, getSponsor } from "@/lib/store";

const VoteInput = z.object({ sponsorId: z.string().min(1), opportunityId: z.string().min(1), voter: z.string().trim().min(2, "Add your name").max(80) });

export async function POST(req: Request) {
  const parsed = VoteInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  const [sp, opp] = await Promise.all([getSponsor(parsed.data.sponsorId), getOpportunity(parsed.data.opportunityId)]);
  if (!sp || !opp) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ vote: await createVote(parsed.data) }, { status: 201 });
}
