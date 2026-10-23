"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { svgDataUrl } from "@/lib/brand-kit";
import type { BrandKit } from "@/lib/types";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Copy text with a short "Copied" confirmation. */
export function CopyButton({ text, label = "Copy", className = "text-xs font-bold text-brand hover:underline" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked: the text is on screen to select */
        }
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}

/** One brand's kit, the way a nonprofit it funds sees it: files to download, words to copy, rules to follow. */
export function KitDownloads({ name, kit, compact = false }: { name: string; kit: BrandKit; compact?: boolean }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["Logo mark (SVG)", kit.mark, "mark"],
            ["Wordmark (SVG)", kit.wordmark, "wordmark"],
          ] as const
        ).map(([label, svg, part]) => (
          <a key={part} href={svgDataUrl(svg)} download={`${slug(name)}-${part}.svg`} className="group rounded-2xl bg-white p-3 ring-1 ring-line transition hover:ring-ink/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={svgDataUrl(svg)} alt={`${name} ${part}`} className={`mx-auto ${part === "mark" ? "h-12 w-12" : "h-12 w-full object-contain"}`} />
            <span className="mt-2 block text-center text-[11px] font-bold text-[#2a2826] group-hover:underline">{label} ↓</span>
          </a>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {kit.colors.map((c) => (
          <span key={c.hex} className="inline-flex items-center gap-1.5 rounded-full bg-bg px-2 py-1 text-[11px] font-semibold ring-1 ring-line">
            <span className="h-3 w-3 rounded-full ring-1 ring-black/10" style={{ background: c.hex }} />
            {c.hex}
          </span>
        ))}
      </div>
      {!compact && (
        <>
          <div className="rounded-xl bg-bg p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="eyebrow text-[9px] text-muted">Boilerplate</span>
              <CopyButton text={kit.boilerplate} />
            </div>
            <p className="mt-1 text-muted">{kit.boilerplate}</p>
          </div>
          {kit.tagline && (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-bg p-3 text-xs">
              <span>
                <span className="eyebrow block text-[9px] text-muted">Approved tagline</span>
                {kit.tagline}
              </span>
              <CopyButton text={kit.tagline} />
            </div>
          )}
          <ul className="space-y-1 text-[11px] text-muted">
            {kit.rules.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** The nonprofit shows where a backer's logo went; the brand approves with a click. */
export function ProofUpload({ pledgeId }: { pledgeId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const image = await shrink(file);
      const res = await fetch(`/api/pledges/${pledgeId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "proof", image }) });
      if (!res.ok) throw new Error((await res.json()).error ?? "Couldn't upload");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };
  return (
    <label className="inline-flex cursor-pointer flex-col text-xs font-bold text-brand hover:underline">
      <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      {busy ? "Uploading…" : "+ Placement photo"}
      {error && <span className="font-normal text-bad">{error}</span>}
    </label>
  );
}

/** Downscale a photo to a ~1200px JPEG data URL before it travels. */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => bad(new Error("That file isn't an image"));
      i.src = url;
    });
    const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}
