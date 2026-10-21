import { money } from "@/lib/match";
import type { Funding } from "@/lib/funding";

export function ProgressBar({ percent, className = "" }: { percent: number; className?: string }) {
  return (
    <div className={`h-1.5 overflow-hidden bg-line ${className}`} role="progressbar" aria-valuenow={Math.min(percent, 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="bg-warm h-full transition-[width] duration-700" style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  );
}

export function daysLabel(f: Funding): string {
  if (f.state === "closed") return "Ended";
  if (f.daysLeft === undefined) return "Ongoing";
  if (f.daysLeft === 0) return "Today";
  return `${f.daysLeft} days to go`;
}

/** The big Kickstarter-style numbers block on a campaign page. */
export function FundingStats({ f }: { f: Funding }) {
  return (
    <div>
      <ProgressBar percent={f.percent} className="h-2" />
      <p className="display mt-5 text-5xl font-semibold text-brand">{money(f.pledged)}</p>
      <p className="mt-1 text-sm text-muted">
        pledged of <span className="font-mono text-ink">{money(f.goal)}</span> sponsorship goal
      </p>
      <div className="mt-5 grid grid-cols-3 border-y border-line">
        {[
          { v: `${f.percent}%`, l: "funded" },
          { v: String(f.sponsors), l: f.sponsors === 1 ? "sponsor" : "sponsors" },
          { v: f.daysLeft === undefined || f.state === "closed" ? "—" : String(f.daysLeft), l: f.state === "closed" ? "ended" : f.daysLeft === undefined ? "ongoing" : "days to go" },
        ].map((s, i) => (
          <div key={s.l} className={`py-3 ${i ? "border-l border-line pl-3" : ""}`}>
            <p className="display text-2xl font-semibold">{s.v}</p>
            <p className="eyebrow text-[10px] text-muted">{s.l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
