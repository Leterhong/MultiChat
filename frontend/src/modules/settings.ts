import { $, $$, esc, api, toast, state, saveSelectedAgent, saveParams, getTheme, setTheme } from '../core/index';
import { GeneralSettings, ProviderSettings, SkillSettings, ToolSettings } from '../components/CoreSettings';
import { AgentSettings, CapabilitySettings, RunsSettings, UsageSettings, WorkspaceSettings, compactNumber } from '../components/SettingsDashboards';
import { ModelExperimentSettings, type CompareResult } from '../components/CompareLab';
import { importProjectFolder } from './assets';
import { applyProjectDefaults, renderFileContext } from './conversations';
import { loadAgents, loadCapabilities, loadProjectControlData, loadProjects, loadProviders, loadRuns, loadSkills, loadTools, loadUsage, loadWorkspaces } from './data';
import { showExtensionImport } from './extensionImport';
import { doImport, exportEntity, normalizeImport, showAddBuiltin, showAddCustom, showAgentModal, showSkillModal } from './importExport';
import { closeModal, showModal } from './modal';
import { renderTopbar } from './modelPicker';
import { mountExtensionSettings, renderMcpServers, renderPlugins, showDiff, sourceLabel, unmountExtensionSettings } from './pluginsUI';
import { renderContent } from './render';
import { adoptResult, compareTargets, executeTarget } from './compare';

$('#settingsBtn').onclick = () => openSettings();
let settingsReturnFocus: HTMLElement | null = null;

function openSettings(tab = 'general') {
  const panel = $('#settings');
  if (!panel.classList.contains('open')) settingsReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  panel.inert = false;
  panel.setAttribute('aria-hidden', 'false');
  panel.classList.add('open');
  $('#scrim').classList.add('open');
  switchSettingsTab(tab);
  $('#settingsBody')?.focus?.({ preventScroll: true });
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
  const target = settingsReturnFocus?.isConnected && app.contains(settingsReturnFocus) ? settingsReturnFocus : fallback;
  try { target?.focus?.({ preventScroll: true }); } catch { target?.focus?.(); }
  if (panel.contains(document.activeElement)) fallback?.focus?.({ preventScroll: true });
  panel.classList.remove('open');
  panel.inert = true;
  panel.setAttribute('aria-hidden', 'true');
  $('#scrim').classList.remove('open');
  settingsReturnFocus = null;
  if (location.hash.startsWith('#/settings/')) history.replaceState(null, '', state.currentConvId ? `#/chat/${encodeURIComponent(state.currentConvId)}` : '#/new');
}

$('#scrim').onclick = closeSettings;
$('#closeSettings').onclick = closeSettings;
$('#closeSettingsTop').onclick = closeSettings;
document.addEventListener('keydown', (event) => {
  const panel = $('#settings') as HTMLElement;
  if (!panel.classList.contains('open') || $('#modal').classList.contains('open')) return;
  if (event.key === 'Escape') { closeSettings(); return; }
  if (event.key !== 'Tab') return;
  const focusable = Array.from(panel.querySelectorAll<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex="0"]')).filter((element) => element.offsetParent !== null);
  if (!focusable.length) { event.preventDefault(); $('#settingsBody')?.focus(); return; }
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});

$$('.settings-tab[data-tab]').forEach((button) => button.onclick = () => switchSettingsTab(button.dataset.tab));

function switchSettingsTab(tab: string) {
  state.currentTab = tab;
  $$('.settings-tab[data-tab]').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
  renderSettings(tab);
  if ($('#settings').classList.contains('open')) {
    const route = `#/settings/${encodeURIComponent(tab)}`;
    if (location.hash !== route) history.replaceState(null, '', route);
  }
  if (tab === 'usage') void loadUsage(state.usageRange);
  else if (tab === 'capabilities') void loadCapabilities();
}

