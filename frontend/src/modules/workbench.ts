import { $, $$, esc, getTheme, setTheme, state } from '../core/index';

type Command = {
  id: string;
  label: string;
  description: string;
  group: string;
  shortcut?: string;
  run: () => void;
};

let lastPaletteFocus: HTMLElement | null = null;
let lastInspectorFocus: HTMLElement | null = null;

function providerReady() {
  const provider = state.selectedProvider;
  if (!provider || !state.selectedModel) return false;
  const localTypes = ['ollama', 'lmstudio', 'mock'];
  return Boolean(provider.baseUrl) && (localTypes.includes(String(provider.apiType || '').toLowerCase()) || provider.apiKeyMasked || provider.apiKey);
}

function runUsage(run: any) {
  const usage = run?.usage || {};
  return usage.totalTokens ?? usage.total_tokens ?? usage.total ?? 0;
}

function capabilityCount(agent: any, key: string, fallback: string) {
  const value = agent?.[key] || agent?.[fallback] || [];
  return Array.isArray(value) ? value.length : 0;
}

function readinessChecks() {
  const agent = state.selectedAgent;
  const modelOk = Boolean(state.selectedProvider && state.selectedModel);
  const connectionOk = providerReady();
  const projectOk = Boolean(state.selectedProject && state.selectedProject.id !== 'pr_inbox' && state.selectedProject.name !== '收件箱');
  return [
    { label: '模型选择', ok: modelOk, detail: modelOk ? `${state.selectedProvider.name || state.selectedProvider.id} · ${state.selectedModel}` : '尚未选择模型', tab: 'providers' },
    { label: '连接配置', ok: connectionOk, detail: connectionOk ? '凭据与地址已配置' : '需要补充 API 地址或凭据', tab: 'providers' },
    { label: '项目上下文', ok: projectOk, detail: projectOk ? state.selectedProject.name : '尚未打开项目文件夹', tab: 'workspace' },
    { label: '运行配置', ok: true, detail: agent ? agent.name : '直接对话（无工具注入）', tab: 'agents' },
  ];
}

function statusText(status: string) {
  const map: Record<string, string> = { running: '运行中', completed: '已完成', error: '失败', cancelled: '已取消', rejected: '已拒绝' };
  return map[status] || status || '暂无记录';
}

function renderInspector() {
  const body = $('#inspectorBody');
  if (!body) return;
  const agent = state.selectedAgent;
  const latest = state.runs?.[0];
  const checks = readinessChecks();
  const ready = checks.every(item => item.ok);
  const selectedFiles = state.selectedAssetIds?.size || 0;
  const selectedBytes = (state.assets || [])
    .filter((item: any) => state.selectedAssetIds?.has(item.id))
    .reduce((sum: number, item: any) => sum + Number(item.size || item.bytes || 0), 0);
  const estimatedContextTokens = Math.ceil(selectedBytes / 4);
  const enabledMemories = (state.memories || []).filter((item: any) => item.enabled !== false).length;
  const skills = capabilityCount(agent, 'skillRefs', 'skillIds');
  const tools = capabilityCount(agent, 'toolIds', 'toolIds');
  const mcp = capabilityCount(agent, 'mcpServerIds', 'mcpServerIds');
  const readiness = Math.round((checks.filter(item => item.ok).length / checks.length) * 100);

  body.innerHTML = `
    <section class="inspector-status ${ready ? 'ready' : 'needs-attention'}">
      <div class="inspector-score"><strong>${readiness}</strong><span>%</span></div>
      <div><strong>${ready ? '可以开始运行' : '需要完成配置'}</strong><span>${ready ? '必要条件已经就绪' : '补齐下面的配置项后再运行'}</span></div>
    </section>
    <section class="inspector-section">
      <div class="inspector-section-head"><strong>会话配置</strong><button type="button" data-inspector-settings="agents">编辑</button></div>
      <dl class="inspector-facts">
        <div><dt>模型</dt><dd>${esc(state.selectedModel || '未选择')}</dd></div>
        <div><dt>运行配置</dt><dd>${esc(agent?.name || '直接对话')}</dd></div>
        <div><dt>项目</dt><dd>${esc(state.selectedProject?.id === 'pr_inbox' ? '临时对话' : state.selectedProject?.name || '未选择')}</dd></div>
      </dl>
    </section>
    <section class="inspector-section">
      <div class="inspector-section-head"><strong>上下文装配</strong><button type="button" data-inspector-settings="workspace">管理</button></div>
      <div class="inspector-metrics">
        <div><strong>${selectedFiles}</strong><span>文件</span></div>
        <div><strong>${enabledMemories}</strong><span>记忆</span></div>
        <div><strong>${skills}</strong><span>Skills</span></div>
        <div><strong>${tools + mcp}</strong><span>工具</span></div>
      </div>
      <div class="context-budget"><div><span>文件上下文估算</span><strong>${estimatedContextTokens.toLocaleString('zh-CN')} Token</strong></div><div class="context-budget-track"><span style="width:${Math.min(100, estimatedContextTokens / 320)}%"></span></div><small>仅估算已选文件；模型系统提示和对话历史未计入。</small></div>
      ${agent ? `<p class="inspector-note">${skills} Skills · ${tools} 内置工具 · ${mcp} MCP 服务</p>` : '<p class="inspector-note">直接对话不会注入工具或运行配置提示词。</p>'}
    </section>
    <section class="inspector-section">
      <div class="inspector-section-head"><strong>运行前检查</strong><button type="button" data-inspector-settings="capabilities">能力清单</button></div>
      <div class="inspector-checks">
        ${checks.map(item => `<button type="button" data-inspector-settings="${item.tab}" class="inspector-check ${item.ok ? 'ok' : 'warn'}"><span aria-hidden="true">${item.ok ? '✓' : '!'}</span><div><strong>${esc(item.label)}</strong><small>${esc(item.detail)}</small></div></button>`).join('')}
      </div>
    </section>
    <section class="inspector-section">
      <div class="inspector-section-head"><strong>最近运行</strong><button type="button" data-inspector-settings="runs">查看日志</button></div>
      ${latest ? `<div class="inspector-run"><div><span class="run-state ${esc(latest.status)}">${esc(statusText(latest.status))}</span><strong>${esc(latest.agentName || latest.agentId || '直接对话')}</strong></div><dl><div><dt>步骤</dt><dd>${esc(latest.steps || 0)}</dd></div><div><dt>工具调用</dt><dd>${esc(latest.toolCalls || 0)}</dd></div><div><dt>Token</dt><dd>${esc(runUsage(latest).toLocaleString('zh-CN'))}</dd></div></dl></div>` : '<div class="inspector-empty">完成一次运行后，这里会显示步骤、工具调用和 Token。</div>'}
    </section>
  `;

  $$('[data-inspector-settings]', body).forEach((button: HTMLButtonElement) => {
    button.onclick = () => {
      closeInspector(false);
      openSettings(button.dataset.inspectorSettings || 'general');
    };
  });
}

