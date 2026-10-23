import Link from "next/link";
import { CauseArt, LOOKS, type ArtTheme } from "../CauseArt";
import { Reveal } from "../Motion";
import { PeepMark } from "../Peep";
import { Arrow, Scribble } from "../ui";

// "Why Peep": one panel per side of the table. Each has a big statement, a
// picture of the promise (a messy deck turned into a polished one-pager; a
// tax receipt that arrives on its own) and four short points.

export type WhyData = {
  campaign: { title: string; org: string; when: string; where: string; theme: ArtTheme };
  receipt: { sponsor: string; org: string; amount: string; tier: string };
};

type Icon = "inbox" | "page" | "pencil" | "tag" | "wallet" | "target" | "send" | "receipt";
const ICONS: Record<Icon, string> = {
  inbox: "M4 13l2.5-7.5A2 2 0 0 1 8.4 4h7.2a2 2 0 0 1 1.9 1.5L20 13M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5M4 13h4l1.5 3h5L16 13h4",
  page: "M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm7 0v5h5M9 13h6M9 17h4",
  pencil: "M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20ZM14 7l3 3",
  tag: "M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Zm5-4.5h.01",
  wallet: "M4 7a2 2 0 0 1 2-2h11v4M4 7v10a2 2 0 0 0 2 2h13V9H6a2 2 0 0 1-2-2Zm12 7h.01",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  send: "M21 3 10 14M21 3l-7 18-4-7-7-4 18-7Z",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6M9 16h3",
};

function Glyph({ name }: { name: Icon }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name]} />
    </svg>
  );
}