function renderSettings(tab = 'general', keepScroll = false) {
  const body = $('#settingsBody') as HTMLElement;
  unmountExtensionSettings();
  const previousScroll = keepScroll ? body.scrollTop : 0;

  if (tab === 'general') {
    mountExtensionSettings(GeneralSettings, {
      params: state.params,
      theme: getTheme(),
      token: localStorage.getItem('multichat_server_token') || '',
      onSaveParams: (params: any) => { state.params = params; saveParams(); toast('已保存'); },
      onTheme: (theme: string) => { setTheme(theme as any); toast('主题已切换'); },
      onSaveToken: (value: string) => { if (value) localStorage.setItem('multichat_server_token', value); else localStorage.removeItem('multichat_server_token'); toast(value ? '访问令牌已保存' : '访问令牌已清除'); },
    });
  } else if (tab === 'providers') {
    mountExtensionSettings(ProviderSettings, {
      providers: state.providers,
      onSave: async (provider: any, payload: any) => { try { await api(`/api/providers/${encodeURIComponent(provider.id)}`, { method: 'PUT', body: JSON.stringify(payload) }); await loadProviders(); renderTopbar(); toast('已保存'); return true; } catch (error: any) { toast(error.message, 'error'); return false; } },
      onDelete: async (provider: any) => { if (!(await showConfirm({ title: '删除模型提供方', message: `删除「${provider.name || provider.id}」？此操作不可撤销。`, confirmLabel: '删除', danger: true }))) return false; try { await api(`/api/providers/${encodeURIComponent(provider.id)}`, { method: 'DELETE' }); await loadProviders(); renderTopbar(); toast('已删除'); return true; } catch (error: any) { toast(error.message, 'error'); return false; } },
      onAddBuiltin: showAddBuiltin,
      onAddCustom: showAddCustom,
      onProbe: async (provider: any) => api(`/api/providers/${encodeURIComponent(provider.id)}/probe`, { method: 'POST', body: JSON.stringify({}) }),
    });
  } else if (tab === 'experiment') {
    const targets = compareTargets();
    const currentId = state.selectedProvider && state.selectedModel ? `${state.selectedProvider.id}:${state.selectedModel}` : '';
    const defaults = [currentId, ...targets.map((item) => item.id)].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).slice(0, 2);
    const latestPrompt = [...(state.messages || [])].reverse().find((message: any) => message.role === 'user')?.content || '';
    mountExtensionSettings(ModelExperimentSettings, {
      targets,
      defaultTargetIds: defaults,
      initialPrompt: latestPrompt,
      projectName: state.selectedProject?.name || '未选择项目',
      fileCount: state.selectedAssetIds?.size || 0,
      memoryCount: (state.memories || []).filter((item: any) => item.enabled !== false).length,
      execute: executeTarget,
      adopt: async (result: CompareResult, prompt: string) => {
        await adoptResult(result, prompt);
        closeSettings();
        window.requestAnimationFrame(() => $('#input')?.focus());
      },
    });
  } else if (tab === 'skills') {
    mountExtensionSettings(SkillSettings, {
      initialSkills: state.skills,
      sourceLabel,
      onToggle: async (skill: any) => { try { await api(`/api/skills/${encodeURIComponent(skill.key || skill.id)}/toggle`, { method: 'POST', body: JSON.stringify({ enabled: !skill.enabled }) }); await loadSkills(); return true; } catch (error: any) { toast(error.message, 'error'); return false; } },
      onEdit: (skill: any) => showSkillModal(skill.key || skill.id),
      onDiff: async (skill: any) => { try { showDiff('Skill 变更', await api(`/api/skills/${encodeURIComponent(skill.key || skill.id)}/diff`)); } catch (error: any) { toast(error.message, 'error'); } },
      onDelete: async (skill: any) => { if (!(await showConfirm({ title: '删除 Skill', message: '删除该 Skill？关联运行配置的引用也将被移除。', confirmLabel: '删除', danger: true }))) return false; try { await api(`/api/skills/${encodeURIComponent(skill.key || skill.id)}`, { method: 'DELETE' }); await Promise.all([loadSkills(), loadAgents()]); return true; } catch (error: any) { toast(error.message, 'error'); return false; } },
      onImport: () => showExtensionImport('skill'),
      onAdd: () => showSkillModal(null),
    });
  } else if (tab === 'tools') {
    mountExtensionSettings(ToolSettings, {
      initialTools: state.tools,
      agents: state.agents,
      onTest: async (tool: any, expression?: string) => api(`/api/tools/${encodeURIComponent(tool.id)}/test`, { method: 'POST', body: JSON.stringify(expression !== undefined ? { expression } : {}) }),
      onToggle: async (tool: any) => { try { await api(`/api/tools/${encodeURIComponent(tool.id)}`, { method: 'PUT', body: JSON.stringify({ enabled: !tool.enabled }) }); await loadTools(); toast(tool.enabled ? '工具已停用' : '工具已启用'); return true; } catch (error: any) { toast(error.message, 'error'); return false; } },
    });
  } else if (tab === 'workspace') {
    mountWorkspaceSettings();
  } else if (tab === 'agents') {
    mountAgentSettings();
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

  if (keepScroll) requestAnimationFrame(() => { body.scrollTop = Math.min(previousScroll, Math.max(0, body.scrollHeight - body.clientHeight)); });
}

