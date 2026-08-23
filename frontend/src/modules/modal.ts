import { $, esc } from '../core/index';

/* --------------------------- Modal --------------------------- */
let returnFocus: HTMLElement | null = null;
function showModal({ title, body, onMount }) {
  const modal = $('#modal') as HTMLDivElement;
  const card = $('#modalCard') as HTMLDivElement;
  const app = $('#app') as HTMLDivElement;
  const settings = $('#settings') as HTMLDivElement;
  const headingId = `modalTitle-${Date.now()}`;
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  app.inert = true;
  settings.inert = true;
  card.className = 'modal-card';
  card.innerHTML = `<div class="modal-heading"><h3 id="${headingId}">${esc(title || '')}</h3><button type="button" class="modal-close" aria-label="关闭弹窗" title="关闭">✕</button></div>${body || ''}`;
  modal.setAttribute('aria-labelledby', headingId);
  modal.setAttribute('aria-hidden', 'false');
  modal.inert = false;
  modal.classList.add('open');
  const closeButton = card.querySelector<HTMLButtonElement>('.modal-close');
  if (closeButton) closeButton.onclick = closeModal;
  if (onMount) onMount(card);
  window.requestAnimationFrame(() => {
    const first = card.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not(.modal-close):not([disabled]), [tabindex="0"]');
    (first || card).focus();
  });
}
function closeModal() {
  const modal = $('#modal') as HTMLDivElement;
  const app = $('#app') as HTMLDivElement;
  const settings = $('#settings') as HTMLDivElement;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  window.setTimeout(() => {
    modal.inert = true;
    $('#modalCard').innerHTML = '';
    const settingsOpen = settings.classList.contains('open');
    settings.inert = !settingsOpen;
    app.inert = settingsOpen;
    returnFocus?.focus();
  }, 160);
}
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', event => {
  const modal = $('#modal') as HTMLDivElement;
  if (!modal.classList.contains('open')) return;
  if (event.key === 'Escape') { event.preventDefault(); closeModal(); return; }
  if (event.key !== 'Tab') return;
  const card = $('#modalCard') as HTMLDivElement;
  const focusable = Array.from(card.querySelectorAll<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]'));
  if (!focusable.length) { event.preventDefault(); card.focus(); return; }
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});

export { showModal,closeModal };
