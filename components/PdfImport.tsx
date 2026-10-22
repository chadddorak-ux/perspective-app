"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { campaignGaps, readiness, type Gap } from "@/lib/campaign-check";
import type { ExtractResult, OpportunityDraft } from "@/lib/extract";
import { money } from "@/lib/match";
import { takePendingUpload } from "@/lib/pending-upload";
import type { PdfProgress, PdfRead } from "@/lib/pdf-read";
import { US_STATES } from "@/lib/taxonomy";
import { CoverArt } from "./CoverArt";
import { EMPTY_OPPORTUNITY, OpportunityForm, cleanOpportunity } from "./OpportunityForm";
import { PeepMark } from "./Peep";

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function toBase64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function sampleDeck(): Promise<File> {
  const { SAMPLE_DECK_BASE64, SAMPLE_DECK_NAME } = await import("@/data/sample-deck");
  const bytes = Uint8Array.from(atob(SAMPLE_DECK_BASE64), (c) => c.charCodeAt(0));
  return new File([bytes], SAMPLE_DECK_NAME, { type: "application/pdf" });
}

type Phase = "open" | "read" | "fill" | "check";
type Meta = { fileName?: string; pages: number; method: ExtractResult["method"]; warnings: string[] };

/**
 * The PDF → campaign tool: drop a pitch deck, watch Peep read it, fix what it
 * flags, post. A campaign is only created once nothing required is missing.
 */
export function PdfImport({ aiEnabled, examples }: { aiEnabled: boolean; examples: { label: string; text: string }[] }) {
  const [stage, setStage] = useState<"drop" | "reading" | "review">("drop");
  const [phase, setPhase] = useState<Phase>("open");
  const [progress, setProgress] = useState<PdfProgress | null>(null);
  const [read, setRead] = useState<PdfRead | null>(null);
  const [draft, setDraft] = useState<OpportunityDraft>(EMPTY_OPPORTUNITY);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  async function run(source: { file?: File; text?: string }) {
    setStage("reading");
    setPhase("open");
    setProgress(null);
    setRead(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      let pdf: PdfRead = { pages: 0, text: source.text ?? "", images: [], thumbs: [] };
      if (source.file) {
        const f = source.file;
        if (f.type !== "application/pdf" && !/\.pdf$/i.test(f.name)) throw new Error("That file isn't a PDF. Export your deck or one-pager as a PDF and drop it in again.");
        if (f.size > MAX_PDF_BYTES) throw new Error("That PDF is over 20 MB. Try exporting a smaller version.");
        const { readPdf } = await import("@/lib/pdf-read");
        setPhase("read");
        pdf = await readPdf(f, setProgress);
        setRead(pdf);
      }
      setPhase("fill");
      let result: ExtractResult;
      if (!pdf.text.trim() && !(source.file && aiEnabled)) {
        // A scanned PDF with no text layer, and no AI to read the images.
        result = { method: "rules", draft: EMPTY_OPPORTUNITY, warnings: ["This PDF has no readable text (it may be a scan), so Peep couldn't fill in the fields. Add them below; your photos are ready to use."] };
      } else {
        const [res] = await Promise.all([
          fetch("/api/extract", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ text: pdf.text, pdfBase64: source.file && aiEnabled ? await toBase64(source.file) : undefined }),
          }),
          pause(700),
        ]);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Peep couldn't read that");
        result = json;
      }
      setPhase("check");
      await pause(600);
      setDraft({ ...result.draft, coverImage: pdf.images[0], gallery: pdf.images.slice(1, 4) });
      setMeta({ fileName: source.file?.name, pages: pdf.pages, method: result.method, warnings: result.warnings });
      setStage("review");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      console.error(e);
      setError((e as Error).message || "Peep couldn't read that file");
      setStage("drop");
    }
  }

  // A PDF dropped on the home page arrives here.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const file = takePendingUpload();
    if (file) run({ file });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (stage === "reading") return <Reading phase={phase} progress={progress} read={read} aiEnabled={aiEnabled} />;
  if (stage === "review" && meta) return <Review draft={draft} setDraft={setDraft} meta={meta} read={read} onRestart={() => setStage("drop")} />;
  return <DropStage onFile={(file) => run({ file })} onText={(text) => run({ text })} error={error} examples={examples} aiEnabled={aiEnabled} />;
}

