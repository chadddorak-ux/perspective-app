import { ImportFlow } from "@/components/ImportFlow";
import { PageHeader } from "@/components/ui";
import { EXAMPLE_PITCHES } from "@/data/examples";
import { aiConfigured } from "@/lib/ai-extract";

export const dynamic = "force-dynamic";
export const metadata = { title: "Import a pitch — Perspective" };

export default function ImportPage() {
  return (
    <>
      <PageHeader eyebrow="For connectors & organizations" title="Turn any sponsorship ask into matches">
        Paste a pitch email or one-pager and attach the sponsorship deck: a gala, a 5K, a youth league, a capital campaign. Perspective turns it into a structured listing and shows which brands and donors are the right fit, with the outreach already drafted.
      </PageHeader>
      <ImportFlow aiEnabled={aiConfigured()} examples={EXAMPLE_PITCHES} />
    </>
  );
}
