// 轻量 Toast 提示。仅依赖 dom.$（叶子依赖）。
import { $ } from './dom';

let toastTimer;
export function toast(msg, kind = '') {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show' + (kind ? ' ' + kind : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.className = 'toast' + (kind ? ' ' + kind : '');
  }, 2400);
}