function mountWorkspaceSettings() {
  mountExtensionSettings(WorkspaceSettings, {
    onProjectChange: async (id: string) => { state.selectedProject = state.projects.find((item: any) => item.id === id) || null; if (state.selectedProject) localStorage.setItem('multichat_project', state.selectedProject.id); await loadProjects(); renderTopbar(); renderContent(); renderFileContext(); },
    onSaveDefaults: async (agentId: string | null, providerId: string | null, model: string | null) => {
      if (!state.selectedProject) { toast('请先选择项目', 'error'); return; }
      try {
        await api(`/api/projects/${encodeURIComponent(state.selectedProject.id)}`, { method: 'PUT', body: JSON.stringify({ defaultAgentId: agentId, defaultProviderId: providerId, defaultModel: model }) });
        const updated = { ...state.selectedProject, defaultAgentId: agentId, defaultProviderId: providerId, defaultModel: model };
        state.selectedProject = updated;
        state.projects = state.projects.map((item: any) => item.id === updated.id ? updated : item);
        applyProjectDefaults(); toast('已保存项目默认');
      } catch (error: any) { toast(error.message, 'error'); }
    },
    onNewProject: showProjectForm,
    onImportFolder: importProjectFolder,
    onImportUrl: showAssetUrlModal,
    onUploadFile: async (file: File) => { if (!state.selectedProject) return; try { await api('/api/assets', { method: 'POST', body: JSON.stringify({ projectId: state.selectedProject.id, name: file.name, mimeType: file.type || 'text/plain', content: await file.text() }) }); await loadProjects(); toast('文件已加入项目'); } catch (error: any) { toast(error.message, 'error'); } },
    onDeleteAsset: async (id: string) => { try { await api(`/api/assets/${encodeURIComponent(id)}`, { method: 'DELETE' }); await loadProjects(); } catch (error: any) { toast(error.message, 'error'); } },
    onSearch: async (query: string) => state.selectedProject ? api(`/api/projects/${encodeURIComponent(state.selectedProject.id)}/search?q=${encodeURIComponent(query)}`) : [],
    onAddMemory: () => showMemoryModal(),
    onEditMemory: (id: string) => showMemoryModal(id),
    onToggleMemory: async (item: any) => { await api(`/api/memories/${encodeURIComponent(item.id)}`, { method: 'PUT', body: JSON.stringify({ enabled: item.enabled === false }) }); await loadProjectControlData(); },
    onDeleteMemory: async (id: string) => { if (!(await showConfirm({ title: '删除项目记忆', message: '删除这条项目记忆？', confirmLabel: '删除', danger: true }))) return; await api(`/api/memories/${encodeURIComponent(id)}`, { method: 'DELETE' }); await loadProjectControlData(); },
    onCreateSnapshot: async () => { if (!state.selectedProject) return; const title = await showPrompt({ title: '新建项目快照', label: '快照名称', value: `项目快照 ${new Date().toLocaleString('zh-CN')}`, maxLength: 120 }); if (title == null) return; try { await api('/api/snapshots', { method: 'POST', body: JSON.stringify({ projectId: state.selectedProject.id, title }) }); await loadProjectControlData(); toast('项目快照已创建'); } catch (error: any) { toast(error.message, 'error'); } },
    onRestoreSnapshot: async (id: string) => { if (!(await showConfirm({ title: '恢复快照', message: '恢复该快照？当前状态会先自动备份，随后替换项目文件、记忆和默认配置。', confirmLabel: '恢复快照', danger: true }))) return; try { await api(`/api/snapshots/${encodeURIComponent(id)}/restore`, { method: 'POST' }); await Promise.all([loadProjects(), loadAgents()]); renderFileContext(); toast('快照已恢复'); } catch (error: any) { toast(error.message, 'error'); } },
    onDeleteSnapshot: async (id: string) => { if (!(await showConfirm({ title: '删除项目快照', message: '删除该项目快照？', confirmLabel: '删除', danger: true }))) return; await api(`/api/snapshots/${encodeURIComponent(id)}`, { method: 'DELETE' }); await loadProjectControlData(); },
  });
}

