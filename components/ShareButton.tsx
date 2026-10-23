"use client";

import { useState } from "react";

export function ShareButton({ className = "w-full" }: { className?: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <button
      className={`btn-secondary ${className}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
        } catch {
          setFailed(true);
        }
        setTimeout(() => {
          setCopied(false);
          setFailed(false);
        }, 2000);
      }}
    >
      {copied ? "Link copied" : failed ? "Copy the link from your address bar" : "Share campaign"}
    </button>
  );
}
