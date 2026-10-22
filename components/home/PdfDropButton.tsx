"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { setPendingUpload } from "@/lib/pending-upload";
import { PdfIcon } from "../PdfImport";
import { PeepMark } from "../Peep";

/**
 * The hero's main call to action: upload a pitch PDF. A PDF dragged anywhere
 * over the page can be dropped too. Either way the file goes straight to the
 * import tool, which starts reading it.
 */
/** Only one button per page should `catchDrops`, so a dropped file is handled once. */
export function PdfDropButton({ className = "", tone = "dark", catchDrops = true }: { className?: string; tone?: "dark" | "light"; catchDrops?: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const take = (file: File | undefined) => {
    if (!file) return;
    setPendingUpload(file);
    router.push("/import");
  };

  useEffect(() => {
    if (!catchDrops) return;
    let depth = 0;
    const hasFile = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFile(e)) return;
      depth++;
      setDragging(true);
    };
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const over = (e: DragEvent) => hasFile(e) && e.preventDefault();
    const drop = (e: DragEvent) => {
      if (!hasFile(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      take(e.dataTransfer?.files[0]);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, [catchDrops]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <button type="button" className={`${tone === "light" ? "btn-primary" : "btn-bright"} group ${className}`} onClick={() => input.current?.click()}>
        <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5 transition-transform group-hover:-translate-y-0.5">
          <path d="M10 13V3m0 0L6 7m4-4 4 4M4 13v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Upload your pitch PDF
      </button>
      <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" aria-label="Upload your pitch PDF" onChange={(e) => take(e.target.files?.[0])} />
      {dragging && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#1b1236]/60 p-6 backdrop-blur-sm" aria-hidden>
          <div className="animate-pop grid w-full max-w-lg place-items-center rounded-[32px] border-2 border-dashed border-white/70 bg-white/10 p-12 text-center text-white">
            <div className="relative">
              <PdfIcon className="h-24 w-20" />
              <PeepMark className="animate-float absolute -bottom-4 -right-12 h-14 w-16" />
            </div>
            <p className="display mt-6 text-4xl">Drop it here</p>
            <p className="mt-2 text-white/80">Peep will turn it into your campaign.</p>
          </div>
        </div>
      )}
    </>
  );
}
