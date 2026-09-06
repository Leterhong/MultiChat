import { act, fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { state } from '../../core';
import { syncModelUI } from '../../modules/modelPicker';
import { useAppStore } from '../../store/appStore';
import { WorkspaceContent } from '../WorkspaceContent';

describe('WorkspaceContent accessibility', () => {
  beforeEach(() => {
    state.messages = [];
    state.currentConvId = null;
    state.providers = [];
    state.selectedProvider = null;
    state.selectedModel = null;
    state.selectedAgent = null;
    state.conversations = [];
    state.memories = [];
    state.assets = [];
    state.selectedProject = null;
    state.selectedAssetIds = new Set();
    localStorage.removeItem('multichat_compare_draft');
    useAppStore.setState({ ready: true, workspaceView: 'home', taskMode: 'chat', actions: {} });
  });

  it('has no detectable axe violations on the home workspace', async () => {
    const { container } = render(<WorkspaceContent />);
    expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations();
  });

  it('turns an empty conversation into an inline task start surface', () => {
    state.currentConvId = 'empty-task';
    state.conversations = [{ id: 'empty-task', title: '整理当前项目' }] as any[];
    useAppStore.setState({ workspaceView: 'chat' });

    const { container } = render(<WorkspaceContent />);

    expect(screen.getByRole('heading', { name: '整理当前项目' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('描述你想完成的任务…')).toBeInTheDocument();
    expect(container.querySelector('.composer-wrap')).toHaveClass('composer-start');
    expect(container.querySelector('.conversation-start')).not.toBeInTheDocument();
  });

  it('reacts to the Zustand-backed compatibility state without a revision refresh', () => {
    render(<WorkspaceContent />);
    act(() => {
      state.selectedProvider = { id: 'mock', name: '本地模型' };
      state.selectedModel = 'echo';
    });
    expect(screen.getByRole('button', { name: '模型：echo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /今天想完成什么？/ })).toBeInTheDocument();
  });

  it('keeps the React model control intact when legacy refresh hooks run', () => {
    state.selectedProvider = { id: 'mock', name: '本地模型' };
    state.selectedModel = 'echo';
    render(<WorkspaceContent />);

    syncModelUI();

    const modelButton = screen.getByRole('button', { name: '模型：echo' });
    expect(modelButton.querySelector('.model-glyph')).toBeInTheDocument();
    expect(modelButton).toHaveTextContent('echo');
  });

  it('opens the model picker from React and keeps a draft when no model is selected', () => {
    const send = vi.fn(async () => {});
    const openModelPicker = vi.fn();
    state.providers = [{ id: 'mock', name: '本地体验', models: ['echo'] }];
    useAppStore.setState({ ready: true, actions: { send, openModelPicker } });
    render(<WorkspaceContent />);

    fireEvent.click(screen.getByRole('button', { name: '模型：选择模型' }));
    expect(openModelPicker).toHaveBeenCalledOnce();

    const input = screen.getByRole('textbox', { name: '告诉 MultiChat 你的目标' });
    fireEvent.change(input, { target: { value: '不要丢失这段草稿' } });
    fireEvent.click(screen.getByRole('button', { name: '开始任务' }));
    expect(send).toHaveBeenCalledWith('不要丢失这段草稿');
    expect(input).toHaveValue('不要丢失这段草稿');
  });

  it('submits a configured chat task and routes compare tasks with their draft', () => {
    const send = vi.fn(async () => {});
    const openCompare = vi.fn();
    state.selectedProvider = { id: 'mock', name: '本地体验' };
    state.selectedModel = 'echo';
    useAppStore.setState({
      ready: true,
      workspaceView: 'home',
      taskMode: 'chat',
      actions: { send, openCompare },
    });
    const { unmount } = render(<WorkspaceContent />);

    const input = screen.getByRole('textbox', { name: '告诉 MultiChat 你的目标' });
    fireEvent.change(input, { target: { value: '执行真实任务' } });
    fireEvent.click(screen.getByRole('button', { name: '开始任务' }));
    expect(send).toHaveBeenCalledWith('执行真实任务');
    unmount();

    useAppStore.setState({ taskMode: 'compare' });
    render(<WorkspaceContent />);
    fireEvent.change(screen.getByRole('textbox', { name: '告诉 MultiChat 你的目标' }), {
      target: { value: '比较这段任务' },
    });
    fireEvent.click(screen.getByRole('button', { name: '开始任务' }));
    expect(openCompare).toHaveBeenCalledOnce();
    expect(localStorage.getItem('multichat_compare_draft')).toBe('比较这段任务');
  });
});
