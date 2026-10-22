"use client";

import { useEffect, useRef, useState } from "react";

/** A statement whose words light up from muted to ink as it scrolls through the viewport. */
export function ScrollWords({ text, accent, className = "" }: { text: string; accent?: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const words = text.split(" ");
  const [lit, setLit] = useState(words.length);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = ref.current!.getBoundingClientRect();
        const vh = window.innerHeight;
        // 0 when the top enters at 85% of the viewport, 1 when the bottom reaches 45%.
        const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.4)));
        setLit(Math.round(p * words.length));
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [words.length]);

  return (
    <p ref={ref} className={className}>
      {words.map((w, i) => (
        <span key={i} className={`scroll-word ${i < lit ? (accent && w.includes(accent) ? "text-brand" : "text-ink") : "text-ink/20"}`}>
          {w}{" "}
        </span>
      ))}
    </p>
  );
}
