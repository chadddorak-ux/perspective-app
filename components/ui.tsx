import type { MatchResult } from "@/lib/types";

const GRADE_STYLE: Record<MatchResult["grade"], string> = {
  Excellent: "bg-accent text-[#111113]",
  Strong: "bg-ink text-bg",
  Possible: "bg-accent-soft text-warn",
  "Long shot": "border border-line text-muted",
  "Not eligible": "bg-bad/10 text-bad",
};

export function GradeBadge({ grade }: { grade: MatchResult["grade"] }) {
  return <span className={`eyebrow rounded-sm px-2 py-0.5 text-[10px] ${GRADE_STYLE[grade]}`}>{grade}</span>;
}

export function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const color = score >= 85 ? "var(--accent)" : score >= 70 ? "var(--ink)" : score >= 55 ? "var(--accent-2)" : "var(--muted)";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-label={`Match score ${score} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={5} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          className="animate-ring"
          style={{ "--ring-c": c } as React.CSSProperties}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-mono text-sm font-semibold tabular-nums">{score}</span>
    </div>
  );
}

export function Pill({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "brand" | "accent" }) {
  const cls =
    tone === "brand" ? "bg-brand-soft text-brand" : tone === "accent" ? "bg-accent-soft text-warn" : "bg-bg text-muted border border-line";
  return <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

export function SampleTag() {
  return (
    <span title="Fictional demo data" className="eyebrow rounded-sm border border-dashed border-line px-1.5 py-0.5 text-[9px] text-muted">
      Sample
    </span>
  );
}

export function Eyebrow({ index, children, className = "" }: { index?: string; children: React.ReactNode; className?: string }) {
  return (
    <p className={`eyebrow flex items-center gap-2 text-muted ${className}`}>
      <span aria-hidden className="inline-block h-1.5 w-1.5 bg-accent" />
      {index && <span className="text-ink">{index}</span>}
      {index && <span aria-hidden>/</span>}
      {children}
    </p>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-10 max-w-3xl animate-rise">
      {eyebrow && <Eyebrow className="mb-4">{eyebrow}</Eyebrow>}
      <h1 className="display text-4xl font-semibold sm:text-6xl">{title}</h1>
      {children && <div className="mt-4 max-w-2xl text-lg text-muted">{children}</div>}
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
          <div className="h-1.5 overflow-hidden bg-line" title={d.note}>
            <div className="bg-warm h-full" style={{ width: `${(d.score / d.max) * 100}%` }} />
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
