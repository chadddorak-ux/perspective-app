import { NextResponse } from "next/server";
import { SponsorInput, firstError } from "@/lib/schemas";
import { createSponsor } from "@/lib/store";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { sponsor?: unknown };
  const parsed = SponsorInput.safeParse(body.sponsor);
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  if (!parsed.data.name) return NextResponse.json({ error: "Add a name" }, { status: 400 });
  const sp = await createSponsor({ ...parsed.data, source: "intake" });
  return NextResponse.json({ id: sp.id }, { status: 201 });
}
