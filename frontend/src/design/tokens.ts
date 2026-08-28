export type DesignTokens = Record<`--${string}`, string>;

export const lightTokens: DesignTokens = {
  '--mc-canvas': '#f3f4ef',
  '--mc-surface': '#ffffff',
  '--mc-surface-subtle': '#eceee8',
  '--mc-sidebar': '#171915',
  '--mc-sidebar-raised': '#22251f',
  '--mc-text': '#20231e',
  '--mc-text-muted': '#677065',
  '--mc-text-faint': '#92998f',
  '--mc-line': '#dfe3da',
  '--mc-line-strong': '#cbd1c6',
  '--mc-accent': '#287254',
  '--mc-accent-strong': '#1f5c43',
  '--mc-accent-soft': '#e1eee7',
  '--mc-warning': '#9a641d',
  '--mc-danger': '#b64242',
  '--mc-radius-sm': '6px',
  '--mc-radius-md': '10px',
  '--mc-radius-lg': '14px',
  '--mc-shadow': '0 12px 32px rgba(31, 36, 29, 0.08)',
};

export function applyDesignTokens(tokens: DesignTokens = lightTokens) {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(tokens)) root.style.setProperty(name, value);
}
