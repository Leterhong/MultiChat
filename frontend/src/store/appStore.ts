import { create } from 'zustand';
import { useStore } from 'zustand';
import { businessStore, type BusinessState } from '../core/state';

export type RuntimeActions = {
  send: (text?: string) => Promise<void>;
  stop: () => void;
  newConversation: () => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string) => Promise<void>;
  openSettings: (tab?: string) => void;
  openModelPicker: () => void;
  selectModel: (providerId: string, model: string) => void;
  openCompare: () => void;
  openConversation: (id: string) => Promise<void>;
  openInspector: () => void;
  importProjectFolder: () => Promise<void>;
  copyMessage: (index: number) => Promise<void>;
  editMessage: (index: number) => void;
  regenerateMessage: (index: number) => Promise<void>;
  resumeMessage: (index: number) => Promise<void>;
  resolveApproval: (approvalId: string, action: 'approve' | 'reject') => Promise<void>;
  refreshFileContext: () => void;
};

export type WorkspaceView = 'home' | 'chat';
export type TaskMode = 'chat' | 'agent' | 'compare';

type AppViewState = {
  ready: boolean;
  workspaceView: WorkspaceView;
  taskMode: TaskMode;
  actions: Partial<RuntimeActions>;
  setReady: (ready: boolean) => void;
  setWorkspaceView: (view: WorkspaceView) => void;
  setTaskMode: (mode: TaskMode) => void;
  installActions: (actions: Partial<RuntimeActions>) => void;
};

export const useAppStore = create<AppViewState>((set) => ({
  ready: false,
  workspaceView: 'home',
  taskMode: 'chat',
  actions: {},
  setReady: (ready) => set({ ready }),
  setWorkspaceView: (workspaceView) => set({ workspaceView }),
  setTaskMode: (taskMode) => set({ taskMode }),
  installActions: (actions) => set((current) => ({ actions: { ...current.actions, ...actions } })),
}));

export const useBusinessStore = <T>(selector: (current: BusinessState) => T) => useStore(businessStore, selector);
export const installRuntimeActions = (actions: Partial<RuntimeActions>) =>
  useAppStore.getState().installActions(actions);
export const markAppReady = () => useAppStore.getState().setReady(true);
export const setWorkspaceView = (view: WorkspaceView) => useAppStore.getState().setWorkspaceView(view);
export const setTaskMode = (mode: TaskMode) => useAppStore.getState().setTaskMode(mode);
