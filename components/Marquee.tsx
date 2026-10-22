"use client";

import { useEffect, useRef } from "react";

/**
 * A strip that scrolls at a steady speed (px per second) however long its
 * content is, and pauses while hovered. Pass the items twice so the loop is
 * seamless.
 */
export function Marquee({ children, speed = 32, className = "" }: { children: React.ReactNode; speed?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current!;
    const set = () => {
      el.style.animationDuration = `${Math.max(20, el.scrollWidth / 2 / speed)}s`;
    };
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, [speed]);

  return (
    <div ref={ref} className={`animate-marquee flex w-max hover:[animation-play-state:paused] ${className}`}>
      {children}
    </div>
  );
}
