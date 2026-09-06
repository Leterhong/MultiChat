import { $, api, toast, state, saveSelectedAgent, loadWorkflowSession, workflowScope } from '../core/index';
import { setWorkspaceView } from '../store/appStore';

function activateWorkflow(conversationId = state.currentConvId, projectId = state.selectedProject?.id) {
  const scope = workflowScope(conversationId, projectId);
  state.workflowScope = scope;
  state.workflow = loadWorkflowSession(scope);
}

/* --------------------------- Conversations --------------------------- */
async function loadConversations() {
  try {
    state.conversations = await api('/api/conversations');
  } catch {
    state.conversations = [];
  }
  renderConvList();
}
function renderConvList() {
  // Conversation navigation is React-owned. State assignments already notify
  // Zustand subscribers, so legacy callers only need this compatibility hook.
}
async function deleteConversation(id) {
  const conversation = state.conversations.find((item) => item.id === id);
  if (!conversation) return;
  if (
    !(await showConfirm({
      title: '删除对话',
      message: `删除「${conversation.title || '新对话'}」？`,
      confirmLabel: '删除',
      danger: true,
    }))
  )
    return;
  try {
    await api('/api/conversations/' + encodeURIComponent(id), { method: 'DELETE' });
    state.conversations = state.conversations.filter((item) => item.id !== id);
    if (state.currentConvId === id) {
      state.currentConvId = null;
      state.messages = [];
      activateWorkflow(null, state.selectedProject?.id);
      $('#topbarTitle').textContent = '新对话';
      setWorkspaceView('chat');
      if (location.hash !== '#/new') history.replaceState(null, '', '#/new');
    }
    toast('对话已删除');
  } catch (error: any) {
    toast('删除对话失败：' + error.message, 'error');
  }
}
async function renameConversation(id) {
  const conversation = state.conversations.find((item) => item.id === id);
  if (!conversation) return;
  const title = await showPrompt({
    title: '重命名任务',
    label: '任务名称',
    value: conversation.title || '新任务',
    placeholder: '输入新的任务名称',
    maxLength: 120,
  });
  if (!title?.trim()) return;
  try {
    const next = await api('/api/conversations/' + encodeURIComponent(id), {
      method: 'PUT',
      body: JSON.stringify({ title: title.trim() }),
    });
    state.conversations = state.conversations.map((item) => (item.id === id ? { ...item, ...next } : item));
    if (state.currentConvId === id) $('#topbarTitle').textContent = next.title || title.trim();
    toast('任务已重命名');
  } catch (error: any) {
    toast('重命名失败：' + error.message, 'error');
  }
}
async function newConversation() {
  setWorkspaceView('home');
  state.currentConvId = null;
  state.messages = [];
  activateWorkflow(null, state.selectedProject?.id);
  $('#topbarTitle').textContent = '新对话';
  renderContent();
  renderConvList();
  renderInspector();
  requestAnimationFrame(() => $('#heroInput')?.focus());
  if (location.hash !== '#/home') history.pushState(null, '', '#/home');
}
async function openConversation(id) {
  try {
    setWorkspaceView('chat');
    const c = await api('/api/conversations/' + encodeURIComponent(id));
    // D1：若会话归属的工作区/项目与当前不同，先切换并重新加载资产（自动全选）
    if (
      (c.workspaceId && (!state.selectedWorkspace || state.selectedWorkspace.id !== c.workspaceId)) ||
      (c.projectId && (!state.selectedProject || state.selectedProject.id !== c.projectId))
    ) {
      state.selectedWorkspace = state.workspaces.find((x) => x.id === c.workspaceId) || state.selectedWorkspace;
      if (state.selectedWorkspace) await loadProjects();
      if (c.projectId) {
        state.selectedProject = state.projects.find((x) => x.id === c.projectId) || state.selectedProject;
        if (state.selectedProject) {
          localStorage.setItem('multichat_project', state.selectedProject.id);
          state.assets = await api('/api/assets?projectId=' + encodeURIComponent(state.selectedProject.id));
          state.selectedAssetIds = new Set(state.assets.map((a) => a.id));
        }
      }
    }
    state.currentConvId = c.id;
    state.messages = (c.messages || []).map((m) => ({ role: m.role, content: m.content, model: m.model }));
    activateWorkflow(c.id, c.projectId || state.selectedProject?.id);
    $('#topbarTitle').textContent = c.title || '对话';
    renderTopbar();
    renderContent();
    renderConvList();
    renderFileContext();
    const route = `#/chat/${encodeURIComponent(c.id)}`;
    if (location.hash !== route) history.pushState(null, '', route);
  } catch (e: any) {
    if (e?.status === 404) {
      state.conversations = state.conversations.filter((conversation) => conversation.id !== id);
      if (state.currentConvId === id) {
        state.currentConvId = null;
        state.messages = [];
        activateWorkflow(null, state.selectedProject?.id);
      }
      setWorkspaceView('home');
      history.replaceState(null, '', '#/home');
      renderTopbar();
      renderContent();
      toast('该任务不存在或已被删除，已返回新任务页', 'error');
      return;
    }
    toast('打开对话失败：' + e.message, 'error');
  }
}

function fmtSize(n) {
  try {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  } catch {
    return '';
  }
}

// D1：文件上下文面板——列出当前项目资产，可勾选要注入到对话的文件
function renderFileContext() {
  renderContent();
  renderInspector();
}

// D1：切换项目时，回填项目级默认智能体/模型（若项目已设置）
function applyProjectDefaults() {
  const p = state.selectedProject;
  if (!p) return;
  if (p.defaultAgentId) {
    const a = state.agents.find((x) => x.id === p.defaultAgentId);
    if (a) {
      state.selectedAgent = a;
      saveSelectedAgent();
    }
  }
  if (p.defaultProviderId && p.defaultModel) {
    const pr = state.providers.find((x) => x.id === p.defaultProviderId);
    if (pr) {
      state.selectedProvider = pr;
      state.selectedModel = p.defaultModel;
      localStorage.setItem('multichat_lastModel', pr.id + ':' + p.defaultModel);
    }
  }
  renderTopbar();
}

export {
  activateWorkflow,
  loadConversations,
  renderConvList,
  newConversation,
  deleteConversation,
  renameConversation,
  openConversation,
  fmtSize,
  renderFileContext,
  applyProjectDefaults,
};
