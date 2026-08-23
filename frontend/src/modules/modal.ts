import { $, esc } from '../core/index';

/* --------------------------- Modal --------------------------- */
let returnFocus: HTMLElement | null = null;
let cleanupTimer: number | undefined;

const MODAL_FOCUSABLE = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex="0"]';

function focusWithoutScroll(target: HTMLElement | null) {
  if (!target) return;
  try { target.focus({ preventScroll: true }); }
  catch { target.focus(); }
}

function showModal({ title, body, onMount }) {
  const modal = $('#modal') as HTMLDivElement;
  const card = $('#modalCard') as HTMLDivElement;
  const app = $('#app') as HTMLDivElement;
  const settings = $('#settings') as HTMLDivElement;
  const headingId = `modalTitle-${Date.now()}`;
  if (cleanupTimer !== undefined) {
    window.clearTimeout(cleanupTimer);
    cleanupTimer = undefined;
  }
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  card.className = 'modal-card';
  card.innerHTML = `<div class="modal-heading"><h3 id="${headingId}">${esc(title || '')}</h3><button type="button" class="modal-close" aria-label="关闭弹窗" title="关闭">✕</button></div>${body || ''}`;
  modal.setAttribute('aria-labelledby', headingId);
  modal.setAttribute('aria-hidden', 'false');
  modal.inert = false;
  modal.classList.add('open');
  const closeButton = card.querySelector<HTMLButtonElement>('.modal-close');
  if (closeButton) closeButton.onclick = closeModal;
  if (onMount) onMount(card);
  const first = Array.from(card.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE))
    .find(element => !element.classList.contains('modal-close'));
  focusWithoutScroll(first || card);

  // Focus must leave the underlying surface before it becomes inert.
  app.inert = true;
  settings.inert = true;
}
function closeModal() {
  const modal = $('#modal') as HTMLDivElement;
  const app = $('#app') as HTMLDivElement;
  const settings = $('#settings') as HTMLDivElement;
  if (!modal.classList.contains('open')) return;

  const settingsOpen = settings.classList.contains('open');
  const destination = settingsOpen ? settings : app;
  app.inert = settingsOpen;
  settings.inert = !settingsOpen;

  const fallback = settingsOpen
    ? ($('#settingsBody') as HTMLElement)
    : ($('#settingsBtn') as HTMLElement);
  const target = returnFocus?.isConnected && destination.contains(returnFocus)
    ? returnFocus
    : fallback;

  // Move focus synchronously before aria-hidden/inert hide its current ancestor.
  focusWithoutScroll(target);
  if (modal.contains(document.activeElement)) focusWithoutScroll(fallback);

  modal.classList.remove('open');
  modal.inert = true;
  modal.setAttribute('aria-hidden', 'true');
  returnFocus = null;
  cleanupTimer = window.setTimeout(() => {
    if (!modal.classList.contains('open')) $('#modalCard').innerHTML = '';
    cleanupTimer = undefined;
  }, 160);
}
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', event => {
  const modal = $('#modal') as HTMLDivElement;
  if (!modal.classList.contains('open')) return;
  if (event.key === 'Escape') { event.preventDefault(); closeModal(); return; }
  if (event.key !== 'Tab') return;
  const card = $('#modalCard') as HTMLDivElement;
  const focusable = Array.from(card.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE));
  if (!focusable.length) { event.preventDefault(); card.focus(); return; }
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});

export { showModal,closeModal };
