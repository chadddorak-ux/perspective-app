// Bauhaus shape system. Every illustration on the site is built from these
// few primitives in the five palette colors, so causes, sponsors and steps
// share one visual language.

import { CAUSE_GROUPS, type CauseId } from "@/lib/taxonomy";

export type ShapeKind = "circle" | "half" | "quarter" | "square" | "triangle" | "arch" | "leaf" | "ring" | "dot";

/** Each path is drawn in a 100×100 box. */
const PATHS: Record<Exclude<ShapeKind, "circle" | "ring" | "dot" | "square">, string> = {
  half: "M0 100 A50 50 0 0 1 100 100 Z",
  quarter: "M0 100 L0 0 A100 100 0 0 1 100 100 Z",
  triangle: "M50 4 L100 100 L0 100 Z",
  arch: "M0 100 V50 A50 50 0 0 1 100 50 V100 Z",
  leaf: "M0 100 A100 100 0 0 1 100 0 A100 100 0 0 1 0 100 Z",
};

export const PALETTE = {
  coral: "var(--accent)",
  sun: "var(--accent-2)",
  sky: "var(--sky)",
  blush: "var(--blush)",
  mint: "var(--mint)",
  ink: "var(--ink)",
} as const;
export type PaletteKey = keyof typeof PALETTE;

export type Piece = { kind: ShapeKind; x: number; y: number; size: number; color: PaletteKey; rotate?: number };

/** One primitive positioned inside a parent <svg>. Rotation pivots on its own center. */
export function ShapePiece({ kind, x, y, size, color, rotate = 0, className = "" }: Piece & { className?: string }) {
  const fill = PALETTE[color];
  const s = size / 100;
  const style = { transformBox: "fill-box", transformOrigin: "center" } as React.CSSProperties;
  const inner =
    kind === "circle" ? (
      <circle cx="50" cy="50" r="50" fill={fill} />
    ) : kind === "dot" ? (
      <circle cx="50" cy="50" r="22" fill={fill} />
    ) : kind === "ring" ? (
      <circle cx="50" cy="50" r="40" fill="none" stroke={fill} strokeWidth="16" />
    ) : kind === "square" ? (
      <rect width="100" height="100" fill={fill} />
    ) : (
      <path d={PATHS[kind]} fill={fill} />
    );
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g transform={`rotate(${rotate} 50 50)`}>
        <g className={className} style={style}>
          {inner}
        </g>
      </g>
    </g>
  );
}

/** A standalone shape as its own small SVG. */
export function Shape({ kind, color, rotate = 0, className = "", title }: { kind: ShapeKind; color: PaletteKey; rotate?: number; className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <ShapePiece kind={kind} x={0} y={0} size={100} color={color} rotate={rotate} />
    </svg>
  );
}

