import { createStore } from 'zustand/vanilla';
import { loadWorkflowSession } from './workflow';

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
  workflowScope: 'draft',
  workflow: loadWorkflowSession('draft'),
};

export type BusinessState = typeof initialBusinessState;
export const businessStore = createStore<BusinessState>(() => initialBusinessState);

// 数组的原地变更（push/splice/索引赋值等）不会更换引用，React 订阅者感知不到。
// 对 Proxy 返回的数组统一包一层：变更方法执行后立刻用新引用写回 store。
const MUTATING_ARRAY_METHODS = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin']);
const arrayWrapperCache = new WeakMap<object, unknown>();

function notifyingArray(property: string, value: readonly unknown[]): unknown[] {
  const cached = arrayWrapperCache.get(value);
  if (cached) return cached as unknown[];
  const wrapper = new Proxy(value as unknown[], {
    get(target, prop) {
      if (typeof prop === 'string' && MUTATING_ARRAY_METHODS.has(prop)) {
        const original = (target as unknown as Record<string, (...args: unknown[]) => unknown>)[prop];
        return (...args: unknown[]) => {
          const result = original.apply(target, args);
          businessStore.setState({ [property]: [...target] } as Partial<BusinessState>);
          return result;
        };
      }
      return (target as unknown as Record<string | symbol, unknown>)[prop];
    },
    set(target, prop, newValue) {
      (target as unknown as Record<string | symbol, unknown>)[prop] = newValue;
      businessStore.setState({ [property]: [...target] } as Partial<BusinessState>);
      return true;
    },
  });
  arrayWrapperCache.set(value, wrapper);
  return wrapper;
}

export const state = new Proxy(initialBusinessState, {
  get(_target, property) {
    const value = businessStore.getState()[property as keyof BusinessState];
    if (Array.isArray(value)) return notifyingArray(property as string, value);
    return value;
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

/**
 * 流式输出期间对单条消息对象的逐 token 原地编辑（`last.content += chunk`）
 * 仍需手动调用本函数刷新 React；这是有意的渲染批处理点。
 * 数组整体层面的 push/splice/索引赋值已由 Proxy 自动通知，无需再手动调用。
 */
export function notifyMessagesChanged() {
  businessStore.setState((current) => ({ ...current, messages: [...current.messages] }));
}

// Optional cross-origin override (?api=…)
try {
  const _q = new URLSearchParams(location.search).get('api');
  if (_q) state.apiBase = _q.replace(/\/+$/, '');
} catch {}

export { DEFAULT_PARAMS };
