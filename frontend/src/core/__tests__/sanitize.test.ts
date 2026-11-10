import { describe, expect, it } from 'vitest';
import { sanitizeOverlayHTML } from '../sanitize';

describe('sanitizeOverlayHTML', () => {
  it('keeps ordinary overlay markup intact', () => {
    const html = '<form id="dialogPromptForm" class="row"><label for="v">名称</label><input name="value" data-role="prompt" type="text" required /></form>';
    const output = sanitizeOverlayHTML(html);
    expect(output).toContain('dialogPromptForm');
    expect(output).toContain('name="value"');
    expect(output).toContain('data-role="prompt"');
    expect(output).toContain('<label');
  });

  it('strips event handlers and executable tags', () => {
    const html = '<div><img src="x" onerror="alert(1)" /><button onclick="alert(2)">确认</button><script>alert(3)</script><iframe src="https://evil.example"></iframe></div>';
    const output = sanitizeOverlayHTML(html);
    expect(output).not.toMatch(/onerror|onclick|<script|<iframe/i);
    expect(output).toContain('<button>确认</button>');
  });

  it('strips javascript:/data: URLs and unsafe styles', () => {
    const html = '<a href="javascript:alert(1)">x</a><div style="background:url(javascript:alert(2))">y</div><img src="data:text/html,<script>1</script>" />';
    const output = sanitizeOverlayHTML(html);
    expect(output).not.toMatch(/javascript:|data:text\/html|url\(/i);
    expect(output).toContain('<a>x</a>');
  });

  it('returns an empty string for empty input', () => {
    expect(sanitizeOverlayHTML('')).toBe('');
  });
});
