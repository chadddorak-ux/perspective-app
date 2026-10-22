// Peep in 2D: the logo mark and the little sticker version. Big notched
// ears, huge glossy eyes, a grin with one fang. The ears flick when a parent
// `.group` is hovered.

export function PeepMark({ className = "", title }: { className?: string; title?: string }) {
  const ear = { transformBox: "fill-box", transition: "transform 0.35s cubic-bezier(0.3, 1.6, 0.5, 1)" } as React.CSSProperties;
  return (
    <svg viewBox="0 0 64 54" className={className} aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <g className="group-hover:-rotate-[12deg]" style={{ ...ear, transformOrigin: "100% 100%" }}>
        <path d="M19 27 Q6 22 2 5 Q10 7 14 12 L15 9 Q21 16 24 22 Z" fill="#86d8bd" />
        <path d="M18 23.5 Q9 19 6 9.5 Q11 12 13.5 15 L14.5 13.5 Q18.5 18 20.5 21.5 Z" fill="#ff98c0" />
      </g>
      <g className="group-hover:rotate-[12deg]" style={{ ...ear, transformOrigin: "0% 100%" }}>
        <path d="M45 27 Q58 22 62 5 Q54 7 50 12 L49 9 Q43 16 40 22 Z" fill="#86d8bd" />
        <path d="M46 23.5 Q55 19 58 9.5 Q53 12 50.5 15 L49.5 13.5 Q45.5 18 43.5 21.5 Z" fill="#ff98c0" />
      </g>
      <path d="M32 7.5 L34.5 14 H29.5 Z" fill="#b29dff" />
      <path d="M27.8 9.5 L30.5 14.5 H27 Z" fill="#b29dff" />
      <path d="M36.2 9.5 L37 14.5 H33.5 Z" fill="#b29dff" />
      <ellipse cx="32" cy="45" rx="11" ry="8" fill="#86d8bd" />
      <ellipse cx="32" cy="47" rx="6.5" ry="5" fill="#e9fbf2" />
      <ellipse cx="32" cy="30" rx="19" ry="15.5" fill="#86d8bd" />
      <ellipse cx="18.5" cy="35" rx="2.6" ry="1.5" fill="#ff8db3" opacity="0.6" />
      <ellipse cx="45.5" cy="35" rx="2.6" ry="1.5" fill="#ff8db3" opacity="0.6" />
      {[24, 40].map((cx, i) => (
        <g key={cx}>
          <ellipse cx={cx} cy="29" rx="6" ry="6.8" fill="#fdfcff" />
          <ellipse cx={cx + (i ? -0.4 : 0.4)} cy="29.6" rx="4.9" ry="5.6" fill="#1d1536" />
          <ellipse cx={cx + (i ? -0.4 : 0.4)} cy="29.6" rx="3.5" ry="4" fill="none" stroke="#3a2a6e" strokeWidth="0.9" />
          <circle cx={cx + 1.6} cy="27" r="1.6" fill="#fff" />
          <circle cx={cx - 1.4} cy="32" r="0.8" fill="#fff" />
          <path d={i ? `M${cx - 4} 21.2 L${cx + 4} 20.4` : `M${cx - 4} 20.4 L${cx + 4} 21.2`} stroke="#3f9a83" strokeWidth="1.4" strokeLinecap="round" />
        </g>
      ))}
      <ellipse cx="32" cy="35.5" rx="2.8" ry="1.8" fill="#2a2046" />
      <path d="M27 39.2 Q32 43.4 37 39.2" stroke="#2b1430" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M34.4 40.6 L35.3 43 L36.2 40.2 Z" fill="#fff" />
    </svg>
  );
}
