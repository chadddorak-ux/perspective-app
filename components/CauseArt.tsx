import type { CauseId } from "@/lib/taxonomy";

// A small animated scene for each kind of cause, drawn in Peep's storybook
// style: paper planes for an aviation expo, paw prints for an adoption day,
// falling leaves for a river cleanup. It's picked from the campaign's words
// first (they're more specific), then its causes.

export type ArtTheme = "flight" | "stem" | "books" | "paws" | "food" | "health" | "nature" | "music" | "sports" | "homes" | "storm" | "people";

const WORDS: [RegExp, ArtTheme][] = [
  [/aviation|flight|pilot|aero|soar|airport|rocket|space/i, "flight"],
  [/adopt|pet|shelter|rescue|animal/i, "paws"],
  [/hurricane|storm|disaster|flood|wildfire|kit drive/i, "storm"],
  [/cleanup|river|park|tree|garden|climate/i, "nature"],
  [/shakespeare|theat|festival|music|concert|arts?\b|gallery/i, "music"],
  [/golf|5k|walk|run\b|marathon|season|league|tournament|sports/i, "sports"],
  [/scholarship|school|read|literacy|library|college/i, "books"],
  [/gala|dinner|breakfast|table|meal|food|pantry|harvest/i, "food"],
  [/code|coding|build camp|robot|tech|stem/i, "stem"],
];

const CAUSE_THEME: Partial<Record<CauseId, ArtTheme>> = {
  "stem-education": "stem",
  "technology-ai": "stem",
  "digital-inclusion": "stem",
  "early-childhood": "books",
  "education-literacy": "books",
  "college-access": "books",
  "journalism-media": "books",
  "youth-development": "sports",
  "health-wellness": "health",
  "mental-health": "health",
  "disease-research": "health",
  "addiction-recovery": "health",
  aging: "health",
  disability: "sports",
  "food-security": "food",
  housing: "homes",
  poverty: "homes",
  "community-development": "homes",
  "small-business": "homes",
  "financial-literacy": "homes",
  "workforce-development": "homes",
  "disaster-relief": "storm",
  "public-safety": "storm",
  environment: "nature",
  "animal-welfare": "paws",
  "arts-culture": "music",
  "sports-recreation": "sports",
};

export function artTheme(opp: { title: string; summary?: string; causes: CauseId[] }): ArtTheme {
  const text = `${opp.title} ${opp.summary ?? ""}`;
  for (const [re, theme] of WORDS) if (re.test(opp.title)) return theme;
  for (const c of opp.causes) if (CAUSE_THEME[c]) return CAUSE_THEME[c]!;
  for (const [re, theme] of WORDS) if (re.test(text)) return theme;
  return "people";
}

type Look = { sky: [string, string, string]; ground: string; ground2: string; accent: string };
export const LOOKS: Record<ArtTheme, Look> = {
  flight: { sky: ["#7a9be6", "#b9b0ee", "#ffd6c0"], ground: "#8fd0b5", ground2: "#5fae8e", accent: "#ff8a5c" },
  stem: { sky: ["#1e1a5a", "#4b358f", "#d9709a"], ground: "#3a2d6e", ground2: "#2a2152", accent: "#7fe0c4" },
  books: { sky: ["#ffcf9e", "#ffb9c0", "#c4b2ff"], ground: "#a07ad8", ground2: "#7d5cb8", accent: "#ffe38a" },
  paws: { sky: ["#9fdccb", "#d4ecbc", "#fff0c6"], ground: "#7cc79a", ground2: "#57a97c", accent: "#ff8db3" },
  food: { sky: ["#ffc99a", "#ffaea6", "#cf96d4"], ground: "#c46f9a", ground2: "#9e527d", accent: "#ffd27a" },
  health: { sky: ["#ffd2dc", "#f4b4d4", "#b6c4ff"], ground: "#9fb0f0", ground2: "#7d8cd8", accent: "#ff6b8f" },
  nature: { sky: ["#b8e2ff", "#cdeed8", "#fff1c6"], ground: "#6fc49a", ground2: "#3f9a7c", accent: "#5aa8e0" },
  music: { sky: ["#120d38", "#3a2470", "#a24f8a"], ground: "#6a2a62", ground2: "#4a1d48", accent: "#ffd27a" },
  sports: { sky: ["#93ccff", "#c4e6ff", "#fff0c6"], ground: "#6cc28c", ground2: "#4fa872", accent: "#ff8a5c" },
  homes: { sky: ["#3f54ae", "#b585c4", "#ffc19f"], ground: "#5a4d88", ground2: "#3d3468", accent: "#ffd27a" },
  storm: { sky: ["#56649a", "#9aa4cc", "#ffd4ae"], ground: "#6f7fb0", ground2: "#55639a", accent: "#ffd27a" },
  people: { sky: ["#ffb0c6", "#c4a6ff", "#9dd6ff"], ground: "#a58ae6", ground2: "#8468cc", accent: "#ffd27a" },
};

