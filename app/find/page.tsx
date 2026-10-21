import { CampaignWizard } from "@/components/CampaignWizard";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Start a campaign — Perspective" };

export default function StartCampaignPage() {
  return (
    <>
      <PageHeader eyebrow="For organizations" title="Start a campaign">
        Five quick steps. Set a goal and sponsorship tiers, see which sponsors fit, then launch. Already have a pitch email or deck?{" "}
        <a href="/import" className="text-brand hover:underline">Import it instead</a>.
      </PageHeader>
      <CampaignWizard />
    </>
  );
}
