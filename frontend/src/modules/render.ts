import { refreshAppView } from '../store/appStore';

/**
 * Compatibility bridge for modules that still mutate the shared runtime
 * object. React owns the workspace DOM; legacy modules only request a view
 * refresh and never rebuild the conversation with innerHTML.
 */
function renderContent() {
  refreshAppView();
}

function autoresize(element: HTMLTextAreaElement | null) {
  if (!element) return;
  element.style.height = 'auto';
  element.style.height = `${Math.min(240, element.scrollHeight)}px`;
}

export { autoresize, renderContent };
