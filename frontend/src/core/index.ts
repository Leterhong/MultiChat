// 核心依赖统一出口：业务模块统一从这里 import，避免散落引用各子模块。
export { $, $$, esc } from './dom';
export { toast } from './toast';
export { api, getServerToken, serverAuthHeaders, serverTokenStorageKey, setServerToken } from './api';
export { applyTheme, getTheme, setTheme } from './theme';
export type { ThemePreference } from './theme';
export {
  state,
  loadParams,
  saveParams,
  loadSelectedAgent,
  saveSelectedAgent,
  DEFAULT_PARAMS,
  businessStore,
  notifyMessagesChanged,
} from './state';
export type { BusinessState } from './state';
export {
  WORK_MODE_LABELS,
  buildWorkflowInstruction,
  copyWorkflowSession,
  createWorkflowSession,
  loadWorkflowSession,
  saveWorkflowSession,
  workflowScope,
} from './workflow';
export type { WorkMode, WorkflowChecks, WorkflowSession, WorkflowStep } from './workflow';
