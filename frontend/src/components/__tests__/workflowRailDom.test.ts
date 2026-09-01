import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openWorkflowRail, setWorkflowRailOpen, syncWorkflowRailLayout } from '../workflowRailDom';

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
}

describe('workflow rail responsive behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.className = '';
    document.body.innerHTML = `
      <button id="workflowRailToggle" aria-expanded="false"></button>
      <button data-workflow-tab="plan"></button>
      <aside id="workflowRail" tabindex="-1"></aside>
    `;
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.className = '';
    document.body.innerHTML = '';
  });

  it('removes a closed narrow drawer from focus and accessibility navigation', () => {
    setViewportWidth(900);
    syncWorkflowRailLayout();

    const rail = document.getElementById('workflowRail')!;
    expect(rail.getAttribute('aria-hidden')).toBe('true');
    expect(rail.hasAttribute('inert')).toBe(true);
    expect(document.getElementById('workflowRailToggle')?.getAttribute('aria-expanded')).toBe('false');

    openWorkflowRail('plan');
    vi.runAllTimers();
    expect(document.body.classList.contains('workflow-rail-open')).toBe(true);
    expect(rail.getAttribute('aria-hidden')).toBe('false');
    expect(rail.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(rail);

    setWorkflowRailOpen(false, { restoreFocus: true });
    vi.runAllTimers();
    expect(document.activeElement).toBe(document.getElementById('workflowRailToggle'));
    expect(rail.hasAttribute('inert')).toBe(true);
  });

  it('keeps the rail visible and accessible on a wide workspace', () => {
    setViewportWidth(1536);
    syncWorkflowRailLayout();

    const rail = document.getElementById('workflowRail')!;
    expect(document.body.classList.contains('workflow-rail-open')).toBe(false);
    expect(rail.getAttribute('aria-hidden')).toBe('false');
    expect(rail.hasAttribute('inert')).toBe(false);
    expect(document.getElementById('workflowRailToggle')?.getAttribute('aria-expanded')).toBe('true');
  });
});
