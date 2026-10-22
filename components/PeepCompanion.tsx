"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Reaction } from "./scene/gremlin";
import type { StageAPI } from "./scene/stage";
import type { PeepLine } from "@/lib/peep-events";
import { LINES, guideFor, pick } from "@/lib/peep-lines";
import { playPeep, setSoundOn, soundOn, soundReady, unlockSound, type PeepSound } from "@/lib/peep-sound";
import { currentTheme, useTheme } from "@/lib/theme";

// The stage canvas, and where Peep sits inside it (at scale 1). It's wide
// enough for her ears, her lantern and a good swing.
const BOX_W = 460;
const BOX_H = 360;
const FEET_Y = 323;
const UNIT = BOX_H / 4.02; // px per world unit (camera FOV 30° at z 7.5)
const HEAD_Y = FEET_Y - 1.62 * UNIT;
const EARS = 2.2 * UNIT; // half her width, ear tip to ear tip
const TOP_Y = FEET_Y - 2.75 * UNIT; // top of her head and ears
const PEEK_Y = FEET_Y - 1.32 * UNIT; // just under her eyes

const LANTERN_MS = 6_000; // no scrolling for this long and she sets the lantern down
const IDLE_MS = 25_000;
const WAIT_MS = 45_000;
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
  pop: "boing",
  sass: "mmwhat",
  impatient: "hmph",
};

const HEART_COLORS = ["#ff6b8f", "#ff8a5c", "#ff9fc4"];
const HEART_PATH = "M12 21s-7.5-4.6-9.6-9.2C.9 8.3 3 4.5 6.6 4.5c2.1 0 3.6 1.2 5.4 3.3 1.8-2.1 3.3-3.3 5.4-3.3 3.6 0 5.7 3.8 4.2 7.3C19.5 16.4 12 21 12 21Z";

/** Hearts drift up out of Peep and float away over the page. */
function floatHearts(n: number, x: number, y: number, unit: number, reduced: boolean) {
  const size = Math.max(14, Math.min(40, unit * 0.42));
  for (let i = 0; i < n; i++) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    el.setAttribute("viewBox", "0 0 24 24");
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = `<path d="${HEART_PATH}" fill="${HEART_COLORS[(i + Math.floor(Math.random() * 3)) % 3]}"/>`;
    const sx = x + (Math.random() - 0.5) * unit * 1.2 - size / 2;
    Object.assign(el.style, { position: "fixed", left: `${sx}px`, top: `${y - size / 2}px`, width: `${size}px`, height: `${size}px`, pointerEvents: "none", zIndex: "71", opacity: "0", filter: "drop-shadow(0 2px 4px rgb(255 80 130 / 0.35))" });
    document.body.appendChild(el);
    const rise = reduced ? 40 : 200 + Math.random() * 140;
    const drift = (Math.random() - 0.5) * 180;
    const wob = 14 + Math.random() * 14;
    const spin = (Math.random() - 0.5) * 50;
    const frames: Keyframe[] = [0, 0.15, 0.4, 0.65, 1].map((f, j) => ({
      offset: f,
      opacity: f === 0 ? 0 : f < 0.65 ? 1 : f === 1 ? 0 : 0.8,
      transform: `translate(${(drift * f + Math.sin(f * Math.PI * 3) * wob).toFixed(1)}px, ${(-rise * f).toFixed(1)}px) rotate(${(spin * f).toFixed(1)}deg) scale(${j === 0 ? 0.3 : j === 1 ? 1.1 : 1 - f * 0.25})`,
    }));
    const anim = el.animate(frames, { duration: reduced ? 900 : 2100 + Math.random() * 700, delay: i * 120, easing: "cubic-bezier(0.25, 0.6, 0.35, 1)", fill: "both" });
    anim.onfinish = () => el.remove();
    anim.oncancel = () => el.remove();
  }
}

const POKES: Reaction[] = ["giggle", "giggle", "spin", "mischief", "cheer", "surprised", "sass", "pop"];

