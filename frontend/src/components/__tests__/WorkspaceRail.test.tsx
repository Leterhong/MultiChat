import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { state } from '../../core';
import { useAppStore } from '../../store/appStore';
import { WorkspaceRail } from '../WorkspaceRail';

describe('WorkspaceRail', () => {
  beforeEach(() => {
    state.providers = [
      { id: 'mock', name: '本地体验', models: ['echo'] },
      { id: 'second', name: '第二模型', models: ['review'] },
    ];
    state.selectedProvider = state.providers[0];
    state.selectedModel = 'echo';
    state.selectedAgent = null;
    state.selectedAssetIds = new Set(['asset-1']);
    state.memories = [{ id: 'memory-1', enabled: true }];
    state.params = { temperature: 0.7, max_tokens: 2000, top_p: 1 };
    state.messages = [{ role: 'assistant', content: '完成', usage: { total_tokens: 120 }, elapsedMs: 2000 }];
  });

  it('selects a configured model directly and exposes useful run statistics', async () => {
    const selectModel = vi.fn();
    useAppStore.setState({ ready: true, actions: { selectModel } });
    const { container } = render(<WorkspaceRail />);

    fireEvent.click(screen.getByRole('button', { name: 'review · 第二模型' }));
    expect(selectModel).toHaveBeenCalledWith('second', 'review');
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('2.0s')).toBeInTheDocument();
    expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations();
  });
});
