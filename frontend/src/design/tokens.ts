export type DesignTokens = Record<`--${string}`, string>;

export const lightTokens: DesignTokens = {
  '--mc-canvas': '#f6f7f9',
  '--mc-surface': '#ffffff',
  '--mc-surface-subtle': '#eef1f5',
  '--mc-sidebar': '#101828',
  '--mc-sidebar-raised': '#1d2939',
  '--mc-text': '#172033',
  '--mc-text-muted': '#5f6b7d',
  '--mc-text-faint': '#8b95a5',
  '--mc-line': '#e3e7ed',
  '--mc-line-strong': '#cfd6df',
  '--mc-accent': '#315fce',
  '--mc-accent-strong': '#244cae',
  '--mc-accent-soft': '#eaf0ff',
  '--mc-warning': '#a15c12',
  '--mc-danger': '#c2414b',
  '--mc-radius-sm': '7px',
  '--mc-radius-md': '11px',
  '--mc-radius-lg': '16px',
  '--mc-shadow': '0 16px 40px rgba(23, 32, 51, 0.10)',
};

export function applyDesignTokens(tokens: DesignTokens = lightTokens) {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(tokens)) root.style.setProperty(name, value);
}