function Panel({
  tone,
  flip = false,
  eyebrow,
  title,
  lede,
  visual,
  points,
  cta,
  aside,
}: {
  tone: "mint" | "sky";
  flip?: boolean;
  eyebrow: string;
  title: React.ReactNode;
  lede: string;
  visual: React.ReactNode;
  points: [Icon, string, string][];
  cta: { href: string; label: string };
  aside?: string;
}) {
  const ink = tone === "mint" ? "text-good" : "text-sky";
  const tile = tone === "mint" ? "bg-mint text-[#1d3b31]" : "bg-sky text-white";
  return (
    <Reveal className={`relative overflow-hidden rounded-[36px] ring-1 ring-line ${tone === "mint" ? "bg-mint-soft" : "bg-sky-soft"}`}>
      <div aria-hidden className="absolute inset-0 opacity-60 [background-image:radial-gradient(var(--line)_1.2px,transparent_1.2px)] [background-size:22px_22px]" />
      <div className="relative grid gap-8 p-6 sm:p-12 lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:gap-x-14 lg:gap-y-8 [&>*]:min-w-0">
        <div className={flip ? "lg:col-start-2 lg:row-start-1" : "lg:col-start-1 lg:row-start-1"}>
          <p className={`eyebrow ${ink}`}>{eyebrow}</p>
          <h2 className="display mt-4 text-[clamp(2.6rem,5.2vw,4.6rem)] leading-[0.95]">{title}</h2>
          <p className="mt-5 max-w-md text-lg text-muted sm:text-xl">{lede}</p>
        </div>
        {/* On phones the picture sits right under the headline; on wide screens it gets its own column. */}
        <div className={`self-center ${flip ? "lg:col-start-1 lg:row-span-2 lg:row-start-1" : "lg:col-start-2 lg:row-span-2 lg:row-start-1"}`}>{visual}</div>
        <div className={flip ? "lg:col-start-2 lg:row-start-2" : "lg:col-start-1 lg:row-start-2"}>
          <ul className="grid grid-cols-2 gap-2.5 sm:gap-3 [&>*]:min-w-0">
            {points.map(([icon, head, body]) => (
              <li key={head} className="rounded-2xl bg-card/80 p-3.5 ring-1 ring-line backdrop-blur-sm sm:p-4">
                <span className={`grid h-9 w-9 place-items-center rounded-xl ${tile}`}>
                  <Glyph name={icon} />
                </span>
                <p className="mt-3 font-bold leading-tight">{head}</p>
                <p className="mt-1 text-sm leading-snug text-muted">{body}</p>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link href={cta.href} className="btn-primary group px-6 py-3.5 text-base">
              {cta.label} <Arrow />
            </Link>
            {aside && <p className="max-w-[16rem] text-sm text-muted">{aside}</p>}
          </div>
        </div>
      </div>
    </Reveal>
  );
}

/** A messy deck on the left, the polished one-pager Peep made from it on the right. */
function LevelVisual({ c }: { c: WhyData["campaign"] }) {
  const look = LOOKS[c.theme];
  return (
    <div className="relative mx-auto flex max-w-[520px] items-center justify-center gap-3 py-4 sm:gap-6">
      {/* Before: a homemade deck */}
      <div className="w-[38%] shrink-0 -rotate-6 rounded-xl bg-[#f4f1ea] p-3 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.55)] ring-1 ring-black/5">
        <div className="h-3 w-4/5 rounded bg-[#d9524f]" />
        <div className="mt-1.5 h-2 w-3/5 rounded bg-[#3b6fd8]" />
        <div className="mt-3 grid grid-cols-3 gap-1">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className="h-5 rounded-sm" style={{ background: ["#f2c94c", "#9b51e0", "#27ae60", "#eb5757", "#2d9cdb", "#f2994a"][i] }} />
          ))}
        </div>
        {[90, 75, 95, 60].map((w, i) => (
          <span key={i} className="mt-1.5 block h-1.5 rounded-full bg-[#c9c2b4]" style={{ width: `${w}%` }} />
        ))}
        <p className="mt-2 truncate font-mono text-[9px] text-[#8a8478]">deck-FINAL-v7.pdf</p>
      </div>

      {/* Peep does the work */}
      <div className="flex shrink-0 flex-col items-center gap-1">
        <span className="animate-float grid h-12 w-12 place-items-center rounded-full bg-card shadow-lg ring-1 ring-line">
          <PeepMark className="h-8 w-9" />
        </span>
        <svg viewBox="0 0 40 12" className="h-3 w-10 text-brand" aria-hidden>
          <path d="M1 6h34m-6-5 6 5-6 5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* After: a Peep one-pager */}
      <div className="w-[46%] shrink-0 rotate-3 overflow-hidden rounded-2xl bg-card shadow-[0_24px_50px_-20px_rgba(0,0,0,0.6)] ring-1 ring-line">
        <CauseArt theme={c.theme} crop="center" className="h-24 sm:h-32" />
        <div className="p-3">
          <p className="flex items-center gap-1">
            <PeepMark className="h-3 w-3.5" />
            <span className="eyebrow text-[8px] text-muted">A Peep one-pager</span>
          </p>
          <p className="display mt-1.5 line-clamp-2 text-[0.95rem] font-semibold leading-tight sm:text-lg">{c.title}</p>
          <p className="mt-1 truncate text-[10px] text-muted">by {c.org}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="rounded-full bg-bg px-2 py-0.5 text-[9px] font-semibold ring-1 ring-line">{c.when}</span>
            <span className="rounded-full bg-bg px-2 py-0.5 text-[9px] font-semibold ring-1 ring-line">{c.where}</span>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-bg">
            <div className="h-full w-2/3 rounded-full" style={{ background: `linear-gradient(90deg, ${look.sky[1]}, ${look.accent})` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** The receipt that shows up on its own once the transfer clears. */
function ReceiptVisual({ r }: { r: WhyData["receipt"] }) {
  return (
    <div className="relative mx-auto max-w-[420px] py-4">
      {/* The budget it came out of */}
      <div className="absolute -top-1 right-0 z-10 w-[58%] rotate-3 rounded-2xl bg-card p-3 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.55)] ring-1 ring-line sm:-right-4">
        <p className="eyebrow text-[9px] text-muted">Giving budget · 2027</p>
        <p className="mt-1 text-sm font-bold">$60K of $100K given</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg">
          <div className="h-full w-[60%] rounded-full bg-sky" />
        </div>
      </div>
      <div className="relative mt-14 -rotate-2 rounded-2xl bg-[#fffdf8] p-5 pb-6 text-[#2a2826] shadow-[0_28px_60px_-24px_rgba(0,0,0,0.65)]">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-display text-lg font-semibold">
            <PeepMark className="h-6 w-7" /> peep
          </span>
          <span className="font-mono text-[10px] text-[#8a8478]">No. 2027-0412</span>
        </div>
        <p className="mt-4 eyebrow text-[10px] text-[#8a8478]">Donation receipt</p>
        <p className="font-display text-4xl font-semibold">{r.amount}</p>
        <dl className="mt-3 space-y-1.5 text-xs">
          {[
            ["From", r.sponsor],
            ["To", r.org],
            ["For", r.tier],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-3">
              <dt className="w-10 shrink-0 text-[#8a8478]">{k}</dt>
              <dd className="min-w-0 truncate font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 space-y-1.5 border-t border-dashed border-[#d8d1c4] pt-3 text-xs">
          <p className="flex items-center gap-2"><span className="grid h-4 w-4 place-items-center rounded-full bg-[#49c49b] text-[9px] text-white">✓</span> Funds transferred</p>
          <p className="flex items-center gap-2"><span className="grid h-4 w-4 place-items-center rounded-full bg-[#49c49b] text-[9px] text-white">✓</span> Receipt confirmed by the nonprofit</p>
          <p className="flex items-center gap-2"><span className="grid h-4 w-4 place-items-center rounded-full bg-[#49c49b] text-[9px] text-white">✓</span> Tax paperwork ready to download</p>
        </div>
        <span className="absolute -right-3 bottom-6 rotate-[-14deg] rounded-lg border-[3px] border-[#8c7cf0] px-2.5 py-1 font-display text-sm font-bold uppercase tracking-wider text-[#8c7cf0]">Verified</span>
      </div>
    </div>
  );
}

export function WhyPeep({ data }: { data: WhyData }) {
  return (
    <section className="space-y-6 pb-24" aria-label="Why Peep">
      <Panel
        tone="mint"
        eyebrow="For nonprofits"
        title={
          <>
            Level the <Scribble color="var(--mint)">playing field.</Scribble>
          </>
        }
        lede="You shouldn't need a design team to get a yes."
        visual={<LevelVisual c={data.campaign} />}
        points={[
          ["inbox", "Any pitch in", "Deck, PDF or email. Peep reads it all."],
          ["page", "One polished page", "The same clean one-pager for everyone."],
          ["pencil", "Make it yours", "Add your story and photos on top."],
          ["tag", "Posted free", "No fees, and nothing missing."],
        ]}
        cta={{ href: "/import", label: "Upload your pitch PDF" }}
      />
      <Panel
        tone="sky"
        flip
        eyebrow="For brands and donors"
        title={
          <>
            No busywork. <Scribble color="var(--sky)">Just giving.</Scribble>
          </>
        }
        lede="Set it once, pick what you care about, and Peep handles the rest."
        visual={<ReceiptVisual r={data.receipt} />}
        points={[
          ["wallet", "Set a budget", "One amount, verified up front."],
          ["target", "Pick what matters", "Causes and places you back."],
          ["receipt", "Transfer + receipt", "Proof it arrived, paperwork done."],
          ["page", "Your brand kit", "Nonprofits pull your logo files themselves."],
        ]}
        cta={{ href: "/give", label: "Find campaigns to back" }}
        aside="Say thanks and set up a call, or keep it to the essentials. Your call."
      />
    </section>
  );
}
