import type { MatchResult } from "@/lib/types";

const GRADE_STYLE: Record<MatchResult["grade"], string> = {
  Excellent: "bg-good/15 text-good",
  Strong: "bg-brand-soft text-brand",
  Possible: "bg-accent-soft text-warn",
  "Long shot": "bg-line text-muted",
  "Not eligible": "bg-bad/10 text-bad",
};

export function GradeBadge({ grade }: { grade: MatchResult["grade"] }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${GRADE_STYLE[grade]}`}>{grade}</span>;
}

export function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const color = score >= 85 ? "var(--good)" : score >= 70 ? "var(--brand)" : score >= 55 ? "var(--accent)" : "var(--muted)";
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
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-sm font-bold tabular-nums">{score}</span>
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
    <span title="Fictional demo data" className="rounded border border-dashed border-line px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
      Sample
    </span>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 max-w-3xl">
      {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand">{eyebrow}</p>}
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
      {children && <div className="mt-3 text-muted">{children}</div>}
    </div>
  );
}

export function Breakdown({ match }: { match: MatchResult }) {
  return (
    <div className="space-y-2">
      {match.breakdown.map((d) => (
        <div key={d.dimension} className="grid grid-cols-[88px_1fr_40px] items-center gap-3 text-xs">
          <span className="capitalize text-muted">{d.dimension}</span>
          <div className="h-1.5 overflow-hidden rounded-full bg-line" title={d.note}>
            <div className="h-full rounded-full bg-brand" style={{ width: `${(d.score / d.max) * 100}%` }} />
          </div>
          <span className="text-right tabular-nums text-muted">
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
