"use client";

import { useRef, useState } from "react";
import { Shape, type PaletteKey, type ShapeKind } from "./Shapes";

export type FloatingShape = {
  kind: ShapeKind;
  color: PaletteKey;
  top: string;
  left: string;
  size: number;
  rotate?: number;
  depth?: number;
  mobile?: boolean; // most shapes stay off phones, where they'd sit on the text
};

/**
 * Decorative shapes that drift with the pointer and wobble when clicked.
 * They're toys, not controls, so they're hidden from assistive tech.
 */
export function Playground({ shapes, children, className = "" }: { shapes: FloatingShape[]; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hits, setHits] = useState<Record<number, number>>({});

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el || e.pointerType !== "mouse") return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--px", String((e.clientX - r.left) / r.width - 0.5));
        el.style.setProperty("--py", String((e.clientY - r.top) / r.height - 0.5));
      }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {shapes.map((s, i) => (
          <span
            key={i}
            className={`pointer-events-auto absolute cursor-pointer transition-transform duration-300 ease-out ${s.mobile ? "" : "max-sm:hidden"}`}
            style={{
              top: s.top,
              left: s.left,
              width: s.size,
              height: s.size,
              transform: `translate(calc(var(--px, 0) * ${(s.depth ?? 1) * 36}px), calc(var(--py, 0) * ${(s.depth ?? 1) * 36}px))`,
            }}
            onClick={() => setHits((h) => ({ ...h, [i]: (h[i] ?? 0) + 1 }))}
          >
            <span key={hits[i] ?? 0} className={`block h-full w-full ${hits[i] ? "animate-wobble" : ""}`}>
              <span className="block h-full w-full animate-float" style={{ animationDelay: `${i * -1.3}s`, animationDuration: `${6 + (i % 3)}s` }}>
                <Shape kind={s.kind} color={s.color} rotate={s.rotate} className="h-full w-full" />
              </span>
            </span>
          </span>
        ))}
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}
