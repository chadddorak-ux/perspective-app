import { NextResponse } from "next/server";
import { OpportunityInput, firstError } from "@/lib/schemas";
import { createOpportunity } from "@/lib/store";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { opportunity?: unknown; source?: "import" | "intake"; consent?: { by?: string } };
  const parsed = OpportunityInput.safeParse(body.opportunity);
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  if (!parsed.data.title && !parsed.data.orgName) {
    return NextResponse.json({ error: "Add an organization or event name" }, { status: 400 });
  }
  // Consent first: a page only goes live when someone from the organization approves it.
  const by = body.consent?.by?.trim();
  if (!by || by.length < 2) return NextResponse.json({ error: "Confirm you're authorized to post for this organization" }, { status: 400 });
  const opp = await createOpportunity({
    ...parsed.data,
    consent: { by: by.slice(0, 120), at: new Date().toISOString() },
    source: body.source === "import" ? "import" : "intake",
  });
  return NextResponse.json({ id: opp.id }, { status: 201 });
}
