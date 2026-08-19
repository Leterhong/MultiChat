// 全局应用状态单例 + 本地持久化（params / 上次选择 agent）。
// 这是整个前端的共享中枢：业务模块通过 `import { state }` 读写同一实例。
// 注意：state 是 const 绑定，业务代码只能修改其属性，不能整体重新赋值。

const DEFAULT_PARAMS = { temperature: 0.7, max_tokens: 2000, top_p: 1 };

export function loadParams() {
  try {
    return Object.assign({}, DEFAULT_PARAMS, JSON.parse(localStorage.getItem('multichat_params') || '{}'));
  } catch {
    return { ...DEFAULT_PARAMS };
  }
}
export function saveParams() {
  localStorage.setItem('multichat_params', JSON.stringify(state.params));
}

export function loadSelectedAgent() {
  try {
    const id = localStorage.getItem('multichat_lastAgent');
    if (!id) return;
    const a = state.agents.find((x) => x.id === id);
    if (a) state.selectedAgent = a;
  } catch {}
}
export function saveSelectedAgent() {
  if (state.selectedAgent) localStorage.setItem('multichat_lastAgent', state.selectedAgent.id);
  else localStorage.removeItem('multichat_lastAgent');
}

export const state = {
  providers: [],
  selectedProvider: null,
  selectedModel: null,
  conversations: [],
  currentConvId: null,
  messages: [],
  streaming: false,
  abortCtrl: null,
  apiBase: '',
  params: loadParams(),
  runtime: null,
  runs: [],
  workspaces: [],
  projects: [],
  assets: [],
  selectedAssetIds: new Set(), // D1：当前项目中被勾选作为上下文注入的文件
  convSearch: '', // D1：侧边栏会话搜索关键字
  selectedWorkspace: null,
  selectedProject: null,
  skills: [],
  agents: [],
  plugins: [],
  selectedAgent: null, // null = 直接对话；否则为 agent 对象
  currentTab: 'providers', // 设置面板当前激活 tab
  currentRunId: null, // 当前进行中的 run id（用于停止/继续流式）
};

// Optional cross-origin override (?api=…)
try {
  const _q = new URLSearchParams(location.search).get('api');
  if (_q) state.apiBase = _q.replace(/\/+$/, '');
} catch {}

export { DEFAULT_PARAMS };
