"use client";

import { useEffect, useState } from "react";
import { directPitch, introEmail, optInAsk, type Draft } from "@/lib/outreach";
import type { MatchResult, Opportunity, SponsorProfile } from "@/lib/types";

const KINDS = {
  pitch: { label: "Direct pitch", hint: "From the organization to the sponsor", make: directPitch },
  optin: { label: "Ask before intro", hint: "Connector checks the sponsor wants the intro (double opt-in)", make: optInAsk },
  intro: { label: "Make the intro", hint: "Once both sides have said yes", make: introEmail },
} as const;
type Kind = keyof typeof KINDS;

export function OutreachModal({
  opp,
  sponsor,
  match,
  initial = "pitch",
  onClose,
}: {
  opp: Opportunity;
  sponsor: SponsorProfile;
  match: MatchResult;
  initial?: Kind;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<Kind>(initial);
  const [draft, setDraft] = useState<Draft>(() => KINDS[initial].make(opp, sponsor, match));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copy = async () => {
    await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className="card flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-semibold">Draft outreach · {sponsor.name}</h2>
          <button onClick={onClose} className="btn-ghost px-2 py-1" aria-label="Close">✕</button>
        </div>
        <div className="flex gap-1 border-b border-line px-5 pt-3">
          {(Object.keys(KINDS) as Kind[]).map((k) => (
            <button
              key={k}
              onClick={() => {
                setKind(k);
                setDraft(KINDS[k].make(opp, sponsor, match));
              }}
              className={`-mb-px border-b-2 px-3 pb-2 text-sm ${k === kind ? "border-accent font-semibold text-ink" : "border-transparent text-muted"}`}
            >
              {KINDS[k].label}
            </button>
          ))}
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          <p className="hint">{KINDS[kind].hint}. Edit freely — nothing is sent from here.</p>
          <input className="field font-medium" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
          <textarea
            className="field min-h-[320px] font-mono text-[13px] leading-relaxed"
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <a className="btn-secondary" href={`mailto:?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`}>
            Open in email
          </a>
          <button className="btn-primary" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
        </div>
      </div>
    </div>
  );
}