/* ------------------------------------------------------------------ drop */

export function DropStage({
  onFile,
  onText,
  error,
  examples,
  aiEnabled,
}: {
  onFile: (f: File) => void;
  onText: (t: string) => void;
  error: string | null;
  examples: { label: string; text: string }[];
  aiEnabled: boolean;
}) {
  const [over, setOver] = useState(false);
  const [paste, setPaste] = useState(false);
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="mx-auto max-w-3xl">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files[0];
          if (f) onFile(f);
        }}
        className={`group relative grid min-h-[340px] place-items-center rounded-[28px] border-2 border-dashed p-8 text-center transition-all duration-300 ${
          over ? "scale-[1.01] border-accent bg-brand-soft" : "border-line bg-card hover:border-sky"
        }`}
      >
        <div>
          <div className={`relative mx-auto h-28 w-24 transition-transform duration-300 ${over ? "-translate-y-2 rotate-[-6deg]" : "group-hover:-translate-y-1"}`}>
            <PdfIcon className="h-full w-full" />
          </div>
          <p className="display mt-5 text-3xl sm:text-4xl">Drop your pitch PDF here</p>
          <p className="mx-auto mt-2 max-w-md text-muted">Sponsorship deck, one-pager or package. Peep reads every page, fills in your campaign and pulls out your photos.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button type="button" className="btn-primary px-6 py-3 text-base" onClick={() => input.current?.click()}>
              Choose a PDF
            </button>
            <button type="button" className="btn-secondary px-6 py-3 text-base" onClick={async () => onFile(await sampleDeck())}>
              Try a sample deck
            </button>
          </div>
          <input
            ref={input}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            aria-label="Upload a pitch PDF"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) onFile(f);
            }}
          />
          <p className="hint mt-5">Free to post. PDFs up to 20 MB. {aiEnabled ? "Read with AI, including scanned pages." : "Read right in your browser."}</p>
        </div>
      </div>
      {error && <p className="mt-4 rounded-2xl bg-bad/10 px-4 py-3 text-sm font-semibold text-bad">{error}</p>}

      <div className="mt-6 text-center">
        <button type="button" className="btn-ghost" onClick={() => setPaste((p) => !p)} aria-expanded={paste}>
          {paste ? "Hide" : "No PDF? Paste the pitch email instead"}
        </button>
      </div>
      {paste && (
        <div className="card mt-3 space-y-4 p-6">
          <textarea
            className="field min-h-56 text-sm leading-relaxed"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the pitch email or the text of a sponsorship one-pager…"
            aria-label="Pitch text"
          />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Try an example:</span>
            {examples.map((ex) => (
              <button key={ex.label} type="button" className="rounded-full border border-line px-3 py-1 hover:border-ink/30" onClick={() => setText(ex.text)}>
                {ex.label}
              </button>
            ))}
          </div>
          <button type="button" className="btn-primary" disabled={!text.trim()} onClick={() => onText(text)}>
            Build my campaign
          </button>
        </div>
      )}
    </div>
  );
}

export function PdfIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 112" className={className} aria-hidden>
      <path d="M8 4h56l28 28v72a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z" fill="var(--card)" stroke="var(--line)" strokeWidth="3" />
      <path d="M64 4v24a4 4 0 0 0 4 4h24" fill="var(--sky-soft)" stroke="var(--line)" strokeWidth="3" />
      <rect x="16" y="44" width="52" height="30" rx="5" fill="var(--sky)" opacity="0.55" />
      <circle cx="58" cy="52" r="5" fill="var(--accent-2)" />
      <rect x="16" y="82" width="44" height="5" rx="2.5" fill="var(--line)" />
      <rect x="16" y="92" width="32" height="5" rx="2.5" fill="var(--line)" />
      <rect x="0" y="16" width="40" height="18" rx="5" fill="var(--accent)" />
      <text x="20" y="29" textAnchor="middle" fontSize="11" fontWeight="800" fill="#2a2826" fontFamily="var(--font-sans)">
        PDF
      </text>
    </svg>
  );
}

/* --------------------------------------------------------------- reading */

