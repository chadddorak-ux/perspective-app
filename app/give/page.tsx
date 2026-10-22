import { SponsorMatcher } from "@/components/SponsorMatcher";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Give through Peep — Peep" };

const STEPS = [
  ["Set a giving budget", "The amount you plan to give this year, in one place."],
  ["Pick what matters", "Causes, places and goals your brand actually cares about."],
  ["Peep matches and transfers", "We move the funds and confirm they reached the nonprofit."],
  ["Tax receipt, right away", "Paperwork lands the moment the transfer clears."],
];

export default function GivePage() {
  return (
    <>
      <PageHeader art="environment" eyebrow="For brands, foundations & donors" title="Giving, without the busywork">
        Set aside your giving budget, pick what you care about, and Peep matches you with campaigns that fit. Peep handles the transfer, the verification and the tax receipt. Stay in touch with the teams you fund, or keep it to the essentials.
      </PageHeader>
      <ol className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(([title, body], i) => (
          <li key={title} className="flex gap-3 rounded-2xl border border-line bg-card p-4">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-xs font-extrabold text-bg">{i + 1}</span>
            <span>
              <span className="block font-bold">{title}</span>
              <span className="mt-0.5 block text-sm text-muted">{body}</span>
            </span>
          </li>
        ))}
      </ol>
      <SponsorMatcher />
    </>
  );
}
