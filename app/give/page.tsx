import Link from "next/link";
import { FloorCalculator } from "@/components/FloorCalculator";
import { SponsorMatcher } from "@/components/SponsorMatcher";
import { Arrow, PageHeader } from "@/components/ui";
import { money } from "@/lib/match";
import { listSponsors } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata = { title: "Give through Peep — Peep" };

const STEPS = [
  ["Set a giving budget", "The amount you plan to give this year, in one place."],
  ["Pick what matters", "Causes, places and goals your brand actually cares about."],
  ["Peep matches and transfers", "We move the funds and confirm they reached the nonprofit."],
  ["Tax receipt, right away", "Paperwork lands the moment the transfer clears."],
];

export default async function GivePage() {
  const sponsors = await listSponsors();
  const pool = sponsors.filter((s) => s.disasterPool);
  const poolTotal = pool.reduce((sum, s) => sum + (s.disasterPool ?? 0), 0);
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
      <div className="mb-10">
        <FloorCalculator />
      </div>
      <div className="mb-14 grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl bg-sky-soft p-6 ring-1 ring-line">
          <p className="eyebrow text-sky">Your brand profile</p>
          <h2 className="display mt-2 text-2xl font-semibold">One place for your logo, your causes and your asks</h2>
          <p className="mt-2 text-sm text-muted">
            Upload your brand kit once. Every nonprofit you fund pulls the right files from it, and pitches arrive as tidy one-pagers instead of emails.
          </p>
          <Link href="/brand/coral-coast-cu" className="btn-primary group mt-5">
            See a sample brand dashboard <Arrow />
          </Link>
        </div>
        <div className="rounded-3xl bg-card p-6 ring-1 ring-line">
          <p className="eyebrow text-brand">Standing disaster pool</p>
          <h2 className="display mt-2 text-2xl font-semibold">Set it aside before the storm</h2>
          <p className="mt-2 text-sm text-muted">
            Opt in ahead of time. When a disaster is declared, Peep sends your share to vetted local responders, with a receipt and no scramble.
          </p>
          <p className="mt-4 font-display text-4xl font-semibold">{money(poolTotal)}</p>
          <p className="text-xs text-muted">ready from {pool.length} brands in the sample network</p>
        </div>
      </div>
      <SponsorMatcher />
    </>
  );
}
