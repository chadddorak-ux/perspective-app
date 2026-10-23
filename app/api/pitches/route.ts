import { NextResponse } from "next/server";
import { z } from "zod";
import { pitchProblem } from "@/lib/pitch";
import { firstError } from "@/lib/schemas";
import { createPitch, getOpportunity, getSponsor, listOpportunities, listPitches } from "@/lib/store";

const PitchInput = z.object({
  opportunityId: z.string().min(1),
  sponsorId: z.string().min(1),
  note: z.string().trim().max(600).optional(),
  via: z.enum(["profile", "request-link"]).default("profile"),
});

export async function POST(req: Request) {
  const parsed = PitchInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  const [opp, sp] = await Promise.all([getOpportunity(parsed.data.opportunityId), getSponsor(parsed.data.sponsorId)]);
  if (!opp || !sp) return NextResponse.json({ error: "Campaign or brand not found" }, { status: 404 });
  const problem = pitchProblem(opp, sp, await listPitches(), await listOpportunities());
  if (problem) return NextResponse.json({ error: problem }, { status: 409 });
  return NextResponse.json({ pitch: await createPitch(parsed.data) }, { status: 201 });
}