// A 2×2 Bauhaus tile per cause group (200×200), chosen to echo the cause:
// a rising sun over a book, a cross, a bowl, a leaf under a sun, and so on.
export const GROUP_GLYPHS: Record<string, { bg: PaletteKey; pieces: Piece[] }> = {
  "Education & youth": {
    bg: "sun",
    pieces: [
      { kind: "half", x: 0, y: 0, size: 100, color: "coral" },
      { kind: "square", x: 100, y: 0, size: 100, color: "sky" },
      { kind: "quarter", x: 0, y: 100, size: 100, color: "ink", rotate: 90 },
      { kind: "circle", x: 115, y: 115, size: 70, color: "blush" },
    ],
  },
  Health: {
    bg: "blush",
    pieces: [
      { kind: "square", x: 66, y: 10, size: 68, color: "coral" },
      { kind: "square", x: 10, y: 66, size: 68, color: "coral" },
      { kind: "square", x: 66, y: 66, size: 68, color: "coral" },
      { kind: "square", x: 122, y: 66, size: 68, color: "coral" },
      { kind: "square", x: 66, y: 122, size: 68, color: "coral" },
      { kind: "dot", x: 140, y: 0, size: 60, color: "sky" },
    ],
  },
  "Basic needs & community": {
    bg: "coral",
    pieces: [
      { kind: "circle", x: 50, y: 20, size: 100, color: "sun" },
      { kind: "half", x: 0, y: 100, size: 200, color: "ink", rotate: 180 },
      { kind: "dot", x: 0, y: 0, size: 60, color: "blush" },
    ],
  },
  "Environment & animals": {
    bg: "mint",
    pieces: [
      { kind: "circle", x: 110, y: 10, size: 80, color: "sun" },
      { kind: "leaf", x: 0, y: 0, size: 110, color: "ink" },
      { kind: "triangle", x: 40, y: 100, size: 100, color: "sky" },
      { kind: "quarter", x: 120, y: 120, size: 80, color: "blush", rotate: 270 },
    ],
  },
  "Arts, culture & sports": {
    bg: "sky",
    pieces: [
      { kind: "triangle", x: 0, y: 0, size: 100, color: "sun" },
      { kind: "circle", x: 105, y: 5, size: 90, color: "coral" },
      { kind: "arch", x: 0, y: 100, size: 100, color: "blush" },
      { kind: "ring", x: 100, y: 100, size: 100, color: "ink" },
    ],
  },
  "Equity & rights": {
    bg: "sun",
    pieces: [
      { kind: "circle", x: 10, y: 40, size: 110, color: "coral" },
      { kind: "circle", x: 80, y: 40, size: 110, color: "sky" },
      { kind: "square", x: 70, y: 150, size: 60, color: "ink" },
    ],
  },
  "Economy & work": {
    bg: "blush",
    pieces: [
      { kind: "square", x: 10, y: 130, size: 55, color: "ink" },
      { kind: "square", x: 72, y: 85, size: 55, color: "coral" },
      { kind: "square", x: 134, y: 40, size: 55, color: "sky" },
      { kind: "quarter", x: 0, y: 0, size: 80, color: "sun" },
    ],
  },
  "Global, civic & faith": {
    bg: "sky",
    pieces: [
      { kind: "circle", x: 30, y: 30, size: 140, color: "sun" },
      { kind: "half", x: 30, y: 30, size: 140, color: "mint" },
      { kind: "ring", x: 0, y: 0, size: 200, color: "ink" },
    ],
  },
};

export function groupOf(cause: CauseId | undefined): string {
  return CAUSE_GROUPS.find((g) => cause && g.ids.includes(cause))?.label ?? "Basic needs & community";
}

/** The square glyph for a cause group; shapes wobble when a parent `.group` is hovered. */
export function CauseGlyph({ group, className = "", animated = true }: { group: string; className?: string; animated?: boolean }) {
  const glyph = GROUP_GLYPHS[group] ?? GROUP_GLYPHS["Basic needs & community"];
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      <rect width="200" height="200" fill={PALETTE[glyph.bg]} />
      {glyph.pieces.map((p, i) => (
        <ShapePiece
          key={i}
          {...p}
          className={animated ? `transition-transform duration-500 ease-out group-hover:scale-110 ${i % 2 ? "group-hover:-rotate-12" : "group-hover:rotate-12"}` : ""}
        />
      ))}
    </svg>
  );
}

/** Perspective's mark: two halves (a cause and a sponsor) that close into one circle on hover. */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <g className="transition-transform duration-300 ease-out group-hover:translate-x-[2px]">
        <path d="M18 4 A16 16 0 0 0 18 36 Z" fill="var(--accent)" />
      </g>
      <g className="transition-transform duration-300 ease-out group-hover:-translate-x-[2px]">
        <path d="M22 4 A16 16 0 0 1 22 36 Z" fill="var(--sky)" />
      </g>
      <circle cx="20" cy="20" r="4.5" fill="var(--accent-2)" className="origin-center transition-transform duration-300 group-hover:scale-125" style={{ transformBox: "fill-box" }} />
    </svg>
  );
}
