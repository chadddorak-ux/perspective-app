"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Reaction } from "./scene/gremlin";
import type { StageAPI } from "./scene/stage";
import type { PeepLine } from "@/lib/peep-events";
import { guideFor } from "@/lib/peep-guide";
import { playPeep, setSoundOn, soundOn, soundReady, unlockSound, type PeepSound } from "@/lib/peep-sound";

// The stage canvas, and where Peep's feet and head sit inside it.
const BOX_W = 300;
const BOX_H = 360;
const FEET_Y = 323;
const PEEP_H = 238;
const IDLE_MS = 25_000;
const SLEEP_MS = 75_000;

const SOUND_FOR: Partial<Record<Reaction, PeepSound>> = {
  giggle: "giggle",
  spin: "squeal",
  cheer: "squeal",
  pledge: "squeal",
  mischief: "chuckle",
  angry: "grumble",
  attention: "psst",
  surprised: "eep",
  sleepy: "yawn",
  love: "purr",
  post: "grunt",
  wave: "grunt",
};

// Where the speech bubble goes. In the arch it never covers Peep: it sits
// under the hero card if there's room, else beside her.
type BubbleAt = { x: number; y: number; mode: "corner" | "anchor"; below: number; boxLeft: number };
const BUBBLE_W = 290;
const BUBBLE_H = 150;

const POKES: Reaction[] = ["giggle", "giggle", "spin", "mischief", "cheer", "surprised"];

/**
 * Peep, your campaign manager. She stands in the hero's arch when there is
 * one on screen, then hops into the corner and follows you around the site:
 * greeting you on each page, nudging you toward the next step, cheering when
 * you post or pledge, and complaining when you try to leave.
 */
