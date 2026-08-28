import { $, $$, esc, api, toast, state, saveSelectedAgent, saveParams, getTheme, setTheme } from '../core/index';
import { GeneralSettings, ProviderSettings, SkillSettings, ToolSettings } from '../components/CoreSettings';
import { mountExtensionSettings, sourceLabel, showDiff, unmountExtensionSettings } from './pluginsUI';

/* --------------------------- Settings --------------------------- */
$('#settingsBtn').onclick = () => openSettings();
let settingsReturnFocus: HTMLElement | null = null;
function openSettings(tab = 'general') {
  const panel = $('#settings');
  if (!panel.classList.contains('open')) {
    settingsReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  panel.inert = false;
  panel.setAttribute('aria-hidden', 'false');
  panel.classList.add('open');
  $('#scrim').classList.add('open');
  switchSettingsTab(tab);
  $('#settingsBody')?.focus?.({ preventScroll: true });

  // Focus is now inside the dialog, so the application can safely become inert.
  $('#app').inert = true;
  const route = `#/settings/${encodeURIComponent(tab)}`;
  if (location.hash !== route) history.pushState(null, '', route);
}
function closeSettings() {
  const panel = $('#settings');
  if (!panel.classList.contains('open')) return;

  const app = $('#app');
  app.inert = false;
  const fallback = $('#settingsBtn') as HTMLElement;
  const target = settingsReturnFocus?.isConnected && app.contains(settingsReturnFocus)
    ? settingsReturnFocus
    : fallback;
  try { target?.focus?.({ preventScroll: true }); }
  catch { target?.focus?.(); }
  if (panel.contains(document.activeElement)) fallback?.focus?.({ preventScroll: true });

  panel.classList.remove('open');
  panel.inert = true;
  panel.setAttribute('aria-hidden', 'true');
  $('#scrim').classList.remove('open');
  settingsReturnFocus = null;
  if (location.hash.startsWith('#/settings/')) {
    const route = state.currentConvId ? `#/chat/${encodeURIComponent(state.currentConvId)}` : '#/new';
    history.replaceState(null, '', route);
  }
}
$('#scrim').onclick = closeSettings;
$('#closeSettings').onclick = closeSettings;
$('#closeSettingsTop').onclick = closeSettings;
document.addEventListener('keydown', event => {
  const panel = $('#settings') as HTMLElement;
  if (!panel.classList.contains('open') || $('#modal').classList.contains('open')) return;
  if (event.key === 'Escape') { closeSettings(); return; }
  if (event.key !== 'Tab') return;
  const focusable = Array.from(panel.querySelectorAll<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex="0"]'))
    .filter(element => element.offsetParent !== null);
  if (!focusable.length) { event.preventDefault(); $('#settingsBody')?.focus(); return; }
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
$$('.settings-tab[data-tab]').forEach(b => b.onclick = () => switchSettingsTab(b.dataset.tab));
function switchSettingsTab(tab) {
  state.currentTab = tab;
  $$('.settings-tab[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  renderSettings(tab);
  if ($('#settings').classList.contains('open')) {
    const route = `#/settings/${encodeURIComponent(tab)}`;
    if (location.hash !== route) history.replaceState(null, '', route);
  }
  if (tab === 'usage') {
    loadUsage(state.usageRange).then(() => { if (state.currentTab === 'usage') renderSettings('usage'); });
  } else if (tab === 'capabilities') {
    loadCapabilities().then(() => { if (state.currentTab === 'capabilities') renderSettings('capabilities'); });
  }
}
function renderSettings(tab = 'general', keepScroll = false) {
  const body = $('#settingsBody');
  unmountExtensionSettings();
  const _prevScroll = keepScroll ? body.scrollTop : 0;
  if (tab === 'general') {
    mountExtensionSettings(GeneralSettings, {
      params: state.params,
      theme: getTheme(),
      token: localStorage.getItem('multichat_server_token') || '',
      onSaveParams: (params: any) => { state.params = params; saveParams(); toast('已保存'); },
      onTheme: (theme: string) => { setTheme(theme as any); toast('主题已切换'); },
      onSaveToken: (value: string) => { if (value) localStorage.setItem('multichat_server_token', value); else localStorage.removeItem('multichat_server_token'); toast(value ? '访问令牌已保存' : '访问令牌已清除'); },
    });
    return;
  }
  if (tab === 'providers') {
    mountExtensionSettings(ProviderSettings, {
      providers: state.providers,
      onSave: async (provider: any, payload: any) => {
        try { await api(`/api/providers/${encodeURIComponent(provider.id)}`, { method: 'PUT', body: JSON.stringify(payload) }); await loadProviders(); renderTopbar(); toast('已保存'); return true; }
        catch (error: any) { toast(error.message, 'error'); return false; }
      },
      onDelete: async (provider: any) => {
        if (!confirm(`删除模型提供方「${provider.name || provider.id}」？`)) return false;
        try { await api(`/api/providers/${encodeURIComponent(provider.id)}`, { method: 'DELETE' }); await loadProviders(); renderTopbar(); toast('已删除'); return true; }
        catch (error: any) { toast(error.message, 'error'); return false; }
      },
      onAddBuiltin: () => showAddBuiltin(),
      onAddCustom: () => showAddCustom(),
    });
    return;
  }
  if (tab === 'skills') {
    mountExtensionSettings(SkillSettings, {
      initialSkills: state.skills,
      sourceLabel,
      onToggle: async (skill: any) => {
        try { await api(`/api/skills/${encodeURIComponent(skill.key || skill.id)}/toggle`, { method: 'POST', body: JSON.stringify({ enabled: !skill.enabled }) }); await loadSkills(); return true; }
        catch (error: any) { toast(error.message, 'error'); return false; }
      },
      onEdit: (skill: any) => showSkillModal(skill.key || skill.id),
      onDiff: async (skill: any) => { try { showDiff('Skill 变更', await api(`/api/skills/${encodeURIComponent(skill.key || skill.id)}/diff`)); } catch (error: any) { toast(error.message, 'error'); } },
      onDelete: async (skill: any) => {
        if (!confirm('删除该 Skill？关联运行配置的引用也将被移除。')) return false;
        try { await api(`/api/skills/${encodeURIComponent(skill.key || skill.id)}`, { method: 'DELETE' }); await Promise.all([loadSkills(), loadAgents()]); return true; }
        catch (error: any) { toast(error.message, 'error'); return false; }
      },
      onImport: () => showExtensionImport('skill'),
      onAdd: () => showSkillModal(null),
    });
    return;
  }
  if (tab === 'tools') {
    mountExtensionSettings(ToolSettings, {
      initialTools: state.tools,
      onToggle: async (tool: any) => {
        try { await api(`/api/tools/${encodeURIComponent(tool.id)}`, { method: 'PUT', body: JSON.stringify({ enabled: !tool.enabled }) }); await loadTools(); toast(tool.enabled ? '工具已停用' : '工具已启用'); return true; }
        catch (error: any) { toast(error.message, 'error'); return false; }
      },
    });
    return;
  }
  if (tab === 'workspace') {
    const workspace = state.selectedWorkspace;
    const project = state.selectedProject;
    body.innerHTML = `
      <h3>工作区</h3>
      <p class="lead">按工作区和项目组织会话、文件与运行上下文。文件内容只保存在本地数据目录。</p>
      <div class="provider-card">
        <h4>当前空间</h4>
        <div class="field"><label>工作区</label><select id="workspaceSelect">${state.workspaces.map(w => `<option value="${esc(w.id)}" ${w.id === workspace?.id ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select></div>
        <div class="field"><label>项目</label><select id="projectSelect">${state.projects.map(p => `<option value="${esc(p.id)}" ${p.id === project?.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
        <div class="field"><label>项目默认运行配置</label><select id="projAgentSelect"><option value="">（继承全局）</option>${state.agents.map(a => `<option value="${esc(a.id)}" ${project?.defaultAgentId === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>
        <div class="field"><label>项目默认模型</label><select id="projModelSelect"><option value="">（继承全局）</option>${state.providers.flatMap(p => (p.models || []).map(m => ({ pid: p.id, m, label: (p.name || p.id) + ' · ' + m }))).map(o => `<option value="${esc(o.pid + ':' + o.m)}" ${project?.defaultProviderId === o.pid && project?.defaultModel === o.m ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></div>
        <div class="provider-row"><button class="btn-primary" id="saveProjDefaults" style="width:auto;padding:8px 18px;">保存项目默认</button></div>
        <div class="provider-row"><button class="btn-ghost" id="newWorkspace">新建工作区</button><button class="btn-ghost" id="newProject">新建项目</button></div>
      </div>
      <div class="provider-card">
        <h4>项目文件</h4>
        <div class="pmeta">支持本地文本文件和 URL 文本资源；对话时会按相关性截取并附带文件/行号来源。</div>
        <div class="provider-row" style="margin-top:12px;"><button class="btn-ghost" id="uploadAsset">上传本地文件</button><button class="btn-ghost" id="importAssetUrl">从 URL 添加</button><input type="file" id="assetFileInput" accept=".txt,.md,.json,.csv,.js,.ts,.py,.html,.css,.yaml,.yml" style="display:none" /></div>
        <div class="run-list" style="margin-top:14px;">${state.assets.map(asset => `<div class="run-row"><span class="run-dot completed"></span><div class="run-main"><div class="run-title">${esc(asset.name)}</div><div class="run-meta">${esc(asset.mimeType)} · ${esc(asset.size)} bytes · ${esc(asset.source)}</div></div><button class="mc-act danger" data-del-asset="${esc(asset.id)}" title="删除">删除</button></div>`).join('') || '<div style="color:var(--label-caption);font-size:13px;padding:8px 0;">当前项目还没有文件。</div>'}</div>
        <form class="knowledge-search" id="knowledgeSearch"><input id="knowledgeQuery" placeholder="搜索项目知识，例如：认证流程在哪里实现？" /><button class="btn-ghost">搜索知识</button></form><div id="knowledgeResults"></div>
      </div>
      <div class="provider-card">
        <div class="control-card-head"><div><h4>项目记忆</h4><div class="pmeta">由你明确维护的事实和偏好；可逐条停用，不会从聊天中偷偷学习。</div></div><button class="btn-ghost" id="addMemory">新增记忆</button></div>
        <div class="memory-list">${(state.memories || []).map(item => `<article class="memory-item ${item.enabled === false ? 'disabled' : ''}"><button class="memory-toggle" data-toggle-memory="${esc(item.id)}" aria-pressed="${item.enabled !== false}"><i></i>${item.enabled !== false ? '已启用' : '已停用'}</button><div><strong>${esc(item.title)}</strong><p>${esc(item.content)}</p></div><div class="memory-actions"><button class="mc-act" data-edit-memory="${esc(item.id)}">编辑</button><button class="mc-act danger" data-del-memory="${esc(item.id)}">删除</button></div></article>`).join('') || '<div class="control-empty">还没有项目记忆。只保存值得长期复用的事实和偏好。</div>'}</div>
      </div>
      <div class="provider-card">
        <div class="control-card-head"><div><h4>项目时光机</h4><div class="pmeta">保存项目设置、知识文件、记忆、默认运行配置和当前 Git 状态；恢复前会自动再备份一次。</div></div><button class="btn-primary" id="createSnapshot">创建快照</button></div>
        <div class="snapshot-list">${(state.snapshots || []).map(item => `<article class="snapshot-item"><span class="snapshot-mark">${item.git?.commit ? esc(item.git.commit) : 'LOCAL'}</span><div><strong>${esc(item.title)}</strong><p>${new Date(item.createdAt).toLocaleString('zh-CN')} · ${item.assets} 文件 · ${item.memories} 记忆 · ${compactNumber(item.size)}B${item.git?.branch ? ` · ${esc(item.git.branch)}${item.git.dirty ? '（有改动）' : ''}` : ''}</p></div><div class="memory-actions"><button class="mc-act" data-restore-snapshot="${esc(item.id)}">恢复</button><button class="mc-act danger" data-del-snapshot="${esc(item.id)}">删除</button></div></article>`).join('') || '<div class="control-empty">尚未创建项目快照。</div>'}</div>
      </div>
    `;
    $('#workspaceSelect').onchange = async (event) => { state.selectedWorkspace = state.workspaces.find(x => x.id === event.target.value) || null; await loadProjects(); renderTopbar(); renderContent(); renderSettings('workspace', true); renderFileContext(); };
    $('#projectSelect').onchange = async (event) => { state.selectedProject = state.projects.find(x => x.id === event.target.value) || null; if (state.selectedProject) localStorage.setItem('multichat_project', state.selectedProject.id); await loadProjects(); renderTopbar(); renderContent(); renderSettings('workspace', true); renderFileContext(); };
    $('#saveProjDefaults').onclick = async () => {
      if (!state.selectedProject) { toast('请先选择项目', 'error'); return; }
      const aid = $('#projAgentSelect').value || null;
      const mv = $('#projModelSelect').value || '';
      const [pid, ...rest] = mv.split(':');
      const model = rest.join(':');
      try {
        await api('/api/projects/' + state.selectedProject.id, { method: 'PUT', body: JSON.stringify({ defaultAgentId: aid, defaultProviderId: pid || null, defaultModel: model || null }) });
        Object.assign(state.selectedProject, { defaultAgentId: aid, defaultProviderId: pid || null, defaultModel: model || null });
        applyProjectDefaults();
        toast('已保存项目默认');
      } catch (e) { toast(e.message, 'error'); }
    };
    $('#newWorkspace').onclick = () => showWorkspaceForm();
    $('#newProject').onclick = () => showProjectForm();
    $('#importAssetUrl').onclick = () => showAssetUrlModal();
    const fileInput = $('#assetFileInput');
    $('#uploadAsset').onclick = () => fileInput.click();
    fileInput.onchange = async () => {
      const file = fileInput.files?.[0];
      if (!file || !state.selectedProject) return;
      try { await api('/api/assets', { method: 'POST', body: JSON.stringify({ projectId: state.selectedProject.id, name: file.name, mimeType: file.type || 'text/plain', content: await file.text() }) }); await loadProjects(); renderSettings('workspace', true); toast('文件已加入项目'); }
      catch (error) { toast(error.message, 'error'); }
      fileInput.value = '';
    };
    body.querySelectorAll('[data-del-asset]').forEach(button => button.onclick = async () => { try { await api('/api/assets/' + button.dataset.delAsset, { method: 'DELETE' }); await loadProjects(); renderSettings('workspace', true); } catch (error) { toast(error.message, 'error'); } });
    $('#knowledgeSearch').onsubmit = async event => {
      event.preventDefault(); const query = $('#knowledgeQuery').value.trim(); if (!query || !state.selectedProject) return;
      const results = $('#knowledgeResults'); results.innerHTML = '<div class="pmeta">正在检索…</div>';
      try { const rows = await api(`/api/projects/${encodeURIComponent(state.selectedProject.id)}/search?q=${encodeURIComponent(query)}`); results.innerHTML = rows.map(item => `<article class="knowledge-hit"><strong>${esc(item.name)} <span>L${item.lineStart}–L${item.lineEnd}</span></strong><p>${esc(item.snippet.slice(0,500))}</p></article>`).join('') || '<div class="control-empty">没有找到相关片段。</div>'; }
      catch (error) { results.innerHTML = `<div class="auth-error">${esc(error.message)}</div>`; }
    };
    $('#addMemory').onclick = () => showMemoryModal();
    body.querySelectorAll('[data-edit-memory]').forEach(button => button.onclick = () => showMemoryModal(button.dataset.editMemory));
    body.querySelectorAll('[data-toggle-memory]').forEach(button => button.onclick = async () => { const item = state.memories.find(row => row.id === button.dataset.toggleMemory); if (!item) return; await api('/api/memories/' + item.id, { method: 'PUT', body: JSON.stringify({ enabled: item.enabled === false }) }); await loadProjectControlData(); renderSettings('workspace', true); });
    body.querySelectorAll('[data-del-memory]').forEach(button => button.onclick = async () => { if (!confirm('删除这条项目记忆？')) return; await api('/api/memories/' + button.dataset.delMemory, { method: 'DELETE' }); await loadProjectControlData(); renderSettings('workspace', true); });
    $('#createSnapshot').onclick = async () => { if (!state.selectedProject) return; const title = prompt('快照名称', `项目快照 ${new Date().toLocaleString('zh-CN')}`); if (title == null) return; try { await api('/api/snapshots', { method: 'POST', body: JSON.stringify({ projectId: state.selectedProject.id, title }) }); await loadProjectControlData(); renderSettings('workspace', true); toast('项目快照已创建'); } catch (error) { toast(error.message, 'error'); } };
    body.querySelectorAll('[data-restore-snapshot]').forEach(button => button.onclick = async () => { if (!confirm('恢复该快照？当前状态会先自动备份，随后替换项目文件、记忆和默认配置。')) return; try { await api('/api/snapshots/' + button.dataset.restoreSnapshot + '/restore', { method: 'POST' }); await loadProjects(); await loadAgents(); renderSettings('workspace'); renderFileContext(); toast('快照已恢复'); } catch (error) { toast(error.message, 'error'); } });
    body.querySelectorAll('[data-del-snapshot]').forEach(button => button.onclick = async () => { if (!confirm('删除该项目快照？')) return; await api('/api/snapshots/' + button.dataset.delSnapshot, { method: 'DELETE' }); await loadProjectControlData(); renderSettings('workspace', true); });
  } else if (tab === 'agents') {
    const agents = state.agents;
    body.innerHTML = `
      <h3>运行配置</h3>
      <p class="lead">把系统提示词、Skills、内置工具和 MCP 服务保存为可复用配置。只有当前配置选中的能力才会进入一次运行。</p>
      ${importBarHTML()}
      <div class="card-grid">
        ${agents.map(a => {
          const active = state.selectedAgent && state.selectedAgent.id === a.id;
          const skillIds = a.skillRefs || a.skillIds || [];
          const toolIds = a.toolIds || [];
          const mcpServerIds = a.mcpServerIds || [];
          return `
          <div class="mc-card" data-aid="${esc(a.id)}">
            <div class="mc-top">
              <div class="mc-ico"><svg viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="11" rx="2.5"/><path d="M12 8V5M9 3h6M9 13h.01M15 13h.01M9.5 16h5"/></svg></div>
              <div style="min-width:0;flex:1;">
                <div class="mc-title">${esc(a.name)}</div>
                <div class="mc-sub">${esc(a.id)}</div>
              </div>
              ${active ? '<span class="mc-tag on">使用中</span>' : ''}
            </div>
            <div class="mc-desc">${esc(a.description || '（暂无描述）')}</div>
            <div class="mc-tags">
              <span class="mc-tag">${skillIds.length} 个技能</span>
              <span class="mc-tag">${toolIds.length} 个内置工具</span>
              <span class="mc-tag">${mcpServerIds.length} 个 MCP</span>
              ${skillIds.slice(0, 3).map(tid => `<span class="mc-tag">${esc(tid)}</span>`).join('')}
              ${(skillIds.length > 3) ? `<span class="mc-tag">+${skillIds.length - 3}</span>` : ''}
            </div>
            <div class="mc-actions">
              <button class="mc-act" data-export-a="${esc(a.id)}" title="导出">${EXPORT_ICON}</button>
              <button class="mc-act" data-edit-a="${esc(a.id)}" title="编辑"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
              <button class="mc-act danger" data-del-a="${esc(a.id)}" title="删除"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg></button>
            </div>
          </div>`;
        }).join('')}
        <button type="button" class="mc-add" id="addAgent"><span class="plus">＋</span><span class="plus-t">新建运行配置</span></button>
      </div>
    `;
    body.querySelectorAll('.mc-card[data-aid]').forEach(c => c.onclick = () => showAgentModal(c.dataset.aid));
    body.querySelectorAll('[data-edit-a]').forEach(b => b.onclick = (e) => { e.stopPropagation(); showAgentModal(b.dataset.editA); });
    body.querySelectorAll('[data-export-a]').forEach(b => b.onclick = (e) => { e.stopPropagation(); const a = state.agents.find(x => x.id === b.dataset.exportA); if (a) exportEntity(a, 'agent'); });
    body.querySelectorAll('[data-del-a]').forEach(b => b.onclick = async (e) => {
      e.stopPropagation();
      const aid = b.dataset.delA;
      if (!confirm('删除该运行配置？')) return;
      try { await api('/api/agents/' + aid, { method: 'DELETE' }); } catch (err) { toast(err.message, 'error'); return; }
      if (state.selectedAgent && state.selectedAgent.id === aid) state.selectedAgent = null;
      saveSelectedAgent();
      await loadAgents(); renderSettings(state.currentTab || 'agents', true); renderTopbar();
    });
    $('#addAgent').onclick = () => showAgentModal(null);
    wireImportBar();
  } else if (tab === 'plugins') {
    renderPlugins();
  } else if (tab === 'mcp') {
    renderMcpServers();
  } else if (tab === 'capabilities') {
    renderCapabilities();
  } else if (tab === 'usage') {
    renderUsage();
  } else if (tab === 'runs') {
    renderRuns();
  }
  if (keepScroll) body.scrollTop = Math.min(_prevScroll, Math.max(0, body.scrollHeight - body.clientHeight));
}

function renderCapabilities() {
  const body = $('#settingsBody');
  const data = state.capabilities;
  if (!data) {
    body.innerHTML = '<h3>能力审计</h3><p class="lead">正在生成能力护照…</p><div class="usage-loading"></div>';
    return;
  }
  const typeLabel = { plugin: '插件', skill: 'Skill', mcp: 'MCP', tool: '内置工具' };
  const riskLabel = { high: '高风险', medium: '中风险', low: '低风险' };
  body.innerHTML = `<section class="passport-page">
    <div class="settings-page-heading"><div><div class="usage-kicker">能力治理</div><h3>能力审计</h3><p class="lead">统一查看每项能力的来源、版本、权限、信任边界和结构完整性。</p></div><button class="btn-ghost" id="refreshCapabilities">重新扫描</button></div>
    <div class="passport-summary"><span><strong>${data.summary.total}</strong> 项能力</span><span><strong>${data.summary.enabled}</strong> 项启用</span><span class="${data.summary.highRisk ? 'warn' : ''}"><strong>${data.summary.highRisk}</strong> 项高风险</span><span class="${data.summary.issues ? 'warn' : ''}"><strong>${data.summary.issues}</strong> 个待处理问题</span></div>
    <div class="resource-toolbar passport-toolbar"><label class="resource-search"><span>⌕</span><input id="passportSearch" type="search" placeholder="搜索能力、来源或权限" /></label><select id="passportType"><option value="">全部类型</option>${Object.entries(typeLabel).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select><select id="passportRisk"><option value="">全部风险</option><option value="high">高风险</option><option value="medium">中风险</option><option value="low">低风险</option></select><span class="resource-count" id="passportCount">${data.items.length} 项</span></div>
    <div class="passport-grid">${data.items.map(item => `<article class="passport-card" data-passport data-type="${esc(item.type)}" data-risk="${esc(item.risk)}" data-search="${esc([item.name,item.id,item.source,item.scope,...(item.permissions||[])].join(' ').toLowerCase())}">
      <div class="passport-head"><span class="passport-type ${esc(item.type)}">${typeLabel[item.type] || esc(item.type)}</span><span class="passport-risk ${esc(item.risk)}">${riskLabel[item.risk] || esc(item.risk)}</span></div>
      <h4>${esc(item.name)}</h4><code>${esc(item.id)}</code><p>${esc(item.description || '暂无说明')}</p>
      <dl><div><dt>来源</dt><dd>${esc(item.source)} · ${esc(item.scope || 'project')}</dd></div><div><dt>版本 / 完整性</dt><dd>${esc(item.version || '未声明')} · ${esc(item.integrity || 'unknown')}</dd></div><div><dt>信任</dt><dd>${esc(item.trust || 'unknown')}</dd></div></dl>
      <div class="passport-perms">${(item.permissions || []).map(permission=>`<span>${esc(permission)}</span>`).join('') || '<span class="none">无特殊权限</span>'}</div>
      ${(item.issues || []).length ? `<div class="passport-issues">${item.issues.map(issue=>`<span>${esc(issue)}</span>`).join('')}</div>` : '<div class="passport-clean">结构检查通过</div>'}
    </article>`).join('')}</div><div class="extension-empty" id="passportEmpty" hidden>没有符合筛选条件的能力。</div>
  </section>`;
  const apply = () => {
    const query = ($('#passportSearch').value || '').trim().toLowerCase(), type = $('#passportType').value, risk = $('#passportRisk').value;
    let visible = 0;
    body.querySelectorAll('[data-passport]').forEach(card => { const show = (!query || card.dataset.search.includes(query)) && (!type || card.dataset.type === type) && (!risk || card.dataset.risk === risk); card.hidden = !show; if (show) visible += 1; });
    $('#passportCount').textContent = `${visible} / ${data.items.length} 项`; $('#passportEmpty').hidden = visible !== 0;
  };
  $('#passportSearch').oninput = apply; $('#passportType').onchange = apply; $('#passportRisk').onchange = apply;
  $('#refreshCapabilities').onclick = async () => { state.capabilities = null; renderCapabilities(); await loadCapabilities(); renderCapabilities(); };
}

function compactNumber(value) {
  const number = Number(value || 0);
  if (number >= 1_000_000_000) return (number / 1_000_000_000).toFixed(number >= 10_000_000_000 ? 0 : 1) + 'B';
  if (number >= 1_000_000) return (number / 1_000_000).toFixed(number >= 10_000_000 ? 0 : 1) + 'M';
  if (number >= 1_000) return (number / 1_000).toFixed(number >= 10_000 ? 0 : 1) + 'K';
  return number.toLocaleString('zh-CN');
}

function usageTrend(data) {
  const rows = data || [];
  const width = 760, height = 226, left = 38, top = 18, bottom = 30;
  const plotW = width - left - 12, plotH = height - top - bottom;
  const max = Math.max(1, ...rows.map(item => Number(item.totalTokens || 0)));
  const step = plotW / Math.max(1, rows.length);
  const bars = rows.map((item, index) => {
    const x = left + index * step + Math.max(1, step * .16);
    const barW = Math.max(2, step * .68);
    const inputH = plotH * Number(item.inputTokens || 0) / max;
    const outputH = plotH * Number(item.outputTokens || 0) / max;
    const yBase = top + plotH;
    return `<g><title>${esc(item.date)} · ${compactNumber(item.totalTokens)} tokens</title><rect class="usage-bar-input" x="${x}" y="${yBase - inputH}" width="${barW}" height="${inputH}" rx="2"/><rect class="usage-bar-output" x="${x}" y="${yBase - inputH - outputH}" width="${barW}" height="${outputH}" rx="2"/></g>`;
  }).join('');
  const points = rows.map((item, index) => `${left + index * step + step / 2},${top + plotH - plotH * Number(item.totalTokens || 0) / max}`).join(' ');
  const ticks = [0, .5, 1].map(ratio => `<g><line x1="${left}" x2="${width - 12}" y1="${top + plotH * (1-ratio)}" y2="${top + plotH * (1-ratio)}"/><text x="0" y="${top + plotH * (1-ratio) + 4}">${compactNumber(max * ratio)}</text></g>`).join('');
  const first = rows[0]?.date?.slice(5) || '', last = rows[rows.length - 1]?.date?.slice(5) || '';
  return `<svg class="usage-trend" viewBox="0 0 ${width} ${height}" role="img" aria-label="每日 Token 用量趋势"><g class="usage-grid">${ticks}</g>${bars}${points ? `<polyline class="usage-line" points="${points}"/>` : ''}<text class="usage-date" x="${left}" y="${height - 5}">${esc(first)}</text><text class="usage-date" x="${width - 12}" y="${height - 5}" text-anchor="end">${esc(last)}</text></svg>`;
}

function renderUsage() {
  const body = $('#settingsBody');
  const usage = state.usage;
  if (state.usageLoading && !usage) {
    body.innerHTML = '<h3>用量中心</h3><p class="lead">正在汇总本地运行记录…</p><div class="usage-loading"></div>';
    return;
  }
  const totals = usage?.totals || {};
  const today = usage?.daily?.[usage.daily.length - 1] || {};
  const models = usage?.models || [];
  const providers = usage?.providers || [];
  const palette = ['#6158e8','#16aabd','#9b77f2','#ef9f52','#46a575','#d65f7a'];
  let angle = 0;
  const stops = models.slice(0, 6).map((model, index) => { const start = angle; angle += Number(model.share || 0) * 360; return `${palette[index % palette.length]} ${start}deg ${angle}deg`; }).join(',');
  const rangeButton = (value, label) => `<button class="usage-range ${state.usageRange === value ? 'active' : ''}" data-usage-range="${value}">${label}</button>`;
  body.innerHTML = `
    <section class="usage-page">
      <div class="settings-page-heading usage-heading"><div><div class="usage-kicker">本地用量统计</div><h3>每日 Token 用量</h3><p class="lead">按本机请求汇总；上游未返回 usage 时会明确标记为估算，不读取任何提示词正文。</p></div>
        <div class="usage-heading-actions"><div class="usage-ranges">${rangeButton('7','近 7 天')}${rangeButton('30','近 30 天')}${rangeButton('all','全部')}</div><button class="btn-ghost" id="exportUsage">导出 CSV</button></div></div>
      <div class="usage-metrics">
        <article class="usage-metric primary"><span>Token 总量</span><strong>${compactNumber(totals.totalTokens)}</strong><small>输入 ${compactNumber(totals.inputTokens)} · 输出 ${compactNumber(totals.outputTokens)}</small></article>
        <article class="usage-metric"><span>今日用量</span><strong>${compactNumber(today.totalTokens)}</strong><small>${today.requests || 0} 次模型请求</small></article>
        <article class="usage-metric"><span>有效交互</span><strong>${compactNumber(totals.messages)}</strong><small>${totals.requests || 0} 次模型调用</small></article>
        <article class="usage-metric"><span>活跃天数</span><strong>${totals.activeDays || 0}</strong><small>连续 ${totals.currentStreak || 0} 天 · 最长 ${totals.longestStreak || 0} 天</small></article>
      </div>
      <div class="usage-insights">
        <span><i class="success"></i>成功率 <strong>${((totals.successRate ?? 1) * 100).toFixed(1)}%</strong></span>
        <span>日均 <strong>${compactNumber(totals.averagePerActiveDay)}</strong></span>
        <span>峰值时段 <strong>${String(totals.peakHour || 0).padStart(2,'0')}:00–${String(((totals.peakHour || 0)+1)%24).padStart(2,'0')}:00</strong></span>
        <span>真实上报 <strong>${((totals.reportedShare || 0) * 100).toFixed(0)}%</strong></span>
        ${totals.estimatedTokens ? `<span class="estimate-note">约 ${compactNumber(totals.estimatedTokens)} Token 为本地估算</span>` : ''}
      </div>
      <div class="usage-layout">
        <article class="usage-panel usage-wide"><div class="usage-panel-head"><div><h4>按天趋势</h4><p>深色为输入，浅色为输出；悬停柱形查看当天明细。</p></div><div class="usage-legend"><span class="input"></span>输入 <span class="output"></span>输出</div></div>${usageTrend(usage?.daily || [])}</article>
        <article class="usage-panel"><div class="usage-panel-head"><div><h4>模型用量</h4><p>选定周期内的 Token 占比</p></div></div><div class="usage-model-wrap"><div class="usage-donut" style="background:conic-gradient(${stops || 'var(--mc-line) 0 360deg'})"><div><strong>${models.length}</strong><span>模型</span></div></div><div class="usage-model-list">${models.slice(0,6).map((model,index)=>`<div><i style="background:${palette[index%palette.length]}"></i><span title="${esc(model.name)}">${esc(model.name)}</span><strong>${(Number(model.share || 0)*100).toFixed(1)}%</strong><small>${compactNumber(model.totalTokens)}</small></div>`).join('') || '<p class="usage-empty">还没有用量记录</p>'}</div></div></article>
        <article class="usage-panel usage-wide"><div class="usage-panel-head"><div><h4>活跃热力图</h4><p>最近 26 周的本地模型调用</p></div><span>${usage?.heatmap?.filter(item=>item.totalTokens>0).length || 0} 个活跃日</span></div><div class="usage-heatmap" aria-label="最近 26 周活跃情况">${(usage?.heatmap || []).map(item=>{ const level=item.totalTokens===0?0:item.totalTokens<1000?1:item.totalTokens<10000?2:item.totalTokens<100000?3:4; return `<i data-level="${level}"><span>${esc(item.date)} · ${compactNumber(item.totalTokens)} tokens</span></i>`;}).join('')}</div></article>
        <article class="usage-panel"><div class="usage-panel-head"><div><h4>提供方健康</h4><p>请求、用量与错误率</p></div></div><div class="usage-provider-list">${providers.map(provider=>`<div><span><i></i>${esc(provider.name)}</span><strong>${compactNumber(provider.totalTokens)}</strong><small>${provider.requests} 次 · ${provider.requests ? (provider.errors/provider.requests*100).toFixed(0) : 0}% 错误</small></div>`).join('') || '<p class="usage-empty">还没有提供方记录</p>'}</div></article>
      </div>
    </section>`;
  body.querySelectorAll('[data-usage-range]').forEach(button => button.onclick = async () => {
    state.usageRange = button.dataset.usageRange; state.usage = null; renderUsage(); await loadUsage(state.usageRange); renderUsage();
  });
  $('#exportUsage').onclick = () => {
    const rows = [['date','input_tokens','output_tokens','total_tokens','requests','errors'], ...(usage?.daily || []).map(item => [item.date,item.inputTokens,item.outputTokens,item.totalTokens,item.requests,item.errors])];
    const blob = new Blob([rows.map(row => row.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `multichat-usage-${state.usageRange}d.csv`; link.click(); setTimeout(()=>URL.revokeObjectURL(link.href),1000);
  };
}

function showWorkspaceForm() {
  showModal({
    title: '新建工作区',
    body: `<form id="workspaceForm"><div class="field"><label>名称</label><input name="name" required placeholder="例如：产品研发" /></div><div class="field"><label>描述</label><input name="description" placeholder="这个工作区用于什么" /></div><div class="row"><button type="button" class="btn-ghost" id="workspaceCancel">取消</button><button class="btn-primary" type="submit">创建</button></div></form>`,
    onMount: (card) => {
      $('#workspaceCancel', card).onclick = closeModal;
      $('#workspaceForm', card).onsubmit = async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.target).entries()); try { await api('/api/workspaces', { method: 'POST', body: JSON.stringify(data) }); await loadWorkspaces(); renderTopbar(); renderSettings('workspace'); closeModal(); toast('工作区已创建'); } catch (error) { toast(error.message, 'error'); } };
    }
  });
}

function showMemoryModal(id = null) {
  const editing = id ? state.memories.find(item => item.id === id) : null;
  showModal({
    title: editing ? '编辑项目记忆' : '新增项目记忆',
    body: `<form id="memoryForm"><div class="field"><label>标题</label><input name="title" required maxlength="120" value="${esc(editing?.title || '')}" placeholder="例如：代码风格" /></div><div class="field"><label>事实或偏好</label><textarea name="content" required maxlength="4000" rows="6" placeholder="只记录可长期复用、由你确认的信息。">${esc(editing?.content || '')}</textarea><div class="pmeta">记忆作为上下文参考，不会被当作可执行指令。</div></div><div id="memoryErr" class="auth-error"></div><div class="row"><button type="button" class="btn-ghost" id="memoryCancel">取消</button><button class="btn-primary" type="submit">保存</button></div></form>`,
    onMount: card => {
      $('#memoryCancel', card).onclick = closeModal;
      $('#memoryForm', card).onsubmit = async event => {
        event.preventDefault(); const values = Object.fromEntries(new FormData(event.target).entries());
        const payload = { ...values, projectId: state.selectedProject?.id, enabled: editing ? editing.enabled !== false : true };
        try { await api(editing ? '/api/memories/' + editing.id : '/api/memories', { method: editing ? 'PUT' : 'POST', body: JSON.stringify(payload) }); await loadProjectControlData(); renderSettings('workspace', true); closeModal(); toast('项目记忆已保存'); }
        catch (error) { $('#memoryErr', card).textContent = error.message; }
      };
    }
  });
}

function showProjectForm() {
  if (!state.selectedWorkspace) return toast('请先选择工作区', 'error');
  showModal({
    title: '新建项目',
    body: `<form id="projectForm"><div class="field"><label>名称</label><input name="name" required placeholder="例如：移动端重构" /></div><div class="field"><label>描述</label><input name="description" placeholder="项目目标或范围" /></div><div class="row"><button type="button" class="btn-ghost" id="projectCancel">取消</button><button class="btn-primary" type="submit">创建</button></div></form>`,
    onMount: (card) => {
      $('#projectCancel', card).onclick = closeModal;
      $('#projectForm', card).onsubmit = async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.target).entries()); data.workspaceId = state.selectedWorkspace.id; try { await api('/api/projects', { method: 'POST', body: JSON.stringify(data) }); await loadProjects(); renderSettings('workspace'); closeModal(); toast('项目已创建'); } catch (error) { toast(error.message, 'error'); } };
    }
  });
}

function showAssetUrlModal() {
  if (!state.selectedProject) return toast('请先选择项目', 'error');
  showModal({
    title: '从 URL 添加文件',
    body: `<form id="assetUrlForm"><div class="field"><label>URL</label><input name="url" type="url" required placeholder="https://example.com/notes.md" /></div><div class="field"><label>显示名称（可选）</label><input name="name" placeholder="自动从 URL 推断" /></div><div id="assetUrlErr" class="auth-error"></div><div class="row"><button type="button" class="btn-ghost" id="assetUrlCancel">取消</button><button class="btn-primary" type="submit">添加</button></div></form>`,
    onMount: (card) => {
      $('#assetUrlCancel', card).onclick = closeModal;
      $('#assetUrlForm', card).onsubmit = async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.target).entries()); data.projectId = state.selectedProject.id; try { await api('/api/assets', { method: 'POST', body: JSON.stringify(data) }); await loadProjects(); renderSettings('workspace'); closeModal(); toast('远程文件已加入项目'); } catch (error) { $('#assetUrlErr', card).textContent = error.message; } };
    }
  });
}

function renderRuns() {
  const body = $('#settingsBody');
  const runs = state.runs || [];
  const completed = runs.filter(run => run.status === 'completed').length;
  const totalTokens = runs.reduce((sum, run) => sum + Number(run.usage?.totalTokens || 0), 0);
  body.innerHTML = `
    <div class="settings-page-heading"><div><div class="usage-kicker">运行记录</div><h3>执行与复盘</h3><p class="lead">复盘模型请求、工具权限、上下文来源、耗时与 Token；点击记录查看完整上下文。</p></div><button class="btn-ghost" id="refreshRuns">刷新</button></div>
    <div class="passport-summary"><span><strong>${runs.length}</strong> 条记录</span><span><strong>${completed}</strong> 次完成</span><span><strong>${compactNumber(totalTokens)}</strong> tokens</span><span class="${runs.length - completed ? 'warn' : ''}"><strong>${runs.length - completed}</strong> 次未完成</span></div>
    <div class="run-list">
      ${runs.map(r => `
        <button class="run-row run-row-button" data-run-id="${esc(r.id)}">
          <span class="run-dot ${esc(r.status || '')}"></span>
          <div class="run-main"><div class="run-title">${esc(r.agentName || r.agentId || '智能体运行')} <span>${esc(r.provider?.name || '')}</span></div><div class="run-meta">${esc(r.model || '未指定模型')} · ${esc(r.steps || 0)} 步 · ${esc(r.toolCalls || 0)} 次工具 · ${compactNumber(r.usage?.totalTokens || 0)} tokens · ${r.finishedAt ? ((Date.parse(r.finishedAt)-Date.parse(r.startedAt))/1000).toFixed(1)+'s' : '运行中'}</div></div>
          <span class="run-status">${r.status === 'completed' ? '已完成' : r.status === 'error' ? '失败' : r.status === 'cancelled' ? '已取消' : '进行中'}</span><span class="run-open">›</span>
        </button>`).join('') || '<div style="color:var(--label-caption);font-size:13px;padding:8px 0;">还没有 Agent 运行记录。</div>'}
    </div>`;
  $('#refreshRuns').onclick = async () => { await loadRuns(); renderSettings('runs', true); };
  body.querySelectorAll('[data-run-id]').forEach(button => button.onclick = () => showRunDetail(button.dataset.runId));
}

async function showRunDetail(id) {
  try {
    const run = await api('/api/runs/' + encodeURIComponent(id));
    const steps = (run.turns || []).flatMap(turn => turn.steps || []);
    const context = run.contextManifest || {};
    const usage = run.usage || {};
    const chip = (label, value) => `<span><small>${esc(label)}</small><strong>${esc(value)}</strong></span>`;
    const statusText = run.status === 'completed' ? '已完成' : run.status === 'error' ? '失败' : run.status === 'cancelled' ? '已取消' : '运行中';
    showModal({
      title: `运行详情 · ${run.agentName || run.agentId}`,
      body: `<div class="run-detail-summary">${chip('状态', statusText)}${chip('模型', run.model || '—')}${chip('Token', compactNumber(usage.totalTokens || 0))}${chip('步骤', String(steps.length))}${chip('策略', run.toolPolicy === 'safe' ? '安全' : '自动')}</div>
        <div class="run-detail-grid"><section><h4>执行时间线</h4><div class="flight-timeline">${steps.map((step,index)=>`<article class="flight-step ${esc(step.status)}"><i>${index+1}</i><div><strong>${step.kind === 'tool_call' ? esc(step.tool || '工具调用') : `模型请求 · ${esc(step.model || '')}`}</strong><p>${step.kind === 'tool_call' ? `${esc((step.permissions||[]).join(', ') || '无特殊权限')} · ${esc(step.risk || 'low')}` : `${step.messageCount || 0} 条上下文 · ${compactNumber(step.usage?.total || 0)} tokens`}</p>${step.error ? `<code>${esc(step.error)}</code>` : ''}</div><span>${step.durationMs != null ? (step.durationMs/1000).toFixed(2)+'s' : step.status}</span></article>`).join('') || '<div class="control-empty">没有步骤轨迹。</div>'}</div></section>
        <section><h4>上下文透镜</h4><div class="context-lens"><div><span>消息</span><strong>${context.messages || 0}</strong></div><div><span>系统上下文</span><strong>${compactNumber(context.systemCharacters || 0)} 字</strong></div><div><span>项目文件</span><strong>${(context.assets || []).length}</strong></div><div><span>记忆</span><strong>${(context.memories || []).length}</strong></div></div>
        <div class="context-source"><h5>注入来源</h5>${[['文件',context.assets],['记忆',context.memories],['Skills',context.skills],['工具',context.tools],['MCP',context.mcpServers]].map(([label,items])=>`<div><strong>${label}</strong><span>${(items||[]).map(item=>esc(item.name || item.id)).join('、') || '无'}</span></div>`).join('')}</div>
        <div class="context-source"><h5>Token 构成</h5><div><strong>输入</strong><span>${compactNumber(usage.inputTokens || 0)}</span></div><div><strong>输出</strong><span>${compactNumber(usage.outputTokens || 0)}</span></div><div><strong>缓存</strong><span>${compactNumber(usage.cachedTokens || 0)}</span></div><div><strong>估算</strong><span>${compactNumber(usage.estimatedTokens || 0)}</span></div></div></section></div>
        <div class="row"><button class="btn-ghost" id="exportRun">导出运行快照</button><button class="btn-primary" id="closeRunDetail">关闭</button></div>`,
      onMount: card => {
        card.classList.add('run-detail-modal');
        $('#closeRunDetail', card).onclick = closeModal;
        $('#exportRun', card).onclick = () => { const blob = new Blob([JSON.stringify(run,null,2)],{type:'application/json'}); const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`${run.id}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000); };
      }
    });
  } catch (error) { toast(error.message, 'error'); }
}

export { openSettings,closeSettings,switchSettingsTab,renderSettings,renderUsage,renderCapabilities,showRunDetail,showMemoryModal,showWorkspaceForm,showProjectForm,showAssetUrlModal,renderRuns };
