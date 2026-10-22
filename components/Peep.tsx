// Peep in 2D: the logo mark and small avatar. Ears flick when a parent
// `.group` is hovered.

export function PeepMark({ className = "", title }: { className?: string; title?: string }) {
  const ear = { transformBox: "fill-box", transition: "transform 0.35s cubic-bezier(0.3, 1.6, 0.5, 1)" } as React.CSSProperties;
  return (
    <svg viewBox="0 0 64 50" className={className} aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <g className="group-hover:-rotate-[14deg]" style={{ ...ear, transformOrigin: "100% 70%" }}>
        <path d="M22 24 Q8 27 1 13 Q13 10 24 17 Z" fill="#8fdcbd" />
        <path d="M20 21.5 Q11 22 5.5 14.5 Q13 13 20.5 18 Z" fill="#ff9fc4" />
      </g>
      <g className="group-hover:rotate-[14deg]" style={{ ...ear, transformOrigin: "0% 70%" }}>
        <path d="M42 24 Q56 27 63 13 Q51 10 40 17 Z" fill="#8fdcbd" />
        <path d="M44 21.5 Q53 22 58.5 14.5 Q51 13 43.5 18 Z" fill="#ff9fc4" />
      </g>
      <path d="M32 4.5 L34.6 12 H29.4 Z" fill="#b7a3ff" />
      <path d="M27.5 7 L30.5 12.5 H26.6 Z" fill="#b7a3ff" />
      <path d="M36.5 7 L37.4 12.5 H33.5 Z" fill="#b7a3ff" />
      <ellipse cx="32" cy="29" rx="15.5" ry="16.5" fill="#8fdcbd" />
      <ellipse cx="32" cy="40" rx="8" ry="4.6" fill="#ecfbf2" />
      <ellipse cx="22.6" cy="31.5" rx="2.2" ry="1.3" fill="#ff8db3" opacity="0.65" />
      <ellipse cx="41.4" cy="31.5" rx="2.2" ry="1.3" fill="#ff8db3" opacity="0.65" />
      {[26.3, 37.7].map((cx) => (
        <g key={cx}>
          <ellipse cx={cx} cy="25.5" rx="4.4" ry="4.9" fill="#fdfcff" />
          <ellipse cx={cx + 0.4} cy="26.1" rx="3.1" ry="3.4" fill="#2a2046" />
          <circle cx={cx + 1.5} cy="24.8" r="1.1" fill="#fff" />
        </g>
      ))}
      <path d="M28.8 32.4 Q32 35.2 35.2 32.4" stroke="#3b2342" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M33.4 33.6 L34.2 35.6 L35 33.4 Z" fill="#fff" />
    </svg>
  );
}