type Spot = "anchor" | "corner" | "peek" | "below" | "home";
type Mode = "anchor" | "corner" | "script" | "drag" | "fly" | "gone";
type Place = { x: number; y: number; k: number };
type Step = { to: Spot; dur: number; arc?: number; hold?: number; start?: () => void };

const smooth = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Peep, your campaign manager. She stands in the hero's arch when it's on
 * screen, hops into the corner when it isn't, and follows you around the
 * site: greeting you, nudging you along, putting her lantern down when you
 * stop scrolling, and complaining when you try to leave. Pet her, poke her,
 * or pick her up and throw her off the page. She'll peek back in.
 */
export function PeepCompanion() {
  const path = usePathname();
  const theme = useTheme();
  const wrap = useRef<HTMLDivElement>(null);
  const spinner = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const muteBtn = useRef<HTMLButtonElement>(null);
  const stage = useRef<StageAPI | null>(null);
  const [line, setLine] = useState<(PeepLine & { id: number }) | null>(null);
  const [sound, setSound] = useState(true);
  const [ready, setReady] = useState(false);
  const [resting, setResting] = useState<"anchor" | "corner" | "other">("other");
  const lineTimer = useRef(0);
  const lineId = useRef(0);

  // Everything the animation loop and the event handlers share.
  const m = useRef({
    mode: "corner" as Mode,
    pos: { x: 0, y: 0, k: 0.5 } as Place,
    rot: 0,
    rotV: 0,
    vx: 0,
    vy: 0,
    vr: 0,
    queue: [] as Step[],
    step: null as (Step & { from: Place; t0: number; reached: number }) | null,
    lastSpot: null as Spot | null,
    peekX: 0,
    peeks: 0,
    nextPeek: 0,
    nextPeekaboo: 0,
    lastScroll: 0,
    lastActive: 0,
    reduced: false,
  });

  const say = (l: PeepLine | null) => {
    window.clearTimeout(lineTimer.current);
    setLine(l ? { ...l, id: ++lineId.current } : null);
    if (l) lineTimer.current = window.setTimeout(() => setLine(null), (l.hold ?? 7) * 1000);
  };
  const react = (kind: Reaction, withSound = true) => {
    stage.current?.react(kind);
    const s = SOUND_FOR[kind];
    if (withSound && s) playPeep(s);
  };
  const run = (steps: Step[]) => {
    const s = m.current;
    s.mode = "script";
    s.queue = steps;
    s.step = null;
    if (stage.current?.lanternDown()) stage.current.setLantern(false, 4);
  };
  const comeBack = (text: string) => {
    m.current.peeks = 0;
    stage.current?.setActive(true);
    stage.current?.setDangle(false);
    run([{ to: "home", dur: 0.9, arc: 1.3, start: () => react("leap", false) }]);
    window.setTimeout(() => {
      react("cheer");
      say({ text, hold: 4 });
    }, 900);
  };
  /** Pop up from the bottom of the screen, just ears and eyes. */
  const peek = (text?: string, x?: number) => {
    const s = m.current;
    const vw = window.innerWidth;
    const k = vw < 640 ? 0.34 : 0.5;
    s.peekX = x ?? lerp(vw * 0.08, vw * 0.85 - BOX_W * k, Math.random());
    stage.current?.setActive(true);
    run([
      { to: "below", dur: 0 },
      {
        to: "peek",
        dur: 0.45,
        hold: text ? 5200 : 3800,
        start: () => {
          react("pop", soundReady());
          if (text) say({ text, hold: 5 });
        },
      },
      { to: "below", dur: 0.4 },
    ]);
  };

  // Boot the stage.
  useEffect(() => {
    setSound(soundOn());
    const s = m.current;
    s.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    s.lastScroll = s.lastActive = performance.now();
    s.nextPeekaboo = performance.now() + 50_000 + Math.random() * 30_000;
    let api: StageAPI | null = null;
    let disposed = false;
    import("./scene/stage")
      .then(({ createStage }) => {
        if (disposed) return;
        api = createStage(canvas.current!, { reduced: s.reduced, onHearts: (n, x, y, unit) => floatHearts(n, x, y, unit, s.reduced) });
        api.setNight(currentTheme() === "dark");
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

  // Night lighting follows the theme. She has opinions when you flip it yourself.
  useEffect(() => {
    stage.current?.setNight(theme === "dark");
  }, [theme, ready]);
  useEffect(() => {
    const onTheme = (e: Event) => {
      const night = (e as CustomEvent<string>).detail === "dark";
      if (m.current.mode === "gone") return;
      react(night ? "sass" : "pop", soundReady());
      say({ text: pick(night ? LINES.night : LINES.day), hold: 3.5 });
    };
    window.addEventListener("peep:theme", onTheme);
    return () => window.removeEventListener("peep:theme", onTheme);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The animation loop: where she is, where she's going, and her bubble.
  useEffect(() => {
    let raf = 0;
    let anchor: Element | null = null;
    let lastT = performance.now();
    let prevX = 0;
    let lastRest = "";
    let booted = false;
    const s = m.current;

    const cornerK = () => (window.innerWidth < 640 ? 0.34 : 0.5);
    function anchorPlace(): Place | null {
      if (!anchor || !anchor.isConnected) anchor = document.querySelector("[data-peep-anchor]");
      const r = anchor?.getBoundingClientRect();
      if (!r || !r.height) return null;
      const shown = (Math.min(window.innerHeight, r.bottom) - Math.max(0, r.top)) / r.height;
      if (shown <= 0.5) return null;
      const k = (0.41 * r.height) / (FEET_Y - TOP_Y);
      return { x: r.left + r.width / 2 - (BOX_W / 2) * k, y: r.top + 0.94 * r.height - FEET_Y * k, k };
    }
    function spot(to: Spot): Place {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (to === "home" || to === "anchor") {
        const a = anchorPlace();
        if (a) return a;
        to = "corner";
      }
      const k = cornerK();
      if (to === "corner") return { x: vw - 10 - (BOX_W / 2 + EARS) * k, y: vh - 14 - FEET_Y * k, k };
      if (to === "peek") return { x: s.peekX, y: vh - PEEK_Y * k, k };
      return { x: s.peekX, y: vh + 8, k }; // below the screen
    }
    const bubbleOpen = () => bubble.current?.dataset.open === "1";

    function placeBubble(abs: boolean, ox: number, oy: number) {
      const b = bubble.current;
      if (!b || b.dataset.open !== "1") return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const bw = b.offsetWidth;
      const bh = b.offsetHeight;
      const { x, y, k } = s.pos;
      const cx = x + (BOX_W / 2) * k;
      let left: number;
      let top: number;
      if (s.mode === "anchor") {
        // Under the arch's hanging card if it fits, else beside her. Never over her face.
        const r = anchor?.getBoundingClientRect();
        const below = r ? r.bottom + 60 : vh;
        if (below + bh < vh - 8) {
          left = cx - bw / 2;
          top = below;
        } else {
          left = x + (BOX_W / 2 - EARS) * k - bw - 8;
          top = y + HEAD_Y * k - bh / 2;
        }
      } else if (s.mode === "script" && (s.lastSpot === "peek" || s.lastSpot === "below")) {
        left = cx - bw / 2;
        top = vh - (FEET_Y - TOP_Y) * k - bh - 6;
      } else {
        left = cx - bw + 60;
        top = y + TOP_Y * k - bh - 4;
      }
      left = Math.max(12, Math.min(vw - bw - 12, left));
      top = Math.max(76, Math.min(vh - bh - 8, top));
      b.style.position = abs ? "absolute" : "fixed";
      b.style.transform = `translate3d(${(left + ox).toFixed(1)}px, ${(top + oy).toFixed(1)}px, 0)`;
    }

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const el = wrap.current;
      if (!el) return;
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const home: "anchor" | "corner" = anchorPlace() ? "anchor" : "corner";
      if (!booted) {
        // She starts where she belongs, no hop.
        booted = true;
        s.mode = home;
        s.pos = spot(home);
        prevX = s.pos.x;
      }

      // Resting spots hop to each other when the hero scrolls in or out.
      if ((s.mode === "anchor" || s.mode === "corner") && s.mode !== home) {
        const to = home;
        run([
          {
            to,
            dur: s.reduced ? 0 : 0.8,
            arc: 1,
            start: () => {
              react("leap", false);
              if (to === "corner") window.setTimeout(() => stage.current?.react("spin"), 650);
            },
          },
        ]);
      }

      switch (s.mode) {
        case "anchor":
        case "corner":
          s.pos = spot(s.mode);
          // A peekaboo now and then, when nothing else is going on.
          if (s.mode === "corner" && now > s.nextPeekaboo && !bubbleOpen() && !s.reduced) {
            s.nextPeekaboo = now + 60_000 + Math.random() * 40_000;
            s.peekX = s.pos.x;
            run([
              { to: "below", dur: 0.35 },
              { to: "below", dur: 0, hold: 1100 },
              {
                to: "peek",
                dur: 0.3,
                hold: 1500,
                start: () => {
                  react("pop", soundReady());
                  say({ text: pick(LINES.peekaboo), hold: 2 });
                },
              },
              { to: "corner", dur: 0.5, arc: 0.35, start: () => react("giggle", soundReady()) },
            ]);
          }
          break;
        case "script": {
          if (!s.step) {
            const next = s.queue.shift();
            if (!next) {
              const end = s.lastSpot;
              if (end === "below" || end === "peek") {
                s.mode = "gone";
                stage.current?.setActive(false);
                s.nextPeek = now + (s.peeks >= 4 ? 4000 : 16_000 + Math.random() * 14_000);
              } else s.mode = home;
              break;
            }
            next.start?.();
            s.step = { ...next, from: { ...s.pos }, t0: now, reached: 0 };
            s.lastSpot = next.to === "home" ? home : next.to;
          }
          const st = s.step;
          const to = spot(st.to);
          const p = st.dur ? Math.min(1, (now - st.t0) / (st.dur * 1000)) : 1;
          const e = smooth(p);
          const lift = (st.arc ?? 0) * Math.min(220, 90 + Math.abs(to.x - st.from.x) * 0.25) * Math.sin(Math.PI * p);
          s.pos = { x: lerp(st.from.x, to.x, e), y: lerp(st.from.y, to.y, e) - lift, k: lerp(st.from.k, to.k, e) };
          if (p >= 1) {
            if (!st.reached) st.reached = now;
            if (now - st.reached >= (st.hold ?? 0)) s.step = null;
          }
          break;
        }
        case "drag":
          break; // the pointer moves her
        case "fly": {
          s.vy += 2600 * dt;
          s.pos = { ...s.pos, x: s.pos.x + s.vx * dt, y: s.pos.y + s.vy * dt };
          s.rot += s.vr * dt;
          const w = BOX_W * s.pos.k;
          if (s.pos.x > vw + 40 || s.pos.x + w < -40 || s.pos.y > vh + 40) {
            s.mode = "gone";
            s.rot = s.rotV = 0;
            s.peeks = 0;
            stage.current?.setDangle(false);
            stage.current?.setActive(false);
            s.nextPeek = now + 7000;
          }
          break;
        }
        case "gone":
          if (now > s.nextPeek) {
            s.peeks++;
            if (s.peeks > 4) comeBack(LINES.sneakBack[0]);
            else peek(Math.random() < 0.65 ? pick(LINES.peek) : undefined);
          }
          break;
      }

      // Swing back upright after being carried; wobble while carried.
      if (s.mode !== "fly") {
        const rotTo = s.mode === "drag" ? Math.max(-35, Math.min(35, -s.vx * 0.03)) : 0;
        s.rotV += ((rotTo - s.rot) * 60 - s.rotV * 7) * dt;
        s.rot += s.rotV * dt;
      }

      // Lantern swing from moving across the screen.
      const sx = dt > 0 ? (s.pos.x - prevX) / dt : 0;
      prevX = s.pos.x;
      stage.current?.setMotion(Math.max(-3000, Math.min(3000, sx)) / Math.max(0.2, s.pos.k));

      // In the arch she rides along with the page, so scrolling is perfectly smooth.
      const abs = s.mode === "anchor";
      const ox = abs ? window.scrollX : 0;
      const oy = abs ? window.scrollY : 0;
      el.style.position = abs ? "absolute" : "fixed";
      el.style.visibility = s.mode === "gone" ? "hidden" : "visible";
      el.style.transform = `translate3d(${(s.pos.x + ox).toFixed(1)}px, ${(s.pos.y + oy).toFixed(1)}px, 0) scale(${s.pos.k.toFixed(4)})`;
      if (spinner.current) spinner.current.style.transform = `rotate(${s.rot.toFixed(2)}deg)`;

      const rest = s.mode === "anchor" ? "anchor" : s.mode === "corner" ? "corner" : "other";
      if (rest !== lastRest) {
        lastRest = rest;
        setResting(rest);
      }
      placeBubble(abs, ox, oy);
      if (muteBtn.current) {
        const c = spot("corner");
        muteBtn.current.style.left = `${Math.max(8, c.x + (BOX_W / 2 - EARS) * c.k - 28)}px`;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Petting, poking, picking her up and throwing her.
  useEffect(() => {
    const s = m.current;
    let lastMove = performance.now();
    let purrAt = 0;
    let petTime = 0;
    let tickledAt = -1e9;
    let pokes: number[] = [];
    let press: { x: number; y: number } | null = null;
    let grab = { dx: 0, dy: 0 };
    let track = { x: 0, y: 0, t: 0 };
    let swallowClick = 0;
    // Peep sits above the page, so she wins over links under her. Only things drawn above her (the header, her bubble, the mute button) win over her.
    const above = (t: EventTarget | null) => !!(t as Element | null)?.closest?.("header,[role=status],[data-above-peep]");
    const peeking = () => s.mode === "script" && (s.lastSpot === "peek" || s.lastSpot === "below");
    const canTouch = () => s.mode === "anchor" || s.mode === "corner" || peeking();

    const onMove = (e: PointerEvent) => {
      const st = stage.current;
      if (!st) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastMove) / 1000);
      lastMove = now;
      st.lookAt(e.clientX, e.clientY);

      if (press && s.mode !== "drag" && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 6) {
        // Picked up by the scruff.
        s.mode = "drag";
        s.queue = [];
        s.step = null;
        grab = { dx: e.clientX - s.pos.x, dy: e.clientY - s.pos.y };
        track = { x: e.clientX, y: e.clientY, t: e.timeStamp };
        s.vx = s.vy = 0;
        if (st.lanternDown()) st.setLantern(false, 5);
        st.setDangle(true);
        document.body.dataset.peepHover = "drag";
        react("surprised");
        say({ text: pick(LINES.grabbed), hold: 2.5 });
        document.body.style.userSelect = "none";
      }
      if (s.mode === "drag") {
        const tdt = Math.max(0.008, (e.timeStamp - track.t) / 1000);
        s.vx = lerp(s.vx, (e.clientX - track.x) / tdt, 0.5);
        s.vy = lerp(s.vy, (e.clientY - track.y) / tdt, 0.5);
        track = { x: e.clientX, y: e.clientY, t: e.timeStamp };
        s.pos = { ...s.pos, x: e.clientX - grab.dx, y: e.clientY - grab.dy };
        return;
      }

      const over = canTouch() && !peeking() && st.hit(e.clientX, e.clientY) && !above(e.target);
      document.body.dataset.peepHover = over ? "1" : "";
      if (over) {
        st.pet(dt);
        petTime += dt;
        if (now - purrAt > 1500) {
          purrAt = now;
          playPeep(petTime > 2 && Math.random() < 0.4 ? "giggle" : "purr");
        }
        if (petTime > 2.4 && now - tickledAt > 20_000) {
          tickledAt = now;
          react("love", false);
          say({ text: pick(LINES.tickle), hold: 3 });
        }
      } else petTime = Math.max(0, petTime - dt * 2);
    };

    const onDown = (e: PointerEvent) => {
      unlockSound();
      const st = stage.current;
      if (!st || e.button > 0 || above(e.target) || !canTouch() || !st.hit(e.clientX, e.clientY)) return;
      e.preventDefault(); // no text selection or image drag while you hold her
      if (peeking()) {
        comeBack(pick(LINES.comeback));
        return;
      }
      press = { x: e.clientX, y: e.clientY };
    };

    const onUp = () => {
      if (!press) return;
      press = null;
      document.body.style.userSelect = "";
      document.body.dataset.peepHover = "";
      swallowClick = performance.now(); // the click under her shouldn't count
      const st = stage.current;
      if (!st) return;
      if (s.mode === "drag") {
        if (Math.hypot(s.vx, s.vy) > 1100 && !s.reduced) {
          // Thrown! She tumbles off the page.
          s.mode = "fly";
          s.vr = s.vx * 0.35;
          playPeep("whee");
          say({ text: pick(LINES.thrown), hold: 2 });
        } else {
          st.setDangle(false);
          run([{ to: "home", dur: 0.7, arc: 0.5, start: () => react("leap", false) }]);
          if (Math.random() < 0.6) say({ text: pick(LINES.dropped), hold: 2.5 });
        }
        return;
      }
      // A poke.
      const now = performance.now();
      pokes = [...pokes.filter((p) => now - p < 3000), now];
      if (pokes.length >= 6) {
        pokes = [];
        react("angry");
        say({ text: pick(LINES.pokeSpam), hold: 3 });
        return;
      }
      react(pick(POKES));
      if (Math.random() < 0.45) say({ text: pick(LINES.poke), hold: 2.5 });
    };

    // Touch: holding her shouldn't scroll the page.
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      const st = stage.current;
      if (t && st && canTouch() && !above(e.target) && st.hit(t.clientX, t.clientY)) e.preventDefault();
    };
    // Poking or dropping her over a link shouldn't follow it.
    const onClick = (e: MouseEvent) => {
      if (performance.now() - swallowClick < 80) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onKey = () => unlockSound();
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("touchstart", onTouch, { passive: false });
    window.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKey);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pages talk to Peep through window events. If she's off sulking, she peeks in to say it.
  useEffect(() => {
    const onReact = (e: Event) => react((e as CustomEvent<Reaction>).detail);
    const onDemo = (e: Event) => react((e as CustomEvent<Reaction>).detail, false);
    const onSay = (e: Event) => {
      const l = (e as CustomEvent<PeepLine>).detail;
      if (m.current.mode === "gone") {
        peek(l.text);
        return;
      }
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
      if (m.current.mode === "gone") return;
      say(guideFor(path).hello);
      react("wave", false);
    }, path === "/" ? 2200 : 900);
    return () => window.clearTimeout(t);
  }, [path, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // The lantern goes down when you stop scrolling and comes back up when you
  // scroll. Drift off and she nudges you, then waits, then naps. Try to leave
  // and she's not having it.
  useEffect(() => {
    if (!ready) return;
    const s = m.current;
    const idleMs = (window as { __peepIdleMs?: number }).__peepIdleMs ?? IDLE_MS;
    const scale = idleMs / IDLE_MS;
    let nudged = false;
    let waited = false;
    let slept = false;
    let angryAt = 0;
    let pickupLineAt = 0;
    let wasAway = false;
    const settled = () => s.mode === "anchor" || s.mode === "corner";
    const active = () => {
      if (slept && s.mode !== "gone") {
        react("surprised");
        say({ text: pick(LINES.wake), hold: 2.5 });
      }
      s.lastActive = performance.now();
      nudged = waited = slept = false;
    };
    const onScroll = () => {
      s.lastScroll = performance.now();
      const st = stage.current;
      if (st?.lanternDown() && settled()) {
        st.setLantern(false, 1.7);
        playPeep("hmph");
        if (performance.now() - pickupLineAt > 30_000 && Math.random() < 0.35) {
          pickupLineAt = performance.now();
          say({ text: pick(LINES.pickup), hold: 2 });
        }
      }
      active();
    };
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      const now = performance.now();
      const st = stage.current;
      if (st && settled() && !st.lanternDown() && now - s.lastScroll > LANTERN_MS * Math.min(1, scale * 2)) {
        st.setLantern(true, 0.95);
        window.setTimeout(() => playPeep("clink"), 520);
      }
      if (s.mode === "gone") return;
      const idle = now - s.lastActive;
      if (!nudged && idle > idleMs) {
        nudged = true;
        react("attention", soundReady());
        say({ ...guideFor(path).idle, hold: 9 });
      } else if (!waited && idle > WAIT_MS * scale) {
        waited = true;
        react("impatient", soundReady());
        say({ text: pick(LINES.waiting), hold: 6 });
      } else if (!slept && idle > SLEEP_MS * scale) {
        slept = true;
        react("sleepy", soundReady());
        say({ text: pick(LINES.sleep), hold: 6 });
      }
    }, 500);
    const onOut = (e: MouseEvent) => {
      if (e.relatedTarget || e.clientY > 4 || Date.now() - angryAt < 25_000) return;
      angryAt = Date.now();
      if (s.mode === "gone") {
        peek(pick(LINES.exit));
        return;
      }
      if (!settled()) return;
      react("angry", soundReady());
      say({ text: pick(LINES.exit), hold: 4 });
    };
    const onVis = () => {
      if (document.hidden) {
        wasAway = true;
        return;
      }
      if (wasAway && settled()) {
        react("cheer", soundReady());
        say({ text: pick(LINES.back), hold: 3.5 });
      }
      wasAway = false;
      active();
    };
    const events = ["pointermove", "pointerdown", "keydown", "touchstart"] as const;
    events.forEach((ev) => window.addEventListener(ev, active, { passive: true }));
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("mouseout", onOut);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(timer);
      events.forEach((ev) => window.removeEventListener(ev, active));
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mouseout", onOut);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [path, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div
        ref={wrap}
        aria-hidden
        className="pointer-events-none left-0 top-0 z-40 origin-top-left will-change-transform"
        style={{ position: "fixed", width: BOX_W, height: BOX_H, transform: "translate(-9999px, 0)" }}
      >
        <div ref={spinner} className="h-full w-full" style={{ transformOrigin: `${BOX_W / 2}px ${HEAD_Y}px` }}>
          <canvas ref={canvas} className="block h-full w-full" />
        </div>
      </div>

      <div
        ref={bubble}
        role="status"
        data-open={line ? "1" : ""}
        className="pointer-events-none left-0 top-0 z-[70] w-[min(290px,calc(100vw-24px))]"
        style={{ position: "fixed", visibility: line ? "visible" : "hidden" }}
      >
        {line && (
          <div key={line.id} className="glass animate-pop pointer-events-auto relative rounded-2xl p-3.5 pr-8 text-sm text-ink">
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
        )}
      </div>

      {ready && resting === "corner" && (
        <button
          ref={muteBtn}
          type="button"
          data-above-peep
          aria-label={sound ? "Mute Peep" : "Unmute Peep"}
          title={sound ? "Mute Peep" : "Unmute Peep"}
          className="glass fixed bottom-3.5 z-50 grid h-8 w-8 place-items-center rounded-full text-xs"
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