export function PeepCompanion() {
  const path = usePathname();
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<StageAPI | null>(null);
  const place = useRef({ left: 0, top: 0, k: 0.5, mode: "corner" as "corner" | "anchor" });
  const [line, setLine] = useState<PeepLine | null>(null);
  const [bubbleAt, setBubbleAt] = useState<BubbleAt>({ x: 0, y: 0, mode: "corner", below: 0, boxLeft: 0 });
  const [sound, setSound] = useState(true);
  const [ready, setReady] = useState(false);
  const lineTimer = useRef(0);

  const say = (l: PeepLine | null) => {
    window.clearTimeout(lineTimer.current);
    setLine(l);
    if (l) lineTimer.current = window.setTimeout(() => setLine(null), (l.hold ?? 7) * 1000);
  };
  const react = (kind: Reaction, withSound = true) => {
    stage.current?.react(kind);
    const s = SOUND_FOR[kind];
    if (withSound && s) playPeep(s);
  };

  // Boot the stage.
  useEffect(() => {
    setSound(soundOn());
    let api: StageAPI | null = null;
    let disposed = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    import("./scene/stage")
      .then(({ createStage }) => {
        if (disposed) return;
        api = createStage(canvas.current!, { reduced });
        stage.current = api;
        api.setActive(true);
        setReady(true);
      })
      .catch((e) => console.warn("Peep couldn't start her stage.", e));
    return () => {
      disposed = true;
      api?.dispose();
      stage.current = null;
    };
  }, []);

  // Follow the hero's arch while it's on screen, otherwise sit in the corner.
  useEffect(() => {
    let raf = 0;
    let anchor: Element | null = null;
    let lastMode = "";
    let lastBubble = "";
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = wrap.current;
      if (!el) return;
      if (!anchor || !anchor.isConnected) anchor = document.querySelector("[data-peep-anchor]");
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let mode: "corner" | "anchor" = "corner";
      let below = 0;
      let k: number;
      let left: number;
      let top: number;
      const r = anchor?.getBoundingClientRect();
      const shown = r && r.height ? (Math.min(vh, r.bottom) - Math.max(0, r.top)) / r.height : 0;
      if (r && shown > 0.5) {
        mode = "anchor";
        k = (0.41 * r.height) / PEEP_H;
        left = r.left + r.width / 2 - (BOX_W / 2) * k;
        top = r.top + 0.94 * r.height - FEET_Y * k;
        // The hero's fit card hangs 48px under the arch.
        below = r.bottom + 60;
      } else {
        k = vw < 640 ? 0.34 : 0.5;
        left = vw - BOX_W * k - 16;
        top = vh - 14 - FEET_Y * k;
      }
      if (mode !== lastMode) {
        // A springy hop between spots; tracking the arch while scrolling stays instant.
        el.style.transition = lastMode ? "transform 0.7s cubic-bezier(0.3, 1.35, 0.5, 1)" : "none";
        window.setTimeout(() => {
          if (wrap.current) wrap.current.style.transition = "none";
        }, 720);
        if (lastMode === "anchor" && mode === "corner") stage.current?.react("spin");
        lastMode = mode;
      }
      el.style.transform = `translate(${left}px, ${top}px) scale(${k})`;
      place.current = { left, top, k, mode };
      const head: BubbleAt = { x: left + (BOX_W / 2) * k, y: top + (FEET_Y - PEEP_H) * k, mode, below, boxLeft: left };
      const key = `${Math.round(head.x)},${Math.round(head.y)},${Math.round(below)},${mode}`;
      if (key !== lastBubble) {
        lastBubble = key;
        setBubbleAt(head);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Petting, poking, looking.
  useEffect(() => {
    let lastMove = performance.now();
    let purrAt = 0;
    let pokes: number[] = [];
    const interactive = (t: EventTarget | null) => !!(t as Element | null)?.closest?.("a,button,input,textarea,select,label,summary");
    const onMove = (e: PointerEvent) => {
      const s = stage.current;
      if (!s) return;
      s.lookAt(e.clientX, e.clientY);
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastMove) / 1000);
      lastMove = now;
      const over = s.hit(e.clientX, e.clientY) && !interactive(e.target);
      document.body.dataset.peepHover = over ? "1" : "";
      if (over) {
        s.pet(dt);
        if (now - purrAt > 1600) {
          purrAt = now;
          playPeep("purr");
        }
      }
    };
    const onDown = (e: PointerEvent) => {
      unlockSound();
      const s = stage.current;
      if (!s || interactive(e.target) || !s.hit(e.clientX, e.clientY)) return;
      const now = performance.now();
      pokes = [...pokes.filter((p) => now - p < 3000), now];
      if (pokes.length >= 6) {
        pokes = [];
        react("angry");
        say({ text: "Hey! Okay, okay, I'm awake! 😤", hold: 3 });
        return;
      }
      const kind = POKES[Math.floor(Math.random() * POKES.length)];
      react(kind);
      if (kind === "mischief" && Math.random() < 0.5) say({ text: "Heh heh. I've got plans for your campaign.", hold: 3 });
    };
    const onKey = () => unlockSound();
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pages talk to Peep through window events.
  useEffect(() => {
    const onReact = (e: Event) => react((e as CustomEvent<Reaction>).detail);
    const onDemo = (e: Event) => react((e as CustomEvent<Reaction>).detail, false);
    const onSay = (e: Event) => {
      const l = (e as CustomEvent<PeepLine>).detail;
      say(l);
      if (l.react) react(l.react);
    };
    window.addEventListener("peep", onReact);
    window.addEventListener("peep:demo", onDemo);
    window.addEventListener("peep:say", onSay);
    return () => {
      window.removeEventListener("peep", onReact);
      window.removeEventListener("peep:demo", onDemo);
      window.removeEventListener("peep:say", onSay);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Say hello the first time you reach each page.
  useEffect(() => {
    if (!ready) return;
    const key = `peep-hello:${path.replace(/\/opportunities\/.+/, "/opportunities/:id")}`;
    let seen = false;
    try {
      seen = sessionStorage.getItem(key) === "1";
      sessionStorage.setItem(key, "1");
    } catch {
      // No storage: greet every time.
    }
    if (seen) return;
    const t = window.setTimeout(() => {
      say(guideFor(path).hello);
      react("wave", false);
    }, path === "/" ? 2200 : 900);
    return () => window.clearTimeout(t);
  }, [path, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drifted off? Peep knocks on the glass, then dozes. Leaving? She's not happy.
  useEffect(() => {
    if (!ready) return;
    const idleMs = (window as { __peepIdleMs?: number }).__peepIdleMs ?? IDLE_MS;
    let lastActive = Date.now();
    let nudged = false;
    let slept = false;
    let angryAt = 0;
    let wasAway = false;
    const active = () => {
      if (slept) {
        react("surprised");
        say({ text: "Huh? I'm up! I'm up.", hold: 2.5 });
      }
      lastActive = Date.now();
      nudged = false;
      slept = false;
    };
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      const idle = Date.now() - lastActive;
      if (!nudged && idle > idleMs) {
        nudged = true;
        react("attention", soundReady());
        say({ ...guideFor(path).idle, hold: 9 });
      } else if (!slept && idle > Math.max(SLEEP_MS, idleMs * 3)) {
        slept = true;
        react("sleepy", soundReady());
        say({ text: "Zzz… poke me when you're ready.", hold: 6 });
      }
    }, 1000);
    const onOut = (e: MouseEvent) => {
      if (e.relatedTarget || e.clientY > 4 || Date.now() - angryAt < 25_000) return;
      angryAt = Date.now();
      react("angry", soundReady());
      say({ text: "Hey! Where are you going? We're so close. 😤", hold: 4 });
    };
    const onVis = () => {
      if (document.hidden) {
        wasAway = true;
        return;
      }
      if (wasAway) {
        wasAway = false;
        react("cheer", soundReady());
        say({ text: "You're back! Let's keep going.", hold: 3.5 });
      }
      active();
    };
    const events = ["pointermove", "pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((ev) => window.addEventListener(ev, active, { passive: true }));
    document.addEventListener("mouseout", onOut);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(timer);
      events.forEach((ev) => window.removeEventListener(ev, active));
      document.removeEventListener("mouseout", onOut);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [path, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const corner = bubbleAt.mode === "corner";
  let bubbleStyle: React.CSSProperties;
  if (corner) bubbleStyle = { right: 12, bottom: `calc(100vh - ${bubbleAt.y}px + 6px)` };
  else if (typeof window !== "undefined" && bubbleAt.below + BUBBLE_H < window.innerHeight)
    bubbleStyle = { left: Math.max(12, Math.min(window.innerWidth - BUBBLE_W - 12, bubbleAt.x - BUBBLE_W / 2)), top: bubbleAt.below };
  else bubbleStyle = { left: Math.max(12, bubbleAt.boxLeft - BUBBLE_W - 8), top: Math.max(84, bubbleAt.y) };
  return (
    <>
      <div
        ref={wrap}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-40 origin-top-left"
        style={{ width: BOX_W, height: BOX_H, transform: "translate(-9999px, 0)" }}
      >
        <canvas ref={canvas} className="block h-full w-full" />
      </div>

      {line && (
        <div
          role="status"
          className="animate-pop fixed z-50 w-[min(290px,calc(100vw-24px))]"
          style={bubbleStyle}
        >
          <div className="glass relative rounded-2xl p-3.5 pr-8 text-sm text-ink">
            <p className="font-semibold leading-snug">{line.text}</p>
            {line.cta && (
              <Link href={line.cta.href} className="btn-primary mt-2.5 px-4 py-2 text-xs" onClick={() => say(null)}>
                {line.cta.label} →
              </Link>
            )}
            <button type="button" aria-label="Dismiss" className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full text-muted hover:bg-black/5" onClick={() => say(null)}>
              ×
            </button>
          </div>
        </div>
      )}

      {ready && corner && (
        <button
          type="button"
          aria-label={sound ? "Mute Peep" : "Unmute Peep"}
          title={sound ? "Mute Peep" : "Unmute Peep"}
          className="glass fixed z-50 grid h-8 w-8 place-items-center rounded-full text-xs"
          style={{ right: 12 + BOX_W * place.current.k * 0.72, bottom: 14 }}
          onClick={() => {
            unlockSound();
            setSoundOn(!sound);
            setSound(!sound);
            if (!sound) playPeep("giggle");
          }}
        >
          {sound ? "🔊" : "🔇"}
        </button>
      )}
    </>
  );
}
