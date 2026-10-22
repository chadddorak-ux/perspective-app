import { CAUSE_GROUPS, type CauseId } from "@/lib/taxonomy";

// Campaign covers are painted storybook landscapes, one scene per cause group
// (sunrise hills for education, a calm sea for health, a mountain forest for
// the environment...). The palette, sun and clouds shift per campaign so no
// two covers match, and the clouds drift when the card is hovered.

type SceneId = "hills" | "sea" | "village" | "forest" | "night" | "dunes" | "city" | "planet";

const GROUP_SCENE: Record<string, SceneId> = {
  "Education & youth": "hills",
  Health: "sea",
  "Basic needs & community": "village",
  "Environment & animals": "forest",
  "Arts, culture & sports": "night",
  "Equity & rights": "dunes",
  "Economy & work": "city",
  "Global, civic & faith": "planet",
};

type Palette = { sky: [string, string, string]; sun: string; layers: string[]; cloud: string };

const PALETTES: Record<SceneId, Palette[]> = {
  hills: [
    { sky: ["#7d83d6", "#d3a6d8", "#ffd3b4"], sun: "#fff1c9", layers: ["#9ccf9a", "#5fae8e", "#3d7f73"], cloud: "#fff6f0" },
    { sky: ["#6f8fd6", "#b9b0e6", "#ffe0c2"], sun: "#ffe7a8", layers: ["#b4d68f", "#7bbf86", "#4f8f78"], cloud: "#ffffff" },
  ],
  sea: [
    { sky: ["#8f86d9", "#f0a9c4", "#ffd7b8"], sun: "#fff0d0", layers: ["#7aa6e0", "#5a86cf"], cloud: "#fff3f2" },
    { sky: ["#6fa5dc", "#bfc8ee", "#ffe5cf"], sun: "#fff8e0", layers: ["#64b3c9", "#3f8fb3"], cloud: "#ffffff" },
  ],
  village: [
    { sky: ["#3b2f7a", "#9a5fa8", "#ffab98"], sun: "#ffd7a8", layers: ["#6d4f8f", "#4c3a75", "#33285a"], cloud: "#ffc6c0" },
    { sky: ["#4a5fb8", "#c08cc8", "#ffc4a4"], sun: "#ffe2b0", layers: ["#7a6aa8", "#58508e", "#3b3570"], cloud: "#ffd8d0" },
  ],
  forest: [
    { sky: ["#4c5fbf", "#b28ad0", "#ffa7a6"], sun: "#ffd2a8", layers: ["#8e5a9e", "#3f7f6b", "#2f6b5e"], cloud: "#ffd0c4" },
    { sky: ["#5f7fd0", "#c4a0d8", "#ffc0a8"], sun: "#ffe6b8", layers: ["#7d6aa8", "#4f8f78", "#3d6f62"], cloud: "#ffe0d6" },
  ],
  night: [
    { sky: ["#0e0a26", "#2c1a52", "#8c3f7c"], sun: "#fff4dc", layers: ["#e9799a", "#ffb3a0"], cloud: "#ffc6b8" },
    { sky: ["#141038", "#3a2470", "#a24f8a"], sun: "#fff8e8", layers: ["#c96aa0", "#ff9fb0"], cloud: "#ffd2c6" },
  ],
  dunes: [
    { sky: ["#8a6fd0", "#f29ab0", "#ffcfa0"], sun: "#fff0c0", layers: ["#ffb07a", "#f2875e", "#d9654f"], cloud: "#fff2ea" },
    { sky: ["#7a8ad8", "#e6a6c8", "#ffd9b0"], sun: "#ffefc8", layers: ["#ffc08a", "#f39a6a", "#e07858"], cloud: "#ffffff" },
  ],
  city: [
    { sky: ["#5d6ac8", "#d098c4", "#ffc49a"], sun: "#ffe4a0", layers: ["#7e6aa8", "#5a4d88", "#3d3468"], cloud: "#ffe4da" },
    { sky: ["#6f8ad6", "#c3b0e0", "#ffd8b0"], sun: "#fff0c0", layers: ["#8f86b8", "#6a6198", "#4a4378"], cloud: "#ffffff" },
  ],
  planet: [
    { sky: ["#0f0b2c", "#2a1f5c", "#5a3a8a"], sun: "#ffe8c8", layers: ["#7fd8c0", "#5aa8d8"], cloud: "#ffffff" },
    { sky: ["#120d30", "#36246a", "#7a3f86"], sun: "#fff0d8", layers: ["#ffb3a0", "#c96aa0"], cloud: "#ffffff" },
  ],
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rand(seed: number) {
  let s = seed || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

function sceneOf(cause: CauseId | undefined): SceneId {
  const group = CAUSE_GROUPS.find((g) => cause && g.ids.includes(cause))?.label;
  return (group && GROUP_SCENE[group]) || "village";
}

/** A rolling ridge across the frame, as an SVG path closed at the bottom. */
function ridge(base: number, amp: number, freq: number, phase: number, w = 400, h = 250): string {
  const pts: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const x = (i / 40) * w;
    const y = base - amp * (Math.sin((x / w) * Math.PI * freq + phase) * 0.6 + Math.sin((x / w) * Math.PI * freq * 2.3 + phase * 1.7) * 0.4);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return `M0,${h} L${pts.join(" L")} L${w},${h} Z`;
}

function Cloud({ x, y, s, id }: { x: number; y: number; s: number; id: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="0" rx="46" ry="16" fill={`url(#${id})`} />
      <ellipse cx="-14" cy="-9" rx="22" ry="15" fill={`url(#${id})`} />
      <ellipse cx="12" cy="-12" rx="26" ry="18" fill={`url(#${id})`} />
    </g>
  );
}

export function coverColors(cause: CauseId | undefined) {
  const p = PALETTES[sceneOf(cause)][0];
  return { bg: p.sky[1], fg: "#2a2826", soft: p.sky[2] };
}

export function CoverArt({ id, cause, label, image, className = "" }: { id: string; cause?: CauseId; label?: string; image?: string; className?: string }) {
  if (image) {
    return (
      <div className={`overflow-hidden bg-line ${/\babsolute\b/.test(className) ? "" : "relative"} ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
        {label && <span className="absolute left-3 top-3 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold text-[#2a2826] shadow-sm backdrop-blur">{label}</span>}
      </div>
    );
  }
  const scene = sceneOf(cause);
  const h = hash(id);
  const r = rand(h);
  const pal = PALETTES[scene][h % PALETTES[scene].length];
  const k = `cv-${scene}-${h % 9973}`;
  const sunX = 70 + r() * 260;
  const sunY = scene === "night" || scene === "planet" ? 40 + r() * 40 : 95 + r() * 50;
  const clouds = Array.from({ length: 3 }, () => ({ x: r() * 400, y: 30 + r() * 80, s: 0.5 + r() * 0.6 }));
  const stars = scene === "night" || scene === "planet" || scene === "village" ? Array.from({ length: 34 }, () => ({ x: r() * 400, y: r() * 150, r: 0.5 + r() * 1.1 })) : [];
  const drift = "transition-transform duration-[1400ms] ease-out";

  return (
    <div className={`overflow-hidden ${/\babsolute\b/.test(className) ? "" : "relative"} ${className}`} style={{ background: pal.sky[1] }}>
      <svg aria-hidden className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 250">
        <defs>
          <linearGradient id={`${k}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={pal.sky[0]} />
            <stop offset="0.55" stopColor={pal.sky[1]} />
            <stop offset="1" stopColor={pal.sky[2]} />
          </linearGradient>
          <radialGradient id={`${k}-glow`}>
            <stop offset="0" stopColor={pal.sun} stopOpacity="0.85" />
            <stop offset="1" stopColor={pal.sun} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${k}-cloud`}>
            <stop offset="0.35" stopColor={pal.cloud} stopOpacity="0.95" />
            <stop offset="1" stopColor={pal.cloud} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${k}-fade`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.18" />
            <stop offset="1" stopColor="#000000" stopOpacity="0.12" />
          </linearGradient>
        </defs>
        <rect width="400" height="250" fill={`url(#${k}-sky)`} />
        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={0.5 + (i % 3) * 0.2} />
        ))}
        <g className={`${drift} group-hover:-translate-y-2`}>
          <circle cx={sunX} cy={sunY} r="70" fill={`url(#${k}-glow)`} />
          <circle cx={sunX} cy={sunY} r={scene === "dunes" ? 34 : 22} fill={pal.sun} />
        </g>
        <g className={`${drift} group-hover:translate-x-4`}>
          {clouds.map((c, i) => (
            <Cloud key={i} {...c} id={`${k}-cloud`} />
          ))}
        </g>
        <SceneLayers scene={scene} pal={pal} r={r} k={k} />
        <rect width="400" height="250" fill={`url(#${k}-fade)`} />
      </svg>
      {label && (
        <span className="absolute left-3 top-3 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold text-[#2a2826] shadow-sm backdrop-blur">{label}</span>
      )}
    </div>
  );
}

function SceneLayers({ scene, pal, r, k }: { scene: SceneId; pal: Palette; r: () => number; k: string }) {
  const L = pal.layers;
  const ph = () => r() * 6.28;
  switch (scene) {
    case "hills":
      return (
        <>
          <path d={ridge(170, 18, 2, ph())} fill={L[0]} />
          <path d={ridge(195, 16, 2.6, ph())} fill={L[1]} />
          <path d={ridge(225, 12, 3, ph())} fill={L[2]} />
          {Array.from({ length: 6 }, (_, i) => {
            const x = 20 + r() * 360;
            const y = 205 + r() * 25;
            return <circle key={i} cx={x} cy={y} r={6 + r() * 6} fill={L[1]} opacity="0.9" />;
          })}
        </>
      );
    case "sea":
      return (
        <>
          <rect y="160" width="400" height="90" fill={L[0]} />
          <rect y="200" width="400" height="50" fill={L[1]} opacity="0.7" />
          {Array.from({ length: 7 }, (_, i) => (
            <rect key={i} x={120 + r() * 160} y={168 + i * 11} width={30 + r() * 60} height="2.5" rx="1.25" fill={pal.sun} opacity={0.75 - i * 0.08} />
          ))}
          <path d={ridge(232, 10, 2, ph())} fill="#ffe2c8" opacity="0.9" />
        </>
      );
    case "village": {
      const houses = Array.from({ length: 7 }, (_, i) => ({ x: 20 + i * 54 + r() * 20, w: 26 + r() * 14, h: 18 + r() * 12 }));
      return (
        <>
          <path d={ridge(175, 14, 2, ph())} fill={L[0]} />
          <path d={ridge(205, 10, 2.4, ph())} fill={L[1]} />
          {houses.map((hs, i) => (
            <g key={i} transform={`translate(${hs.x} ${215 - hs.h})`}>
              <rect width={hs.w} height={hs.h + 10} fill={L[2]} />
              <path d={`M-3 0 L${hs.w / 2} ${-hs.w * 0.45} L${hs.w + 3} 0 Z`} fill={L[2]} />
              <rect x={hs.w * 0.3} y={hs.h * 0.3} width="6" height="6" rx="1" fill="#ffd27a" />
            </g>
          ))}
          <path d={ridge(240, 6, 3, ph())} fill={L[2]} />
        </>
      );
    }
    case "forest": {
      const tree = (x: number, y: number, s: number, c: string, i: number) => (
        <path key={i} d={`M${x} ${y - 34 * s} L${x + 11 * s} ${y - 12 * s} L${x + 6 * s} ${y - 12 * s} L${x + 14 * s} ${y} L${x - 14 * s} ${y} L${x - 6 * s} ${y - 12 * s} L${x - 11 * s} ${y - 12 * s} Z`} fill={c} />
      );
      const colors = ["#e8743b", "#f2a541", "#3f7f6b", "#9cc06b", "#d65d4f"];
      return (
        <>
          <path d="M40 200 L150 70 L190 110 L230 60 L360 200 Z" fill={L[0]} />
          <path d="M150 70 L168 92 L158 96 L190 110 L176 88 Z M230 60 L250 84 L238 88 L262 96 Z" fill="#fff0e6" opacity="0.9" />
          <path d={ridge(200, 10, 2, ph())} fill={L[1]} />
          {Array.from({ length: 16 }, (_, i) => tree(r() * 400, 205 + r() * 45, 0.8 + r() * 0.7, colors[i % colors.length], i))}
          <path d={ridge(244, 5, 3, ph())} fill={L[2]} />
        </>
      );
    }
    case "night":
      return (
        <>
          <circle cx={300} cy={60} r="16" fill="#fff6e0" opacity="0.95" />
          {Array.from({ length: 9 }, (_, i) => (
            <ellipse key={i} cx={i * 50 + r() * 20} cy={215 + r() * 10} rx={40 + r() * 20} ry={26 + r() * 10} fill={L[0]} opacity="0.95" />
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <ellipse key={`b${i}`} cx={i * 55 + r() * 30} cy={240 + r() * 8} rx={44 + r() * 16} ry={24 + r() * 8} fill={L[1]} />
          ))}
        </>
      );
    case "dunes":
      return (
        <>
          <path d={ridge(175, 22, 1.4, ph())} fill={L[0]} />
          <path d={ridge(205, 20, 1.8, ph())} fill={L[1]} />
          <path d={ridge(235, 14, 2.2, ph())} fill={L[2]} />
        </>
      );
    case "city": {
      const buildings = Array.from({ length: 14 }, (_, i) => ({ x: i * 30 - 6 + r() * 8, w: 22 + r() * 14, h: 40 + r() * 90 }));
      return (
        <>
          <path d={ridge(200, 8, 2, ph())} fill={L[0]} />
          {buildings.map((b, i) => (
            <g key={i}>
              <rect x={b.x} y={225 - b.h} width={b.w} height={b.h + 30} rx="2" fill={i % 2 ? L[1] : L[2]} />
              {Array.from({ length: Math.floor(b.h / 16) }, (_, j) =>
                [0, 1].map((c) => (r() > 0.55 ? <rect key={`${j}-${c}`} x={b.x + 4 + c * (b.w / 2 - 2)} y={232 - b.h + j * 16} width="5" height="6" rx="1" fill="#ffd98a" opacity="0.9" /> : null)),
              )}
            </g>
          ))}
        </>
      );
    }
    case "planet":
      return (
        <>
          <circle cx="200" cy="560" r="400" fill={L[1]} opacity="0.45" />
          <circle cx="200" cy="572" r="392" fill={L[0]} />
          <circle cx="200" cy="580" r="392" fill={L[1]} opacity="0.55" />
          <ellipse cx="200" cy="168" rx="240" ry="10" fill="#ffffff" opacity="0.25" />
        </>
      );
  }
}
