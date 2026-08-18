import { $, $$, esc, api, toast, state, DEFAULT_PARAMS, loadSelectedAgent, saveSelectedAgent, saveParams } from '../core/index.js';

/* --------------------------- Markdown (small, dep-free) --------------------------- */
/* 紧凑数字格式：517 / 12.2K / 1.2M */
function fmtTok(n) {
  if (n == null) return '0';
  if (n < 1000) return String(n);
  if (n < 1e6) return (n >= 1e5 ? String(Math.round(n / 1e3)) : String(Math.round(n / 1e2) / 10)) + 'K';
  return (n >= 1e8 ? String(Math.round(n / 1e6)) : String(Math.round(n / 1e5) / 10)) + 'M';
}
function renderMarkdown(s) {
  if (!s) return '';
  let out = esc(s);
  out = out.replace(/```([\w-]*)\n([\s\S]*?)```/g, (_, lang, code) => `<div class="code-block"><button class="code-copy" type="button">复制</button><pre><code class="lang-${lang}">${code}</code></pre></div>`);
  out = out.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  out = out.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  out = out.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  out = out.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  out = out.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  out = out.replace(/(?:^|\n)((?:- .+(?:\n|$))+)/g, (m, block) => {
    const items = block.trim().split('\n').map(l => `<li>${l.replace(/^- /, '')}</li>`).join('');
    return '\n<ul>' + items + '</ul>';
  });
  out = out.replace(/(?:^|\n)((?:\d+\. .+(?:\n|$))+)/g, (m, block) => {
    const items = block.trim().split('\n').map(l => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('');
    return '\n<ol>' + items + '</ol>';
  });
  const parts = out.split(/\n{2,}/).map(p => {
    p = p.trim();
    if (!p) return '';
    if (/^<(h\d|ul|ol|pre|blockquote)/.test(p)) return p;
    return '<p>' + p.replace(/\n/g, '<br/>') + '</p>';
  });
  return parts.join('\n');
}

export { fmtTok,renderMarkdown };
