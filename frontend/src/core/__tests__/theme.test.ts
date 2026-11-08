import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyAppearance,
  applyTheme,
  getDensity,
  getSkin,
  getTheme,
  setDensity,
  setSkin,
  setTheme,
} from '../theme';

describe('theme preferences', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme-preference');
    document.documentElement.removeAttribute('data-skin');
    document.documentElement.removeAttribute('data-density');
  });

  it('defaults to the product dark theme', () => {
    expect(getTheme()).toBe('dark');
  });

  it('notifies every mounted surface when settings change the theme', () => {
    const listener = vi.fn();
    window.addEventListener('multichat:themechange', listener);

    setTheme('light');

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.dataset.themePreference).toBe('light');
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener('multichat:themechange', listener);
  });
});

describe('appearance primitives (skin + density)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-skin');
    document.documentElement.removeAttribute('data-density');
  });

  it('defaults to the blue workbench skin and standard density', () => {
    expect(getSkin()).toBe('blue');
    expect(getDensity()).toBe('comfortable');
  });

  it('seeds both data attributes from the single theme entry point', () => {
    localStorage.setItem('multichat_skin', 'teal');
    localStorage.setItem('multichat_density', 'compact');
    applyTheme('light');
    expect(document.documentElement.dataset.skin).toBe('teal');
    expect(document.documentElement.dataset.density).toBe('compact');
  });

  it('persists skin and density and notifies mounted surfaces', () => {
    const listener = vi.fn();
    window.addEventListener('multichat:appearancechange', listener);

    setSkin('graphite');
    setDensity('compact');

    expect(getSkin()).toBe('graphite');
    expect(getDensity()).toBe('compact');
    expect(document.documentElement.dataset.skin).toBe('graphite');
    expect(document.documentElement.dataset.density).toBe('compact');
    expect(listener).toHaveBeenCalledTimes(2);
    window.removeEventListener('multichat:appearancechange', listener);
  });

  it('normalizes unknown stored values instead of leaking them into the DOM', () => {
    localStorage.setItem('multichat_skin', 'neon-pink');
    localStorage.setItem('multichat_density', 'tiny');
    applyAppearance();
    expect(document.documentElement.dataset.skin).toBe('blue');
    expect(document.documentElement.dataset.density).toBe('comfortable');
  });
});
