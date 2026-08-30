import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTheme, setTheme } from '../theme';

describe('theme preferences', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme-preference');
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
