import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { $, $$, getTheme, setTheme, state } from '../core/index';
import { openWorkflowRail } from '../components/workflowRailDom';
import { CommandList, InspectorBody } from '../components/workbenchPanels';
import { setTaskMode } from '../store/appStore';

// 把 React 面板渲染进遗留容器（参照 pluginsUI.ts 的 mountExtensionSettings 写法）。
// WeakMap 以 DOM 节点为键，容器被替换时自然重建 root；渲染后的交互改由面板内的
// React onClick 处理，setupWorkbench 只保留挂在容器本身（不随重渲染消失）的监听。
const overlayRoots = new WeakMap<HTMLElement, Root>();
function mountOverlayPanel(containerId: string, element: ReactElement) {
  const container = document.getElementById(containerId);
  if (!container) return;
  let root = overlayRoots.get(container);
  if (!root) {
    root = createRoot(container);
    overlayRoots.set(container, root);
  }
  root.render(element);
}

type Command = {
  id: string;
  label: string;
  description: string;
  group: string;
  shortcut?: string;
  run: () => void;
};

let lastPaletteFocus: HTMLElement | null = null;

function providerReady() {
  const provider = state.selectedProvider;
  if (!provider || !state.selectedModel) return false;
  const localTypes = ['ollama', 'lmstudio', 'mock'];
  return (
    Boolean(provider.baseUrl) &&
    (localTypes.includes(String(provider.apiType || '').toLowerCase()) || provider.apiKeyMasked || provider.apiKey)
  );
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
  const projectOk = Boolean(
    state.selectedProject && state.selectedProject.id !== 'pr_inbox' && state.selectedProject.name !== '收件箱'
  );
  return [
    {
      label: '模型选择',
      ok: modelOk,
      detail: modelOk
        ? `${state.selectedProvider.name || state.selectedProvider.id} · ${state.selectedModel}`
        : '尚未选择模型',
      tab: 'providers',
    },
    {
      label: '连接配置',
      ok: connectionOk,
      detail: connectionOk ? '凭据与地址已配置' : '需要补充 API 地址或凭据',
      tab: 'providers',
    },
    {
      label: '项目上下文',
      ok: projectOk,
      detail: projectOk ? state.selectedProject.name : '尚未打开项目文件夹',
      tab: 'workspace',
    },
    { label: '运行配置', ok: true, detail: agent ? agent.name : '直接对话（无工具注入）', tab: 'agents' },
  ];
}

function statusText(status: string) {
  const map: Record<string, string> = {
    running: '运行中',
    completed: '已完成',
    error: '失败',
    cancelled: '已取消',
    rejected: '已拒绝',
  };
  return map[status] || status || '暂无记录';
}

function renderInspector() {
  const body = $('#inspectorBody');
  if (!body) return;
  const agent = state.selectedAgent;
  const latest = state.runs?.[0];
  const checks = readinessChecks();
  const ready = checks.every((item) => item.ok);
  const selectedFiles = state.selectedAssetIds?.size || 0;
  const selectedBytes = (state.assets || [])
    .filter((item: any) => state.selectedAssetIds?.has(item.id))
    .reduce((sum: number, item: any) => sum + Number(item.size || item.bytes || 0), 0);
  const estimatedContextTokens = Math.ceil(selectedBytes / 4);
  const enabledMemories = (state.memories || []).filter((item: any) => item.enabled !== false).length;
  const skills = capabilityCount(agent, 'skillRefs', 'skillIds');
  const tools = capabilityCount(agent, 'toolIds', 'toolIds');
  const mcp = capabilityCount(agent, 'mcpServerIds', 'mcpServerIds');
  const readiness = Math.round((checks.filter((item) => item.ok).length / checks.length) * 100);

  const view = {
    ready,
    readiness,
    selectedModel: state.selectedModel || '未选择',
    agentName: agent?.name || '直接对话',
    projectName: state.selectedProject?.id === 'pr_inbox' ? '临时对话' : state.selectedProject?.name || '未选择',
    selectedFiles,
    enabledMemories,
    skills,
    tools,
    mcp,
    estimatedLabel: estimatedContextTokens.toLocaleString('zh-CN'),
    budgetWidth: Math.min(100, estimatedContextTokens / 320),
    agentNote: agent
      ? `${skills} Skills · ${tools} 内置工具 · ${mcp} MCP 服务`
      : '直接对话不会注入工具或运行配置提示词。',
    checks: checks.map((item) => ({ label: item.label, ok: item.ok, detail: item.detail, tab: item.tab })),
    latest: latest
      ? {
          statusClass: latest.status,
          statusLabel: statusText(latest.status),
          name: latest.agentName || latest.agentId || '直接对话',
          steps: latest.steps || 0,
          toolCalls: latest.toolCalls || 0,
          tokens: runUsage(latest).toLocaleString('zh-CN'),
        }
      : null,
  };

  mountOverlayPanel('inspectorBody', createElement(InspectorBody, {
    view,
    onSettings: (tab: string) => {
      closeInspector();
      openSettings(tab);
    },
  }));
}

