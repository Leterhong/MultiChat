const WORKFLOW_RAIL_BREAKPOINT = 1240;

function railElement() {
  return document.getElementById('workflowRail');
}

function toggleElement() {
  return document.getElementById('workflowRailToggle');
}

export function workflowRailUsesDrawer() {
  return window.innerWidth <= WORKFLOW_RAIL_BREAKPOINT;
}

export function setWorkflowRailOpen(open: boolean, options: { focusRail?: boolean; restoreFocus?: boolean } = {}) {
  const drawer = workflowRailUsesDrawer();
  const visible = !drawer || open;
  const rail = railElement();

  document.body.classList.toggle('workflow-rail-open', drawer && open);
  toggleElement()?.setAttribute('aria-expanded', String(visible));

  if (rail) {
    rail.toggleAttribute('inert', !visible);
    rail.setAttribute('aria-hidden', String(!visible));
  }

  if (open && options.focusRail !== false) {
    window.setTimeout(() => railElement()?.focus({ preventScroll: true }), 0);
  } else if (!open && options.restoreFocus) {
    window.setTimeout(() => toggleElement()?.focus({ preventScroll: true }), 0);
  }
}

export function openWorkflowRail(tab: 'run' | 'plan' | 'activity' = 'run') {
  (document.querySelector(`[data-workflow-tab="${tab}"]`) as HTMLButtonElement | null)?.click();
  setWorkflowRailOpen(true);
}

export function syncWorkflowRailLayout() {
  const drawer = workflowRailUsesDrawer();
  const requestedOpen = document.body.classList.contains('workflow-rail-open');
  setWorkflowRailOpen(drawer ? requestedOpen : true, { focusRail: false });
}
