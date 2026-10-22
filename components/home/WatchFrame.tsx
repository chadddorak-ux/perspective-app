"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Frames a home-page animation so the whole thing fits in one window: if it's
 * taller than the screen it's scaled down to fit. When it scrolls into view
 * it grows slightly and glows, a nudge to stop and watch.
 */
export function WatchFrame({
  children,
  className = "",
  minWidth = 0,
  minScale = 0.6,
}: {
  children: React.ReactNode;
  className?: string;
  /** Below this viewport width, don't scale (e.g. stacked cards on a phone). */
  minWidth?: number;
  minScale?: number;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ s: 1, h: 0 });
  const fitRef = useRef(1);

  useEffect(() => {
    const el = inner.current!;
    const measure = () => {
      const natural = el.offsetHeight;
      const header = window.innerWidth >= 640 ? 100 : 84;
      const avail = window.innerHeight - header - 20;
      const s = window.innerWidth < minWidth ? 1 : Math.max(minScale, Math.min(1, avail / natural));
      fitRef.current = s;
      setFit({ s, h: natural * s });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let shown = false;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !shown) {
          shown = true;
          if (reduced) return;
          const s = fitRef.current;
          el.animate(
            [
              { scale: `${s * 0.93}`, filter: "drop-shadow(0 0 0 rgb(255 170 110 / 0))" },
              { scale: `${s * 1.025}`, filter: "drop-shadow(0 0 36px rgb(255 170 110 / 0.35))", offset: 0.55 },
              { scale: `${s}`, filter: "drop-shadow(0 0 0 rgb(255 170 110 / 0))" },
            ],
            { duration: 1100, easing: "cubic-bezier(0.3, 0.9, 0.3, 1)" },
          );
        } else if (!e.isIntersecting) shown = false; // nudge again next time it comes into view
      },
      { threshold: 0.4 },
    );
    io.observe(outer.current!);
    return () => {
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [minWidth, minScale]);

  return (
    <div ref={outer} className={className} style={fit.h && fit.s < 1 ? { height: fit.h } : undefined}>
      <div ref={inner} style={{ scale: `${fit.s}`, transformOrigin: "top center" }}>
        {children}
      </div>
    </div>
  );
}