function openInspector() {
  openWorkflowRail('context');
}

function closeInspector() {
  const panel = $('#sessionInspector');
  const main = $('#mainWorkspace');
  const button = $('#inspectorBtn');
  if (!panel || !main) return;
  if (panel.contains(document.activeElement)) (button || document.body).focus();
  main.classList.remove('inspector-open');
  panel.setAttribute('aria-hidden', 'true');
  panel.inert = true;
  button?.setAttribute('aria-expanded', 'false');
}

function toggleInspector() {
  openWorkflowRail('activity');
}

function commands(): Command[] {
  const recentConversations = (state.conversations || []).slice(0, 8).map((conversation: any) => ({
    id: `conversation:${conversation.id}`,
    label: conversation.title || '未命名对话',
    description: '打开最近对话',
    group: '对话',
    run: () => openConversation(conversation.id),
  }));
  const availableModels = (state.providers || [])
    .flatMap((provider: any) =>
      (provider.models || []).slice(0, 5).map((model: string) => ({
        id: `model:${provider.id}:${model}`,
        label: model,
        description: `切换到 ${provider.name || provider.id}`,
        group: '模型',
        run: () => selectModel(provider.id, model),
      }))
    )
    .slice(0, 10);
  const agents = (state.agents || []).slice(0, 6).map((agent: any) => ({
    id: `agent:${agent.id}`,
    label: agent.name || agent.id,
    description: '在智能体页面查看和编辑运行配置',
    group: '智能体',
    run: () => openSettings('agents'),
  }));
  return [
    {
      id: 'new',
      label: '新任务',
      description: '使用当前模型开始一个任务',
      group: '任务',
      shortcut: 'Ctrl N',
      run: () => {
        setTaskMode('chat');
        void newConversation();
      },
    },
    {
      id: 'run-agent',
      label: '运行智能体',
      description: '选择智能体并开始一个可使用工具的任务',
      group: '任务',
      run: () => {
        setTaskMode('agent');
        void newConversation().then(() => $('#agentPicker')?.click());
      },
    },
    {
      id: 'inspect',
      label: '打开 AI 活动中心',
      description: '检查模型活动、上下文和真实运行指标',
      group: '对话',
      shortcut: 'Ctrl I',
      run: toggleInspector,
    },
    ...recentConversations,
    ...availableModels,
    ...agents,
    {
      id: 'compare',
      label: '模型对比',
      description: '使用相同任务和上下文并行比较 2–4 个模型',
      group: '任务',
      shortcut: 'Ctrl M',
      run: () => {
        setTaskMode('compare');
        openSettings('experiment');
      },
    },
    {
      id: 'switch-project',
      label: '切换项目',
      description: '选择项目或打开本地项目文件夹',
      group: '工作区',
      run: () => $('#workspacePicker')?.click(),
    },
    {
      id: 'settings',
      label: '打开设置',
      description: '配置外观、模型、能力与运行记录',
      group: '工作区',
      run: () => openSettings('general'),
    },
    {
      id: 'providers',
      label: '模型连接',
      description: '添加模型提供方、地址和凭据',
      group: '设置',
      run: () => openSettings('providers'),
    },
    {
      id: 'agents',
      label: '运行配置',
      description: '组合提示词、Skills、工具与 MCP',
      group: '设置',
      run: () => openSettings('agents'),
    },
    {
      id: 'workspace',
      label: '项目与文件',
      description: '管理代码文件、记忆、快照和项目默认值',
      group: '设置',
      run: () => openSettings('workspace'),
    },
    {
      id: 'skills',
      label: 'Skills',
      description: '浏览、导入和管理工作流能力',
      group: '能力',
      run: () => openSettings('skills'),
    },
    {
      id: 'mcp',
      label: 'MCP 服务',
      description: '管理外部工具连接与信任状态',
      group: '能力',
      run: () => openSettings('mcp'),
    },
    {
      id: 'plugins',
      label: '插件',
      description: '导入、审查和启用扩展包',
      group: '能力',
      run: () => openSettings('plugins'),
    },
    {
      id: 'runs',
      label: '运行日志',
      description: '查看 Turn、Step、工具调用和审批记录',
      group: '观察',
      run: () => openSettings('runs'),
    },
    {
      id: 'usage',
      label: 'Token 用量',
      description: '查看每日消耗、模型分布和缓存命中',
      group: '观察',
      run: () => openSettings('usage'),
    },
    {
      id: 'theme',
      label: getTheme() === 'dark' ? '切换为浅色界面' : '切换为深色界面',
      description: '更改当前设备上的显示主题',
      group: '界面',
      run: () => setTheme(getTheme() === 'dark' ? 'light' : 'dark'),
    },
  ];
}

