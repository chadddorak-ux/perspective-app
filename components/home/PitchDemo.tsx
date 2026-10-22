"use client";

import { useEffect, useRef, useState } from "react";

export type PitchExample = {
  label: string;
  /** The opening of the pitch, typed into the box. */
  text: string;
  /** What the parser pulled out of the full pitch. */
  fields: { label: string; value: string }[];
};

const TYPE_MS = 18;

/** Tabs of real pitch emails: Peep "types" one in, then shows what it extracted. */
export function PitchDemo({ examples }: { examples: PitchExample[] }) {
  const [tab, setTab] = useState(0);
  const [typed, setTyped] = useState(0);
  const [seen, setSeen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const ex = examples[tab];
  const done = typed >= ex.text.length;

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold: 0.3 });
    io.observe(ref.current!);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!seen) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTyped(ex.text.length);
      return;
    }
    setTyped(0);
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      setTyped(Math.min(i, ex.text.length));
      if (i >= ex.text.length) clearInterval(id);
    }, TYPE_MS);
    return () => clearInterval(id);
  }, [tab, seen, ex.text.length]);

  // Move on to the next example a while after one finishes.
  useEffect(() => {
    if (!done || !seen) return;
    const t = setTimeout(() => setTab((x) => (x + 1) % examples.length), 5200);
    return () => clearTimeout(t);
  }, [done, seen, examples.length]);

  return (
    <div ref={ref} className="mx-auto max-w-3xl">
      <div role="tablist" aria-label="Example pitches" className="flex flex-wrap justify-center gap-x-8 gap-y-2">
        {examples.map((e, i) => (
          <button
            key={e.label}
            role="tab"
            aria-selected={tab === i}
            onClick={() => setTab(i)}
            className={`relative pb-2 text-base font-bold transition-colors ${tab === i ? "text-ink" : "text-muted hover:text-ink"}`}
          >
            {e.label}
            <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-line">
              {tab === i && <span key={tab} className="block h-full origin-left rounded-full bg-ink" style={{ animation: seen ? `grow ${ex.text.length * (TYPE_MS / 2) + 5200}ms linear both` : undefined }} />}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-2xl bg-card p-3 pl-4 shadow-[0_10px_30px_-16px_rgba(60,30,90,0.35)] ring-1 ring-line">
        <p className="min-h-[4.5rem] flex-1 whitespace-pre-line text-left text-sm leading-relaxed text-ink" aria-live="polite">
          {ex.text.slice(0, typed)}
          {!done && <span aria-hidden className="animate-caret ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-ink" />}
        </p>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-white transition-colors ${done ? "bg-ink" : "bg-muted/40"}`} aria-hidden>
          ↑
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {ex.fields.map((f, i) => (
          <div key={f.label} className="flex items-center justify-between gap-3 rounded-xl bg-card px-3.5 py-2.5 text-sm ring-1 ring-line">
            <span className="eyebrow shrink-0 text-[10px] text-muted">{f.label}</span>
            {done ? (
              <span key={`${tab}-${f.label}`} className="animate-pop truncate text-right font-semibold" style={{ animationDelay: `${i * 60}ms` }}>
                {f.value}
              </span>
            ) : (
              <span aria-hidden className="animate-blink h-2.5 w-24 rounded-full bg-line" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
