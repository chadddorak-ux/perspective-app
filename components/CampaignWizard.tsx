"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { OpportunityDraft } from "@/lib/extract";
import { fundingFor } from "@/lib/funding";
import type { Ranked } from "@/lib/match";
import type { Opportunity, SponsorProfile } from "@/lib/types";
import { CampaignCard } from "./CampaignCard";
import { MatchCard } from "./MatchCard";
import { EMPTY_OPPORTUNITY, FORM_STEPS, OpportunityForm, cleanOpportunity } from "./OpportunityForm";
import { Arrow } from "./ui";

const REVIEW = FORM_STEPS.length;

function stepProblem(step: number, d: OpportunityDraft): string | null {
  if (step === 0 && !d.title.trim() && !d.orgName.trim()) return "Add your organization or campaign name to continue.";
  if (step === 1 && d.causes.length === 0) return "Pick at least one cause so we can find sponsors.";
  return null;
}

/** GoFundMe-style "start a campaign" flow: one question at a time, then a review. */
export function CampaignWizard() {
  const router = useRouter();
  const [draft, setDraft] = useState<OpportunityDraft>(EMPTY_OPPORTUNITY);
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"match" | "publish" | null>(null);
  const [results, setResults] = useState<Ranked<SponsorProfile>[] | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const go = (next: number) => {
    if (next > step) {
      for (let s = step; s < next && s < REVIEW; s++) {
        const problem = stepProblem(s, draft);
        if (problem) return setError(problem);
      }
    }
    setError(null);
    setStep(next);
    setReached((r) => Math.max(r, next));
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const post = async (url: string, body: unknown) => {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Something went wrong");
    return json;
  };

  const preview = async () => {
    setBusy("match");
    setError(null);
    try {
      setResults((await post("/api/match", { opportunity: cleanOpportunity(draft) })).results);
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const publish = async () => {
    setBusy("publish");
    setError(null);
    try {
      const { id } = await post("/api/opportunities", { opportunity: cleanOpportunity(draft), source: "intake" });
      router.push(`/opportunities/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  const opp: Opportunity = { ...cleanOpportunity(draft), id: "draft", source: "intake", createdAt: "" };
  const eligible = results?.filter((r) => r.match.grade !== "Not eligible") ?? [];
  const percent = Math.round((Math.min(step, REVIEW) / REVIEW) * 100);

  return (
    <div ref={top} className="scroll-mt-24">
      <div className="grid gap-8 lg:grid-cols-12 [&>*]:min-w-0">
        {/* Step rail */}
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-24">
            <div className="h-1 bg-line">
              <div className="bg-warm h-full transition-[width] duration-500" style={{ width: `${percent}%` }} />
            </div>
            <ol className="mt-4 border-l border-line">
              {[...FORM_STEPS.map((s) => s.title), "Review & launch"].map((t, i) => {
                const state = i === step ? "current" : i < step || i <= reached ? "done" : "todo";
                return (
                  <li key={t}>
                    <button
                      type="button"
                      disabled={i > reached}
                      onClick={() => go(i)}
                      className={`-ml-px flex w-full items-center gap-3 border-l-2 px-4 py-2.5 text-left text-sm transition-colors ${
                        state === "current" ? "border-accent font-medium text-ink" : "border-transparent text-muted hover:text-ink disabled:hover:text-muted"
                      }`}
                    >
                      <span className={`grid h-5 w-5 place-items-center font-mono text-[10px] ${state === "done" && i !== step ? "bg-ink text-bg" : "border border-line"}`}>
                        {state === "done" && i !== step ? "✓" : i + 1}
                      </span>
                      {t}
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className="hint mt-4 hidden lg:block">Nothing is published until you launch. You can preview matching sponsors first.</p>
          </div>
        </aside>

        {/* Current step */}
        <div className="lg:col-span-8">
          {step < REVIEW ? (
            <div key={step} className="card animate-rise p-6 sm:p-8">
              <p className="eyebrow text-muted">
                Step {step + 1} of {REVIEW}
              </p>
              <h2 className="display mt-2 text-3xl font-semibold sm:text-4xl">{FORM_STEPS[step].prompt}</h2>
              <div className="mt-8">
                <OpportunityForm value={draft} onChange={setDraft} step={step} />
              </div>
              {error && <p className="mt-6 text-sm text-bad">{error}</p>}
              <div className="mt-8 flex items-center justify-between border-t border-line pt-6">
                <button type="button" className="btn-ghost" onClick={() => go(step - 1)} disabled={step === 0}>
                  ← Back
                </button>
                <button type="button" className="btn-primary group" onClick={() => go(step + 1)}>
                  {step === REVIEW - 1 ? "Review" : "Continue"} <Arrow />
                </button>
              </div>
            </div>
          ) : (
            <div className="animate-rise grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <div>
                <p className="eyebrow mb-3 text-muted">Card preview</p>
                <div className="pointer-events-none">
                  <CampaignCard opp={{ ...opp, title: opp.title || opp.orgName, summary: opp.summary || "Add a short pitch to tell sponsors why this matters." }} f={fundingFor(opp, [])} />
                </div>
              </div>
              <div className="card h-fit p-6">
                <h2 className="display text-3xl font-semibold">Ready to launch?</h2>
                <ul className="mt-4 space-y-2 text-sm">
                  {[
                    [draft.causes.length > 0, `${draft.causes.length} cause${draft.causes.length === 1 ? "" : "s"} selected`],
                    [opp.tiers.length > 0, opp.tiers.length ? `${opp.tiers.length} sponsorship tier${opp.tiers.length === 1 ? "" : "s"}` : "No tiers yet: sponsors can't pledge without them"],
                    [!!opp.startDate || opp.kind !== "event", opp.startDate ? "Date set" : opp.kind === "event" ? "No date: add one so sponsors can plan" : "Ongoing program"],
                    [!!opp.summary, opp.summary ? "Short pitch written" : "No pitch: sponsors read this first"],
                  ].map(([ok, text]) => (
                    <li key={String(text)} className="flex gap-2">
                      <span className={ok ? "text-good" : "text-warn"}>{ok ? "✓" : "!"}</span>
                      {text}
                    </li>
                  ))}
                </ul>
                {error && <p className="mt-4 text-sm text-bad">{error}</p>}
                <div className="mt-6 flex flex-col gap-2">
                  <button className="btn-primary group py-3" onClick={publish} disabled={busy !== null}>
                    {busy === "publish" ? "Launching…" : "Launch campaign"} <Arrow />
                  </button>
                  <button className="btn-secondary" onClick={preview} disabled={busy !== null}>
                    {busy === "match" ? "Matching…" : "Preview matching sponsors"}
                  </button>
                  <button className="btn-ghost" onClick={() => go(0)}>
                    ← Edit details
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {results && (
        <div ref={resultsRef} className="mt-16 scroll-mt-24 space-y-4">
          <h2 className="display text-3xl font-semibold">
            {eligible.filter((r) => r.match.score >= 70).length} strong matches
            <span className="font-sans text-xl font-normal text-muted"> of {results.length} sponsors</span>
          </h2>
          <p className="text-sm text-muted">Launch your campaign to request warm intros and collect pledges.</p>
          {eligible.slice(0, 8).map((r, i) => (
            <MatchCard key={r.item.id} opp={opp} sponsor={r.item} match={r.match} viewer="organization" rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
