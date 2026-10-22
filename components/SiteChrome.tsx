import Link from "next/link";
import { ButtonFX } from "./ButtonFX";
import { PeepCompanion } from "./PeepCompanion";
import { Logo, SiteNav } from "./SiteNav";

export { Logo };

const FOOTER_LINKS = [
  { title: "Nonprofits", links: [["/import", "Upload your pitch PDF"], ["/find", "Start a campaign"], ["/opportunities", "Discover campaigns"]] },
  { title: "Sponsors", links: [["/give", "Find your fit"], ["/sponsors", "Sponsor network"], ["/intros", "Warm intros"]] },
];

// Fixed star positions for the footer sky, so server and client agree.
const STARS = Array.from({ length: 40 }, (_, i) => ({ x: (i * 37) % 100, y: (i * 53) % 70, s: i % 5 === 0 ? 2.5 : 1.5 }));

/** Header, page frame and footer, shared by the Next app and the static build. */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ButtonFX />
      <SiteNav />
      <PeepCompanion />
      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-24 pt-28 sm:pt-32">{children}</main>
      <footer className="relative z-10 px-3 pb-3 sm:px-6 sm:pb-6" data-nav-dark>
        <div className="sky-night relative mx-auto max-w-[1320px] overflow-hidden rounded-[28px] text-white">
          <div aria-hidden className="absolute inset-0">
            {STARS.map((s, i) => (
              <span key={i} className="animate-blink absolute rounded-full bg-white" style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, animationDelay: `${(i % 7) * 0.4}s` }} />
            ))}
          </div>
          <div className="relative grid gap-10 px-6 py-12 sm:px-12 md:grid-cols-[1.4fr_1fr_1fr]">
            <div className="max-w-sm">
              <Logo onDark />
              <p className="mt-4 text-sm text-white/75">Peep is your sponsorship campaign manager. Nonprofits post polished campaigns free; brands and donors with verified funds back the ones that fit, and get their tax paperwork without the back-and-forth.</p>
            </div>
            {FOOTER_LINKS.map((col) => (
              <div key={col.title}>
                <p className="eyebrow text-white/60">{col.title}</p>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map(([href, label]) => (
                    <li key={href}>
                      <Link href={href} className="text-sm font-semibold text-white/90 hover:text-white">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="relative border-t border-white/10 px-6 py-5 text-xs text-white/60 sm:px-12">
            EAGLES SOAR is a real campaign. All other organizations and sponsors are fictional and labeled “Sample”.
          </div>
        </div>
      </footer>
    </>
  );
}
