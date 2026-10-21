import type { MatchResult } from "@/lib/types";
import { Shape } from "./Shapes";

const GRADE_STYLE: Record<MatchResult["grade"], string> = {
  Excellent: "bg-mint text-[#1f1a17]",
  Strong: "bg-sky text-[#1f1a17]",
  Possible: "bg-accent-2 text-[#1f1a17]",
  "Long shot": "border border-line text-muted",
  "Not eligible": "bg-bad/10 text-bad",
};

export function GradeBadge({ grade }: { grade: MatchResult["grade"] }) {
  return <span className={`eyebrow rounded-full px-2.5 py-0.5 text-[10px] ${GRADE_STYLE[grade]}`}>{grade}</span>;
}

export function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const color = score >= 85 ? "var(--mint)" : score >= 70 ? "var(--sky)" : score >= 55 ? "var(--accent-2)" : "var(--muted)";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-label={`Match score ${score} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={6} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          className="animate-ring"
          style={{ "--ring-c": c } as React.CSSProperties}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display text-base font-bold tabular-nums">{score}</span>
    </div>
  );
}

export function Pill({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "brand" | "accent" }) {
  const cls =
    tone === "brand" ? "bg-brand-soft text-brand" : tone === "accent" ? "bg-accent-soft text-warn" : "bg-bg text-muted border border-line";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

export function SampleTag() {
  return (
    <span title="Fictional demo data" className="eyebrow rounded-full border border-dashed border-line px-2 py-0.5 text-[9px] text-muted">
      Sample
    </span>
  );
}

export function Eyebrow({ index, children, className = "" }: { index?: string; children: React.ReactNode; className?: string }) {
  return (
    <p className={`eyebrow flex items-center gap-2 text-muted ${className}`}>
      <Shape kind="half" color="coral" className="h-3 w-3" />
      {index && <span className="text-ink">{index}</span>}
      {index && <span aria-hidden>/</span>}
      {children}
    </p>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="relative mb-10 flex items-start justify-between gap-6">
      <div className="max-w-3xl animate-rise">
        {eyebrow && <Eyebrow className="mb-4">{eyebrow}</Eyebrow>}
        <h1 className="display text-4xl font-bold sm:text-6xl">{title}</h1>
        {children && <div className="mt-4 max-w-2xl text-lg text-muted">{children}</div>}
      </div>
      <div aria-hidden className="hidden shrink-0 grid-cols-2 gap-1.5 md:grid">
        <Shape kind="quarter" color="coral" rotate={90} className="h-14 w-14" />
        <Shape kind="circle" color="sky" className="h-14 w-14 animate-float" />
        <Shape kind="square" color="sun" className="h-14 w-14" />
        <Shape kind="half" color="mint" rotate={180} className="h-14 w-14" />
      </div>
    </div>
  );
}

/** Up-right arrow that nudges on hover; put it inside a `group`. */
export function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={`h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${className}`}>
      <path d="M4 12 12 4M6 4h6v6" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function Breakdown({ match }: { match: MatchResult }) {
  return (
    <div className="space-y-2">
      {match.breakdown.map((d) => (
        <div key={d.dimension} className="grid grid-cols-[88px_1fr_40px] items-center gap-3 text-xs">
          <span className="eyebrow text-[10px] text-muted">{d.dimension}</span>
          <div className="h-2 overflow-hidden rounded-full bg-line" title={d.note}>
            <div className="h-full rounded-full bg-accent" style={{ width: `${(d.score / d.max) * 100}%` }} />
          </div>
          <span className="text-right font-mono tabular-nums text-muted">
            {d.score}/{d.max}
          </span>
        </div>
      ))}
      {match.adjustments.map((a) => (
        <div key={a.label} className="grid grid-cols-[1fr_40px] gap-3 text-xs">
          <span className="text-muted">{a.label}</span>
          <span className="text-right tabular-nums text-bad">{a.points}</span>
        </div>
      ))}
    </div>
  );
}