const a = (name: string, dur: number, delay = 0, extra = "ease-in-out infinite") => ({ animation: `${name} ${dur}s ${extra} ${delay}s` });
const alt = (name: string, dur: number, delay = 0) => a(name, dur, delay, "ease-in-out infinite alternate");

function Cloud({ x, y, s = 1, color = "#fff", delay = 0, op = 0.9 }: { x: number; y: number; s?: number; color?: string; delay?: number; op?: number }) {
  return (
    <g className="ca" style={alt("ca-drift", 7 + s * 3, delay)} opacity={op}>
      <g transform={`translate(${x} ${y}) scale(${s})`} fill={color}>
        <circle cx="0" cy="0" r="16" />
        <circle cx="18" cy="-8" r="20" />
        <circle cx="40" cy="0" r="15" />
        <rect x="-4" y="0" width="48" height="14" rx="7" />
      </g>
    </g>
  );
}

function Stars({ n = 14, color = "#fff" }: { n?: number; color?: string }) {
  return (
    <g fill={color}>
      {Array.from({ length: n }, (_, i) => (
        <circle key={i} className="ca" cx={(i * 83) % 400} cy={(i * 47) % 230 + 10} r={i % 4 === 0 ? 2.2 : 1.3} style={alt("ca-twinkle", 1.6 + (i % 5) * 0.4, (i % 7) * 0.3)} />
      ))}
    </g>
  );
}

function Hills({ look }: { look: Look }) {
  return (
    <g>
      <path d="M0 392 C 70 360, 140 372, 210 384 S 340 360, 400 376 V480 H0Z" fill={look.ground} />
      <path d="M0 420 C 90 400, 180 418, 260 410 S 360 398, 400 404 V480 H0Z" fill={look.ground2} />
    </g>
  );
}

const PLANE = "M0 0 L34 -12 L12 4 Z M12 4 L34 -12 L18 10 Z";

