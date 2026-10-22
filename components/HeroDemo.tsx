"use client";

import { useEffect, useRef, useState } from "react";
import { CoverArt } from "./CoverArt";
import { PeepMark } from "./Peep";
import type { Reaction } from "./scene/gremlin";

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

const STEPS: { title: string; body: string; react: Reaction }[] = [
  { title: "Post a campaign", body: "Goal, tiers, who it serves", react: "post" },
  { title: "Find the fits", body: "Every sponsor scored, with reasons", react: "match" },
  { title: "Get pledged", body: "The bar fills, the intro goes out", react: "pledge" },
];
const STEP_MS = 3600;
const AVATAR = ["bg-sky", "bg-mint", "bg-accent-2"];

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
  return (
    <div
      className={`rounded-2xl bg-card p-3 transition-all duration-500 ${
        matched && top ? "shadow-[0_12px_30px_-12px_rgba(60,30,90,0.45)] ring-2 ring-mint" : "shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-line"
      } ${matched && !top ? "opacity-85" : ""}`}
      style={{ transitionDelay: matched ? `${i * 120}ms` : "0ms" }}
    >
      <div className="flex items-center gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-extrabold text-[#2a2826] ${AVATAR[i % 3]}`}>{s.name[0]}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{s.name}</p>
          <p className="truncate text-xs text-muted">{s.kind}</p>
        </div>
        <span
          className={`grid h-9 min-w-12 place-items-center rounded-full px-2 text-sm font-extrabold tabular-nums transition-all duration-300 ${
            matched ? (top ? "bg-mint text-[#2a2826]" : "bg-sky-soft text-ink") : "bg-line text-transparent"
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
                <span key={r} className="rounded-full bg-mint-soft px-2 py-0.5 text-[11px] font-semibold text-good">
                  ✓ {r}
                </span>
              ))}
            </div>
            {s.ask && (
              <p className="mt-2 text-xs text-muted">
                Suggested ask: <span className="font-bold text-ink">{s.ask.name.split(" — ")[0]} · {money(s.ask.amount)}</span>
              </p>
            )}
            <p className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold transition-all duration-500 ${step >= 2 ? "bg-accent text-[#2a2826]" : "bg-transparent text-transparent"}`}>
              ♥ Pledged {s.ask ? money(s.ask.amount) : ""}
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

  // Peep, in the 3D scene behind, reacts to each step.
  useEffect(() => {
    if (cycle === 0) return;
    window.dispatchEvent(new CustomEvent<Reaction>("peep", { detail: STEPS[step].react }));
  }, [step, cycle]);

  const ask = sponsors[0]?.ask;
  const pledged = useCount(step >= 2 && ask ? ask.amount : 0, step >= 2, 900);
  const pct = campaign.goal ? Math.round((pledged / campaign.goal) * 100) : 0;

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="glass relative grid items-center gap-3 rounded-[28px] p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_112px_minmax(0,1fr)] lg:gap-0 [&>*]:min-w-0">
        {/* Campaign */}
        <div
          className={`rounded-2xl bg-card p-3 transition-all duration-500 sm:p-4 ${
            step === 0 ? "shadow-[0_12px_30px_-12px_rgba(60,30,90,0.45)] ring-2 ring-accent" : "shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-line"
          }`}
        >
          <CoverArt id={campaign.id} cause={campaign.cause} className="group h-20 rounded-xl sm:h-24" />
          <p className="eyebrow mt-3 text-[10px] text-brand">Nonprofit campaign</p>
          <p className="mt-1 font-display text-lg font-semibold leading-snug">{campaign.title}</p>
          <p className="mt-0.5 truncate text-xs text-muted">
            {campaign.org} · {campaign.place} · {campaign.when}
          </p>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-line">
            <div className="bg-warm h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(pct, 0)}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-xs">
            <span>
              <span className="font-extrabold tabular-nums">{money(pledged)}</span>
              <span className="text-muted"> of {money(campaign.goal)} goal</span>
            </span>
            <span className="font-bold tabular-nums text-muted">{pct}%</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {campaign.tiers.slice(0, 4).map((t) => {
              const hit = step >= 2 && ask?.name === t.name;
              return (
                <span key={t.name} className={`rounded-full px-2 py-0.5 text-[11px] transition-colors duration-500 ${hit ? "bg-accent font-bold text-[#2a2826]" : "bg-bg text-muted ring-1 ring-line"}`}>
                  {money(t.amount)} {t.name.split(" — ")[0]}
                </span>
              );
            })}
          </div>
        </div>

        {/* Matcher */}
        <div className="relative flex items-center justify-center py-1 lg:h-full lg:py-0">
          <div aria-hidden className="absolute inset-x-0 top-1/2 hidden -translate-y-1/2 lg:block">
            <div className={`h-0.5 origin-center bg-gradient-to-r from-accent via-sky to-mint transition-transform duration-700 ${step >= 1 ? "scale-x-100" : "scale-x-0"}`} />
            <span
              className={`absolute top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full bg-accent text-[10px] text-white shadow-[0_0_14px_rgba(255,107,44,0.8)] transition-all duration-1000 ease-in-out ${
                step >= 2 ? "left-0 opacity-100" : "left-[calc(100%-1.25rem)] opacity-0"
              }`}
            >
              ♥
            </span>
          </div>
          <div aria-hidden className="text-xl text-muted lg:hidden">↓</div>
          <div className="group relative z-10 mx-3 grid h-20 w-20 shrink-0 place-items-center rounded-full bg-card shadow-[0_10px_30px_-10px_rgba(60,30,90,0.5)] ring-1 ring-line lg:mx-0">
            <span aria-hidden className={`absolute inset-[-9px] rounded-full border-2 border-dashed ${step === 1 ? "animate-spin-slow border-sky" : "border-line"}`} />
            <PeepMark className={`h-12 w-14 transition-transform duration-500 ${step === 1 ? "scale-110" : ""}`} />
          </div>
          <div aria-hidden className="text-xl text-muted lg:hidden">↓</div>
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

      {/* Step chips */}
      <ol className="mx-auto mt-4 grid max-w-3xl gap-2 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <button
              type="button"
              onClick={() => {
                setStep(i);
                setCycle((c) => c + 1);
              }}
              aria-current={step === i ? "step" : undefined}
              className={`relative w-full overflow-hidden rounded-full py-2 pl-2 pr-4 text-left transition-all duration-300 ${
                step === i ? "bg-white text-[#2a2826] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]" : "glass-dark text-white/85 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-extrabold ${step === i ? "bg-accent text-[#2a2826]" : "bg-white/15"}`}>{i + 1}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{s.title}</span>
                  <span className={`block truncate text-[11px] ${step === i ? "text-[#6e6a64]" : "text-white/60"}`}>{s.body}</span>
                </span>
              </span>
              {step === i && !paused && (
                <span key={cycle} aria-hidden className="absolute inset-x-4 bottom-0 h-[3px] origin-left rounded-full bg-accent" style={{ animation: `grow ${cycle === 0 ? 2600 : STEP_MS}ms linear both` }} />
              )}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
