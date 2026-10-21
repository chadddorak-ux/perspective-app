import type { CauseId } from "@/lib/taxonomy";
import { GROUP_GLYPHS, PALETTE, ShapePiece, groupOf, type PaletteKey, type Piece } from "./Shapes";

// Campaign covers are generated Bauhaus compositions: the cause group's glyph,
// enlarged and shifted per campaign so no two covers look alike. Shapes play
// when the card is hovered.

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const SOFT_BG: Record<PaletteKey, string> = {
  coral: "var(--brand-soft)",
  sun: "var(--accent-soft)",
  sky: "var(--sky-soft)",
  blush: "var(--brand-soft)",
  mint: "var(--mint-soft)",
  ink: "var(--line)",
};

export function coverColors(cause: CauseId | undefined) {
  const glyph = GROUP_GLYPHS[groupOf(cause)];
  return { bg: PALETTE[glyph.bg], fg: "#1f1a17", soft: SOFT_BG[glyph.bg] };
}

export function CoverArt({ id, cause, label, className = "" }: { id: string; cause?: CauseId; label?: string; className?: string }) {
  const group = groupOf(cause);
  const glyph = GROUP_GLYPHS[group];
  const h = hash(id);
  // The glyph sits in a 400×250 frame; position and a little rotation vary per campaign.
  const flip = h % 2 === 0;
  const offsetX = 150 + (h % 110);
  const tilt = (h % 3) * 90;
  const extras: Piece[] = [
    { kind: "dot", x: 20 + (h % 60), y: 140 + (h % 50), size: 70, color: glyph.pieces[0].color },
    { kind: (["quarter", "half", "square"] as const)[h % 3], x: 30 + (h % 40), y: 20, size: 80, color: glyph.pieces[glyph.pieces.length - 1].color, rotate: tilt },
  ];
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: SOFT_BG[glyph.bg] }}>
      <svg aria-hidden className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 250">
        {extras.map((p, i) => (
          <ShapePiece key={`e${i}`} {...p} className={`transition-transform duration-700 ease-out ${i ? "group-hover:rotate-45" : "group-hover:scale-125"}`} />
        ))}
        <g transform={`translate(${offsetX} 25) scale(1.0)`}>
          <g transform={flip ? "translate(200 0) scale(-1 1)" : undefined}>
            <rect width="200" height="200" rx="0" fill={PALETTE[glyph.bg]} />
            {glyph.pieces.map((p, i) => (
              <ShapePiece
                key={i}
                {...p}
                className={`transition-transform duration-500 ease-out group-hover:scale-105 ${i % 2 ? "group-hover:-rotate-12" : "group-hover:rotate-12"}`}
              />
            ))}
          </g>
        </g>
      </svg>
      {label && (
        <span className="eyebrow absolute left-3 top-3 rounded-full bg-card/90 px-2.5 py-1 text-[10px] text-ink shadow-sm backdrop-blur">{label}</span>
      )}
    </div>
  );
}
