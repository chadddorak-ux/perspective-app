import { PdfImport } from "@/components/PdfImport";
import { PageHeader } from "@/components/ui";
import { EXAMPLE_PITCHES } from "@/data/examples";
import { aiConfigured } from "@/lib/ai-extract";

export const dynamic = "force-dynamic";
export const metadata = { title: "Upload your pitch PDF — Peep" };

export default function ImportPage() {
  return (
    <>
      <PageHeader art="community-development" eyebrow="Free for nonprofits" title="Turn your pitch PDF into a campaign">
        Drop in your sponsorship deck or one-pager. Peep reads every page, fills in your campaign, pulls out your photos and flags anything missing. Fix the flags, post it free, and get matched with sponsors whose funds are verified.
      </PageHeader>
      <PdfImport aiEnabled={aiConfigured()} examples={EXAMPLE_PITCHES} />
    </>
  );
}
