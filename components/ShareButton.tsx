"use client";

import { useState } from "react";

export function ShareButton() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn-secondary w-full"
      onClick={async () => {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Link copied" : "Share campaign"}
    </button>
  );
}
