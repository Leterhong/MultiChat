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
    state.conversationsLoadFailed = false;
    state.selectedProject = null;
    (globalThis as any).renderTopbar = vi.fn();
    (globalThis as any).renderContent = vi.fn();
    (globalThis as any).openConversation = vi.fn();
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
    expect((globalThis as any).openConversation).not.toHaveBeenCalled();
  });

  it('does not bounce a deep link when the conversation list failed to load', async () => {
    // 列表加载失败时 state.conversations 为空但不可信，必须交由后端
    // /api/conversations/:id 权威判定，而不是直接 replaceState 到 #/home。
    state.conversationsLoadFailed = true;
    history.replaceState(null, '', '#/chat/recoverable-task');

    await applyLocationRoute();

    expect(location.hash).toBe('#/chat/recoverable-task');
    expect((globalThis as any).openConversation).toHaveBeenCalledWith('recoverable-task');
    expect(useAppStore.getState().workspaceView).toBe('chat');
    expect(state.currentConvId).toBeNull();
  });

  it('canonicalizes the legacy new-task route to the home task composer', async () => {
    history.replaceState(null, '', '#/new');

    await applyLocationRoute();

    expect(location.hash).toBe('#/home');
    expect(useAppStore.getState().workspaceView).toBe('home');
  });
});
