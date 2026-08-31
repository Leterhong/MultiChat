import type { CSSProperties } from 'react';

type BrandMarkProps = {
  className?: string;
  size?: number;
};

/**
 * MultiChat 的唯一品牌图形。
 * 两个相连的对话窗代表“同一上下文，多模型协作”，圆点代表可核对的运行结果。
 */
export function BrandMark({ className = '', size = 34 }: BrandMarkProps) {
  return <span
    className={`brand-mark${className ? ` ${className}` : ''}`}
    style={{ '--brand-mark-size': `${size}px` } as CSSProperties}
    aria-hidden="true"
  >
    <svg viewBox="0 0 36 36" focusable="false">
      <path d="M8.4 7.5h12.1a4.9 4.9 0 0 1 4.9 4.9v4.8a4.9 4.9 0 0 1-4.9 4.9h-5.9l-4.8 3.7v-3.9a4.9 4.9 0 0 1-6.3-4.7v-4.8a4.9 4.9 0 0 1 4.9-4.9Z" />
      <path d="M16.1 13.9h11.5a4.9 4.9 0 0 1 4.9 4.9v4.8a4.9 4.9 0 0 1-6.2 4.7v3.8l-4.9-3.6h-5.3a4.9 4.9 0 0 1-4.9-4.9v-4.8a4.9 4.9 0 0 1 4.9-4.9Z" />
      <circle cx="18" cy="21.2" r="1.5" />
      <circle cx="23.1" cy="21.2" r="1.5" />
    </svg>
  </span>;
}

type ModelGlyphProps = {
  name: string;
  className?: string;
};

function initials(name: string) {
  const normalized = name.trim();
  if (!normalized) return 'M';
  const words = normalized.split(/[\s._-]+/).filter(Boolean);
  if (words.length > 1) return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  return Array.from(normalized).slice(0, 2).join('').toUpperCase();
}

function tone(name: string) {
  return Array.from(name).reduce((sum, char) => sum + (char.codePointAt(0) || 0), 0) % 6;
}

export function ModelGlyph({ name, className = '' }: ModelGlyphProps) {
  return <span className={`model-glyph tone-${tone(name)}${className ? ` ${className}` : ''}`} aria-hidden="true">{initials(name)}</span>;
}
