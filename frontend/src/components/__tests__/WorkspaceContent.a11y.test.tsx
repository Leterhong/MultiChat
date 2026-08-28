import { act, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { beforeEach, describe, expect, it } from 'vitest';
import { state } from '../../core';
import { useAppStore } from '../../store/appStore';
import { WorkspaceContent } from '../WorkspaceContent';

describe('WorkspaceContent accessibility', () => {
  beforeEach(() => {
    state.messages = [];
    state.providers = [];
    state.selectedProvider = null;
    state.selectedModel = null;
    state.conversations = [];
    state.memories = [];
    state.selectedAssetIds = new Set();
    useAppStore.setState({ ready: true, actions: {} });
  });

  it('has no detectable axe violations on the home workspace', async () => {
    const { container } = render(<WorkspaceContent />);
    expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations();
  });

  it('reacts to the Zustand-backed compatibility state without a revision refresh', () => {
    render(<WorkspaceContent />);
    act(() => {
      state.selectedProvider = { id: 'mock', name: '本地模型' };
      state.selectedModel = 'echo';
    });
    expect(screen.getByRole('button', { name: 'echo' })).toBeInTheDocument();
    expect(screen.getByText(/本地模型 · echo/)).toBeInTheDocument();
  });
});
