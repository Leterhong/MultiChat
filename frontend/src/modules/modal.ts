import { $, esc } from '../core/index';

/* --------------------------- Modal --------------------------- */
let returnFocus: HTMLElement | null = null;
let cleanupTimer: number | undefined;
let closeCallback: (() => void) | null = null;

const MODAL_FOCUSABLE = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex="0"]';

function focusWithoutScroll(target: HTMLElement | null) {
  if (!target) return;
  try { target.focus({ preventScroll: true }); }
  catch { target.focus(); }
}

function showModal({ title, body, onMount, onClose = null }) {
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
  closeCallback = typeof onClose === 'function' ? onClose : null;
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
  const callback = closeCallback;
  closeCallback = null;
  callback?.();
  cleanupTimer = window.setTimeout(() => {
    if (!modal.classList.contains('open')) $('#modalCard').innerHTML = '';
    cleanupTimer = undefined;
  }, 160);
}
type ConfirmOptions = { title?: string; message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean };
type PromptOptions = { title: string; message?: string; label?: string; value?: string; placeholder?: string; required?: boolean; maxLength?: number; multiline?: boolean; rows?: number; confirmLabel?: string };

/* Promise 化的确认/输入对话框，替代原生 confirm() 与 prompt()，样式与系统弹窗一致。
   Esc、背景点击或取消都 resolve(false/null)；onClose 兜底保证 Promise 永不悬挂。 */
function showConfirm({ title = '请确认', message, confirmLabel = '确认', cancelLabel = '取消', danger = false }: ConfirmOptions): Promise<boolean> {
  let settled = false;
  return new Promise((resolve) => {
    const finish = (value: boolean) => { if (!settled) { settled = true; resolve(value); } };
    showModal({
      title,
      body: `<div class="confirm-message">${esc(message)}</div><div class="row"><button type="button" class="btn-ghost" id="dialogCancel">${esc(cancelLabel)}</button><button type="button" class="${danger ? 'btn-danger' : 'btn-primary'}" id="dialogAccept" style="width:auto;padding:9px 18px;">${esc(confirmLabel)}</button></div>`,
      onMount: (card: HTMLElement) => {
        $('#dialogCancel', card).onclick = () => { finish(false); closeModal(); };
        $('#dialogAccept', card).onclick = () => { finish(true); closeModal(); };
      },
      onClose: () => finish(false),
    });
  });
}

function showPrompt({ title, message = '', label = '名称', value = '', placeholder = '', required = true, maxLength, multiline = false, rows = 5, confirmLabel = '确定' }: PromptOptions): Promise<string | null> {
  let settled = false;
  return new Promise((resolve) => {
    const finish = (result: string | null) => { if (!settled) { settled = true; resolve(result); } };
    const control = multiline
      ? `<textarea name="value" rows="${rows}" placeholder="${esc(placeholder)}" ${maxLength ? `maxlength="${maxLength}"` : ''} autofocus>${esc(value)}</textarea>`
      : `<input name="value" value="${esc(value)}" placeholder="${esc(placeholder)}" ${maxLength ? `maxlength="${maxLength}"` : ''} autofocus />`;
    showModal({
      title,
      body: `${message ? `<p class="lead" style="margin-bottom:12px;">${esc(message)}</p>` : ''}
        <form id="dialogPromptForm"><div class="field"><label>${esc(label)}</label>${control}</div><div class="row"><button type="button" class="btn-ghost" id="dialogCancel">取消</button><button class="btn-primary" type="submit" style="width:auto;padding:9px 18px;">${esc(confirmLabel)}</button></div></form>`,
      onMount: (card: HTMLElement) => {
        $('#dialogCancel', card).onclick = () => { finish(null); closeModal(); };
        $('#dialogPromptForm', card).onsubmit = (event: SubmitEvent) => {
          event.preventDefault();
          const input = card.querySelector<HTMLInputElement | HTMLTextAreaElement>('[name="value"]');
          const text = (input?.value ?? '').trim();
          if (required && !text) return;
          finish(text);
          closeModal();
        };
      },
      onClose: () => finish(null),
    });
  });
}

$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });document.addEventListener('keydown', event => {
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

export { showModal,closeModal, showConfirm, showPrompt };
