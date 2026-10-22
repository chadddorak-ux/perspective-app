/**
 * Tucks secondary detail behind a tap: a small "show more" disclosure built
 * on <details>, so it works without JavaScript and in both builds.
 */
export function More({ label, openLabel, children, className = "" }: { label: string; openLabel?: string; children: React.ReactNode; className?: string }) {
  return (
    <details className={`group/more ${className}`}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full py-1 text-sm font-bold text-brand hover:underline [&::-webkit-details-marker]:hidden">
        <span className="group-open/more:hidden">{label}</span>
        <span className="hidden group-open/more:inline">{openLabel ?? "Show less"}</span>
        <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3 transition-transform group-open/more:rotate-180">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
