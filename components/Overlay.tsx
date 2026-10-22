"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * A modal backdrop rendered straight into <body>, so no animated or sticky
 * section of the page can trap it underneath. Click outside or press Escape
 * to close.
 */
export function Overlay({ onClose, label, children }: { onClose: () => void; label?: string; children: React.ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(document.body);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!host) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/55 p-4 backdrop-blur-[2px]" onClick={onClose} role="dialog" aria-modal="true" aria-label={label}>
      {children}
    </div>,
    host,
  );
}