function scene(theme: ArtTheme, look: Look) {
  switch (theme) {
    case "flight":
      return (
        <>
          <Cloud x={30} y={90} s={1.1} />
          <Cloud x={250} y={60} s={0.8} delay={1.5} />
          <Cloud x={290} y={200} s={1.2} delay={0.8} op={0.75} />
          {/* A paper plane looping, leaving a dashed trail */}
          <path d="M40 300 C 120 140, 260 120, 300 200 S 200 330, 140 250 S 260 90, 380 110" fill="none" stroke="#fff" strokeWidth="2.5" strokeDasharray="2 9" strokeLinecap="round" opacity="0.7" />
          <g style={{ offsetPath: "path('M40 300 C 120 140, 260 120, 300 200 S 200 330, 140 250 S 260 90, 380 110')", offsetRotate: "auto", ...a("ca-path", 7, 0, "linear infinite") }}>
            <path d={PLANE} fill="#fff" stroke="#2a2826" strokeWidth="1.6" strokeLinejoin="round" transform="translate(-17 0)" />
          </g>
          <g style={{ offsetPath: "path('M-40 170 C 80 120, 200 210, 440 140')", offsetRotate: "auto", ...a("ca-path", 9, 2.5, "linear infinite") }}>
            <path d={PLANE} fill={look.accent} stroke="#2a2826" strokeWidth="1.6" strokeLinejoin="round" transform="translate(-17 0) scale(0.8)" />
          </g>
          {/* A rocket on the hill, ready to go */}
          <g className="ca" style={a("ca-launch", 6, 1, "ease-in infinite")}>
            <g transform="translate(320 330)">
              <path d="M0 -46 C 12 -34, 14 -10, 10 8 H-10 C -14 -10, -12 -34, 0 -46Z" fill="#fff" stroke="#2a2826" strokeWidth="2" />
              <circle cx="0" cy="-20" r="5" fill="#7a9be6" stroke="#2a2826" strokeWidth="1.6" />
              <path d="M-10 0 L-18 14 L-9 10Z M10 0 L18 14 L9 10Z" fill={look.accent} stroke="#2a2826" strokeWidth="1.6" strokeLinejoin="round" />
              <path className="ca" d="M-6 10 Q0 30 6 10Z" fill="#ffd27a" style={alt("ca-flicker", 0.15)} />
            </g>
          </g>
          <Hills look={look} />
        </>
      );
    case "stem":
      return (
        <>
          <Stars />
          {/* An atom: three orbits and their electrons */}
          <g transform="translate(200 190)">
            {[0, 60, 120].map((r, i) => (
              <g key={r} transform={`rotate(${r})`}>
                <ellipse rx="110" ry="38" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="2.5" />
                <circle r="7" fill={i === 1 ? look.accent : "#ffd27a"} style={{ offsetPath: "path('M110 0 A110 38 0 1 1 -110 0 A110 38 0 1 1 110 0')", ...a("ca-path", 3 + i * 0.7, i * 0.4, "linear infinite") }} />
              </g>
            ))}
            <circle r="20" fill={look.accent} className="ca" style={alt("ca-pulse", 1.2)} />
          </g>
          {/* Gears turning */}
          <g transform="translate(70 380)">
            <path className="ca" d={gear(34, 10)} fill="#fff" fillOpacity="0.85" style={a("ca-spin", 8, 0, "linear infinite")} />
          </g>
          <g transform="translate(118 350)">
            <path className="ca" d={gear(22, 8)} fill={look.accent} style={a("ca-spin-rev", 5.3, 0, "linear infinite")} />
          </g>
          {["</>", "{ }", "01"].map((t, i) => (
            <text key={t} className="ca" x={260 + i * 40} y={400} fill="#fff" fontFamily="ui-monospace, monospace" fontWeight="700" fontSize="22" style={a("ca-rise", 4, i * 1.3, "ease-out infinite")}>
              {t}
            </text>
          ))}
          <path d="M0 440 H400 V480 H0Z" fill={look.ground2} />
        </>
      );
    case "books":
      return (
        <>
          <Cloud x={40} y={70} s={0.9} />
          <Cloud x={270} y={110} s={1} delay={1.2} />
          {["A", "b", "C", "?", "!", "ä"].map((t, i) => (
            <text key={i} className="ca" x={150 + (i % 3) * 45} y={300} fill={i % 2 ? "#fff" : "#2a2826"} fontFamily="Fraunces Variable, Georgia, serif" fontWeight="700" fontSize={24 + (i % 3) * 6} style={a("ca-rise-far", 4.5, i * 0.75, "ease-out infinite")}>
              {t}
            </text>
          ))}
          {/* An open book with a page turning */}
          <g transform="translate(200 360)">
            <path d="M0 -6 C -40 -26, -90 -24, -120 -14 V40 C -90 30, -40 30, 0 46Z" fill="#fffaf1" stroke="#2a2826" strokeWidth="2.5" />
            <path d="M0 -6 C 40 -26, 90 -24, 120 -14 V40 C 90 30, 40 30, 0 46Z" fill="#fffaf1" stroke="#2a2826" strokeWidth="2.5" />
            {[-90, -70, -50, 30, 50, 70].map((x) => (
              <path key={x} d={`M${x} ${x < 0 ? 0 : -2} q ${x < 0 ? 15 : 15} -4 30 0`} stroke="#c9bfae" strokeWidth="3" fill="none" strokeLinecap="round" />
            ))}
            <path className="ca" d="M0 -6 C 40 -26, 90 -24, 120 -14 V40 C 90 30, 40 30, 0 46Z" fill={look.accent} stroke="#2a2826" strokeWidth="2.5" style={{ transformOrigin: "0px 20px", transformBox: "view-box", ...a("ca-page", 3.4, 0, "ease-in-out infinite") }} />
          </g>
          {/* A cap, tossed */}
          <g className="ca" style={a("ca-toss", 4.2, 0.6, "ease-in-out infinite")}>
            <g transform="translate(300 300)">
              <path d="M-26 0 L0 -12 L26 0 L0 12Z" fill="#2a2826" />
              <path d="M-14 6 V16 Q0 24 14 16 V6" fill="#2a2826" />
              <path d="M20 2 V18" stroke={look.accent} strokeWidth="3" strokeLinecap="round" />
            </g>
          </g>
          <path d="M0 430 H400 V480 H0Z" fill={look.ground2} />
        </>
      );
    case "paws":
      return (
        <>
          <Cloud x={30} y={80} s={1} />
          <Cloud x={260} y={60} s={0.8} delay={1} />
          <Hills look={look} />
          {/* Paw prints trotting across */}
          {Array.from({ length: 7 }, (_, i) => (
            <g key={i} className="ca" transform={`translate(${40 + i * 50} ${i % 2 ? 404 : 428}) rotate(${-10 + (i % 2) * 20})`} style={a("ca-print", 4.2, i * 0.45, "ease-out infinite")}>
              <ellipse cx="0" cy="6" rx="9" ry="8" fill="#2a2826" opacity="0.75" />
              {[-9, -3, 3, 9].map((x, j) => (
                <circle key={j} cx={x} cy={j === 0 || j === 3 ? -4 : -8} r="3.6" fill="#2a2826" opacity="0.75" />
              ))}
            </g>
          ))}
          {/* A bouncing ball and a bone */}
          <g className="ca" style={a("ca-bounce", 1.1, 0, "cubic-bezier(0.5, 0, 0.5, 1) infinite")}>
            <circle cx="300" cy="300" r="20" fill={look.accent} stroke="#2a2826" strokeWidth="2.5" />
            <path d="M282 294 Q300 308 318 294" stroke="#fff" strokeWidth="3" fill="none" />
          </g>
          <g className="ca" style={alt("ca-float", 2.4)}>
            <path transform="translate(110 250)" d="M-30 -6 a8 8 0 1 1 6 -6 h48 a8 8 0 1 1 6 6 a8 8 0 1 1 -6 6 h-48 a8 8 0 1 1 -6 -6z" fill="#fffaf1" stroke="#2a2826" strokeWidth="2.5" />
          </g>
          {[0, 1, 2].map((i) => (
            <g key={i} className="ca" style={a("ca-rise", 3.2, i * 1, "ease-out infinite")}>
              <path d={HEART} transform={`translate(${190 + i * 30} 220) scale(${0.8 + (i % 2) * 0.4})`} fill="#ff6b8f" />
            </g>
          ))}
        </>
      );
    case "food":
      return (
        <>
          <Cloud x={40} y={70} s={0.9} />
          <Cloud x={270} y={90} s={1} delay={1.4} />
          {/* Produce dropping into a basket */}
          {[
            ["apple", 150],
            ["carrot", 205],
            ["pear", 255],
            ["apple", 230],
            ["bread", 180],
          ].map(([kind, x], i) => (
            <g key={i} className="ca" style={a("ca-drop", 3.6, i * 0.7, "cubic-bezier(0.5, 0, 0.8, 0.6) infinite")}>
              <g transform={`translate(${x} 120)`}>{produce(kind as string)}</g>
            </g>
          ))}
          <g transform="translate(200 380)">
            <path d="M-90 -20 H90 L72 56 H-72Z" fill="#d9965c" stroke="#2a2826" strokeWidth="2.5" strokeLinejoin="round" />
            {[-50, -10, 30].map((x) => (
              <path key={x} d={`M${x} -20 L${x + 10} 56`} stroke="#b0703f" strokeWidth="3" />
            ))}
            <path d="M-96 -24 H96" stroke="#2a2826" strokeWidth="6" strokeLinecap="round" />
            <path d="M-60 -24 C -60 -80, 60 -80, 60 -24" stroke="#2a2826" strokeWidth="5" fill="none" />
          </g>
          {[0, 1].map((i) => (
            <g key={i} className="ca" style={a("ca-rise", 2.8, i * 1.4, "ease-out infinite")}>
              <path d="M0 0 C 10 -12, -10 -24, 0 -36" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" transform={`translate(${320 + i * 18} 330)`} />
            </g>
          ))}
          <path d="M0 440 H400 V480 H0Z" fill={look.ground2} />
        </>
      );
    case "health":
      return (
        <>
          <Cloud x={30} y={70} s={0.9} />
          <Cloud x={280} y={90} s={0.8} delay={1} />
          <g transform="translate(200 225)">
            <g className="ca" style={a("ca-beat", 1.1, 0, "ease-in-out infinite")}>
              <path d={HEART} transform="scale(5.2)" fill={look.accent} stroke="#2a2826" strokeWidth="0.5" />
            </g>
          </g>
          {/* A heartbeat line, drawing itself */}
          <path className="ca" d="M0 360 H120 L140 330 L162 400 L184 300 L206 380 L222 360 H400" fill="none" stroke="#fff" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" pathLength={1} style={{ strokeDasharray: 1, ...a("ca-ecg", 2.6, 0, "linear infinite") }} />
          {[0, 1, 2, 3].map((i) => (
            <g key={i} className="ca" style={a("ca-rise-far", 4, i * 0.9, "ease-out infinite")}>
              <path transform={`translate(${60 + i * 95} 300)`} d="M-8 -3 H-3 V-8 H3 V-3 H8 V3 H3 V8 H-3 V3 H-8Z" fill="#fff" />
            </g>
          ))}
          <path d="M0 440 H400 V480 H0Z" fill={look.ground2} />
        </>
      );
    case "nature":
      return (
        <>
          <Cloud x={40} y={70} s={1} />
          <Cloud x={260} y={50} s={0.8} delay={1.2} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <g key={i} className="ca" style={a("ca-leaf", 5 + (i % 3), i * 0.9, "ease-in-out infinite")}>
              <path d={LEAF} transform={`translate(${30 + i * 62} 0) rotate(${i * 40})`} fill={i % 2 ? "#ffb36b" : "#5fb98a"} stroke="#2a2826" strokeWidth="1.4" />
            </g>
          ))}
          <Hills look={look} />
          {/* A sprout growing on the hill */}
          <g transform="translate(200 392)">
            <g className="ca" style={{ transformOrigin: "0 0", transformBox: "view-box", ...a("ca-grow", 5, 0, "ease-out infinite") }}>
              <path d="M0 0 C 0 -30, 4 -50, 0 -80" stroke="#2f7a5c" strokeWidth="6" strokeLinecap="round" fill="none" />
              <path d={LEAF} transform="translate(0 -60) rotate(-40) scale(1.5)" fill="#5fb98a" stroke="#2a2826" strokeWidth="1.2" />
              <path d={LEAF} transform="translate(0 -78) rotate(220) scale(1.3)" fill="#7fd0a0" stroke="#2a2826" strokeWidth="1.2" />
            </g>
          </g>
          {/* River ripples */}
          {[0, 1, 2].map((i) => (
            <ellipse key={i} className="ca" cx="300" cy="448" rx="40" ry="8" fill="none" stroke={look.accent} strokeWidth="3" style={a("ca-ripple", 3, i * 1, "ease-out infinite")} />
          ))}
        </>
      );
    case "music":
      return (
        <>
          <Stars />
          {[-1, 1].map((s) => (
            <g key={s} transform={`translate(${200 + s * 110} 470)`}>
              <path className="ca" d="M0 0 L-60 -420 L60 -420Z" fill="#fff4d6" opacity="0.16" style={{ transformOrigin: "0 0", transformBox: "view-box", ...alt(s < 0 ? "ca-sweep" : "ca-sweep-rev", 3.5) }} />
            </g>
          ))}
          {/* Curtains */}
          <path d="M0 0 H70 C 60 120, 80 260, 40 480 H0Z" fill="#c2335f" />
          <path d="M400 0 H330 C 340 120, 320 260, 360 480 H400Z" fill="#c2335f" />
          <path d="M0 0 H400 V34 C 300 50, 100 50, 0 34Z" fill="#9a2349" />
          {["♪", "♫", "♩", "♬", "♪"].map((n, i) => (
            <text key={i} className="ca" x={130 + i * 35} y={380} fill={i % 2 ? look.accent : "#fff"} fontSize={30 + (i % 2) * 10} style={a("ca-note", 4, i * 0.8, "ease-out infinite")}>
              {n}
            </text>
          ))}
          <path d="M60 420 H340 L360 480 H40Z" fill={look.ground} />
        </>
      );
    case "sports":
      return (
        <>
          <Cloud x={30} y={70} s={1} />
          <Cloud x={270} y={100} s={0.8} delay={1} />
          <path d="M0 360 H400 V480 H0Z" fill={look.ground} />
          {[0, 1, 2, 3].map((i) => (
            <path key={i} d={`M0 ${380 + i * 26} H400`} stroke="#fff" strokeOpacity="0.35" strokeWidth="3" strokeDasharray={i % 2 ? "0" : "14 12"} />
          ))}
          {/* A ball bouncing, with its shadow */}
          <ellipse className="ca" cx="150" cy="372" rx="26" ry="6" fill="#2a2826" opacity="0.25" style={a("ca-shadow", 1, 0, "cubic-bezier(0.5, 0, 0.5, 1) infinite")} />
          <g className="ca" style={a("ca-bounce-big", 1, 0, "cubic-bezier(0.5, 0, 0.5, 1) infinite")}>
            <circle cx="150" cy="340" r="26" fill="#fff" stroke="#2a2826" strokeWidth="2.5" />
            <path d="M150 314 L160 330 L150 344 L140 330Z M126 336 L140 330 M160 330 L174 336 M150 344 L150 366" stroke="#2a2826" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
          </g>
          {/* A trophy with a shine running across it */}
          <g transform="translate(290 300)">
            <path d="M-26 -50 H26 V-20 C 26 0, 12 10, 0 10 C -12 10, -26 0, -26 -20Z" fill="#ffd27a" stroke="#2a2826" strokeWidth="2.5" />
            <path d="M-26 -42 C -44 -42, -44 -18, -22 -16 M26 -42 C 44 -42, 44 -18, 22 -16" stroke="#2a2826" strokeWidth="2.5" fill="none" />
            <path d="M-6 10 V24 H6 V10 M-18 24 H18 V34 H-18Z" fill="#ffd27a" stroke="#2a2826" strokeWidth="2.5" strokeLinejoin="round" />
            <g transform="skewX(-20)">
              <rect className="ca" x="-34" y="-56" width="10" height="70" fill="#fff" opacity="0.6" style={a("ca-shine", 2.6, 0.5, "ease-in-out infinite")} />
            </g>
          </g>
          {Array.from({ length: 8 }, (_, i) => (
            <rect key={i} className="ca" x={40 + i * 44} y="40" width="7" height="12" rx="2" fill={["#ff8a5c", "#7fe0c4", "#ffd27a", "#b29dff"][i % 4]} style={a("ca-confetti", 3 + (i % 3) * 0.6, i * 0.35, "linear infinite")} />
          ))}
        </>
      );
    case "homes":
      return (
        <>
          <Stars n={10} />
          <circle cx="320" cy="90" r="26" fill="#fff4dc" opacity="0.9" />
          <Hills look={look} />
          {/* A little street; windows light up one by one */}
          {[
            [70, 1.0],
            [150, 1.25],
            [235, 0.95],
            [310, 1.15],
          ].map(([x, s], i) => (
            <g key={i} transform={`translate(${x} 400) scale(${s})`}>
              <path d="M-30 0 V-46 L0 -70 L30 -46 V0Z" fill={["#ffb38a", "#c9b6ff", "#8fd0b5", "#ff9fbf"][i]} stroke="#2a2826" strokeWidth="2.2" strokeLinejoin="round" />
              <rect className="ca" x="-18" y="-40" width="12" height="12" rx="2" fill="#ffd27a" stroke="#2a2826" strokeWidth="1.6" style={alt("ca-window", 1.8, i * 0.6)} />
              <rect className="ca" x="6" y="-40" width="12" height="12" rx="2" fill="#ffd27a" stroke="#2a2826" strokeWidth="1.6" style={alt("ca-window", 2.4, i * 0.9 + 0.4)} />
              <rect x="-6" y="-20" width="12" height="20" rx="2" fill="#2a2826" opacity="0.8" />
              {i === 1 && <circle className="ca" cx="16" cy="-74" r="6" fill="#fff" opacity="0.7" style={a("ca-rise", 3, 0, "ease-out infinite")} />}
            </g>
          ))}
          {/* Coins dropping into a jar */}
          {[0, 1, 2].map((i) => (
            <circle key={i} className="ca" cx="350" cy="250" r="9" fill="#ffd27a" stroke="#2a2826" strokeWidth="2" style={a("ca-coin", 2.4, i * 0.8, "ease-in infinite")} />
          ))}
          <path d="M330 330 H370 V362 Q370 372 360 372 H340 Q330 372 330 362Z" fill="#ffffff" fillOpacity="0.4" stroke="#2a2826" strokeWidth="2.2" />
        </>
      );
    case "storm":
      return (
        <>
          <Cloud x={40} y={60} s={1.4} color="#e4e8f6" />
          <Cloud x={220} y={80} s={1.2} color="#d5dbef" delay={1} />
          {Array.from({ length: 16 }, (_, i) => (
            <g key={i} className="ca" style={a("ca-rain", 0.9 + (i % 3) * 0.2, (i % 5) * 0.18, "linear infinite")}>
              <path d="M0 0 l-4 14" stroke="#fff" strokeOpacity="0.8" strokeWidth="3" strokeLinecap="round" transform={`translate(${30 + (i * 53) % 360} ${110 + (i % 4) * 20})`} />
            </g>
          ))}
          {/* An umbrella over a house, and a rainbow after */}
          <path className="ca" d="M40 400 A160 160 0 0 1 360 400" fill="none" stroke="#ff8a5c" strokeWidth="9" pathLength={1} style={{ strokeDasharray: 1, ...a("ca-rainbow", 6, 0, "ease-in-out infinite") }} />
          <path className="ca" d="M58 400 A142 142 0 0 1 342 400" fill="none" stroke="#ffd27a" strokeWidth="9" pathLength={1} style={{ strokeDasharray: 1, ...a("ca-rainbow", 6, 0.15, "ease-in-out infinite") }} />
          <path className="ca" d="M76 400 A124 124 0 0 1 324 400" fill="none" stroke="#7fe0c4" strokeWidth="9" pathLength={1} style={{ strokeDasharray: 1, ...a("ca-rainbow", 6, 0.3, "ease-in-out infinite") }} />
          <g transform="translate(200 300)">
            <g className="ca" style={{ transformOrigin: "0px 70px", transformBox: "view-box", ...alt("ca-sway", 1.8) }}>
              <path d="M-80 0 A80 60 0 0 1 80 0 Q60 -10 40 0 Q20 -10 0 0 Q-20 -10 -40 0 Q-60 -10 -80 0Z" fill={look.accent} stroke="#2a2826" strokeWidth="2.5" strokeLinejoin="round" />
              <path d="M0 0 V62 Q0 74 -12 70" stroke="#2a2826" strokeWidth="4" fill="none" strokeLinecap="round" />
            </g>
          </g>
          <path d="M0 440 H400 V480 H0Z" fill={look.ground2} />
          <g transform="translate(200 440)">
            <path d="M-32 0 V-40 L0 -66 L32 -40 V0Z" fill="#fff" stroke="#2a2826" strokeWidth="2.5" strokeLinejoin="round" />
            <rect x="-8" y="-22" width="16" height="22" rx="2" fill="#2a2826" opacity="0.8" />
          </g>
        </>
      );
    case "people":
      return (
        <>
          <Cloud x={30} y={80} s={1} />
          <Cloud x={270} y={60} s={0.8} delay={1} />
          {Array.from({ length: 10 }, (_, i) => (
            <rect key={i} className="ca" x={20 + i * 38} y="30" width="8" height="12" rx="2" fill={["#ff8a5c", "#7fe0c4", "#ffd27a", "#fff"][i % 4]} style={a("ca-confetti", 3.4 + (i % 3) * 0.5, i * 0.3, "linear infinite")} />
          ))}
          {/* A little crowd, taking turns cheering */}
          {[60, 125, 200, 275, 340].map((x, i) => {
            const c = ["#ffb38a", "#8fd0b5", "#ff9fbf", "#ffd27a", "#9dc4ff"][i];
            return (
              <g key={x} transform={`translate(${x} 410)`}>
                <g className="ca" style={a("ca-hop", 2.5, i * 0.5, "ease-in-out infinite")}>
                  <path d="M-26 40 C -26 0, 26 0, 26 40Z" fill={c} stroke="#2a2826" strokeWidth="2.2" />
                  <circle cy="-14" r="17" fill={c} stroke="#2a2826" strokeWidth="2.2" />
                  <circle cx="-6" cy="-16" r="2.2" fill="#2a2826" />
                  <circle cx="6" cy="-16" r="2.2" fill="#2a2826" />
                  <path d="M-5 -8 Q0 -4 5 -8" stroke="#2a2826" strokeWidth="2" fill="none" strokeLinecap="round" />
                  <path className="ca" d="M20 12 L34 -16" stroke="#2a2826" strokeWidth="5" strokeLinecap="round" style={{ transformOrigin: "20px 12px", transformBox: "view-box", ...a("ca-cheer", 2.5, i * 0.5, "ease-in-out infinite") }} />
                </g>
              </g>
            );
          })}
          {[0, 1, 2].map((i) => (
            <g key={i} className="ca" style={a("ca-rise", 3, i * 0.9, "ease-out infinite")}>
              <path d={HEART} transform={`translate(${150 + i * 50} 300)`} fill="#ff6b8f" />
            </g>
          ))}
        </>
      );
  }
}

