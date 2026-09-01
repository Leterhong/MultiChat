import { $, api, toast, state, loadSelectedAgent, loadWorkflowSession, workflowScope } from '../core/index';

/* --------------------------- Init --------------------------- */
async function bootstrap() {
  await initApp();
  await applyLocationRoute();
  window.addEventListener('popstate', () => { void applyLocationRoute(); });
}

async function applyLocationRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const compareOpen = $('#modal')?.classList.contains('open') && $('#modalCard')?.classList.contains('compare-modal-card');
  if (parts[0] !== 'compare' && compareOpen) closeModal();
  if (parts[0] === 'settings') {
    openSettings(parts[1] || 'general');
    return;
  }
  if ($('#settings')?.classList.contains('open')) closeSettings();
  if (parts[0] === 'compare') {
    openCompare();
    return;
  }
  if (parts[0] === 'chat' && parts[1] && parts[1] !== state.currentConvId) {
    await openConversation(parts[1]);
  } else if (parts[0] === 'new' && (state.currentConvId || state.messages.length)) {
    await newConversation();
  }
}

async function initApp() {
  await Promise.all([loadProviders(), loadConversations(), loadSkills(), loadTools(), loadMcpServers(), loadAgents(), loadPlugins(), loadRuntime(), loadRuns()]);
  loadSelectedAgent();

  const last = localStorage.getItem('multichat_lastModel');
  if (last) {
    const [pid, ...rest] = last.split(':');
    const m = rest.join(':');
    const p = state.providers.find(x => x.id === pid);
    if (p) { state.selectedProvider = p; state.selectedModel = m; }
  }
  if (!state.selectedProvider && state.providers.length > 0) {
    const p = state.providers[0];
    state.selectedProvider = p;
    state.selectedModel = (p.models && p.models[0]) || p.defaultModel || p.model || '';
  }
  // Projects depend on loaded Agents/Providers; their explicit defaults take
  // precedence over the user's last global selection.
  await loadWorkspaces();
  state.workflowScope = workflowScope(null, state.selectedProject?.id);
  state.workflow = loadWorkflowSession(state.workflowScope);
  renderTopbar();
  renderContent();
  renderSettings();
  // D1：文件上下文面板初始化 + 折叠按钮
  const fcMin = $('#fcMin');
  if (fcMin) fcMin.onclick = () => {
    const b = $('#fileCtxBody'); if (!b) return;
    b.classList.toggle('collapsed');
    fcMin.textContent = b.classList.contains('collapsed') ? '▸' : '▾';
  };
  renderFileContext();
  setupDrop();
  const cs = $('#convSearch'); if (cs) cs.oninput = (e) => { state.convSearch = e.target.value; renderConvList(); };
  const fb = $('#forkBtn'); if (fb) fb.onclick = forkConversation;
  const fileButton = $('#composerFileBtn');
  if (fileButton) fileButton.onclick = () => openSettings('workspace');
}

// D1：拖拽文件到对话区 → 自动上传为当前项目资产并加入上下文
function setupDrop() {
  const zone = $('#content'); if (!zone) return;
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', (e) => { if (e.target === zone) zone.classList.remove('drag-over'); });
  zone.addEventListener('drop', async (e) => {
    e.preventDefault(); zone.classList.remove('drag-over');
    const files = e.dataTransfer && e.dataTransfer.files;
    if (!files || !files.length) return;
    if (!state.selectedProject) { toast('请先在右上角选择工作区/项目', 'error'); return; }
    for (const file of Array.from(files) as File[]) {
      if (file.size > 2_000_000) { toast('文件超过 2MB 限制，已跳过：' + file.name, 'error'); continue; }
      try {
        const content = await file.text();
        const asset = await api('/api/assets', { method: 'POST', body: JSON.stringify({ projectId: state.selectedProject.id, name: file.name, mimeType: file.type || 'text/plain', content }) });
        state.assets = [asset, ...state.assets];
        state.selectedAssetIds = new Set([...state.selectedAssetIds, asset.id]);
        toast('已添加文件：' + file.name);
      } catch (err) { toast('文件添加失败：' + err.message, 'error'); }
    }
    renderFileContext();
  });
}

// D1：从当前对话历史创建一个分支副本（独立新会话，互不干扰）
async function forkConversation() {
  const history = state.messages.filter(m => m.content && !m.streaming).map(m => ({ role: m.role, content: m.content, model: m.model }));
  if (!history.length) { toast('当前没有可分支的内容', 'error'); return; }
  const title = '分支 · ' + (history.find(m => m.role === 'user')?.content?.slice(0, 20) || '新对话');
  state.currentConvId = null; state.messages = [];
  $('#topbarTitle').textContent = '新对话（分支）';
  renderContent(); renderConvList();
  try {
    const r = await api('/api/conversations', { method: 'POST', body: JSON.stringify({ title, workspaceId: state.selectedWorkspace?.id || null, projectId: state.selectedProject?.id || null }) });
    state.currentConvId = r.id;
    window.history.replaceState(null, '', `#/chat/${encodeURIComponent(r.id)}`);
    await api('/api/conversations/' + r.id + '/messages', { method: 'POST', body: JSON.stringify(history) });
    state.messages = history;
    $('#topbarTitle').textContent = r.title || '对话';
    await loadConversations();
    renderContent(); renderConvList();
    toast('已创建分支对话');
  } catch (e) { toast('分支失败：' + e.message, 'error'); }
}

export { applyLocationRoute,bootstrap,initApp,setupDrop,forkConversation };
