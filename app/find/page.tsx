import { CampaignWizard } from "@/components/CampaignWizard";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Start a campaign — Peep" };

export default function StartCampaignPage() {
  return (
    <>
      <PageHeader art="stem-education" eyebrow="For organizations" title="Start a campaign">
        Five quick steps. Set a goal and sponsorship tiers, see which sponsors fit, then launch. Already have a pitch email or deck?{" "}
        <a href="/import" >Import it instead</a>.
      </PageHeader>
      <CampaignWizard />
    </>
  );
}
