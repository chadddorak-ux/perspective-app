import { NextResponse } from "next/server";
import { fundingFor } from "@/lib/funding";
import { rankOpportunities, rankSponsors, withSmallOrgSpotlight } from "@/lib/match";
import { OpportunityInput, SponsorInput, firstError } from "@/lib/schemas";
import { listOpportunities, listPledges, listSponsors } from "@/lib/store";
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
    const [opps, pledges] = await Promise.all([listOpportunities(), listPledges()]);
    // A small organization is always kept in the top five when one fits.
    const results = withSmallOrgSpotlight(rankOpportunities(sp, opps)).map((r) => ({ ...r, funding: fundingFor(r.item, pledges) }));
    return NextResponse.json({ results });
  }

  return NextResponse.json({ error: "Send an opportunity or a sponsor profile" }, { status: 400 });
}