function mountAgentSettings() {
  mountExtensionSettings(AgentSettings, {
    onEdit: (id: string | null) => showAgentModal(id),
    onExport: (agent: any) => exportEntity(agent, 'agent'),
    onDelete: async (agent: any) => {
      if (!(await showConfirm({ title: '删除运行配置', message: '删除该运行配置？', confirmLabel: '删除', danger: true }))) return;
      try { await api(`/api/agents/${encodeURIComponent(agent.id)}`, { method: 'DELETE' }); } catch (error: any) { toast(error.message, 'error'); return; }
      if (state.selectedAgent?.id === agent.id) state.selectedAgent = null;
      saveSelectedAgent(); await loadAgents(); renderTopbar();
    },
    onImport: async (file: File) => { try { await doImport(normalizeImport(JSON.parse(await file.text())), `文件 ${file.name}`); } catch (error: any) { toast(`解析失败：${error.message}`, 'error'); } },
  });
}

function renderCapabilities() {
  mountExtensionSettings(CapabilitySettings, {
    onRefresh: async () => { state.capabilities = null; await loadCapabilities(); },
  });
}

function exportUsage(usage: any, range: string) {
  const rows = [['date', 'input_tokens', 'output_tokens', 'total_tokens', 'requests', 'errors'], ...(usage?.daily || []).map((item: any) => [item.date, item.inputTokens, item.outputTokens, item.totalTokens, item.requests, item.errors])];
  const blob = new Blob([rows.map((row) => row.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `multichat-usage-${range}d.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function renderUsage() {
  mountExtensionSettings(UsageSettings, {
    onRange: async (range: string) => { state.usage = null; await loadUsage(range); },
    onExport: exportUsage,
  });
}

function renderRuns() {
  mountExtensionSettings(RunsSettings, {
    onRefresh: loadRuns,
    onOpen: showRunDetail,
  });
}

function showWorkspaceForm() {
  showModal({
    title: '新建工作区',
    body: '<form id="workspaceForm"><div class="field"><label>名称</label><input name="name" required placeholder="例如：产品研发" /></div><div class="field"><label>描述</label><input name="description" placeholder="这个工作区用于什么" /></div><div class="row"><button type="button" class="btn-ghost" id="workspaceCancel">取消</button><button class="btn-primary" type="submit">创建</button></div></form>',
    onMount: (card: HTMLElement) => {
      $('#workspaceCancel', card).onclick = closeModal;
      $('#workspaceForm', card).onsubmit = async (event: SubmitEvent) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.target as HTMLFormElement).entries()); try { await api('/api/workspaces', { method: 'POST', body: JSON.stringify(data) }); await loadWorkspaces(); renderTopbar(); closeModal(); toast('工作区已创建'); } catch (error: any) { toast(error.message, 'error'); } };
    },
  });
}

function showMemoryModal(id: string | null = null) {
  const editing = id ? state.memories.find((item: any) => item.id === id) : null;
  showModal({
    title: editing ? '编辑项目记忆' : '新增项目记忆',
    body: `<form id="memoryForm"><div class="field"><label>标题</label><input name="title" required maxlength="120" value="${esc(editing?.title || '')}" placeholder="例如：代码风格" /></div><div class="field"><label>事实或偏好</label><textarea name="content" required maxlength="4000" rows="6" placeholder="只记录可长期复用、由你确认的信息。">${esc(editing?.content || '')}</textarea><div class="pmeta">记忆作为上下文参考，不会被当作可执行指令。</div></div><div id="memoryErr" class="auth-error"></div><div class="row"><button type="button" class="btn-ghost" id="memoryCancel">取消</button><button class="btn-primary" type="submit">保存</button></div></form>`,
    onMount: (card: HTMLElement) => {
      $('#memoryCancel', card).onclick = closeModal;
      $('#memoryForm', card).onsubmit = async (event: SubmitEvent) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.target as HTMLFormElement).entries()); const payload = { ...values, projectId: state.selectedProject?.id, enabled: editing ? editing.enabled !== false : true }; try { await api(editing ? `/api/memories/${encodeURIComponent(editing.id)}` : '/api/memories', { method: editing ? 'PUT' : 'POST', body: JSON.stringify(payload) }); await loadProjectControlData(); closeModal(); toast('项目记忆已保存'); } catch (error: any) { $('#memoryErr', card).textContent = error.message; } };
    },
  });
}

function showProjectForm() {
  if (!state.selectedWorkspace) return toast('请先选择工作区', 'error');
  showModal({
    title: '新建项目',
    body: '<form id="projectForm"><div class="field"><label>名称</label><input name="name" required placeholder="例如：移动端重构" /></div><div class="field"><label>描述</label><input name="description" placeholder="项目目标或范围" /></div><div class="row"><button type="button" class="btn-ghost" id="projectCancel">取消</button><button class="btn-primary" type="submit">创建</button></div></form>',
    onMount: (card: HTMLElement) => {
      $('#projectCancel', card).onclick = closeModal;
      $('#projectForm', card).onsubmit = async (event: SubmitEvent) => { event.preventDefault(); const data: any = Object.fromEntries(new FormData(event.target as HTMLFormElement).entries()); data.workspaceId = state.selectedWorkspace.id; try { await api('/api/projects', { method: 'POST', body: JSON.stringify(data) }); await loadProjects(); closeModal(); toast('项目已创建'); } catch (error: any) { toast(error.message, 'error'); } };
    },
  });
}

function showAssetUrlModal() {
  if (!state.selectedProject) return toast('请先选择项目', 'error');
  showModal({
    title: '从 URL 添加文件',
    body: '<form id="assetUrlForm"><div class="field"><label>URL</label><input name="url" type="url" required placeholder="https://example.com/notes.md" /></div><div class="field"><label>显示名称（可选）</label><input name="name" placeholder="自动从 URL 推断" /></div><div id="assetUrlErr" class="auth-error"></div><div class="row"><button type="button" class="btn-ghost" id="assetUrlCancel">取消</button><button class="btn-primary" type="submit">添加</button></div></form>',
    onMount: (card: HTMLElement) => {
      $('#assetUrlCancel', card).onclick = closeModal;
      $('#assetUrlForm', card).onsubmit = async (event: SubmitEvent) => { event.preventDefault(); const data: any = Object.fromEntries(new FormData(event.target as HTMLFormElement).entries()); data.projectId = state.selectedProject.id; try { await api('/api/assets', { method: 'POST', body: JSON.stringify(data) }); await loadProjects(); closeModal(); toast('远程文件已加入项目'); } catch (error: any) { $('#assetUrlErr', card).textContent = error.message; } };
    },
  });
}

async function showRunDetail(id: string) {
  try {
    const run = await api(`/api/runs/${encodeURIComponent(id)}`);
    const steps = (run.turns || []).flatMap((turn: any) => turn.steps || []);
    const context = run.contextManifest || {};
    const usage = run.usage || {};
    const chip = (label: string, value: unknown) => `<span><small>${esc(label)}</small><strong>${esc(value)}</strong></span>`;
    const statusText = run.status === 'completed' ? '已完成' : run.status === 'error' ? '失败' : run.status === 'cancelled' ? '已取消' : '运行中';
    showModal({
      title: `运行详情 · ${run.agentName || run.agentId}`,
      body: `<div class="run-detail-summary">${chip('状态', statusText)}${chip('模型', run.model || '—')}${chip('Token', compactNumber(usage.totalTokens || 0))}${chip('步骤', String(steps.length))}${chip('策略', run.toolPolicy === 'safe' ? '安全' : '自动')}</div><div class="run-detail-grid"><section><h4>执行时间线</h4><div class="flight-timeline">${steps.map((step: any, index: number) => `<article class="flight-step ${esc(step.status)}"><i>${index + 1}</i><div><strong>${step.kind === 'tool_call' ? esc(step.tool || '工具调用') : `模型请求 · ${esc(step.model || '')}`}</strong><p>${step.kind === 'tool_call' ? `${esc((step.permissions || []).join(', ') || '无特殊权限')} · ${esc(step.risk || 'low')}` : `${step.messageCount || 0} 条上下文 · ${compactNumber(step.usage?.total || 0)} tokens`}</p>${step.error ? `<code>${esc(step.error)}</code>` : ''}</div><span>${step.durationMs != null ? `${(step.durationMs / 1000).toFixed(2)}s` : esc(step.status)}</span></article>`).join('') || '<div class="control-empty">没有步骤轨迹。</div>'}</div></section><section><h4>上下文透镜</h4><div class="context-lens"><div><span>消息</span><strong>${context.messages || 0}</strong></div><div><span>系统上下文</span><strong>${compactNumber(context.systemCharacters || 0)} 字</strong></div><div><span>项目文件</span><strong>${(context.assets || []).length}</strong></div><div><span>记忆</span><strong>${(context.memories || []).length}</strong></div></div><div class="context-source"><h5>注入来源</h5>${[['文件', context.assets], ['记忆', context.memories], ['Skills', context.skills], ['工具', context.tools], ['MCP', context.mcpServers]].map(([label, items]: any) => `<div><strong>${label}</strong><span>${(items || []).map((item: any) => esc(item.name || item.id)).join('、') || '无'}</span></div>`).join('')}</div><div class="context-source"><h5>Token 构成</h5><div><strong>输入</strong><span>${compactNumber(usage.inputTokens || 0)}</span></div><div><strong>输出</strong><span>${compactNumber(usage.outputTokens || 0)}</span></div><div><strong>缓存</strong><span>${compactNumber(usage.cachedTokens || 0)}</span></div><div><strong>估算</strong><span>${compactNumber(usage.estimatedTokens || 0)}</span></div></div></section></div><div class="row"><button class="btn-ghost" id="exportRun">导出运行快照</button><button class="btn-primary" id="closeRunDetail">关闭</button></div>`,
      onMount: (card: HTMLElement) => {
        card.classList.add('run-detail-modal');
        $('#closeRunDetail', card).onclick = closeModal;
        $('#exportRun', card).onclick = () => { const blob = new Blob([JSON.stringify(run, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${run.id}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); };
      },
    });
  } catch (error: any) { toast(error.message, 'error'); }
}

export { openSettings, closeSettings, switchSettingsTab, renderSettings, renderUsage, renderCapabilities, showRunDetail, showMemoryModal, showWorkspaceForm, showProjectForm, showAssetUrlModal, renderRuns };
