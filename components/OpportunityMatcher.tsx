"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { OpportunityDraft } from "@/lib/extract";
import type { Ranked } from "@/lib/match";
import type { Opportunity, SponsorProfile } from "@/lib/types";
import { MatchCard } from "./MatchCard";
import { OpportunityForm, cleanOpportunity } from "./OpportunityForm";

export function OpportunityMatcher({
  initial,
  source,
  submitLabel = "Find matching sponsors",
}: {
  initial: OpportunityDraft;
  source: "intake" | "import";
  submitLabel?: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [results, setResults] = useState<Ranked<SponsorProfile>[] | null>(null);
  const [busy, setBusy] = useState<"match" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const call = async (url: string, body: unknown) => {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Something went wrong");
    return json;
  };

  const match = async () => {
    setBusy("match");
    setError(null);
    try {
      const { results } = await call("/api/match", { opportunity: cleanOpportunity(draft) });
      setResults(results);
      setShowAll(false);
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setBusy("save");
    setError(null);
    try {
      const { id } = await call("/api/opportunities", { opportunity: cleanOpportunity(draft), source });
      router.push(`/opportunities/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  const opp: Opportunity = { ...cleanOpportunity(draft), id: "draft", source, createdAt: "" };
  const eligible = results?.filter((r) => r.match.grade !== "Not eligible") ?? [];
  const shown = showAll ? results ?? [] : eligible.slice(0, 8);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="card h-fit p-6 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        <OpportunityForm value={draft} onChange={setDraft} />
        <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex flex-wrap items-center gap-2 border-t border-line bg-card px-6 py-4">
          <button className="btn-primary" onClick={match} disabled={busy !== null}>
            {busy === "match" ? "Matching…" : submitLabel}
          </button>
          <button className="btn-secondary" onClick={save} disabled={busy !== null}>
            {busy === "save" ? "Launching…" : "Launch campaign"}
          </button>
          {error && <p className="w-full text-sm text-bad">{error}</p>}
        </div>
      </div>

      <div ref={resultsRef} className="scroll-mt-20 space-y-4">
        {!results && (
          <div className="card grid min-h-80 place-items-center p-10 text-center text-muted">
            <div>
              <p className="font-medium text-ink">Your matches will appear here</p>
              <p className="mt-1 text-sm">Fill in the listing (at least one cause), then hit “{submitLabel}”.</p>
            </div>
          </div>
        )}
        {results && (
          <>
            <div className="flex items-baseline justify-between">
              <h2 className="text-2xl font-semibold">
                {eligible.filter((r) => r.match.score >= 70).length} strong matches
                <span className="font-normal text-muted"> of {results.length} sponsors</span>
              </h2>
              <button className="btn-ghost" onClick={() => setShowAll(!showAll)}>
                {showAll ? "Top matches" : "Show all"}
              </button>
            </div>
            {shown.map((r, i) => (
              <MatchCard key={r.item.id} opp={opp} sponsor={r.item} match={r.match} viewer="organization" rank={i + 1} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
