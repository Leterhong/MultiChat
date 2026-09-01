import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { state } from '../../core';
import { createWorkflowSession } from '../../core/workflow';
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
    state.workflowScope = 'test';
    state.workflow = createWorkflowSession();
    state.messages = [{ role: 'assistant', content: '完成', usage: { total_tokens: 120 }, elapsedMs: 2000 }];
  });

  it('selects a configured model directly and exposes useful run statistics', async () => {
    const selectModel = vi.fn();
    useAppStore.setState({ ready: true, actions: { selectModel } });
    const { container } = render(<WorkspaceRail />);

    fireEvent.click(screen.getByRole('button', { name: 'review · 第二模型' }));
    expect(selectModel).toHaveBeenCalledWith('second', 'review');
    fireEvent.click(screen.getByRole('tab', { name: '活动' }));
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('2.0s')).toBeInTheDocument();
    expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations();
  });

  it('persists task mode, plan steps, and acceptance criteria', () => {
    useAppStore.setState({ ready: true, actions: {} });
    render(<WorkspaceRail />);

    fireEvent.click(screen.getByRole('radio', { name: '审查' }));
    expect(state.workflow.mode).toBe('review');

    fireEvent.click(screen.getByRole('tab', { name: '计划' }));
    const stepInput = screen.getByRole('textbox', { name: '新任务步骤' });
    fireEvent.change(stepInput, { target: { value: '完成回归测试' } });
    fireEvent.keyDown(stepInput, { key: 'Enter' });
    expect(screen.getByText('完成回归测试')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: '验收标准' }), { target: { value: '构建通过' } });
    expect(state.workflow.acceptance).toBe('构建通过');
  });
});
