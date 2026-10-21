import { ImportFlow } from "@/components/ImportFlow";
import { PageHeader } from "@/components/ui";
import { EAGLES_SOAR_EMAIL } from "@/data/examples";
import { aiConfigured } from "@/lib/ai-extract";

export const dynamic = "force-dynamic";
export const metadata = { title: "Import a pitch — Perspective" };

export default function ImportPage() {
  return (
    <>
      <PageHeader eyebrow="For connectors" title="Got a sponsorship ask in your inbox?">
        Paste the email and attach the sponsorship package. Perspective turns it into a structured listing, then shows which brands and donors in the network are the right fit, with the intro already drafted.
      </PageHeader>
      <ImportFlow aiEnabled={aiConfigured()} example={EAGLES_SOAR_EMAIL} />
    </>
  );
}
