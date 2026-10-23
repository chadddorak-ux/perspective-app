"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Funding } from "@/lib/funding";
import type { Ranked } from "@/lib/match";
import {
  AUDIENCES,
  CAUSES,
  CAUSE_GROUPS,
  INDUSTRIES,
  INDUSTRY_AFFINITY,
  OBJECTIVES,
  REGIONS,
  SPONSOR_TYPES,
  SUPPORT_TYPES,
  US_STATES,
  type IndustryId,
} from "@/lib/taxonomy";
import type { Opportunity, SponsorProfile } from "@/lib/types";
import { ChipSelect } from "./ChipSelect";
import { MatchCard } from "./MatchCard";
import { PeepMark } from "./Peep";

type SponsorDraft = Omit<SponsorProfile, "id" | "createdAt" | "source" | "sample">;

const EMPTY: SponsorDraft = {
  name: "",
  type: "brand",
  about: "",
  causes: [],
  audiences: [],
  objectives: [],
  geography: { scope: "local", states: [], metros: [] },
  budget: { min: 2500, max: 15000 },
  supportTypes: ["cash"],
  leadTimeDays: 60,
  requires501c3: true,
  excludedCauses: [],
  approach: "open",
};

export function SponsorMatcher() {
  const router = useRouter();
  const [d, setD] = useState<SponsorDraft>(EMPTY);
  const [results, setResults] = useState<(Ranked<Opportunity> & { funding: Funding })[] | null>(null);
  const [busy, setBusy] = useState<"match" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const set = <K extends keyof SponsorDraft>(k: K, v: SponsorDraft[K]) => setD({ ...d, [k]: v });
  const setGeo = (patch: Partial<SponsorDraft["geography"]>) => set("geography", { ...d.geography, ...patch });

  const call = async (url: string) => {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sponsor: d }) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Something went wrong");
    return json;
  };

  const match = async () => {
    setBusy("match");
    setError(null);
    try {
      setResults((await call("/api/match")).results);
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
      router.push(`/sponsors/${(await call("/api/sponsors")).id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  const sponsor: SponsorProfile = { ...d, id: "draft", source: "intake", createdAt: "" };
  const live = results?.filter((r) => r.match.grade !== "Not eligible") ?? [];

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="card h-fit space-y-6 p-6 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">Brand, foundation or your name</span>
            <input className="field" value={d.name} onChange={(e) => set("name", e.target.value)} />
          </label>
          <label>
            <span className="label">You are a…</span>
            <select className="field" value={d.type} onChange={(e) => set("type", e.target.value as SponsorDraft["type"])}>
              {Object.entries(SPONSOR_TYPES).map(([id, l]) => <option key={id} value={id}>{l}</option>)}
            </select>
          </label>
        </div>
        {(d.type === "brand" || d.type === "small-business") && (
          <div>
            <label>
              <span className="label">Industry</span>
              <select
                className="field"
                value={d.industry ?? ""}
                onChange={(e) => set("industry", (e.target.value || undefined) as IndustryId | undefined)}
              >
                <option value="">Choose your industry</option>
                {Object.entries(INDUSTRIES).map(([id, l]) => <option key={id} value={id}>{l}</option>)}
              </select>
            </label>
            {d.industry && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted">Brands like yours are credible on:</span>
                {INDUSTRY_AFFINITY[d.industry].map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={d.causes.includes(c)}
                    onClick={() => set("causes", [...d.causes, c].slice(0, 6))}
                    className="rounded-full border border-dashed border-brand px-2 py-0.5 text-brand disabled:border-line disabled:text-muted"
                  >
                    + {CAUSES[c]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <label className="block">
          <span className="label">About your giving</span>
          <textarea className="field min-h-20" value={d.about} onChange={(e) => set("about", e.target.value)} placeholder="What you fund and why." />
        </label>

        <div>
          <span className="label">Causes you care about</span>
          <p className="hint mb-2">In priority order — your first pick counts most.</p>
          <ChipSelect options={CAUSES} groups={CAUSE_GROUPS} value={d.causes} onChange={(v) => set("causes", v)} max={6} />
        </div>
        <div>
          <span className="label">What you want from a partnership</span>
          <ChipSelect options={OBJECTIVES} value={d.objectives} onChange={(v) => set("objectives", v)} />
        </div>
        <div>
          <span className="label">Who you want to reach</span>
          <ChipSelect options={AUDIENCES} value={d.audiences} onChange={(v) => set("audiences", v)} />
        </div>

        <div className="space-y-3">
          <span className="label">Where you give</span>
          <div className="flex flex-wrap gap-2">
            {(["local", "state", "regional", "national"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setGeo({ scope: s })}
                className={`rounded-full border px-3 py-1.5 text-sm capitalize ${d.geography.scope === s ? "border-ink bg-ink text-bg" : "border-line"}`}
              >
                {s}
              </button>
            ))}
          </div>
          {d.geography.scope !== "national" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="hint">{d.geography.scope === "regional" ? "A state in your region" : "States"}</span>
                <select
                  multiple={d.geography.scope !== "regional"}
                  className="field h-24"
                  value={d.geography.scope === "regional" ? d.geography.states[0] ?? "" : d.geography.states}
                  onChange={(e) => setGeo({ states: Array.from(e.target.selectedOptions, (o) => o.value) })}
                >
                  {Object.entries(US_STATES).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
                </select>
                {d.geography.scope === "regional" && d.geography.states[0] && (
                  <span className="hint">
                    Covers the {Object.entries(REGIONS).find(([, m]) => m.includes(d.geography.states[0]))?.[0] ?? "surrounding"} region
                  </span>
                )}
              </label>
              <label>
                <span className="hint">Home metro areas (comma-separated)</span>
                <input
                  className="field"
                  value={d.geography.metros.join(", ")}
                  onChange={(e) => setGeo({ metros: e.target.value.split(",").map((s) => s.trimStart()) })}
                  onBlur={() => setGeo({ metros: d.geography.metros.map((m) => m.trim()).filter(Boolean) })}
                  placeholder="e.g. Denver, Boulder"
                />
              </label>
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label>
            <span className="label">Typical gift from</span>
            <input type="number" min={0} className="field" value={d.budget.min} onChange={(e) => set("budget", { ...d.budget, min: Number(e.target.value) })} />
          </label>
          <label>
            <span className="label">up to</span>
            <input type="number" min={0} className="field" value={d.budget.max} onChange={(e) => set("budget", { ...d.budget, max: Number(e.target.value) })} />
          </label>
          <label>
            <span className="label">Decide ~N days ahead</span>
            <input type="number" min={0} className="field" value={d.leadTimeDays} onChange={(e) => set("leadTimeDays", Number(e.target.value))} />
          </label>
        </div>

        <div>
          <span className="label">How you can help</span>
          <ChipSelect options={SUPPORT_TYPES} value={d.supportTypes} onChange={(v) => set("supportTypes", v)} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={d.requires501c3} onChange={(e) => set("requires501c3", e.target.checked)} />
            Only 501(c)(3) organizations
          </label>
          <label>
            <select className="field" value={d.approach} onChange={(e) => set("approach", e.target.value as SponsorDraft["approach"])}>
              <option value="open">Open to direct pitches</option>
              <option value="intro-preferred">Prefer warm introductions</option>
              <option value="invite-only">Invite-only</option>
            </select>
          </label>
        </div>

        <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-wrap items-center gap-2 border-t border-line bg-card px-6 py-4">
          <button className="btn-primary" onClick={match} disabled={busy !== null}>
            {busy === "match" ? "Matching…" : "Find opportunities"}
          </button>
          <button className="btn-secondary" onClick={save} disabled={busy !== null}>
            {busy === "save" ? "Saving…" : "Save giving profile"}
          </button>
          {error && <p className="w-full text-sm text-bad">{error}</p>}
        </div>
      </div>

      <div ref={resultsRef} className="scroll-mt-28 space-y-4">
        {!results ? (
          <div className="card grid min-h-80 place-items-center p-10 text-center text-muted">
            <div className="group">
              <PeepMark className="animate-float mx-auto mb-4 h-20 w-24" />
              <p className="font-display text-xl text-ink">Opportunities that fit will appear here</p>
              <p className="mt-1 text-sm">Tell us what you care about and where you give.</p>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-semibold">
              {live.filter((r) => r.match.score >= 70).length} strong fits
              <span className="font-normal text-muted"> of {results.length} open opportunities</span>
            </h2>
            {live.map((r, i) => (
              <MatchCard key={r.item.id} opp={r.item} sponsor={sponsor} match={r.match} viewer="sponsor" rank={i + 1} funding={r.funding} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
