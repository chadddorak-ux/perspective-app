"use client";

import { useEffect, useRef } from "react";
import type { SceneKind, WorldAPI } from "./engine";
import { useTheme } from "@/lib/theme";

const FALLBACK: Record<SceneKind, string> = { night: "sky-night", day: "sky-day", mountains: "sky-dusk" };

/**
 * A live 3D environment behind a section. three.js loads on demand the first
 * time the scene comes near the viewport, and the loop pauses off screen. If
 * WebGL isn't available the painted CSS sky underneath stays visible.
 * `nightKind` swaps the scene when the site is in dark mode.
 */
export function World({ kind: dayKind, nightKind, className = "" }: { kind: SceneKind; nightKind?: SceneKind; className?: string }) {
  const theme = useTheme();
  const kind = theme === "dark" && nightKind ? nightKind : dayKind;
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = host.current!;
    let api: WorldAPI | null = null;
    let disposed = false;
    let loading = false;
    let visible = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    async function boot() {
      loading = true;
      try {
        const { createWorld } = await import("./engine");
        if (disposed) return;
        api = createWorld(canvas.current!, { kind, reduced });
        canvas.current!.style.opacity = "1";
        api.setActive(visible);
      } catch (e) {
        console.warn("3D scene unavailable; showing the painted sky instead.", e);
      }
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !loading) boot();
        api?.setActive(visible);
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(el);
    return () => {
      disposed = true;
      io.disconnect();
      api?.dispose();
    };
  }, [kind]);

  return (
    <div ref={host} aria-hidden className={`absolute inset-0 overflow-hidden ${FALLBACK[kind]} ${className}`}>
      <canvas key={kind} ref={canvas} className="block h-full w-full opacity-0 transition-opacity duration-700" />
    </div>
  );
}
