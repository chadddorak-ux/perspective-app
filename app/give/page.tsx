import { SponsorMatcher } from "@/components/SponsorMatcher";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Find causes to support — Perspective" };

export default function GivePage() {
  return (
    <>
      <PageHeader eyebrow="For brands, foundations & donors" title="Find opportunities that deliver on your goals">
        Whether you want a talent pipeline, local visibility, or simply impact in your community, we&apos;ll rank the events and programs that fit and flag the ones that don&apos;t.
      </PageHeader>
      <SponsorMatcher />
    </>
  );
}
