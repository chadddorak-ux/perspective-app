import Link from "next/link";
import { money } from "@/lib/match";
import type { MatchResult } from "@/lib/types";
import { CountUp, Reveal } from "../Motion";
import { Arrow } from "../ui";

export type MatchStoryData = {
  campaign: { id: string; title: string };
  sponsor: {
    name: string;
    kind: string;
    budget: string;
    wants: { label: string; value: string }[];
    warmIntro: boolean;
  };
  match: Pick<MatchResult, "score" | "grade" | "breakdown">;
  ask?: { tier: string; amount: number };
  draft: { subject: string; lines: string[] };
  blocked?: { name: string; why: string };
  declined?: { campaign: string; rule: string; name: string };
};

const DIMENSION: Record<string, string> = {
  causes: "Cause",
  geography: "Place",
  budget: "Budget",
  audience: "People",
  objectives: "Goals",
  timing: "Timing",
};

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink font-display text-lg font-semibold text-bg">{n}</span>
      <div>
        <p className="text-lg font-bold leading-tight">{title}</p>
        <p className="mt-1 text-sm text-muted">{body}</p>
      </div>
    </div>
  );
}

/**
 * One real match, start to finish, laid out as three steps you can read at a
 * glance: what the sponsor wants, how the campaign measures up, and the ask.
 */
export function MatchStory({ data }: { data: MatchStoryData }) {
  const { sponsor, match } = data;
  return (
    <section className="py-24" aria-labelledby="match-story">
      <Reveal className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-end">
        <div>
          <p className="eyebrow text-brand">How matching works</p>
          <h2 id="match-story" className="display mt-3 text-4xl sm:text-5xl">
            How Peep finds the sponsors who&apos;ll say yes
          </h2>
        </div>
        <p className="text-lg text-muted lg:pb-1">
          One real match, start to finish: <b className="text-ink">{data.campaign.title}</b> and its top sponsor, <b className="text-ink">{sponsor.name}</b>.
        </p>
      </Reveal>

      <div className="relative mt-12 grid gap-8 lg:grid-cols-3 lg:gap-6">
        {/* The path that links the three steps */}
        <span aria-hidden className="absolute left-[16%] right-[16%] top-[18px] hidden border-t-2 border-dashed border-line lg:block" />

        {/* 1. What the sponsor wants */}
        <Reveal className="relative flex flex-col gap-5">
          <Step n={1} title="Brands set a budget and pick what matters" body="Causes, places, people and goals, with funds verified up front." />
          <div className="flex-1 rounded-3xl bg-card p-5 ring-1 ring-line">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky text-lg font-extrabold text-white">{sponsor.name[0]}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{sponsor.name}</p>
                <p className="truncate text-xs text-muted">{sponsor.kind}</p>
              </div>
              <span className="shrink-0 rounded-full bg-mint-soft px-2.5 py-1 text-[11px] font-bold text-good">✓ Funds verified</span>
            </div>
            <p className="mt-5 rounded-2xl bg-bg px-4 py-3">
              <span className="eyebrow block text-[10px] text-muted">Ready to give</span>
              <span className="font-display text-2xl font-semibold">{sponsor.budget}</span>
              <span className="text-sm text-muted"> per sponsorship</span>
            </p>
            <dl className="mt-4 space-y-3">
              {sponsor.wants.map((w) => (
                <div key={w.label}>
                  <dt className="eyebrow text-[10px] text-muted">{w.label}</dt>
                  <dd className="mt-0.5 text-sm font-semibold">{w.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>

        {/* 2. How the campaign measures up */}
        <Reveal delay={120} className="relative flex flex-col gap-5">
          <Step n={2} title="Peep checks how you fit" body="Six checks against your campaign, every one shown. Sponsors that don't fit never see you." />
          <div className="flex flex-1 flex-col rounded-3xl bg-card p-5 ring-1 ring-line">
            <ul className="flex-1 divide-y divide-line">
              {match.breakdown.map((d) => {
                const good = d.score >= d.max * 0.7;
                return (
                  <li key={d.dimension} className="flex items-start gap-3 py-2.5 first:pt-0">
                    <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-extrabold ${good ? "bg-mint text-[#2a2826]" : "bg-accent-soft text-warn"}`}>{good ? "✓" : "~"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{DIMENSION[d.dimension]}</p>
                      <p className="text-xs text-muted">{d.note}</p>
                    </div>
                    <span className="shrink-0 text-xs font-bold tabular-nums text-muted">
                      {d.score}/{d.max}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex items-center gap-4 rounded-2xl bg-mint-soft px-4 py-3">
              <p className="font-display text-5xl font-semibold leading-none text-good">
                <CountUp to={match.score} />
              </p>
              <p className="text-sm">
                <b>out of 100</b>
                <br />
                <span className="text-muted">{match.grade} fit</span>
              </p>
            </div>
          </div>
        </Reveal>

        {/* 3. The ask */}
        <Reveal delay={240} className="relative flex flex-col gap-5">
          <Step
            n={3}
            title="You send the right ask"
            body={sponsor.warmIntro ? `${sponsor.name} prefers a warm intro, so Peep drafts the request.` : "A drafted pitch with the tier that fits their budget."}
          />
          <div className="flex flex-1 flex-col rounded-3xl bg-card p-5 ring-1 ring-line">
            <p className="eyebrow text-[10px] text-muted">{sponsor.warmIntro ? "Warm intro request" : "Drafted pitch"}</p>
            <p className="mt-2 text-sm font-bold">{data.draft.subject}</p>
            <div className="mt-3 flex-1 space-y-2 border-l-2 border-line pl-3 text-sm text-muted">
              {data.draft.lines.map((l, i) => (
                <p key={i}>{l}</p>
              ))}
            </div>
            {data.ask && (
              <p className="mt-4 rounded-2xl bg-accent-soft px-4 py-3 text-sm">
                <span className="eyebrow block text-[10px] text-warn">The ask</span>
                <b>
                  {data.ask.tier} · {money(data.ask.amount)}
                </b>
              </p>
            )}
            <Link href={`/opportunities/${data.campaign.id}#matches`} className="btn-primary group mt-4 self-start">
              See all of its matches <Arrow />
            </Link>
          </div>
        </Reveal>
      </div>

      {/* The other half of the promise: misfits are filtered out, both ways */}
      {(data.blocked || data.declined) && (
        <Reveal className="mt-8 grid gap-3 rounded-3xl bg-card p-5 ring-1 ring-line sm:grid-cols-[auto_1fr_1fr] sm:items-center sm:p-6">
          <p className="font-display text-xl font-semibold sm:pr-4">Not a fit? Never shown.</p>
          {data.blocked && (
            <p className="text-sm text-muted">
              <span className="font-bold text-ink line-through decoration-bad/60">{data.blocked.name}</span> {data.blocked.why.toLowerCase()}, so it never sees {data.campaign.title}.
            </p>
          )}
          {data.declined && (
            <p className="text-sm text-muted">
              It works the other way too. <b className="text-ink">{data.declined.campaign}</b> turns down {data.declined.rule} sponsors, so <span className="font-bold text-ink">{data.declined.name}</span> is never matched to it.
            </p>
          )}
        </Reveal>
      )}
    </section>
  );
}
