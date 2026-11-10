// 遗留 showModal({ body }) 调用点仍以 HTML 字符串传入（当前 16 处已全部用
// esc() 转义）。为防「某处漏写一次 esc() 就变成 XSS」，在 React 用
// dangerouslySetInnerHTML 渲染前统一净化：去掉可执行标签、事件属性、
// 危险 URL scheme 与可注入的 style 值。零第三方依赖，用浏览器 DOMParser。

const REMOVED_TAGS = new Set([
  'script', 'iframe', 'object', 'embed', 'applet', 'link', 'meta', 'base',
  'style', 'template', 'svg', 'math', 'frame', 'frameset', 'portal',
  'audio', 'video', 'source', 'track',
]);
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'xlink:href', 'poster', 'background']);
const UNSAFE_SCHEME = /^(?:javascript|data|vbscript|file):/i;
const UNSAFE_STYLE = /(?:url\s*\(|expression\s*\(|@import|behavior\s*:)/i;

function safeUrl(value: string) {
  // 去掉空白/换行，阻断 "java\nscript:" 之类的拆分绕过。
  return !UNSAFE_SCHEME.test(value.replace(/\s+/g, ''));
}

/** 返回可直接注入的 HTML 片段字符串；输入不可解析时返回空串。 */
export function sanitizeOverlayHTML(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(`<div id="mc-sanitize-root">${html}</div>`, 'text/html');
  const root = doc.getElementById('mc-sanitize-root');
  if (!root) return '';

  const walk = (parent: Element) => {
    for (const child of Array.from(parent.children)) {
      const tag = child.tagName.toLowerCase();
      if (REMOVED_TAGS.has(tag)) {
        child.remove();
        continue;
      }
      for (const attr of Array.from(child.attributes)) {
        const name = attr.name.toLowerCase();
        const value = attr.value.trim();
        if (name.startsWith('on') || name === 'srcdoc') {
          child.removeAttribute(attr.name);
          continue;
        }
        if (URL_ATTRS.has(name) && !safeUrl(value)) {
          child.removeAttribute(attr.name);
          continue;
        }
        if (name === 'style' && UNSAFE_STYLE.test(value)) {
          child.removeAttribute(attr.name);
          continue;
        }
      }
      walk(child);
    }
  };
  walk(root);
  return root.innerHTML;
}
