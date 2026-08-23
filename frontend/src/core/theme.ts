export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'multichat_theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

function normalizeTheme(value: string | null): ThemePreference {
  return value === 'dark' || value === 'system' ? value : 'light';
}

export function getTheme(): ThemePreference {
  return normalizeTheme(localStorage.getItem(STORAGE_KEY));
}

export function applyTheme(preference: ThemePreference = getTheme()): void {
  const resolved = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.style.colorScheme = resolved;
}

export function setTheme(preference: ThemePreference): void {
  localStorage.setItem(STORAGE_KEY, preference);
  applyTheme(preference);
}

media.addEventListener('change', () => {
  if (getTheme() === 'system') applyTheme('system');
});