function Reading({ phase, progress, read, aiEnabled }: { phase: Phase; progress: PdfProgress | null; read: PdfRead | null; aiEnabled: boolean }) {
  const order: Phase[] = ["open", "read", "fill", "check"];
  const at = order.indexOf(phase);
  const steps: { p: Phase; label: string; detail: string }[] = [
    { p: "open", label: "Opening your PDF", detail: progress ? `${progress.pages} page${progress.pages === 1 ? "" : "s"}` : "" },
    {
      p: "read",
      label: "Reading every page and pulling out photos",
      detail: progress ? `Page ${progress.page} of ${progress.pages} · ${progress.found} photo${progress.found === 1 ? "" : "s"} found` : "",
    },
    { p: "fill", label: "Filling in your campaign", detail: aiEnabled ? "Peep is reading it with AI" : "Matching what it read to each field" },
    { p: "check", label: "Checking for anything missing", detail: "" },
  ];
  const pct = Math.round(((at + (progress && phase === "read" ? progress.page / Math.max(1, progress.pages) : 0)) / order.length) * 100);

  return (
    <div className="mx-auto grid max-w-4xl items-center gap-10 py-6 md:grid-cols-[1fr_1.1fr]" role="status" aria-live="polite">
      <div className="relative mx-auto h-72 w-60">
        {(read?.thumbs.length ? read.thumbs.slice(0, 3) : [null, null, null]).map((src, i) => (
          <div
            key={i}
            className="absolute inset-0 overflow-hidden rounded-2xl bg-card shadow-[0_20px_40px_-20px_rgba(60,30,90,0.5)] ring-1 ring-line transition-transform duration-700"
            style={{ transform: `rotate(${(i - 1) * 7}deg) translateX(${(i - 1) * 26}px)`, zIndex: 3 - i }}
          >
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt="" className="h-full w-full object-cover object-top" />
            ) : (
              <div className="space-y-2 p-5">
                <div className="h-24 rounded-lg bg-sky-soft" />
                {[90, 70, 80, 60, 75].map((w, k) => (
                  <div key={k} className="h-2.5 rounded-full bg-line" style={{ width: `${w}%` }} />
                ))}
              </div>
            )}
          </div>
        ))}
        <div aria-hidden className="pointer-events-none absolute inset-x-[-12px] z-10 h-10 rounded-full bg-gradient-to-b from-transparent via-sky/40 to-transparent" style={{ animation: "scan 1.8s ease-in-out infinite alternate" }} />
        <PeepMark className="animate-float absolute -bottom-6 -right-8 z-20 h-20 w-24 drop-shadow-[0_10px_20px_rgba(0,0,0,0.25)]" />
      </div>
      <div>
        <p className="eyebrow text-brand">Peep is on it</p>
        <h2 className="display mt-2 text-3xl sm:text-4xl">Building your campaign</h2>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-line">
          <div className="bg-warm h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(6, pct)}%` }} />
        </div>
        <ol className="mt-6 space-y-3">
          {steps.map((s, i) => {
            const state = i < at ? "done" : i === at ? "doing" : "todo";
            return (
              <li key={s.p} className={`flex items-start gap-3 transition-opacity ${state === "todo" ? "opacity-40" : ""}`}>
                <span
                  className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-extrabold ${
                    state === "done" ? "bg-mint text-[#2a2826]" : state === "doing" ? "bg-accent text-[#2a2826]" : "bg-line text-muted"
                  }`}
                >
                  {state === "done" ? "✓" : state === "doing" ? <span className="h-2 w-2 animate-blink rounded-full bg-[#2a2826]" /> : i + 1}
                </span>
                <span>
                  <span className="block font-bold">{s.label}</span>
                  {state !== "todo" && s.detail && <span className="block text-sm text-muted">{s.detail}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- review */

function Review({
  draft,
  setDraft,
  meta,
  read,
  onRestart,
}: {
  draft: OpportunityDraft;
  setDraft: (d: OpportunityDraft) => void;
  meta: Meta;
  read: PdfRead | null;
  onRestart: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gaps = campaignGaps(draft);
  const required = gaps.filter((g) => g.level === "required");
  const nice = gaps.filter((g) => g.level === "recommended");
  const ready = readiness(draft);
  const photosRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const filled = [draft.orgName, draft.title, draft.summary, draft.location.city || draft.location.virtual, draft.startDate, draft.tiers.length, draft.causes.length, draft.contact.email || draft.contact.website].filter(Boolean).length;

  const post = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/opportunities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ opportunity: { ...cleanOpportunity(draft), coverImage: draft.coverImage, gallery: draft.gallery?.length ? draft.gallery : undefined }, source: "import" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't post the campaign");
      router.push(`/opportunities/${json.id}?new=1`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      {/* Live preview */}
      <aside className="h-fit lg:sticky lg:top-28">
        <p className="eyebrow mb-3 text-muted">Live preview</p>
        <div className="overflow-hidden rounded-3xl bg-card shadow-[0_24px_50px_-28px_rgba(60,30,90,0.5)] ring-1 ring-line">
          <CoverArt id={draft.title || "new"} cause={draft.causes[0]} image={draft.coverImage} className="aspect-[16/10]" />
          <div className="p-5">
            <p className="truncate text-xs text-muted">{draft.orgName || "Your organization"}</p>
            <h3 className="mt-1 text-xl font-semibold leading-snug">{draft.title || "Your campaign name"}</h3>
            <p className="mt-1 text-sm text-muted">
              {[draft.location.virtual ? "Virtual" : [draft.location.city, draft.location.state].filter(Boolean).join(", "), draft.startDate].filter(Boolean).join(" · ") || "Where & when"}
            </p>
            <p className="mt-3 line-clamp-4 text-sm">{draft.summary || "Your short pitch appears here."}</p>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-line">
              <div className="bg-warm h-full w-[3%] rounded-full" />
            </div>
            <p className="mt-1.5 text-xs text-muted">$0 of {draft.goal ? money(draft.goal) : "your goal"}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {draft.tiers.slice(0, 5).map((t) => (
                <span key={t.name + t.amount} className="rounded-full bg-bg px-2 py-0.5 text-[11px] ring-1 ring-line">
                  {money(t.amount)} {t.name}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-2xl bg-card p-4 ring-1 ring-line">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-bold">Campaign {ready}% ready</span>
            <span className="text-muted">{required.length ? `${required.length} to fix` : "Ready to post"}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
            <div className={`h-full rounded-full transition-[width] duration-500 ${required.length ? "bg-accent-2" : "bg-mint"}`} style={{ width: `${ready}%` }} />
          </div>
        </div>
      </aside>

      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-brand">{meta.fileName ? `From ${meta.fileName}` : "From your pitch"}</p>
            <h2 className="display mt-2 text-3xl sm:text-4xl">Peep built your campaign</h2>
            <p className="mt-2 text-muted">
              Filled in {filled} of 8 key fields{meta.pages ? ` from ${meta.pages} page${meta.pages === 1 ? "" : "s"}` : ""}
              {read?.images.length ? ` and found ${read.images.length} photo${read.images.length === 1 ? "" : "s"}` : ""}. {meta.method === "ai" ? "Read with AI." : ""}
            </p>
          </div>
          <button type="button" className="btn-ghost" onClick={onRestart}>
            ← Use a different file
          </button>
        </div>

        {meta.warnings.length > 0 && (
          <ul className="space-y-1 rounded-2xl bg-accent-soft px-4 py-3 text-sm text-warn">
            {meta.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}

        {/* Flags */}
        <section aria-labelledby="flags-title">
          <h3 id="flags-title" className="text-2xl font-semibold">
            {required.length ? `${required.length} thing${required.length === 1 ? "" : "s"} to fix before posting` : "Nothing required is missing"}
          </h3>
          <p className="mt-1 text-sm text-muted">{required.length ? "Peep couldn't find these in your PDF. Sponsors need them to say yes." : "Your campaign has everything sponsors need."}</p>
          <div className="mt-4 space-y-3">
            {required.map((g) => (
              <Flag key={g.field} gap={g} draft={draft} setDraft={setDraft} onPhotos={() => photosRef.current?.scrollIntoView({ behavior: "smooth" })} onDetails={() => detailsRef.current?.scrollIntoView({ behavior: "smooth" })} />
            ))}
          </div>
          {nice.length > 0 && (
            <>
              <h4 className="mt-8 text-lg font-semibold">Suggestions</h4>
              <p className="text-sm text-muted">Optional, but they help sponsors decide.</p>
              <div className="mt-3 space-y-3">
                {nice.map((g) => (
                  <Flag key={g.field} gap={g} draft={draft} setDraft={setDraft} onPhotos={() => photosRef.current?.scrollIntoView({ behavior: "smooth" })} onDetails={() => detailsRef.current?.scrollIntoView({ behavior: "smooth" })} />
                ))}
              </div>
            </>
          )}
        </section>

        {/* Photos */}
        <section ref={photosRef} className="scroll-mt-28" aria-labelledby="photos-title">
          <Photos draft={draft} setDraft={setDraft} read={read} />
        </section>

        {/* Every field */}
        <section ref={detailsRef} className="card scroll-mt-28 p-6" aria-label="All campaign details">
          <OpportunityForm value={draft} onChange={setDraft} />
        </section>

        <div className="glass sticky bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-2xl p-3">
          <button type="button" className="btn-primary px-6 py-3 text-base" disabled={busy || required.length > 0} onClick={post}>
            {busy ? "Posting…" : required.length ? `Fix ${required.length} thing${required.length === 1 ? "" : "s"} to post` : "Post campaign · free"}
          </button>
          <p className="text-sm text-muted">
            {required.length
              ? "Fill in the flagged fields above and this unlocks."
              : nice.length
                ? `${nice.length} optional suggestion${nice.length === 1 ? "" : "s"} left. You can post now and add them later.`
                : "Everything's in place."}
          </p>
          {error && <p className="w-full text-sm font-semibold text-bad">{error}</p>}
        </div>
      </div>
    </div>
  );
}

function Flag({ gap, draft, setDraft, onPhotos, onDetails }: { gap: Gap; draft: OpportunityDraft; setDraft: (d: OpportunityDraft) => void; onPhotos: () => void; onDetails: () => void }) {
  const set = (patch: Partial<OpportunityDraft>) => setDraft({ ...draft, ...patch });
  const [tierName, setTierName] = useState("");
  const [tierAmount, setTierAmount] = useState("");
  const req = gap.level === "required";

  let fix: React.ReactNode = null;
  switch (gap.field) {
    case "orgName":
    case "title":
      fix = <input className="field" aria-label={gap.label} value={draft[gap.field]} onChange={(e) => set({ [gap.field]: e.target.value })} />;
      break;
    case "summary":
      fix = <textarea className="field min-h-24" aria-label={gap.label} value={draft.summary} onChange={(e) => set({ summary: e.target.value })} />;
      break;
    case "email":
      fix = <input type="email" className="field" aria-label={gap.label} placeholder="you@yourorg.org" value={draft.contact.email ?? ""} onChange={(e) => set({ contact: { ...draft.contact, email: e.target.value } })} />;
      break;
    case "startDate":
      fix = <input type="date" className="field" aria-label={gap.label} value={draft.startDate ?? ""} onChange={(e) => set({ startDate: e.target.value || undefined, endDate: undefined })} />;
      break;
    case "ein":
      fix = <input className="field" aria-label={gap.label} placeholder="12-3456789" value={draft.ein ?? ""} onChange={(e) => set({ ein: e.target.value || undefined })} />;
      break;
    case "location":
      fix = (
        <div className="grid gap-2 sm:grid-cols-[1fr_120px_auto] sm:items-center">
          <input className="field" aria-label="City" placeholder="City" value={draft.location.city ?? ""} onChange={(e) => set({ location: { ...draft.location, city: e.target.value, virtual: false } })} />
          <select className="field" aria-label="State" value={draft.location.state ?? ""} onChange={(e) => set({ location: { ...draft.location, state: e.target.value || undefined, virtual: false } })}>
            <option value="">State</option>
            {Object.keys(US_STATES).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!draft.location.virtual} onChange={(e) => set({ location: e.target.checked ? { virtual: true } : {} })} /> Virtual
          </label>
        </div>
      );
      break;
    case "goal":
      fix = (
        <div className="flex flex-wrap gap-2">
          <input type="number" min={0} className="field max-w-48" aria-label={gap.label} placeholder="Goal in USD" value={draft.goal ?? ""} onChange={(e) => set({ goal: e.target.value ? Number(e.target.value) : undefined })} />
          {gap.suggestion && (
            <button type="button" className="btn-secondary" onClick={() => set({ goal: gap.suggestion })}>
              Use {money(gap.suggestion)}
            </button>
          )}
        </div>
      );
      break;
    case "tiers":
      fix = (
        <div className="flex flex-wrap gap-2">
          <input className="field max-w-56" aria-label="Tier name" placeholder="Gold Sponsor" value={tierName} onChange={(e) => setTierName(e.target.value)} />
          <input type="number" min={0} className="field max-w-36" aria-label="Tier amount" placeholder="$5,000" value={tierAmount} onChange={(e) => setTierAmount(e.target.value)} />
          <button
            type="button"
            className="btn-secondary"
            disabled={!Number(tierAmount)}
            onClick={() => {
              set({ tiers: [...draft.tiers, { name: tierName || `${money(Number(tierAmount))} level`, amount: Number(tierAmount), benefits: [] }] });
              setTierName("");
              setTierAmount("");
            }}
          >
            Add tier
          </button>
        </div>
      );
      break;
    case "cover":
      fix = (
        <button type="button" className="btn-secondary" onClick={onPhotos}>
          Choose a photo ↓
        </button>
      );
      break;
    default:
      fix = (
        <button type="button" className="btn-secondary" onClick={onDetails}>
          Add it below ↓
        </button>
      );
  }

  return (
    <div className={`animate-pop rounded-2xl p-4 ring-1 ${req ? "bg-card ring-accent/50" : "bg-card ring-line"}`}>
      <div className="flex items-start gap-3">
        <span aria-hidden className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-extrabold ${req ? "bg-accent text-[#2a2826]" : "bg-sky-soft text-sky"}`}>
          {req ? "!" : "+"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">
            {gap.label} <span className="sr-only">{req ? "(required)" : "(suggested)"}</span>
          </p>
          <p className="text-sm text-muted">{gap.hint}</p>
          <div className="mt-3">{fix}</div>
        </div>
      </div>
    </div>
  );
}

function Photos({ draft, setDraft, read }: { draft: OpportunityDraft; setDraft: (d: OpportunityDraft) => void; read: PdfRead | null }) {
  const [uploads, setUploads] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const photos = [...(read?.images ?? []), ...uploads];
  const pages = read?.thumbs ?? [];
  const gallery = draft.gallery ?? [];
  const toggleGallery = (src: string) =>
    setDraft({ ...draft, gallery: gallery.includes(src) ? gallery.filter((g) => g !== src) : [...gallery, src].slice(0, 6) });

  const tile = (src: string, caption: string) => {
    const isCover = draft.coverImage === src;
    return (
      <div key={src.slice(-40) + caption} className={`overflow-hidden rounded-2xl bg-card ring-2 ${isCover ? "ring-accent" : "ring-line"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={caption} className="aspect-[4/3] w-full object-cover" />
        <div className="flex items-center justify-between gap-2 p-2 text-xs">
          <button type="button" className={`rounded-full px-2.5 py-1 font-bold ${isCover ? "bg-accent text-[#2a2826]" : "bg-bg ring-1 ring-line hover:ring-ink/30"}`} onClick={() => setDraft({ ...draft, coverImage: src, gallery: gallery.filter((g) => g !== src) })}>
            {isCover ? "★ Cover" : "Make cover"}
          </button>
          {!isCover && (
            <label className="flex items-center gap-1.5 text-muted">
              <input type="checkbox" checked={gallery.includes(src)} onChange={() => toggleGallery(src)} /> Gallery
            </label>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <h3 id="photos-title" className="text-2xl font-semibold">
        Photos from your PDF
      </h3>
      <p className="mt-1 text-sm text-muted">
        {photos.length ? "Peep picked a cover. Swap it, or add more to the gallery." : pages.length ? "No photos were embedded, but you can use a page or upload one." : "Upload a photo for your campaign."}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((src, i) => tile(src, i < (read?.images.length ?? 0) ? `Photo ${i + 1} from the PDF` : "Uploaded photo"))}
        {!photos.length && pages.map((src, i) => tile(src, `Page ${i + 1}`))}
        <button type="button" onClick={() => input.current?.click()} className="grid aspect-[4/3] place-items-center rounded-2xl border-2 border-dashed border-line text-sm font-bold text-muted hover:border-sky hover:text-ink">
          + Upload a photo
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        aria-label="Upload a photo"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const { imageFileToJpeg } = await import("@/lib/pdf-read");
          const url = await imageFileToJpeg(f);
          setUploads((u) => [...u, url]);
          if (!draft.coverImage) setDraft({ ...draft, coverImage: url });
        }}
      />
    </div>
  );
}
