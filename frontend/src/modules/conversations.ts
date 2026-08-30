import { $, esc, api, toast, state, saveSelectedAgent } from '../core/index';

/* --------------------------- Conversations --------------------------- */
async function loadConversations() {
  try { state.conversations = await api('/api/conversations'); }
  catch { state.conversations = []; }
  renderConvList();
}
function renderConvList() {
  const el = $('#convList');
  // D1：按标题关键字过滤
  const kw = (state.convSearch || '').trim().toLowerCase();
  const list = kw ? state.conversations.filter(c => (c.title || '新对话').toLowerCase().includes(kw)) : state.conversations;
  if (!list.length) {
    el.innerHTML = '<div style="padding:18px 12px; color:var(--label-caption); font-size:12.5px;">' + (state.conversations.length ? '没有匹配的对话' : '还没有对话') + '</div>';
    return;
  }
  el.innerHTML = list.map(c => `
    <div class="conv-item ${c.id === state.currentConvId ? 'active' : ''}" data-id="${esc(c.id)}">
      <span class="conv-dot"></span>
      <span style="overflow:hidden;text-overflow:ellipsis;">${esc(c.title || '新对话')}</span>
      <button type="button" class="conv-del" data-del="${esc(c.id)}" title="删除对话：${esc(c.title || '新对话')}" aria-label="删除对话：${esc(c.title || '新对话')}">×</button>
    </div>
  `).join('');
  el.querySelectorAll('.conv-item').forEach(it => {
    it.onclick = (e) => { if (e.target.dataset.del) return; openConversation(it.dataset.id); };
  });
  el.querySelectorAll('.conv-del').forEach(b => {
    b.onclick = async (e) => {
      e.stopPropagation();
      const id = b.dataset.del;
      if (!(await showConfirm({ title: '删除对话', message: '删除该对话？', confirmLabel: '删除', danger: true }))) return;
      try { await api('/api/conversations/' + id, { method: 'DELETE' }); } catch {}
      state.conversations = state.conversations.filter(c => c.id !== id);
      if (state.currentConvId === id) {
        state.currentConvId = null;
        state.messages = [];
        renderContent();
        $('#topbarTitle').textContent = '新对话';
        if (location.hash !== '#/new') history.replaceState(null, '', '#/new');
      }
      renderConvList();
    };
  });
}
async function newConversation() {
  state.currentConvId = null;
  state.messages = [];
  $('#topbarTitle').textContent = '新对话';
  renderContent();
  renderConvList();
  renderInspector();
  $('#heroInput')?.focus();
  if (location.hash !== '#/new') history.pushState(null, '', '#/new');
}
$('#newChatBtn').onclick = newConversation;
async function openConversation(id) {
  try {
    const c = await api('/api/conversations/' + id);
    // D1：若会话归属的工作区/项目与当前不同，先切换并重新加载资产（自动全选）
    if ((c.workspaceId && (!state.selectedWorkspace || state.selectedWorkspace.id !== c.workspaceId))
        || (c.projectId && (!state.selectedProject || state.selectedProject.id !== c.projectId))) {
      state.selectedWorkspace = state.workspaces.find(x => x.id === c.workspaceId) || state.selectedWorkspace;
      if (state.selectedWorkspace) await loadProjects();
      if (c.projectId) {
        state.selectedProject = state.projects.find(x => x.id === c.projectId) || state.selectedProject;
        if (state.selectedProject) { localStorage.setItem('multichat_project', state.selectedProject.id); state.assets = await api('/api/assets?projectId=' + encodeURIComponent(state.selectedProject.id)); state.selectedAssetIds = new Set(state.assets.map(a => a.id)); }
      }
    }
    state.currentConvId = c.id;
    state.messages = (c.messages || []).map(m => ({ role: m.role, content: m.content, model: m.model }));
    $('#topbarTitle').textContent = c.title || '对话';
    renderTopbar();
    renderContent();
    renderConvList();
    renderFileContext();
    const route = `#/chat/${encodeURIComponent(c.id)}`;
    if (location.hash !== route) history.pushState(null, '', route);
  } catch (e) { toast('打开对话失败：' + e.message, 'error'); }
}

function fmtSize(n) {
  try {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  } catch { return ''; }
}

// D1：文件上下文面板——列出当前项目资产，可勾选要注入到对话的文件
function renderFileContext() {
  renderContent();
  renderInspector();
}

// D1：切换项目时，回填项目级默认智能体/模型（若项目已设置）
function applyProjectDefaults() {
  const p = state.selectedProject; if (!p) return;
  if (p.defaultAgentId) {
    const a = state.agents.find(x => x.id === p.defaultAgentId);
    if (a) { state.selectedAgent = a; saveSelectedAgent(); }
  }
  if (p.defaultProviderId && p.defaultModel) {
    const pr = state.providers.find(x => x.id === p.defaultProviderId);
    if (pr) { state.selectedProvider = pr; state.selectedModel = p.defaultModel; localStorage.setItem('multichat_lastModel', pr.id + ':' + p.defaultModel); }
  }
  renderTopbar();
}

export { loadConversations,renderConvList,newConversation,openConversation,fmtSize,renderFileContext,applyProjectDefaults };