function renderCommands(query = '') {
  const list = $('#commandList');
  if (!list) return;
  const needle = query.trim().toLowerCase();
  const filtered = commands().filter((item) =>
    `${item.label} ${item.description} ${item.group}`.toLowerCase().includes(needle)
  );
  const items = filtered.map((item) => ({
    id: item.id,
    label: item.label,
    description: item.description,
    group: item.group,
    shortcut: item.shortcut,
  }));
  mountOverlayPanel('commandList', createElement(CommandList, {
    items,
    onRun: (id: string) => {
      const command = commands().find((item) => item.id === id);
      closeCommandPalette(false);
      command?.run();
    },
  }));
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
    general: '通用与外观',
    workspace: '项目、文件与记忆',
    providers: '模型',
    experiment: '模型对比',
    agents: '智能体',
    capabilities: '能力审计',
    usage: 'Token 用量',
    runs: '运行记录',
  };
  $$('.settings-tab[data-tab]').forEach((button: HTMLButtonElement) => {
    const label = button.querySelector('span:last-child');
    if (label && labels[button.dataset.tab || '']) label.textContent = labels[button.dataset.tab || ''];
  });

  $('#commandBtn').onclick = openCommandPalette;
  const search = $('#commandSearch') as HTMLInputElement;
  search.oninput = () => renderCommands(search.value);
  search.onkeydown = (event: KeyboardEvent) => {
    const items = Array.from($$('.command-item')) as HTMLButtonElement[];
    if (event.key === 'ArrowDown' && items.length) {
      event.preventDefault();
      items[0].focus();
    }
    if (event.key === 'Enter' && items.length) {
      event.preventDefault();
      items[0].click();
    }
  };
  $('#commandList').addEventListener('keydown', (event: KeyboardEvent) => {
    const items = Array.from($$('.command-item')) as HTMLButtonElement[];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown' && index >= 0) {
      event.preventDefault();
      items[(index + 1) % items.length]?.focus();
    }
    if (event.key === 'ArrowUp' && index >= 0) {
      event.preventDefault();
      (index === 0 ? search : items[index - 1])?.focus();
    }
  });
  $$('[data-open-settings]').forEach((button: HTMLButtonElement) => {
    button.onclick = () => openSettings(button.dataset.openSettings || 'general');
  });
  $('#commandPalette').addEventListener('mousedown', (event: MouseEvent) => {
    if (event.target === $('#commandPalette')) closeCommandPalette();
  });

  document.addEventListener('keydown', (event: KeyboardEvent) => {
    const dialogOpen = $('#settings')?.classList.contains('open') || $('#modal')?.classList.contains('open');
    if (dialogOpen && (event.ctrlKey || event.metaKey) && ['k', 'i', 'm', 'n'].includes(event.key.toLowerCase()))
      return;
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

export {
  closeCommandPalette,
  closeInspector,
  openCommandPalette,
  openInspector,
  renderCommands,
  renderInspector,
  setupWorkbench,
  toggleInspector,
};
