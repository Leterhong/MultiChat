import { createStore } from 'zustand/vanilla';

// Zustand 是业务状态的唯一数据源。`state` Proxy 只作为旧模块迁移期间的
// 兼容门面：任何顶层赋值都会进入 store 并触发精确订阅，不再维护第二份数据。

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

const initialBusinessState = {
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
  usage: null,
  usageRange: '30',
  usageLoading: false,
  capabilities: null,
  memories: [],
  snapshots: [],
  workspaces: [],
  projects: [],
  assets: [],
  selectedAssetIds: new Set(), // D1：当前项目中被勾选作为上下文注入的文件
  convSearch: '', // D1：侧边栏会话搜索关键字
  selectedWorkspace: null,
  selectedProject: null,
  skills: [],
  tools: [],
  mcpServers: [],
  agents: [],
  plugins: [],
  selectedAgent: null, // null = 直接对话；否则为 agent 对象
  currentTab: 'providers', // 设置面板当前激活 tab
  currentRunId: null, // 当前进行中的 run id（用于停止/继续流式）
};

export type BusinessState = typeof initialBusinessState;
export const businessStore = createStore<BusinessState>(() => initialBusinessState);

export const state = new Proxy(initialBusinessState, {
  get(_target, property) {
    return businessStore.getState()[property as keyof BusinessState];
  },
  set(_target, property, value) {
    businessStore.setState({ [property]: value } as Partial<BusinessState>);
    return true;
  },
  ownKeys() {
    return Reflect.ownKeys(businessStore.getState());
  },
  getOwnPropertyDescriptor(_target, property) {
    if (!(property in businessStore.getState())) return undefined;
    return { configurable: true, enumerable: true, writable: true, value: businessStore.getState()[property as keyof BusinessState] };
  },
});

/** Notify React after a legacy module mutates an item inside messages in place. */
export function notifyMessagesChanged() {
  businessStore.setState((current) => ({ ...current, messages: [...current.messages] }));
}

// Optional cross-origin override (?api=…)
try {
  const _q = new URLSearchParams(location.search).get('api');
  if (_q) state.apiBase = _q.replace(/\/+$/, '');
} catch {}

export { DEFAULT_PARAMS };
