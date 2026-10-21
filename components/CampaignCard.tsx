import Link from "next/link";
import { money } from "@/lib/match";
import type { Funding } from "@/lib/funding";
import { CAUSES, label } from "@/lib/taxonomy";
import type { Opportunity } from "@/lib/types";
import { CoverArt } from "./CoverArt";
import { ProgressBar, daysLabel } from "./Funding";
import { SampleTag } from "./ui";

const KIND = { event: "Event", program: "Program", campaign: "Campaign", general: "General support" };

export function placeLabel(o: Opportunity): string {
  return o.location.virtual ? "Virtual" : [o.location.city, o.location.state].filter(Boolean).join(", ") || "Location TBD";
}

export function CampaignCard({ opp, f, badge }: { opp: Opportunity; f: Funding; badge?: React.ReactNode }) {
  return (
    <Link
      href={`/opportunities/${opp.id}`}
      className="group block overflow-hidden rounded-3xl border border-line bg-card transition-all duration-300 hover:-translate-y-1 hover:border-ink hover:shadow-[6px_6px_0_var(--ink)]"
    >
      <div className="relative overflow-hidden">
        <CoverArt
          id={opp.id}
          cause={opp.causes[0]}
          label={`${KIND[opp.kind]} · ${placeLabel(opp)}`}
          className="aspect-[16/10]"
        />
        {(badge || opp.featured) && (
          <div className="absolute right-3 top-3">
            {badge ?? <span className="eyebrow rounded-full bg-ink px-2.5 py-1 text-[10px] text-bg">★ Featured</span>}
          </div>
        )}
      </div>
      <div className="p-5">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="truncate">{opp.orgName}</span>
          {opp.sample && <SampleTag />}
        </div>
        <h3 className="mt-1 line-clamp-2 font-display text-lg font-semibold leading-snug tracking-tight group-hover:text-brand">{opp.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{opp.summary}</p>
        <ProgressBar percent={f.percent} className="mt-4" />
        <div className="mt-2 flex items-baseline justify-between gap-2 text-xs">
          <span>
            <span className="font-mono font-semibold text-ink">{money(f.pledged)}</span>
            <span className="text-muted"> of {money(f.goal)}</span>
          </span>
          <span className="font-display font-semibold text-muted">{f.percent}%</span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
          <span className="truncate">{opp.causes[0] ? label(CAUSES, opp.causes[0]) : ""}</span>
          <span className="eyebrow shrink-0 text-[10px]">{daysLabel(f)}</span>
        </div>
      </div>
    </Link>
  );
}