function openInspector() {
  const panel = $('#sessionInspector');
  const main = $('#mainWorkspace');
  const button = $('#inspectorBtn');
  if (!panel || !main) return;
  lastInspectorFocus = document.activeElement as HTMLElement;
  renderInspector();
  panel.inert = false;
  panel.setAttribute('aria-hidden', 'false');
  main.classList.add('inspector-open');
  button?.setAttribute('aria-expanded', 'true');
  window.setTimeout(() => $('#inspectorClose')?.focus(), 0);
}

function closeInspector(restoreFocus = true) {
  const panel = $('#sessionInspector');
  const main = $('#mainWorkspace');
  const button = $('#inspectorBtn');
  if (!panel || !main) return;
  if (panel.contains(document.activeElement)) (button || document.body).focus();
  main.classList.remove('inspector-open');
  panel.setAttribute('aria-hidden', 'true');
  panel.inert = true;
  button?.setAttribute('aria-expanded', 'false');
  if (restoreFocus && lastInspectorFocus && document.contains(lastInspectorFocus)) lastInspectorFocus.focus();
}

function toggleInspector() {
  const open = $('#mainWorkspace')?.classList.contains('inspector-open');
  if (open) closeInspector(); else openInspector();
}

function commands(): Command[] {
  return [
    { id: 'new', label: '新建对话', description: '清空当前视图并开始一段新对话', group: '对话', shortcut: 'Ctrl N', run: () => newConversation() },
    { id: 'inspect', label: '打开会话检查器', description: '检查模型、上下文、能力和最近运行', group: '对话', shortcut: 'Ctrl I', run: toggleInspector },
    { id: 'compare', label: '模型实验', description: '在设置中使用相同上下文并行比较 2–4 个模型', group: '设置', shortcut: 'Ctrl M', run: () => openSettings('experiment') },
    { id: 'providers', label: '模型连接', description: '添加模型提供方、地址和凭据', group: '设置', run: () => openSettings('providers') },
    { id: 'agents', label: '运行配置', description: '组合提示词、Skills、工具与 MCP', group: '设置', run: () => openSettings('agents') },
    { id: 'workspace', label: '项目与文件', description: '管理代码文件、记忆、快照和项目默认值', group: '设置', run: () => openSettings('workspace') },
    { id: 'skills', label: 'Skills', description: '浏览、导入和管理工作流能力', group: '能力', run: () => openSettings('skills') },
    { id: 'mcp', label: 'MCP 服务', description: '管理外部工具连接与信任状态', group: '能力', run: () => openSettings('mcp') },
    { id: 'plugins', label: '插件', description: '导入、审查和启用扩展包', group: '能力', run: () => openSettings('plugins') },
    { id: 'runs', label: '运行日志', description: '查看 Turn、Step、工具调用和审批记录', group: '观察', run: () => openSettings('runs') },
    { id: 'usage', label: 'Token 用量', description: '查看每日消耗、模型分布和缓存命中', group: '观察', run: () => openSettings('usage') },
    { id: 'theme', label: getTheme() === 'dark' ? '切换为浅色界面' : '切换为深色界面', description: '更改当前设备上的显示主题', group: '界面', run: () => setTheme(getTheme() === 'dark' ? 'light' : 'dark') },
  ];
}

