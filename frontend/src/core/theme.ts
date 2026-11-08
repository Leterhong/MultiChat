export type ThemePreference = 'light' | 'dark' | 'system';
export type SkinPreference = 'blue' | 'graphite' | 'teal';
export type DensityPreference = 'comfortable' | 'compact';

const STORAGE_KEY = 'multichat_theme';
const SKIN_KEY = 'multichat_skin';
const DENSITY_KEY = 'multichat_density';
const media = window.matchMedia('(prefers-color-scheme: dark)');

function normalizeTheme(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'dark';
}

function normalizeSkin(value: string | null): SkinPreference {
  return value === 'graphite' || value === 'teal' ? value : 'blue';
}

function normalizeDensity(value: string | null): DensityPreference {
  return value === 'compact' ? value : 'comfortable';
}

export function getTheme(): ThemePreference {
  return normalizeTheme(localStorage.getItem(STORAGE_KEY));
}

export function getSkin(): SkinPreference {
  return normalizeSkin(localStorage.getItem(SKIN_KEY));
}

export function getDensity(): DensityPreference {
  return normalizeDensity(localStorage.getItem(DENSITY_KEY));
}

/** Applies the primitive-layer switches (accent skin + spacing density). */
export function applyAppearance(): void {
  const skin = getSkin();
  const density = getDensity();
  document.documentElement.dataset.skin = skin;
  document.documentElement.dataset.density = density;
  window.dispatchEvent(new CustomEvent('multichat:appearancechange', { detail: { skin, density } }));
}

export function setSkin(skin: SkinPreference): void {
  localStorage.setItem(SKIN_KEY, normalizeSkin(skin));
  applyAppearance();
}

export function setDensity(density: DensityPreference): void {
  localStorage.setItem(DENSITY_KEY, normalizeDensity(density));
  applyAppearance();
}

export function applyTheme(preference: ThemePreference = getTheme()): void {
  const resolved = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.style.colorScheme = resolved;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute('content', resolved === 'dark' ? '#1e1e2e' : '#f7f8fa');
  applyAppearance();
  window.dispatchEvent(new CustomEvent('multichat:themechange', { detail: { preference, resolved } }));
}

export function setTheme(preference: ThemePreference): void {
  localStorage.setItem(STORAGE_KEY, preference);
  applyTheme(preference);
}

media.addEventListener('change', () => {
  if (getTheme() === 'system') applyTheme('system');
});
