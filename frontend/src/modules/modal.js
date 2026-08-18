import { $, $$, esc, api, toast, state, DEFAULT_PARAMS, loadSelectedAgent, saveSelectedAgent, saveParams } from '../core/index.js';

/* --------------------------- Modal --------------------------- */
function showModal({ title, body, onMount }) {
  const card = $('#modalCard');
  card.innerHTML = `<h3>${esc(title || '')}</h3>${body || ''}`;
  $('#modal').classList.add('open');
  if (onMount) onMount(card);
}
function closeModal() { $('#modal').classList.remove('open'); }
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

export { showModal,closeModal };
