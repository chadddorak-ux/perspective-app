"use client";

import { useEffect, useState } from "react";
import { PeepMark } from "../Peep";

/** Pulsing rings around Peep with a speech bubble that cycles through real pledges. */
export function Radar({ messages }: { messages: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (messages.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((x) => (x + 1) % messages.length), 3200);
    return () => clearInterval(id);
  }, [messages.length]);

  return (
    <div className="relative mx-auto grid h-64 max-w-xl place-items-center overflow-hidden sm:h-72">
      {[0, 1, 2].map((k) => (
        <span
          key={k}
          aria-hidden
          className="animate-radar absolute aspect-square w-[min(36rem,140%)] rounded-full border border-sky/40"
          style={{ animationDelay: `${k * 1.2}s` }}
        />
      ))}
      <div className="relative flex flex-col items-center">
        <p key={i} aria-live="polite" className="animate-pop relative mb-4 max-w-[20rem] rounded-2xl bg-accent px-4 py-2.5 text-center text-sm font-bold text-[#2a2826] shadow-[0_12px_30px_-12px_rgba(255,107,44,0.7)]">
          {messages[i]}
          <span aria-hidden className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-accent" />
        </p>
        <span className="group grid h-16 w-16 place-items-center rounded-2xl bg-card shadow-[0_10px_30px_-10px_rgba(60,30,90,0.45)] ring-1 ring-line">
          <PeepMark className="h-10 w-12" />
        </span>
      </div>
    </div>
  );
}
