import { CAUSES, CAUSE_GROUPS, type CauseId } from "@/lib/taxonomy";

// Campaigns don't have photos yet, so each gets a generated typographic cover:
// a color per cause group, one of four patterns, and its main cause set large.
const GROUP_COLORS: Record<string, { bg: string; fg: string }> = {
  "Education & youth": { bg: "#FFB23D", fg: "#111113" },
  Health: { bg: "#FF3D7F", fg: "#111113" },
  "Basic needs & community": { bg: "#FF6A3D", fg: "#111113" },
  "Environment & animals": { bg: "#2FA36B", fg: "#0B1A12" },
  "Arts, culture & sports": { bg: "#7B5CFF", fg: "#FFFFFF" },
  "Equity & rights": { bg: "#E0369B", fg: "#FFFFFF" },
  "Economy & work": { bg: "#2F6BFF", fg: "#FFFFFF" },
  "Global, civic & faith": { bg: "#14A3A3", fg: "#0A1A1A" },
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function coverColors(cause: CauseId | undefined) {
  const group = CAUSE_GROUPS.find((g) => cause && g.ids.includes(cause))?.label ?? "Basic needs & community";
  return GROUP_COLORS[group];
}

export function CoverArt({
  id,
  cause,
  label,
  className = "",
}: {
  id: string;
  cause?: CauseId;
  label?: string; // small mono caption, e.g. "Event · Denver"
  className?: string;
}) {
  const { bg, fg } = coverColors(cause);
  const h = hash(id);
  const pattern = h % 4;
  const word = cause ? CAUSES[cause].split(/[ &]/)[0] : "Community";
  const pid = `p-${id.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: bg, color: fg }}>
      <svg aria-hidden className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 250">
        <defs>
          <linearGradient id={`${pid}-g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#000000" stopOpacity="0.12" />
          </linearGradient>
          <pattern id={`${pid}-dots`} width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.4" fill={fg} opacity="0.22" />
          </pattern>
          <pattern id={`${pid}-grid`} width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke={fg} strokeOpacity="0.16" />
          </pattern>
        </defs>
        <rect width="400" height="250" fill={`url(#${pid}-g)`} />
        {pattern === 0 &&
          [60, 100, 140, 180].map((r) => (
            <circle key={r} cx={320 - (h % 60)} cy={60 + (h % 40)} r={r} fill="none" stroke={fg} strokeOpacity="0.18" strokeWidth="1.5" />
          ))}
        {pattern === 1 && <rect width="400" height="250" fill={`url(#${pid}-grid)`} />}
        {pattern === 2 && <rect width="400" height="250" fill={`url(#${pid}-dots)`} />}
        {pattern === 3 &&
          Array.from({ length: 9 }, (_, i) => (
            <path key={i} d={`M${-100 + i * 60} 260 L${60 + i * 60} -10`} stroke={fg} strokeOpacity="0.14" strokeWidth="14" />
          ))}
        {/* Accent dot stays in the upper area so it never sits on the cause word. */}
        <circle cx={200 + (h % 150)} cy={52 + (h % 50)} r={22 + (h % 16)} fill={fg} opacity="0.9" />
      </svg>
      <span
        className={`display absolute -bottom-[0.18em] left-3 select-none font-bold leading-none opacity-90 ${
          word.length > 9 ? "text-[clamp(2rem,7vw,4rem)] sm:text-[clamp(2rem,3.4vw,4rem)]" : "text-[clamp(2.5rem,9vw,5.5rem)] sm:text-[clamp(2.5rem,5vw,5.5rem)]"
        }`}
      >
        {word}
      </span>
      {label && <span className="eyebrow absolute left-3 top-3 bg-black/80 px-1.5 py-0.5 text-[9px] text-white">{label}</span>}
    </div>
  );
}
