import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../store/appStore';
import { AppShell } from '../AppShell';

describe('AppShell navigation', () => {
  beforeEach(() => {
    document.body.className = '';
    useAppStore.setState({ ready: true, actions: {} });
  });

  it('has no detectable accessibility violations and exposes one settings entry', async () => {
    const openSettings = vi.fn();
    useAppStore.setState({ ready: true, actions: { openSettings } });
    const { container } = render(<AppShell />);
    expect(screen.getAllByRole('button', { name: /^设置$/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /^设置$/ }));
    expect(openSettings).toHaveBeenCalledWith('general');
    expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations();
  });

  it('closes the mobile drawer before opening a workspace section', () => {
    const openSettings = vi.fn();
    useAppStore.setState({ ready: true, actions: { openSettings } });
    render(<AppShell />);
    const sidebar = document.getElementById('sidebar')!;
    const main = document.querySelector<HTMLElement>('.main')!;
    sidebar.classList.add('open');
    main.inert = true;
    document.body.classList.add('mobile-nav-open');

    fireEvent.click(screen.getByRole('button', { name: /^模型实验$/ }));

    expect(openSettings).toHaveBeenCalledWith('experiment');
    expect(sidebar).not.toHaveClass('open');
    expect(main.inert).toBe(false);
    expect(document.body).not.toHaveClass('mobile-nav-open');
  });
});
