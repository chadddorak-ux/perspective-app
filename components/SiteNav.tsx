"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PeepMark } from "./Peep";

// Visitors are nonprofits first; everything for sponsors lives in one menu.
const LEFT = [
  { href: "/import", label: "Upload a PDF" },
  { href: "/opportunities", label: "Discover" },
];
const SPONSOR_LINKS = [
  { href: "/give", label: "Find campaigns to back", note: "Ranked by fit with your goals" },
  { href: "/sponsors", label: "Sponsor network", note: "Brands, foundations and donors" },
  { href: "/intros", label: "Warm intros", note: "Double opt-in introductions" },
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
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
    setMenu(false);
  }, [path]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menu]);

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
          <div ref={menuRef} className="relative hidden lg:block">
            <button
              type="button"
              className={`${link} flex items-center gap-1 ${SPONSOR_LINKS.some((n) => active(n.href)) ? (dark ? "text-white" : "text-brand") : ""}`}
              aria-expanded={menu}
              aria-haspopup="true"
              onClick={() => setMenu((m) => !m)}
            >
              For sponsors
              <svg aria-hidden viewBox="0 0 12 12" className={`h-3 w-3 transition-transform ${menu ? "rotate-180" : ""}`}>
                <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {menu && (
              <div className="glass animate-pop absolute left-0 top-full mt-3 w-72 rounded-2xl p-2 text-ink">
                {SPONSOR_LINKS.map((n) => (
                  <Link key={n.href} href={n.href} className={`block rounded-xl px-3 py-2.5 hover:bg-black/5 ${active(n.href)}`}>
                    <span className="block text-[15px] font-bold">{n.label}</span>
                    <span className="block text-xs text-muted">{n.note}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>
        <nav className={`flex items-center gap-1 rounded-2xl p-1.5 ${pill}`} aria-label="Get started">
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
          {[{ href: "/find", label: "Start a campaign" }, ...LEFT].map((n) => (
            <Link key={n.href} href={n.href} className={`block rounded-xl px-4 py-3 text-base font-semibold hover:bg-black/5 ${active(n.href)}`}>
              {n.label}
            </Link>
          ))}
          <p className="eyebrow mt-2 border-t border-line px-4 pb-1 pt-4 text-muted">For sponsors</p>
          {SPONSOR_LINKS.map((n) => (
            <Link key={n.href} href={n.href} className={`block rounded-xl px-4 py-2.5 text-base font-semibold hover:bg-black/5 ${active(n.href)}`}>
              {n.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
