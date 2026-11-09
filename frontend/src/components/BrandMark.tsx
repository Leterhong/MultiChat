import type { CSSProperties } from 'react';

type BrandMarkProps = {
  className?: string;
  size?: number;
};

/** MultiChat 的唯一品牌图形：两路输入汇流成一个可验证的答案核心。 */
export function BrandMark({ className = '', size = 34 }: BrandMarkProps) {
  return (
    <span
      className={`brand-mark${className ? ` ${className}` : ''}`}
      style={{ '--brand-mark-size': `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      <svg viewBox="0 0 36 36" focusable="false">
        <path className="brand-arc" d="M7.5 15.5a11 11 0 0 1 21 0" />
        <path className="brand-arc" d="M28.5 20.5a11 11 0 0 1-21 0" />
        <circle className="brand-core" cx="18" cy="18" r="4.3" />
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
