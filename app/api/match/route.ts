import { NextResponse } from "next/server";
import { rankOpportunities, rankSponsors } from "@/lib/match";
import { OpportunityInput, SponsorInput, firstError } from "@/lib/schemas";
import { listOpportunities, listSponsors } from "@/lib/store";
import type { Opportunity, SponsorProfile } from "@/lib/types";

// Scores a draft listing or sponsor profile against everything in the network
// without saving it, so people can see results before committing.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { opportunity?: unknown; sponsor?: unknown };
  const now = new Date().toISOString();

  if (body.opportunity) {
    const parsed = OpportunityInput.safeParse(body.opportunity);
    if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
    const opp: Opportunity = { ...parsed.data, id: "draft", source: "intake", createdAt: now };
    return NextResponse.json({ results: rankSponsors(opp, await listSponsors()) });
  }

  if (body.sponsor) {
    const parsed = SponsorInput.safeParse(body.sponsor);
    if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
    const sp: SponsorProfile = { ...parsed.data, id: "draft", source: "intake", createdAt: now };
    return NextResponse.json({ results: rankOpportunities(sp, await listOpportunities()) });
  }

  return NextResponse.json({ error: "Send an opportunity or a sponsor profile" }, { status: 400 });
}
