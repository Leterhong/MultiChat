import { beforeEach, describe, expect, it, vi } from 'vitest';
import { state } from '../../core';
import { useAppStore } from '../../store/appStore';
import { applyLocationRoute, isKnownConversation } from '../init';

describe('conversation route recovery', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="toast"></div>';
    state.currentConvId = null;
    state.messages = [];
    state.conversations = [];
    state.selectedProject = null;
    (globalThis as any).renderTopbar = vi.fn();
    (globalThis as any).renderContent = vi.fn();
    useAppStore.setState({ workspaceView: 'chat' });
    history.replaceState(null, '', '#/home');
  });

  it('recognizes only conversation ids that were returned by the server', () => {
    const conversations = [{ id: 'existing-task' }, { id: 'another-task' }] as any[];
    expect(isKnownConversation('existing-task', conversations)).toBe(true);
    expect(isKnownConversation('deleted-task', conversations)).toBe(false);
  });

  it('returns a stale chat URL to the task workspace without requesting it again', async () => {
    state.conversations = [{ id: 'existing-task' }] as any[];
    state.currentConvId = 'previous-task';
    state.messages = [{ role: 'user', content: 'stale' }] as any[];
    history.replaceState(null, '', '#/chat/deleted-task');

    await applyLocationRoute();

    expect(location.hash).toBe('#/home');
    expect(state.currentConvId).toBeNull();
    expect(state.messages).toEqual([]);
    expect(useAppStore.getState().workspaceView).toBe('home');
    expect(document.getElementById('toast')).toHaveTextContent('该任务不存在或已被删除');
  });
});
