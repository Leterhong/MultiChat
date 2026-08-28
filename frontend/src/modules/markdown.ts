import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { fmtTok } from '../utils/format';

/* --------------------------- Markdown compatibility renderer --------------------------- */
function renderMarkdown(s) {
  if (!s) return '';
  const parsed = marked.parse(String(s), { async: false, gfm: true, breaks: true }) as string;
  return DOMPurify.sanitize(parsed, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['style', 'onerror', 'onload'],
  });
}

export { fmtTok,renderMarkdown };