const HEART = "M0 6 C -2 4, -10 -1, -10 -6 C -10 -11, -4 -12, 0 -7 C 4 -12, 10 -11, 10 -6 C 10 -1, 2 4, 0 6Z";
const LEAF = "M0 0 C 10 -12, 26 -10, 30 0 C 26 10, 10 12, 0 0Z";

function gear(r: number, teeth: number) {
  const pts: string[] = [];
  for (let i = 0; i < teeth * 2; i++) {
    const ang = (i / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 ? r : r + 7;
    const a1 = ang - Math.PI / (teeth * 2) / 1.6;
    const a2 = ang + Math.PI / (teeth * 2) / 1.6;
    pts.push(`${(Math.cos(a1) * rr).toFixed(1)} ${(Math.sin(a1) * rr).toFixed(1)}`, `${(Math.cos(a2) * rr).toFixed(1)} ${(Math.sin(a2) * rr).toFixed(1)}`);
  }
  const hole = r * 0.38;
  return `M${pts.join(" L")}Z M${hole} 0 A${hole} ${hole} 0 1 0 ${-hole} 0 A${hole} ${hole} 0 1 0 ${hole} 0Z`;
}

function produce(kind: string) {
  const s = { stroke: "#2a2826", strokeWidth: 2 };
  if (kind === "carrot") return <><path d="M0 -18 L8 18 L-8 18Z" transform="rotate(180)" fill="#ff8a3c" {...s} /><path d="M0 -20 l-6 -10 M0 -20 l0 -12 M0 -20 l6 -10" stroke="#3f9a6a" strokeWidth="3" strokeLinecap="round" /></>;
  if (kind === "pear") return <><path d="M0 -16 C 8 -16, 6 -4, 12 6 C 16 16, -16 16, -12 6 C -6 -4, -8 -16, 0 -16Z" fill="#c8e06a" {...s} /><path d="M0 -16 v-6" stroke="#6b4a2a" strokeWidth="3" /></>;
  if (kind === "bread") return <path d="M-20 6 C -22 -14, 22 -14, 20 6 Q 20 12 14 12 H-14 Q-20 12 -20 6Z" fill="#e8b06a" {...s} />;
  return <><circle r="14" fill="#ff5d6e" {...s} /><path d="M0 -14 q 2 -8 8 -10" stroke="#3f9a6a" strokeWidth="3" fill="none" strokeLinecap="round" /></>;
}

/**
 * The scene itself. It fills its box; give the box a shape (the campaign page
 * uses an arch window).
 */
export function CauseArt({ theme, className = "" }: { theme: ArtTheme; className?: string }) {
  const look = LOOKS[theme];
  return (
    <div aria-hidden className={`cause-art relative overflow-hidden ${className}`} style={{ background: `linear-gradient(180deg, ${look.sky[0]}, ${look.sky[1]} 55%, ${look.sky[2]})` }}>
      <svg viewBox="0 0 400 480" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
        {scene(theme, look)}
      </svg>
    </div>
  );
}
