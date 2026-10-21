import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Perspective — sponsorship matching",
  description: "Match nonprofits and events with the brands and donors most likely to say yes.",
  icons: { icon: "/icon.svg" },
};

const NAV = [
  { href: "/find", label: "Find sponsors" },
  { href: "/give", label: "Find causes" },
  { href: "/import", label: "Import a pitch" },
  { href: "/opportunities", label: "Browse" },
  { href: "/intros", label: "Intros" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
              <svg aria-hidden viewBox="0 0 28 28" className="h-7 w-7">
                <rect width="28" height="28" rx="8" fill="var(--brand)" />
                <circle cx="14" cy="14" r="7" fill="none" stroke="var(--brand-ink)" strokeWidth="2" />
                <path d="M14 7a7 7 0 0 1 0 14z" fill="var(--brand-ink)" />
              </svg>
              Perspective
            </Link>
            <nav className="-mx-2 flex flex-1 gap-1 overflow-x-auto text-sm">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-md px-2 py-1.5 text-muted hover:bg-brand-soft hover:text-ink">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-24 pt-8">{children}</main>
        <footer className="border-t border-line py-8 text-center text-xs text-muted">
          Perspective prototype · Sample sponsors are fictional and labeled as such
        </footer>
      </body>
    </html>
  );
}
