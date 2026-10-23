import type { SponsorProfile } from "@/lib/types";

/** The Peep Pledge: a public, verified giving commitment, like 1% for the Planet. */
export function pledgeText(p: NonNullable<SponsorProfile["peepPledge"]>): string {
  return p.kind === "percent-profit" ? `${p.value}% of profit to causes` : `$${Math.round(p.value).toLocaleString("en-US")} a year to causes`;
}

export function PledgeBadge({ pledge, className = "" }: { pledge: NonNullable<SponsorProfile["peepPledge"]>; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full bg-[#1d1536] py-1.5 pl-1.5 pr-3.5 text-white shadow-[0_8px_20px_-10px_rgba(0,0,0,0.6)] ${className}`}>
      <span className="grid h-7 w-7 place-items-center rounded-full bg-[#86d8bd] text-[11px] font-extrabold text-[#1d3b31]">✓</span>
      <span className="leading-tight">
        <span className="block text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#86d8bd]">Peep Pledge</span>
        <span className="block text-xs font-bold">{pledgeText(pledge)}</span>
      </span>
    </span>
  );
}

/** HTML a brand can paste on its own site. */
export function pledgeEmbed(sp: SponsorProfile, origin = "https://peep.example"): string {
  if (!sp.peepPledge) return "";
  return `<a href="${origin}/sponsors/${sp.id}" style="display:inline-flex;align-items:center;gap:8px;padding:6px 14px 6px 6px;border-radius:999px;background:#1d1536;color:#fff;font:700 12px system-ui;text-decoration:none"><span style="display:grid;place-items:center;width:28px;height:28px;border-radius:999px;background:#86d8bd;color:#1d3b31">&#10003;</span>Peep Pledge · ${pledgeText(sp.peepPledge)}</a>`;
}
