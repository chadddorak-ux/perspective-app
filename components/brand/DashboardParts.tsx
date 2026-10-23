"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DEFAULT_RULES, draftLogos, svgDataUrl } from "@/lib/brand-kit";
import { checkTagline } from "@/lib/compliance";
import { money } from "@/lib/match";
import { DECLINE_REASONS } from "@/lib/pitch";
import type { BrandKit, DeclineReason, Opportunity, SponsorProfile } from "@/lib/types";
import { CopyButton } from "../BrandAssets";
import { Arrow } from "../ui";
import { PledgeBadge, pledgeEmbed } from "./PledgeBadge";

async function send(url: string, method: string, body: unknown): Promise<string | null> {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return res.ok ? null : ((await res.json().catch(() => ({}))).error ?? "Something went wrong");
}

/** Reply to a pitch: interested, or a reason so the nonprofit isn't left guessing. */
export function PitchReply({ id }: { id: string }) {
  const router = useRouter();
  const [reason, setReason] = useState<DeclineReason>("not-now");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reply = async (body: { status: "interested" } | { status: "declined"; reason: DeclineReason }) => {
    setBusy(true);
    const e = await send(`/api/pitches/${id}`, "PATCH", body);
    setBusy(false);
    if (e) return setError(e);
    router.refresh();
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="btn-primary px-4 py-2 text-sm" disabled={busy} onClick={() => reply({ status: "interested" })}>
        Interested
      </button>
      <select className="field w-auto py-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value as DeclineReason)} aria-label="Reason">
        {Object.entries(DECLINE_REASONS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <button className="btn-secondary px-4 py-2 text-sm" disabled={busy} onClick={() => reply({ status: "declined", reason })}>
        Decline kindly
      </button>
      {error && <span className="text-xs text-bad">{error}</span>}
    </div>
  );
}

export function ApproveProof({ pledgeId, proofId }: { pledgeId: string; proofId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-primary px-3 py-1.5 text-xs"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await send(`/api/pledges/${pledgeId}`, "PATCH", { action: "approve-proof", proofId });
        router.refresh();
      }}
    >
      Approve
    </button>
  );
}

