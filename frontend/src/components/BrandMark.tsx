import type { CSSProperties } from 'react';

type BrandMarkProps = {
  className?: string;
  size?: number;
};

/** MultiChat 的唯一品牌图形：四条能力轨道汇入一个可验证的执行核心。 */
export function BrandMark({ className = '', size = 34 }: BrandMarkProps) {
  return (
    <span
      className={`brand-mark${className ? ` ${className}` : ''}`}
      style={{ '--brand-mark-size': `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      <svg viewBox="0 0 36 36" focusable="false">
        <path className="brand-frame" d="M11 5.5h14l7 7v11l-7 7H11l-7-7v-11l7-7Z" />
        <path className="brand-flow" d="M9 11.5h5.2l3.8 5.1 3.8-5.1H27M9 24.5h5.2l3.8-5.1 3.8 5.1H27" />
        <circle cx="9" cy="11.5" r="1.5" />
        <circle cx="27" cy="11.5" r="1.5" />
        <circle cx="9" cy="24.5" r="1.5" />
        <circle cx="27" cy="24.5" r="1.5" />
        <circle className="brand-core" cx="18" cy="18" r="2.7" />
      </svg>
    </span>
  );
}

type ModelGlyphProps = {
  name: string;
  className?: string;
};

function initials(name: string) {
  const normalized = name.trim();
  if (!normalized) return 'M';
  const words = normalized.split(/[\s._-]+/).filter(Boolean);
  if (words.length > 1)
    return words
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase();
  return Array.from(normalized).slice(0, 2).join('').toUpperCase();
}

function tone(name: string) {
  return Array.from(name).reduce((sum, char) => sum + (char.codePointAt(0) || 0), 0) % 6;
}

export function ModelGlyph({ name, className = '' }: ModelGlyphProps) {
  return (
    <span className={`model-glyph tone-${tone(name)}${className ? ` ${className}` : ''}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
