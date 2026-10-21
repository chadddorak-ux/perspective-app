import { EMPTY_OPPORTUNITY } from "@/components/OpportunityForm";
import { OpportunityMatcher } from "@/components/OpportunityMatcher";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Find sponsors — Perspective" };

export default function FindPage() {
  return (
    <>
      <PageHeader eyebrow="For organizations" title="Find sponsors who'll say yes">
        Tell us about your event or program. The more you share, especially sponsorship levels, the sharper the matches. Results are instant, and nothing is saved until you choose to.
      </PageHeader>
      <OpportunityMatcher initial={EMPTY_OPPORTUNITY} source="intake" />
    </>
  );
}
