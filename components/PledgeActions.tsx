"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Action = "clear" | "acknowledge" | "revoke-kit" | "restore-kit" | "renew" | "stop-renew";

/** Small buttons that move a pledge along. In the prototype, "clear" stands in for the transfer landing. */
export function PledgeAction({ id, action, label, className = "btn-secondary px-4 py-2 text-sm" }: { id: string; action: Action; label: string; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    const body = action === "renew" ? { action: "renew", renews: true } : action === "stop-renew" ? { action: "renew", renews: false } : { action };
    const res = await fetch(`/api/pledges/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) return setError((await res.json()).error ?? "Something went wrong");
    router.refresh();
  };
  return (
    <span className="inline-flex flex-col">
      <button type="button" className={className} disabled={busy} onClick={run}>
        {busy ? "…" : label}
      </button>
      {error && <span className="mt-1 text-xs text-bad">{error}</span>}
    </span>
  );
}

export function PrintButton() {
  return (
    <button type="button" className="btn-primary px-4 py-2 text-sm print:hidden" onClick={() => window.print()}>
      Print or save as PDF
    </button>
  );
}
