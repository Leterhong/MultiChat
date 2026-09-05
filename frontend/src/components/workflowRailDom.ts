function railElement() {
  return document.getElementById('workflowRail');
}

function toggleElement() {
  return document.getElementById('workflowRailToggle');
}

let lastRailTrigger: HTMLElement | null = null;

export function workflowRailUsesDrawer() {
  return true;
}

export function setWorkflowRailOpen(open: boolean, options: { focusRail?: boolean; restoreFocus?: boolean } = {}) {
  const drawer = workflowRailUsesDrawer();
  const visible = !drawer || open;
  const rail = railElement();
  const fallback = lastRailTrigger && document.contains(lastRailTrigger) ? lastRailTrigger : toggleElement();

  // Focus must leave the drawer before aria-hidden/inert hides its ancestor.
  if (!visible && rail?.contains(document.activeElement)) fallback?.focus({ preventScroll: true });

  document.body.classList.toggle('workflow-rail-open', drawer && open);
  toggleElement()?.setAttribute('aria-expanded', String(visible));

  if (rail) {
    rail.toggleAttribute('inert', !visible);
    rail.setAttribute('aria-hidden', String(!visible));
  }

  if (open && options.focusRail !== false) {
    window.setTimeout(() => railElement()?.focus({ preventScroll: true }), 0);
  } else if (!open && options.restoreFocus && document.activeElement !== fallback) {
    window.setTimeout(() => fallback?.focus({ preventScroll: true }), 0);
  }
}

export function openWorkflowRail(tab: 'run' | 'plan' | 'activity' | 'context' | 'metrics' = 'run') {
  lastRailTrigger =
    document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement
      : null;
  window.dispatchEvent(new CustomEvent('multichat:workflowtab', { detail: { tab } }));
  (document.querySelector(`[data-workflow-tab="${tab}"]`) as HTMLButtonElement | null)?.click();
  setWorkflowRailOpen(true);
}

export function syncWorkflowRailLayout() {
  const requestedOpen = document.body.classList.contains('workflow-rail-open');
  setWorkflowRailOpen(requestedOpen, { focusRail: false });
}
