"use client";

import { useEffect } from "react";

const BUTTONS = ".btn, .btn-primary, .btn-secondary, .btn-ghost, .btn-glass, .btn-bright";

/**
 * Brings the glass buttons to life: the glint follows the pointer and a
 * bubble ring pops out from where you click. Pure decoration, one listener.
 */
export function ButtonFX() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const onMove = (e: PointerEvent) => {
      const btn = (e.target as Element).closest?.<HTMLElement>(BUTTONS);
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      btn.style.setProperty("--mx", `${e.clientX - r.left}px`);
      btn.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    const onDown = (e: PointerEvent) => {
      if (reduced) return;
      const btn = (e.target as Element).closest?.<HTMLElement>(BUTTONS);
      if (!btn || (btn as HTMLButtonElement).disabled) return;
      const r = btn.getBoundingClientRect();
      const ring = document.createElement("span");
      ring.className = "bubble-pop";
      ring.style.setProperty("--px", `${e.clientX - r.left}px`);
      ring.style.setProperty("--py", `${e.clientY - r.top}px`);
      ring.setAttribute("aria-hidden", "true");
      btn.appendChild(ring);
      ring.addEventListener("animationend", () => ring.remove(), { once: true });
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerdown", onDown, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerdown", onDown);
    };
  }, []);
  return null;
}
