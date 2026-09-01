import { act, fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    state.assets = [];
    state.selectedProject = null;
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
    expect(screen.getByRole('heading', { name: '从项目到可验证结果' })).toBeInTheDocument();
  });

  it('opens the model picker from React and keeps a draft when no model is selected', () => {
    const send = vi.fn(async () => {});
    const openModelPicker = vi.fn();
    state.providers = [{ id: 'mock', name: '本地体验', models: ['echo'] }];
    useAppStore.setState({ ready: true, actions: { send, openModelPicker } });
    render(<WorkspaceContent />);

    fireEvent.click(screen.getByRole('button', { name: '选择模型' }));
    expect(openModelPicker).toHaveBeenCalledOnce();

    const input = screen.getByRole('textbox', { name: '任务描述' });
    fireEvent.change(input, { target: { value: '不要丢失这段草稿' } });
    fireEvent.click(screen.getByRole('button', { name: '开始运行' }));
    expect(send).toHaveBeenCalledWith('不要丢失这段草稿');
    expect(input).toHaveValue('不要丢失这段草稿');
  });
});
