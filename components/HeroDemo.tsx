"use client";

import { useEffect, useRef, useState } from "react";
import { CoverArt } from "./CoverArt";
import { LogoMark, Shape, type PaletteKey, type ShapeKind } from "./Shapes";

export type DemoCampaign = {
  id: string;
  title: string;
  org: string;
  place: string;
  when: string;
  cause?: Parameters<typeof CoverArt>[0]["cause"];
  goal: number;
  tiers: { name: string; amount: number }[];
};
export type DemoSponsor = { name: string; kind: string; score: number; reasons: string[]; ask?: { name: string; amount: number } };

const STEPS = [
  { title: "A nonprofit posts a campaign", body: "Goal, tiers and who it serves." },
  { title: "Perspective finds the fits", body: "Every sponsor scored, with reasons." },
  { title: "Sponsors pledge to a tier", body: "The progress bar fills. Intro sent." },
];
const STEP_MS = 3400;
const AVATARS: [ShapeKind, PaletteKey][] = [
  ["half", "sky"],
  ["quarter", "mint"],
  ["square", "sun"],
];

const money = (n: number) => (n >= 1000 ? `$${Math.round(n / 100) / 10}K`.replace(".0K", "K") : `$${n}`);

/** Counts toward `target` when `on`, back to 0 when not. */
function useCount(target: number, on: boolean, ms = 700): number {
  const [n, setN] = useState(on ? target : 0);
  useEffect(() => {
    const from = n;
    const to = on ? target : 0;
    if (from === to) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      setN(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on, target]); // eslint-disable-line react-hooks/exhaustive-deps
  return n;
}

function SponsorRow({ s, i, step }: { s: DemoSponsor; i: number; step: number }) {
  const matched = step >= 1;
  const top = i === 0;
  const score = useCount(s.score, matched);
  const [kind, color] = AVATARS[i % AVATARS.length];
  return (
    <div
      className={`rounded-2xl border bg-card p-3 transition-all duration-500 ${
        matched && top ? "border-ink shadow-[4px_4px_0_var(--ink)]" : "border-line"
      } ${matched && !top ? "opacity-80" : ""}`}
    >
      <div className="flex items-center gap-3">
        <Shape kind={kind} color={color} className="h-9 w-9 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-semibold">{s.name}</p>
          <p className="truncate text-xs text-muted">{s.kind}</p>
        </div>
        <span
          className={`grid h-9 min-w-12 place-items-center rounded-full px-2 font-display text-sm font-bold tabular-nums transition-all duration-300 ${
            matched ? (top ? "bg-mint text-[#1f1a17]" : "bg-sky-soft text-ink") : "bg-line text-transparent"
          }`}
          aria-label={matched ? `Match score ${s.score}` : undefined}
        >
          {score}
        </span>
      </div>
      {top && (
        <div className={`grid transition-all duration-500 ${matched ? "mt-2.5 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="overflow-hidden">
            <div className="flex flex-wrap gap-1.5">
              {s.reasons.map((r) => (
                <span key={r} className="rounded-full bg-mint-soft px-2 py-0.5 text-[11px] text-good">
                  ✓ {r}
                </span>
              ))}
            </div>
            {s.ask && (
              <p className="mt-2 text-xs text-muted">
                Suggested ask: <span className="font-semibold text-ink">{s.ask.name.split(" — ")[0]} · {money(s.ask.amount)}</span>
              </p>
            )}
            <p className={`mt-2 inline-flex rounded-full px-2.5 py-1 font-display text-xs font-bold transition-all duration-500 ${step >= 2 ? "bg-ink text-bg" : "bg-transparent text-transparent"}`}>
              ✓ Pledged {s.ask ? money(s.ask.amount) : ""}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function HeroDemo({ campaign, sponsors }: { campaign: DemoCampaign; sponsors: DemoSponsor[] }) {
  // Opens on the finished picture (good for a first glance and for thumbnails), then plays from step 1.
  const [step, setStep] = useState(2);
  const [paused, setPaused] = useState(false);
  const [cycle, setCycle] = useState(0);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (paused || reduced.current) return;
    const t = setTimeout(() => {
      setStep((s) => (s + 1) % STEPS.length);
      setCycle((c) => c + 1);
    }, cycle === 0 ? 2600 : STEP_MS);
    return () => clearTimeout(t);
  }, [step, paused, cycle]);

  const ask = sponsors[0]?.ask;
  const pledged = useCount(step >= 2 && ask ? ask.amount : 0, step >= 2, 900);
  const pct = campaign.goal ? Math.round((pledged / campaign.goal) * 100) : 0;

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="relative grid items-center gap-4 rounded-[28px] border border-line bg-bg/60 p-3 sm:p-5 lg:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)] lg:gap-0 [&>*]:min-w-0">
        {/* Campaign */}
        <div className={`rounded-2xl border bg-card p-3 transition-all duration-500 sm:p-4 ${step === 0 ? "border-ink shadow-[4px_4px_0_var(--ink)]" : "border-line"}`}>
          <CoverArt id={campaign.id} cause={campaign.cause} className="group h-20 rounded-xl sm:h-24" />
          <p className="eyebrow mt-3 text-[10px] text-brand">Nonprofit campaign</p>
          <p className="mt-1 font-display text-base font-bold leading-snug sm:text-lg">{campaign.title}</p>
          <p className="mt-0.5 truncate text-xs text-muted">
            {campaign.org} · {campaign.place} · {campaign.when}
          </p>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${Math.max(pct, 0)}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-xs">
            <span>
              <span className="font-display font-bold tabular-nums">{money(pledged)}</span>
              <span className="text-muted"> of {money(campaign.goal)} goal</span>
            </span>
            <span className="font-display font-semibold tabular-nums text-muted">{pct}%</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {campaign.tiers.slice(0, 4).map((t) => {
              const hit = step >= 2 && ask?.name === t.name;
              return (
                <span key={t.name} className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors duration-500 ${hit ? "border-accent bg-accent font-semibold text-[#1f1a17]" : "border-line text-muted"}`}>
                  {money(t.amount)} {t.name.split(" — ")[0]}
                </span>
              );
            })}
          </div>
        </div>

        {/* Matcher */}
        <div className="relative flex items-center justify-center py-2 lg:h-full lg:py-0">
          {/* Connectors */}
          <div aria-hidden className="absolute inset-x-0 top-1/2 hidden -translate-y-1/2 lg:block">
            <div className={`h-0.5 origin-center bg-ink transition-transform duration-700 ${step >= 1 ? "scale-x-100" : "scale-x-0"}`} />
            {/* The pledge travels from the sponsor to the campaign */}
            <span
              className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-accent-2 ring-2 ring-ink transition-all duration-1000 ease-in-out ${
                step >= 2 ? "left-0 opacity-100" : "left-[calc(100%-1rem)] opacity-0"
              }`}
            />
          </div>
          <div aria-hidden className="text-2xl text-muted lg:hidden">↓</div>
          <div className="group relative z-10 mx-3 grid h-20 w-20 shrink-0 place-items-center rounded-full border-2 border-ink bg-card lg:mx-0">
            <span aria-hidden className={`absolute inset-[-10px] rounded-full border-2 border-dashed border-line ${step === 1 ? "animate-spin-slow border-sky" : ""}`} />
            <LogoMark className={`h-11 w-11 transition-transform duration-500 ${step === 1 ? "scale-110" : ""}`} />
          </div>
          <div aria-hidden className="text-2xl text-muted lg:hidden">↓</div>
        </div>

        {/* Sponsors */}
        <div className={`rounded-2xl p-1 transition-colors duration-500 ${step === 1 ? "bg-sky-soft" : ""}`}>
          <p className="eyebrow mb-2 px-2 pt-1 text-[10px] text-muted">Best-fit sponsors</p>
          <div className="space-y-2">
            {sponsors.slice(0, 3).map((s, i) => (
              <SponsorRow key={s.name} s={s} i={i} step={step} />
            ))}
          </div>
        </div>
      </div>

      {/* Step controls */}
      <ol className="mt-4 grid gap-2 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <button
              type="button"
              onClick={() => {
                setStep(i);
                setCycle((c) => c + 1);
              }}
              aria-current={step === i ? "step" : undefined}
              className={`relative w-full overflow-hidden rounded-2xl border p-3 text-left transition-colors ${step === i ? "border-ink bg-card" : "border-line hover:border-ink"}`}
            >
              <span className="flex items-center gap-2.5">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full font-display text-sm font-bold ${step === i ? "bg-accent text-[#1f1a17]" : "bg-line text-muted"}`}>
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-display text-sm font-semibold">{s.title}</span>
                  <span className="block truncate text-xs text-muted">{s.body}</span>
                </span>
              </span>
              {step === i && !paused && (
                <span key={cycle} aria-hidden className="absolute inset-x-0 bottom-0 h-1 origin-left bg-accent" style={{ animation: `grow ${cycle === 0 ? 2600 : STEP_MS}ms linear both` }} />
              )}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