function renderCommands(query = '') {
  const list = $('#commandList');
  if (!list) return;
  const needle = query.trim().toLowerCase();
  const filtered = commands().filter(item => `${item.label} ${item.description} ${item.group}`.toLowerCase().includes(needle));
  list.innerHTML = filtered.length ? filtered.map(item => `
    <button class="command-item" type="button" data-command="${item.id}">
      <span class="command-item-group">${esc(item.group)}</span>
      <span class="command-item-copy"><strong>${esc(item.label)}</strong><small>${esc(item.description)}</small></span>
      ${item.shortcut ? `<kbd>${esc(item.shortcut)}</kbd>` : '<span class="command-arrow" aria-hidden="true">›</span>'}
    </button>`).join('') : '<div class="command-empty">没有匹配的操作</div>';
  $$('[data-command]', list).forEach((button: HTMLButtonElement) => {
    button.onclick = () => {
      const command = commands().find(item => item.id === button.dataset.command);
      closeCommandPalette(false);
      command?.run();
    };
  });
}

function openCommandPalette() {
  const palette = $('#commandPalette');
  const search = $('#commandSearch') as HTMLInputElement;
  if (!palette || !search) return;
  lastPaletteFocus = document.activeElement as HTMLElement;
  search.value = '';
  renderCommands();
  palette.inert = false;
  palette.setAttribute('aria-hidden', 'false');
  palette.classList.add('open');
  $('#app').inert = true;
  window.setTimeout(() => search.focus(), 0);
}

function closeCommandPalette(restoreFocus = true) {
  const palette = $('#commandPalette');
  if (!palette) return;
  $('#app').inert = false;
  if (palette.contains(document.activeElement)) (lastPaletteFocus || $('#commandBtn') || document.body).focus();
  palette.classList.remove('open');
  palette.setAttribute('aria-hidden', 'true');
  palette.inert = true;
  if (restoreFocus && lastPaletteFocus && document.contains(lastPaletteFocus)) lastPaletteFocus.focus();
}

function setupWorkbench() {
  const labels: Record<string, string> = {
    general: '偏好设置', providers: '模型连接', experiment: '模型实验', agents: '运行配置',
    capabilities: '能力清单', usage: '用量', runs: '运行日志',
  };
  $$('.settings-tab[data-tab]').forEach((button: HTMLButtonElement) => {
    const label = button.querySelector('span:last-child');
    if (label && labels[button.dataset.tab || '']) label.textContent = labels[button.dataset.tab || ''];
  });

  $('#commandBtn').onclick = openCommandPalette;
  $('#inspectorBtn').onclick = toggleInspector;
  $('#inspectorClose').onclick = () => closeInspector();
  const search = $('#commandSearch') as HTMLInputElement;
  search.oninput = () => renderCommands(search.value);
  search.onkeydown = (event: KeyboardEvent) => {
    const items = Array.from($$('.command-item')) as HTMLButtonElement[];
    if (event.key === 'ArrowDown' && items.length) { event.preventDefault(); items[0].focus(); }
    if (event.key === 'Enter' && items.length) { event.preventDefault(); items[0].click(); }
  };
  $('#commandList').addEventListener('keydown', (event: KeyboardEvent) => {
    const items = Array.from($$('.command-item')) as HTMLButtonElement[];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown' && index >= 0) { event.preventDefault(); items[(index + 1) % items.length]?.focus(); }
    if (event.key === 'ArrowUp' && index >= 0) { event.preventDefault(); (index === 0 ? search : items[index - 1])?.focus(); }
  });
  $$('[data-open-settings]').forEach((button: HTMLButtonElement) => {
    button.onclick = () => openSettings(button.dataset.openSettings || 'general');
  });
  $('#commandPalette').addEventListener('mousedown', (event: MouseEvent) => {
    if (event.target === $('#commandPalette')) closeCommandPalette();
  });

  document.addEventListener('keydown', (event: KeyboardEvent) => {
    const dialogOpen = $('#settings')?.classList.contains('open') || $('#modal')?.classList.contains('open');
    if (dialogOpen && (event.ctrlKey || event.metaKey) && ['k', 'i', 'm', 'n'].includes(event.key.toLowerCase())) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if ($('#commandPalette')?.classList.contains('open')) closeCommandPalette();
      else openCommandPalette();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'i') {
      event.preventDefault();
      if ($('#commandPalette')?.classList.contains('open')) closeCommandPalette(false);
      toggleInspector();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'm') {
      event.preventDefault();
      if ($('#commandPalette')?.classList.contains('open')) closeCommandPalette(false);
      openSettings('experiment');
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') {
      event.preventDefault();
      if ($('#commandPalette')?.classList.contains('open')) closeCommandPalette(false);
      newConversation();
      return;
    }
    if (event.key === 'Escape') {
      if ($('#commandPalette')?.classList.contains('open')) closeCommandPalette();
      else if ($('#mainWorkspace')?.classList.contains('inspector-open')) closeInspector();
    }
  });
  renderInspector();
}

export { closeCommandPalette, closeInspector, openCommandPalette, openInspector, renderInspector, setupWorkbench, toggleInspector };
