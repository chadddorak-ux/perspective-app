"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CoverArt } from "../CoverArt";
import { PdfIcon } from "../PdfImport";
import { PeepMark } from "../Peep";
import type { Reaction } from "../scene/gremlin";

export type DropDemoData = {
  fileName: string;
  pages: number;
  id: string;
  cause?: Parameters<typeof CoverArt>[0]["cause"];
  title: string;
  org: string;
  when: string;
  where: string;
  causes: string[];
  tiers: number[];
  story: string;
  goal: number;
  sponsors: { name: string; score: number }[];
};

// The script, in ms. One loop is about 16 seconds.
const T = {
  move: 400,
  drop: 1700,
  read: 2100,
  readDone: 4000,
  fields: 2500, // first field; then every FIELD_MS
  flags: 6900,
  fixGoal: 8300,
  typeEmail: 9300,
  emailDone: 10300,
  post: 11300,
  live: 11700,
  matches: 12300,
  end: 16500,
};
const FIELD_MS = 420;
const EMAIL = "you@yourorg.org";
const STEPS = [
  { label: "Drop your PDF", at: 0 },
  { label: "Peep builds it", at: T.read },
  { label: "Fix the flags", at: T.flags },
  { label: "Post free, get matched", at: T.post },
];

const money = (n: number) => `$${n >= 1000 ? `${Math.round(n / 1000)}K` : n}`;