/** Edit the asset vault. Taglines are checked as you type: acknowledgment, not advertising. */
export function KitEditor({ sponsor, kit }: { sponsor: SponsorProfile; kit: BrandKit }) {
  const router = useRouter();
  const [draft, setDraft] = useState<BrandKit>(kit);
  const [rules, setRules] = useState(kit.rules.join("\n"));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const tag = useMemo(() => (draft.tagline ? checkTagline(draft.tagline) : { ok: true, problems: [] as string[] }), [draft.tagline]);

  const readSvg = async (file: File, part: "mark" | "wordmark") => {
    const text = await file.text();
    if (!text.trim().startsWith("<svg") || /<script|on\w+=/i.test(text)) return setMsg({ ok: false, text: "Please upload a plain SVG file." });
    setDraft((d) => ({ ...d, [part]: text }));
  };
  const redraft = () => {
    const logos = draftLogos(sponsor.name);
    setDraft((d) => ({ ...d, ...logos }));
    setMsg({ ok: true, text: "Drafted from your name and website. In production this pulls your real logo from a logo API." });
  };
  const save = async () => {
    setBusy(true);
    setMsg(null);
    const e = await send(`/api/sponsors/${sponsor.id}`, "PATCH", {
      brandKit: { ...draft, rules: rules.split("\n").map((r) => r.trim()).filter(Boolean), origin: undefined, updatedAt: undefined },
    });
    setBusy(false);
    setMsg(e ? { ok: false, text: e } : { ok: true, text: "Saved. Every nonprofit you've funded sees the new kit right away." });
    if (!e) router.refresh();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] [&>*]:min-w-0">
      <div className="space-y-3">
        {(["mark", "wordmark"] as const).map((part) => (
          <div key={part} className="rounded-2xl bg-white p-4 ring-1 ring-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={svgDataUrl(draft[part])} alt={part} className={`mx-auto ${part === "mark" ? "h-16 w-16" : "h-14 w-full object-contain"}`} />
            <label className="mt-3 block cursor-pointer text-center text-xs font-bold text-[#c2410c] hover:underline">
              <input type="file" accept=".svg,image/svg+xml" className="sr-only" onChange={(e) => e.target.files?.[0] && readSvg(e.target.files[0], part)} />
              Upload {part === "mark" ? "logo mark" : "wordmark"} (SVG)
            </label>
          </div>
        ))}
        <button type="button" className="btn-secondary w-full text-sm" onClick={redraft}>
          Fill from your website
        </button>
        <div className="flex flex-wrap gap-2">
          {draft.colors.map((c, i) => (
            <label key={i} className="flex items-center gap-1.5 rounded-full bg-bg px-2 py-1 text-xs ring-1 ring-line">
              <input type="color" value={c.hex} onChange={(e) => setDraft((d) => ({ ...d, colors: d.colors.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)) }))} className="h-5 w-5 cursor-pointer rounded-full border-0 bg-transparent p-0" />
              {c.name}
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <label className="block">
          <span className="label">Tagline for recognition</span>
          <input className="field" maxLength={120} value={draft.tagline ?? ""} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} />
          {!tag.ok ? (
            <span className="mt-1 block text-xs text-warn">
              Reads as advertising ({tag.problems.join(", ")}). Nonprofits can only print value-neutral lines as acknowledgment.
            </span>
          ) : (
            <span className="mt-1 block text-xs text-good">✓ Acknowledgment-safe</span>
          )}
        </label>
        <label className="block">
          <span className="label">Boilerplate</span>
          <textarea className="field min-h-24" maxLength={1200} value={draft.boilerplate} onChange={(e) => setDraft({ ...draft, boilerplate: e.target.value })} />
        </label>
        <label className="block">
          <span className="label">Mission (optional)</span>
          <input className="field" maxLength={400} value={draft.mission ?? ""} onChange={(e) => setDraft({ ...draft, mission: e.target.value })} />
        </label>
        <label className="block">
          <span className="label">Usage rules, one per line</span>
          <textarea className="field min-h-28 text-sm" value={rules} onChange={(e) => setRules(e.target.value)} />
          <button type="button" className="mt-1 text-xs font-bold text-brand hover:underline" onClick={() => setRules(DEFAULT_RULES.join("\n"))}>
            Reset to Peep&apos;s defaults
          </button>
        </label>
        {msg && <p className={`text-sm ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</p>}
        <button className="btn-primary group" disabled={busy || !tag.ok} onClick={save}>
          {busy ? "Saving…" : "Save brand kit"} <Arrow />
        </button>
      </div>
    </div>
  );
}

/** Employees vote on where the team pool goes; the company funds the winner in one click. */
export function TeamVote({ sponsor, options, tallies }: { sponsor: SponsorProfile; options: Opportunity[]; tallies: Record<string, number> }) {
  const router = useRouter();
  const [voter, setVoter] = useState("");
  const [pool, setPool] = useState(Math.max(500, Math.round((sponsor.givingBudget ?? 10000) * 0.1)));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const total = Object.values(tallies).reduce((a, b) => a + b, 0);
  const winner = [...options].sort((a, b) => (tallies[b.id] ?? 0) - (tallies[a.id] ?? 0))[0];

  const vote = async (opportunityId: string) => {
    const e = await send("/api/votes", "POST", { sponsorId: sponsor.id, opportunityId, voter });
    setMsg(e ? { ok: false, text: e } : { ok: true, text: "Vote counted. One vote per person; voting again moves it." });
    if (!e) router.refresh();
  };
  const fund = async () => {
    if (!winner) return;
    const e = await send("/api/pledges", "POST", { opportunityId: winner.id, tierName: "General operating support", sponsorId: sponsor.id, amount: pool, kind: "gift", recognition: "public" });
    setMsg(e ? { ok: false, text: e } : { ok: true, text: `Sent ${money(pool)} to ${winner.title}. The receipt is in Gifts & receipts.` });
    if (!e) router.refresh();
  };

  return (
    <div className="space-y-4">
      <label className="block max-w-xs">
        <span className="label">Your name</span>
        <input className="field" value={voter} onChange={(e) => setVoter(e.target.value)} placeholder="Jordan from Finance" />
      </label>
      <ul className="space-y-2">
        {options.map((o) => {
          const n = tallies[o.id] ?? 0;
          const pct = total ? Math.round((n / total) * 100) : 0;
          return (
            <li key={o.id} className="relative overflow-hidden rounded-2xl bg-bg p-4 ring-1 ring-line">
              <span aria-hidden className="absolute inset-y-0 left-0 bg-mint/15 transition-[width] duration-500" style={{ width: `${pct}%` }} />
              <div className="relative flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{o.title}</p>
                  <p className="text-xs text-muted">
                    {o.orgName} · {n} vote{n === 1 ? "" : "s"}
                  </p>
                </div>
                <button className="btn-secondary px-4 py-2 text-sm" disabled={voter.trim().length < 2} onClick={() => vote(o.id)}>
                  Vote
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-card p-4 ring-1 ring-line">
        <label className="block">
          <span className="label">Team pool</span>
          <input type="number" min={25} step={50} className="field w-36" value={pool} onChange={(e) => setPool(Math.max(0, Number(e.target.value)))} />
        </label>
        <button className="btn-primary group" disabled={!total || pool < 25} onClick={fund}>
          Fund the winner{winner && total ? `: ${winner.title.slice(0, 28)}${winner.title.length > 28 ? "…" : ""}` : ""} <Arrow />
        </button>
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</p>}
    </div>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Budget year, giving budget, disaster pool and the public Peep Pledge. */
export function BrandSettings({ sponsor }: { sponsor: SponsorProfile }) {
  const router = useRouter();
  const [fy, setFy] = useState(sponsor.fiscalYearEnd ?? 12);
  const [budget, setBudget] = useState(sponsor.givingBudget ?? 0);
  const [pool, setPool] = useState(sponsor.disasterPool ?? 0);
  const [pledgeOn, setPledgeOn] = useState(!!sponsor.peepPledge);
  const [kind, setKind] = useState<"percent-profit" | "fixed">(sponsor.peepPledge?.kind ?? "percent-profit");
  const [value, setValue] = useState(sponsor.peepPledge?.value ?? 1);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async () => {
    const e = await send(`/api/sponsors/${sponsor.id}`, "PATCH", { fiscalYearEnd: fy, givingBudget: budget, disasterPool: pool, peepPledge: pledgeOn ? { kind, value } : null });
    setMsg(e ? { ok: false, text: e } : { ok: true, text: "Saved." });
    if (!e) router.refresh();
  };
  const preview = pledgeOn ? { kind, value, since: "" } : undefined;
  return (
    <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
      <div className="space-y-4">
        <label className="block">
          <span className="label">Budget year ends</span>
          <select className="field" value={fy} onChange={(e) => setFy(Number(e.target.value))}>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <span className="hint mt-1 block">Shown to nonprofits so asks land when your budget is open.</span>
        </label>
        <label className="block">
          <span className="label">Giving budget this year</span>
          <input type="number" min={0} step={1000} className="field" value={budget} onChange={(e) => setBudget(Math.max(0, Number(e.target.value)))} />
        </label>
        <label className="block">
          <span className="label">Standing disaster pool</span>
          <input type="number" min={0} step={500} className="field" value={pool} onChange={(e) => setPool(Math.max(0, Number(e.target.value)))} />
          <span className="hint mt-1 block">Sent to vetted local responders when a disaster is declared in your area, with an acknowledgment-only receipt.</span>
        </label>
      </div>
      <div className="space-y-4">
        <label className="flex items-center gap-2.5 text-sm font-bold">
          <input type="checkbox" className="h-4 w-4 accent-[var(--mint)]" checked={pledgeOn} onChange={(e) => setPledgeOn(e.target.checked)} />
          Make a public Peep Pledge
        </label>
        {pledgeOn && (
          <div className="flex flex-wrap gap-2">
            <select className="field w-auto" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="percent-profit">% of profit</option>
              <option value="fixed">$ per year</option>
            </select>
            <input type="number" min={0.1} step={kind === "fixed" ? 1000 : 0.5} className="field w-36" value={value} onChange={(e) => setValue(Math.max(0.1, Number(e.target.value)))} />
          </div>
        )}
        {preview && (
          <div className="space-y-2">
            <PledgeBadge pledge={preview} />
            <div className="rounded-xl bg-bg p-3 text-xs ring-1 ring-line">
              <div className="flex items-center justify-between">
                <span className="eyebrow text-[9px] text-muted">Badge for your website</span>
                <CopyButton text={pledgeEmbed({ ...sponsor, peepPledge: preview })} label="Copy HTML" />
              </div>
              <p className="mt-1 text-muted">A fixed commitment, not &ldquo;buy this and we donate&rdquo;, so state cause-marketing rules don&apos;t kick in.</p>
            </div>
          </div>
        )}
        {msg && <p className={`text-sm ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</p>}
        <button className="btn-primary" onClick={save}>
          Save settings
        </button>
      </div>
    </div>
  );
}

/** Year-end pack for the CFO or CPA: every gift and sponsorship, classified, with receipt numbers. */
export function FinanceDownload({ csv, name }: { csv: string; name: string }) {
  return (
    <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`} download={`${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-giving-2026.csv`} className="btn-primary group">
      Download the year-end pack (CSV) <Arrow />
    </a>
  );
}
