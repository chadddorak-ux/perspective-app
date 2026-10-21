import { NextResponse } from "next/server";
import { z } from "zod";
import { updateIntroStatus } from "@/lib/store";

const StatusInput = z.object({ status: z.enum(["requested", "opted-in", "introduced", "won", "passed"]) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = StatusInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Unknown status" }, { status: 400 });
  const intro = await updateIntroStatus(id, parsed.data.status);
  if (!intro) return NextResponse.json({ error: "Intro not found" }, { status: 404 });
  return NextResponse.json({ intro });
}
