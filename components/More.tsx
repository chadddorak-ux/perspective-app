"use client";

import { useId, useState } from "react";

/** Tucks secondary detail behind a tap: a small "show more" toggle. */
export function More({ label, openLabel, children, className = "" }: { label: string; openLabel?: string; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full py-1 text-sm font-bold text-brand hover:underline"
      >
        {open ? (openLabel ?? "Show less") : label}
        <svg aria-hidden viewBox="0 0 12 12" className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div id={id} hidden={!open} className="mt-3">
        {children}
      </div>
    </div>
  );
}