/** A scripted run of the PDF → campaign tool, on real campaign data. */
export function PdfDropDemo({ data }: { data: DropDemoData }) {
  const [t, setT] = useState(T.end - 1); // first paint shows the finished campaign
  const [started, setStarted] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const zone = useRef<HTMLDivElement>(null);
  const goalBtn = useRef<HTMLSpanElement>(null);
  const emailField = useRef<HTMLSpanElement>(null);
  const postBtn = useRef<HTMLSpanElement>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0, show: false });
  const fired = useRef(new Set<string>());
  const jump = useRef<(to: number) => void>(() => {});

  // Start when scrolled near, loop forever; reduced motion keeps the finished state.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setStarted(true), { threshold: 0.15 });
    io.observe(box.current!);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!started) return;
    let start = performance.now();
    setT(0);
    const id = setInterval(() => {
      const now = performance.now() - start;
      if (now >= T.end) {
        start = performance.now();
        fired.current.clear();
        setT(0);
      } else setT(now);
    }, 80);
    jump.current = (to: number) => {
      start = performance.now() - to;
      fired.current.clear();
      setT(to);
    };
    return () => clearInterval(id);
  }, [started]);

  // Tell Peep (in the sky behind) what's happening.
  useEffect(() => {
    const fire = (key: string, kind: Reaction) => {
      if (fired.current.has(key) || !started) return;
      fired.current.add(key);
      window.dispatchEvent(new CustomEvent<Reaction>("peep", { detail: kind }));
    };
    if (t >= T.drop) fire("drop", "post");
    if (t >= T.read + 300) fire("read", "match");
    if (t >= T.live) fire("live", "pledge");
  }, [t, started]);

  // The cursor glides between targets.
  useLayoutEffect(() => {
    const host = box.current?.getBoundingClientRect();
    if (!host) return;
    const at = (el: Element | null, dx = 0.5, dy = 0.55) => {
      const r = el?.getBoundingClientRect();
      return r ? { x: r.left - host.left + r.width * dx, y: r.top - host.top + r.height * dy } : { x: host.width * 0.9, y: -20 };
    };
    let target: { x: number; y: number } | null = null;
    if (t < T.move) target = { x: host.width * 0.42, y: -30 };
    else if (t < T.drop + 300) target = at(zone.current);
    else if (t >= T.fixGoal - 700 && t < T.typeEmail - 200) target = at(goalBtn.current);
    else if (t >= T.typeEmail - 200 && t < T.emailDone + 200) target = at(emailField.current, 0.3);
    else if (t >= T.post - 600 && t < T.live + 400) target = at(postBtn.current);
    // Between moves the cursor fades out where it is.
    setCursor((c) => (target ? { ...target, show: started && t < T.matches } : { ...c, show: false }));
  }, [t, started]);

  const dropped = t >= T.drop;
  const reading = t >= T.read && t < T.readDone;
  const readPct = Math.min(100, Math.max(0, ((t - T.read) / (T.readDone - T.read)) * 100));
  const field = (i: number) => t >= T.fields + i * FIELD_MS;
  const flagsOn = t >= T.flags;
  const goalFixed = t >= T.fixGoal;
  const typed = t < T.typeEmail ? 0 : Math.min(EMAIL.length, Math.floor((t - T.typeEmail) / ((T.emailDone - T.typeEmail) / EMAIL.length)));
  const emailFixed = t >= T.emailDone;
  const pressing = t >= T.post && t < T.post + 250;
  const live = t >= T.live;
  const matched = t >= T.matches;
  const ready = !flagsOn ? 0 : goalFixed && emailFixed ? 100 : goalFixed || emailFixed ? 92 : 84;
  const step = STEPS.reduce((acc, s, i) => (t >= s.at ? i : acc), 0);

  // Plain render helpers (not components), so rows don't remount on every tick.
  const skel = (w = "60%") => <span className="inline-block h-3 rounded-full bg-line align-middle" style={{ width: w }} />;
  const row = (i: number, label: string, value: React.ReactNode) => (
    <div className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-colors duration-500 ${field(i) && t < T.fields + i * FIELD_MS + 700 ? "bg-mint-soft" : ""}`}>
      <span className="eyebrow w-[86px] shrink-0 text-[10px] text-muted">{label}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{field(i) ? <span className="animate-pop inline-block max-w-full truncate align-middle">{value}</span> : skel()}</span>
      <span className={`text-xs transition-opacity ${field(i) ? "text-good opacity-100" : "opacity-0"}`}>✓</span>
    </div>
  );

  return (
    <div>
      <div ref={box} className="glass relative overflow-hidden rounded-[28px] p-3 sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] [&>*]:min-w-0">
          {/* Left: the drop and the reading */}
          <div className="flex flex-col gap-3">
            <div
              ref={zone}
              className={`relative grid min-h-[230px] place-items-center overflow-hidden rounded-2xl border-2 border-dashed p-4 text-center transition-all duration-500 sm:min-h-[300px] ${
                dropped ? "border-transparent bg-card" : t >= T.move + 600 ? "scale-[1.02] border-accent bg-brand-soft" : "border-line bg-card"
              }`}
            >
              {!dropped ? (
                <div>
                  <PdfIcon className="mx-auto h-16 w-14 opacity-40" />
                  <p className="mt-3 font-display text-xl font-semibold">Drop your pitch PDF</p>
                  <p className="text-xs text-muted">Deck, one-pager or package</p>
                </div>
              ) : (
                <div className="relative h-full w-full">
                  <div className="relative mx-auto h-[150px] w-[118px] sm:h-[190px] sm:w-[150px]">
                    {[2, 1, 0].map((k) => (
                      <div
                        key={k}
                        className="absolute inset-0 overflow-hidden rounded-xl bg-white shadow-[0_14px_30px_-14px_rgba(60,30,90,0.5)] ring-1 ring-line transition-transform duration-700"
                        style={{ transform: dropped ? `rotate(${(k - 1) * 8}deg) translateX(${(k - 1) * 22}px)` : "none" }}
                      >
                        {k === 0 ? (
                          <div className="flex h-full flex-col p-2.5">
                            <CoverArt id={data.id} cause={data.cause} className={`h-[45%] rounded-lg transition-opacity duration-500 ${field(6) ? "opacity-30" : ""}`} />
                            <span className="mt-2 h-2 w-4/5 rounded-full bg-[#e6e1d7]" />
                            <span className="mt-1.5 h-2 w-3/5 rounded-full bg-[#e6e1d7]" />
                            <span className="mt-3 h-1.5 w-full rounded-full bg-[#efebe3]" />
                            <span className="mt-1 h-1.5 w-full rounded-full bg-[#efebe3]" />
                            <span className="mt-1 h-1.5 w-2/3 rounded-full bg-[#efebe3]" />
                          </div>
                        ) : (
                          <div className="space-y-1.5 p-3">
                            {[80, 95, 70, 90, 60, 85].map((w, j) => (
                              <span key={j} className="block h-1.5 rounded-full bg-[#efebe3]" style={{ width: `${w}%` }} />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {reading && <span aria-hidden className="absolute inset-x-[-14px] z-10 h-8 rounded-full bg-gradient-to-b from-transparent via-sky/45 to-transparent" style={{ animation: "scan 0.9s ease-in-out infinite alternate" }} />}
                  </div>
                  <p className="mt-4 truncate text-xs font-bold">{data.fileName}</p>
                  <div className="mx-auto mt-2 h-1.5 max-w-[200px] overflow-hidden rounded-full bg-line">
                    <div className="bg-warm h-full rounded-full transition-[width] duration-200" style={{ width: `${t >= T.readDone ? 100 : readPct}%` }} />
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted">
                    {t < T.readDone ? `Peep is reading ${data.pages} pages…` : `Read ${data.pages} pages · found 3 photos`}
                  </p>
                </div>
              )}
              {dropped && t < T.drop + 600 && <span aria-hidden className="bubble-pop" style={{ "--px": "50%", "--py": "50%" } as React.CSSProperties} />}
            </div>

            {/* Flags */}
            <div className={`space-y-2 transition-all duration-500 ${flagsOn ? "opacity-100" : "pointer-events-none opacity-0"}`}>
              <div className={`flex items-center gap-2.5 rounded-xl p-2.5 text-sm ring-1 transition-colors duration-500 ${goalFixed ? "bg-mint-soft ring-mint/40" : "bg-card ring-accent/50"}`}>
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-extrabold ${goalFixed ? "bg-mint" : "bg-accent"} text-[#2a2826]`}>{goalFixed ? "✓" : "!"}</span>
                <span className="min-w-0 flex-1 truncate">{goalFixed ? <>Goal set: <b>{money(data.goal)}</b></> : <>No fundraising goal in the PDF</>}</span>
                {!goalFixed && (
                  <span ref={goalBtn} className={`shrink-0 rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-bg transition-transform ${t > T.fixGoal - 200 ? "scale-90" : ""}`}>
                    Use {money(data.goal)}
                  </span>
                )}
              </div>
              <div className={`flex items-center gap-2.5 rounded-xl p-2.5 text-sm ring-1 transition-colors duration-500 ${emailFixed ? "bg-mint-soft ring-mint/40" : "bg-card ring-accent/50"}`}>
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-extrabold ${emailFixed ? "bg-mint" : "bg-accent"} text-[#2a2826]`}>{emailFixed ? "✓" : "!"}</span>
                <span className="shrink-0">{emailFixed ? "Contact added" : "Contact email missing"}</span>
                <span ref={emailField} className="min-w-0 flex-1 truncate rounded-lg bg-bg px-2 py-1 text-xs ring-1 ring-line">
                  {EMAIL.slice(0, typed) || <span className="text-muted">email</span>}
                  {typed > 0 && typed < EMAIL.length && <span className="animate-caret ml-px inline-block h-3 w-px translate-y-0.5 bg-ink" />}
                </span>
              </div>
            </div>
          </div>

          {/* Right: the campaign being built */}
          <div className="rounded-2xl bg-card p-3 ring-1 ring-line sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="eyebrow text-[10px] text-brand">Your campaign</p>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all duration-500 ${live ? "bg-mint text-[#2a2826]" : "bg-bg text-muted ring-1 ring-line"}`}>
                {live ? "● Live" : flagsOn ? `${ready}% ready` : dropped ? "Building…" : "Waiting for a PDF"}
              </span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)]">
              <div className={`relative overflow-hidden rounded-xl transition-all duration-700 ${field(6) ? "" : "bg-line"}`}>
                {field(6) ? (
                  <CoverArt id={data.id} cause={data.cause} className="animate-pop h-24 rounded-xl sm:h-full sm:min-h-[150px]" />
                ) : (
                  <div className="grid h-24 place-items-center text-[11px] text-muted sm:h-full sm:min-h-[150px]">Cover photo</div>
                )}
                {field(6) && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-bold text-[#2a2826]">From page 1</span>}
              </div>
              <div className="min-w-0 space-y-0.5">
                {row(0, "Campaign", data.title)}
                {row(1, "Organization", data.org)}
                {row(2, "When", data.when)}
                {row(3, "Where", data.where)}
              </div>
            </div>
            <div className="mt-1 space-y-0.5">
              {row(4, "Causes", data.causes.join(" · "))}
              {row(5, "Tiers", data.tiers.map(money).join(" · "))}
              {row(7, "Story", data.story)}
              <div className="flex items-center gap-3 rounded-xl px-3 py-2">
                <span className="eyebrow w-[86px] shrink-0 text-[10px] text-muted">Goal</span>
                <span className="flex-1 text-sm font-semibold">{goalFixed ? <span className="animate-pop inline-block">{money(data.goal)}</span> : flagsOn ? <span className="text-brand">Missing</span> : skel("30%")}</span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
              <span
                ref={postBtn}
                className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all duration-300 ${
                  live ? "bg-mint text-[#2a2826]" : ready === 100 ? "bg-ink text-bg shadow-[0_10px_24px_-10px_rgba(0,0,0,0.6)]" : "bg-line text-muted"
                }`}
                style={pressing ? { transform: "scale(1.06, 0.9)" } : undefined}
              >
                {live ? "✓ Posted, free" : "Post campaign · free"}
              </span>
              <div className={`flex min-w-0 flex-1 flex-wrap items-center gap-1.5 transition-all duration-500 ${matched ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}>
                <span className="text-xs font-bold">Matched with</span>
                {data.sponsors.map((s, i) => (
                  <span key={s.name} className="inline-flex items-center gap-1.5 rounded-full bg-mint-soft px-2.5 py-1 text-[11px] font-semibold text-good" style={{ transitionDelay: `${i * 120}ms` }}>
                    {s.name} <b className="text-ink">{s.score}</b>
                  </span>
                ))}
                <span className="text-[11px] text-muted">· funds verified</span>
              </div>
            </div>
          </div>
        </div>

        {/* The cursor carrying the file */}
        <div
          aria-hidden
          className={`pointer-events-none absolute left-0 top-0 z-30 transition-[transform,opacity] duration-[1000ms] ease-in-out ${cursor.show ? "opacity-100" : "opacity-0"}`}
          style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}
        >
          {!dropped && started && (
            <div className="absolute -left-10 -top-14 flex items-center gap-1.5 rounded-xl bg-white px-2 py-1.5 shadow-[0_14px_30px_-10px_rgba(0,0,0,0.45)] ring-1 ring-line" style={{ transform: "rotate(-6deg)" }}>
              <PdfIcon className="h-7 w-6" />
              <span className="max-w-[140px] truncate text-[11px] font-bold text-[#2a2826]">{data.fileName}</span>
            </div>
          )}
          <svg viewBox="0 0 24 24" className="h-6 w-6 drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]">
            <path d="M4 2l15 9.5-6.5 1.4L9.6 19z" fill="#fff" stroke="#2a2826" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </div>
        {live && t < T.live + 1400 && <PeepMark className="animate-pop pointer-events-none absolute bottom-4 right-4 z-20 h-12 w-14" />}
      </div>

      {/* Steps */}
      <ol className="mx-auto mt-4 grid max-w-4xl grid-cols-2 gap-2 sm:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.label}>
            <button
              type="button"
              onClick={() => {
                if (!started) setStarted(true);
                requestAnimationFrame(() => jump.current(s.at));
              }}
              aria-current={step === i ? "step" : undefined}
              className={`relative w-full overflow-hidden rounded-full py-2 pl-2 pr-3 text-left transition-all duration-300 ${
                step === i && started ? "bg-white text-[#2a2826] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]" : "glass-dark text-white/85 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-extrabold ${step === i && started ? "bg-accent text-[#2a2826]" : "bg-white/15"}`}>{i + 1}</span>
                <span className="truncate text-[13px] font-bold">{s.label}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
