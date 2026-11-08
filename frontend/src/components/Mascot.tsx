type MascotProps = {
  size?: number;
  className?: string;
};

/** MultiChat 的吉祥物：一只圆滚滚的执行小猫（渐变外壳 + 发光眼睛）。 */
export function Mascot({ size = 64, className = '' }: MascotProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="mascot-head" x1="8" y1="6" x2="56" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8fb0fb" />
          <stop offset="0.55" stopColor="#5b83f8" />
          <stop offset="1" stopColor="#7fa0fa" />
        </linearGradient>
        <linearGradient id="mascot-head-light" x1="8" y1="6" x2="56" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3b6cf6" />
          <stop offset="0.55" stopColor="#2f59dc" />
          <stop offset="1" stopColor="#4b7af0" />
        </linearGradient>
      </defs>
      <g className="mascot">
        <path
          className="mascot-ear-l"
          d="M14 18 L10 6 Q9.4 4.6 10.8 5.2 L23 11 Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          className="mascot-ear-r"
          d="M50 18 L54 6 Q54.6 4.6 53.2 5.2 L41 11 Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <rect
          className="mascot-head"
          x="8"
          y="12"
          width="48"
          height="42"
          rx="16"
          fill="url(#mascot-head)"
          stroke="currentColor"
          strokeWidth="2"
        />
        <rect x="26" y="8" width="12" height="7" rx="3" className="mascot-antenna" stroke="currentColor" strokeWidth="2" />
        <circle className="mascot-antenna-dot" cx="32" cy="5" r="3" stroke="currentColor" strokeWidth="2" />
        <g className="mascot-face">
          <ellipse cx="23" cy="32" rx="4.2" ry="5.2" fill="#1e1e2e" />
          <ellipse cx="41" cy="32" rx="4.2" ry="5.2" fill="#1e1e2e" />
          <circle cx="24.5" cy="30" r="1.4" fill="#ffffff" />
          <circle cx="42.5" cy="30" r="1.4" fill="#ffffff" />
          <path d="M28 40 Q32 43.5 36 40" stroke="#1e1e2e" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <ellipse cx="15.5" cy="38" rx="2.6" ry="1.7" fill="#f5c2e7" opacity="0.85" />
          <ellipse cx="48.5" cy="38" rx="2.6" ry="1.7" fill="#f5c2e7" opacity="0.85" />
        </g>
      </g>
    </svg>
  );
}
