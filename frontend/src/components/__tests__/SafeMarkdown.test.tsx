import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SafeMarkdown } from '../SafeMarkdown';

describe('SafeMarkdown', () => {
  it('does not turn untrusted HTML into executable elements', () => {
    const { container } = render(<SafeMarkdown>{'<img src=x onerror="window.pwned=true">\n\n**safe**'}</SafeMarkdown>);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('safe')).toBeInTheDocument();
    expect((window as any).pwned).toBeUndefined();
  });

  it('opens links outside the application without opener access', () => {
    render(<SafeMarkdown>{'[资料](https://example.com)'}</SafeMarkdown>);
    expect(screen.getByRole('link', { name: '资料' })).toHaveAttribute('rel', 'noreferrer noopener');
  });
});
