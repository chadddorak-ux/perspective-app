"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PeepMark } from "./Peep";

const LEFT = [
  { href: "/opportunities", label: "Discover" },
  { href: "/give", label: "For sponsors" },
  { href: "/import", label: "Import a pitch" },
];
const RIGHT = [
  { href: "/sponsors", label: "Sponsors" },
  { href: "/intros", label: "Intros" },
];

export function Logo({ onDark = false }: { onDark?: boolean }) {
  return (
    <Link href="/" className={`group flex items-center gap-1.5 font-display text-[1.35rem] font-semibold tracking-tight ${onDark ? "text-white" : "text-ink"}`} aria-label="Perspective home">
      <PeepMark className="h-8 w-10" />
      perspective
    </Link>
  );
}

/**
 * The floating two-pill header. Over a dark scene (anything marked
 * data-nav-dark) it turns to smoky glass with light text.
 */
export function SiteNav() {
  const path = usePathname();
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [path]);

  useEffect(() => {
    let raf = 0;
    const check = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = 44;
        const over = [...document.querySelectorAll("[data-nav-dark]")].some((el) => {
          const r = el.getBoundingClientRect();
          return r.top <= y && r.bottom >= y;
        });
        setDark(over);
      });
    };
    check();
    const mo = new MutationObserver(check);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [path]);

  const pill = dark ? "glass-dark text-white/90" : "glass text-ink";
  const link = `rounded-full px-3 py-1.5 text-[15px] font-semibold transition-colors ${dark ? "hover:bg-white/10 hover:text-white" : "hover:bg-black/5"}`;
  const active = (href: string) => (path === href || path.startsWith(`${href}/`) ? (dark ? "text-white" : "text-brand") : "");

  return (
    <header className="site-header fixed inset-x-0 z-40 px-3 pt-3 sm:px-6 sm:pt-5">
      <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-3">
        <nav className={`flex items-center gap-1 rounded-2xl py-1.5 pl-3 pr-1.5 ${pill}`} aria-label="Main">
          <Logo onDark={dark} />
          <span aria-hidden className={`mx-2 hidden h-5 w-px lg:block ${dark ? "bg-white/20" : "bg-black/10"}`} />
          {LEFT.map((n) => (
            <Link key={n.href} href={n.href} className={`${link} hidden lg:block ${active(n.href)}`}>
              {n.label}
            </Link>
          ))}
        </nav>
        <nav className={`flex items-center gap-1 rounded-2xl p-1.5 ${pill}`} aria-label="Account">
          {RIGHT.map((n) => (
            <Link key={n.href} href={n.href} className={`${link} hidden md:block ${active(n.href)}`}>
              {n.label}
            </Link>
          ))}
          <Link href="/find" className={`${dark ? "btn-bright" : "btn-primary"} group hidden px-4 py-2 sm:inline-flex`}>
            Start a campaign
            <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
          <button
            type="button"
            className={`grid h-9 w-9 place-items-center rounded-xl lg:hidden ${dark ? "hover:bg-white/10" : "hover:bg-black/5"}`}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden>
              {open ? <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /> : <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
            </svg>
          </button>
        </nav>
      </div>
      {open && (
        <div id="mobile-menu" className="glass animate-pop mx-auto mt-2 max-w-[1320px] rounded-2xl p-2 lg:hidden">
          {[{ href: "/find", label: "Start a campaign" }, ...LEFT, ...RIGHT].map((n) => (
            <Link key={n.href} href={n.href} className={`block rounded-xl px-4 py-3 text-base font-semibold hover:bg-black/5 ${active(n.href)}`}>
              {n.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
