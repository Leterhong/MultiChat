import { notifyMessagesChanged } from '../core/state';

/**
 * Compatibility bridge for modules that still mutate the shared runtime
 * object. React owns the workspace DOM; legacy modules only request a view
 * refresh and never rebuild the conversation with innerHTML.
 */
function renderContent() {
  notifyMessagesChanged();
}

function autoresize(element: HTMLTextAreaElement | null) {
  if (!element) return;
  element.style.height = 'auto';
  element.style.height = `${Math.min(240, element.scrollHeight)}px`;
}

export { autoresize, renderContent };
