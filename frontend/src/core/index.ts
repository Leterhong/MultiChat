// 核心依赖统一出口：业务模块统一从这里 import，避免散落引用各子模块。
export { $, $$, esc } from './dom';
export { toast } from './toast';
export { api } from './api';
export { applyTheme, getTheme, setTheme } from './theme';
export type { ThemePreference } from './theme';
export {
  state,
  loadParams,
  saveParams,
  loadSelectedAgent,
  saveSelectedAgent,
  DEFAULT_PARAMS,
} from './state';
