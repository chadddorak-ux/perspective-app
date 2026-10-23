import { NextResponse } from "next/server";
import { z } from "zod";
import { firstError } from "@/lib/schemas";
import { updatePitch } from "@/lib/store";

const Reply = z.discriminatedUnion("status", [
  z.object({ status: z.literal("interested") }),
  z.object({ status: z.literal("declined"), reason: z.enum(["outside-causes", "outside-area", "budget-spent", "timing", "not-now"]) }),
]);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Reply.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  const pitch = await updatePitch(id, { status: parsed.data.status, reason: parsed.data.status === "declined" ? parsed.data.reason : undefined });
  if (!pitch) return NextResponse.json({ error: "Pitch not found" }, { status: 404 });
  return NextResponse.json({ pitch });
}
