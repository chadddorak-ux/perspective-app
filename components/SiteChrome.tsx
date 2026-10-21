import Link from "next/link";
import { LogoMark, Shape } from "./Shapes";

const NAV = [
  { href: "/find", label: "Start", mobileOnly: true },
  { href: "/opportunities", label: "Discover" },
  { href: "/give", label: "For sponsors" },
  { href: "/import", label: "Import a pitch" },
  { href: "/sponsors", label: "Sponsors" },
  { href: "/intros", label: "Intros" },
];

export function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-2 font-display text-xl font-bold tracking-tight" aria-label="Perspective home">
      <LogoMark className="h-8 w-8" />
      perspective
    </Link>
  );
}

/** Header, page frame and footer, shared by the Next app and the static build. */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="site-header sticky top-0 z-30 border-b border-line/70 bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Logo />
          <nav className="-mx-1 flex flex-1 gap-0.5 overflow-x-auto sm:justify-center">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 font-display text-sm font-medium text-muted transition-colors hover:bg-card hover:text-ink ${
                  "mobileOnly" in n ? "text-brand sm:hidden" : ""
                }`}
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
      <footer className="relative z-10 overflow-hidden border-t border-line bg-card">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div className="max-w-sm">
              <Logo />
              <p className="mt-3 text-sm text-muted">Sponsorship matching for every cause. Nonprofits post campaigns; brands, foundations and donors find the ones that fit and pledge.</p>
            </div>
            <div aria-hidden className="flex items-end gap-2">
              <Shape kind="half" color="coral" className="h-14 w-14" />
              <Shape kind="square" color="sun" className="h-10 w-10" />
              <Shape kind="circle" color="sky" className="h-16 w-16" />
              <Shape kind="quarter" color="mint" rotate={90} className="h-12 w-12" />
              <Shape kind="triangle" color="blush" className="h-14 w-14" />
            </div>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-xs text-muted">
            <span>Perspective prototype</span>
            <span>EAGLES SOAR is a real campaign. All other organizations and sponsors are fictional and labeled “Sample”.</span>
          </div>
        </div>
      </footer>
    </>
  );
}
