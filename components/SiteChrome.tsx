import Link from "next/link";

const NAV = [
  { href: "/find", label: "Start", mobileOnly: true },
  { href: "/opportunities", label: "Discover" },
  { href: "/give", label: "For sponsors" },
  { href: "/import", label: "Import a pitch" },
  { href: "/sponsors", label: "Sponsors" },
  { href: "/intros", label: "Intros" },
];

function Logo() {
  return (
    <svg aria-hidden viewBox="0 0 28 28" className="h-7 w-7">
      <rect width="28" height="28" fill="var(--ink)" />
      <circle cx="14" cy="14" r="7" fill="none" stroke="var(--bg)" strokeWidth="2" />
      <path d="M14 7a7 7 0 0 1 0 14z" fill="var(--accent)" />
    </svg>
  );
}

// The visible column grid behind every page. Content sits above it; empty
// space and gutters let the lines show through.
function GridLines() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
      <div className="mx-auto h-full max-w-6xl px-4">
        {[
          { cols: 4, cls: "grid grid-cols-4 md:hidden" },
          { cols: 6, cls: "hidden grid-cols-6 md:grid lg:hidden" },
          { cols: 12, cls: "hidden grid-cols-12 lg:grid" },
        ].map(({ cols, cls }) => (
          <div key={cols} className={`h-full border-r border-line/60 ${cls}`}>
            {Array.from({ length: cols }, (_, i) => (
              <div key={i} className="border-l border-line/60" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Grid, header, page frame and footer, shared by the Next app and the static build. */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GridLines />
      <header className="site-header sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link href="/" className="flex items-center gap-2.5 font-display text-lg font-semibold tracking-tight">
            <Logo />
            Perspective
          </Link>
          <nav className="-mx-2 flex flex-1 gap-0.5 overflow-x-auto">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`eyebrow whitespace-nowrap px-2.5 py-2 text-muted transition-colors hover:text-ink ${"mobileOnly" in n ? "text-brand sm:hidden" : ""}`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <Link href="/find" className="btn-primary hidden py-2 sm:inline-flex">
            Start a campaign
          </Link>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-24 pt-10">{children}</main>
      <footer className="relative z-10 border-t border-line bg-bg">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <p className="display select-none text-[18vw] font-bold leading-none text-ink/[0.06] lg:text-[11rem]">Perspective</p>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-muted">
            <span className="eyebrow">Sponsorship & donor matching · Prototype</span>
            <span>Sample organizations and sponsors are fictional and labeled as such.</span>
          </div>
        </div>
      </footer>
    </>
  );
}
