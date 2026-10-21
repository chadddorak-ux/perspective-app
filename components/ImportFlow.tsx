"use client";

import { useState } from "react";
import type { ExtractResult } from "@/lib/extract";
import { OpportunityMatcher } from "./OpportunityMatcher";

async function toBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function ImportFlow({ aiEnabled, examples }: { aiEnabled: boolean; examples: { label: string; text: string }[] }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);

  const extract = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, pdfBase64: file ? await toBase64(file) : undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setResult(json);
    } catch (e) {
      setError((e as Error).message || "Couldn't read that pitch");
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-6">
        <div className="card flex flex-wrap items-start gap-4 p-5">
          <div className="flex-1">
            <p className="font-semibold">
              Here’s the listing we pulled out {result.method === "ai" ? "with AI" : "with our parser"} — check it, then find sponsors.
            </p>
            {result.warnings.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-warn">
                {result.warnings.map((w) => <li key={w}>! {w}</li>)}
              </ul>
            )}
          </div>
          <button className="btn-ghost" onClick={() => setResult(null)}>← Start over</button>
        </div>
        <OpportunityMatcher initial={result.draft} source="import" />
      </div>
    );
  }

  return (
    <div className="card max-w-3xl space-y-4 p-6">
      <label className="block">
        <span className="label">Paste the email or pitch</span>
        <textarea
          className="field min-h-72 text-sm leading-relaxed"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the pitch email, sponsorship one-pager, or the text of a sponsorship deck…"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <label className="btn-secondary cursor-pointer">
          <input type="file" accept="application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {file ? `📎 ${file.name}` : "Attach sponsorship PDF"}
        </label>
        {file && <button className="btn-ghost" onClick={() => setFile(null)}>Remove</button>}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Try an example:</span>
        {examples.map((ex) => (
          <button key={ex.label} className="rounded-full border border-line px-3 py-1 hover:border-brand" onClick={() => setText(ex.text)}>
            {ex.label}
          </button>
        ))}
      </div>
      {!aiEnabled && (
        <p className="hint">
          Running without an AI key: we’ll use the built-in parser. For best results with PDFs, set <code>ANTHROPIC_API_KEY</code>, or paste the package text along with the email.
        </p>
      )}
      {error && <p className="text-sm text-bad">{error}</p>}
      <button className="btn-primary" onClick={extract} disabled={busy || (!text.trim() && !file)}>
        {busy ? "Reading…" : "Turn into a listing"}
      </button>
    </div>
  );
}
