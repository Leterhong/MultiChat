type MascotProps = {
  size?: number;
  className?: string;
};

/**
 * MultiChat 的吉祥物。与品牌标共用同一套语言：单色强调色、圆头描边、
 * 实心核，无渐变、无杂色。配色全部由 CSS token 提供，随皮肤与明暗变化。
 */
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
      <g className="mascot">
        <path className="mascot-ear-l" d="M14 18 L10 6 Q9.4 4.6 10.8 5.2 L23 11 Z" />
        <path className="mascot-ear-r" d="M50 18 L54 6 Q54.6 4.6 53.2 5.2 L41 11 Z" />
        <rect className="mascot-head" x="8" y="12" width="48" height="42" rx="16" />
        <g className="mascot-face">
          <ellipse cx="23" cy="32" rx="4.2" ry="5.2" />
          <ellipse cx="41" cy="32" rx="4.2" ry="5.2" />
          <path d="M28 40 Q32 43.5 36 40" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}
