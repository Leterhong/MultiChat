import { create } from 'zustand';

export type RuntimeActions = {
  send: (text?: string) => Promise<void>;
  stop: () => void;
  openSettings: (tab?: string) => void;
  openCompare: () => void;
  openConversation: (id: string) => Promise<void>;
  openInspector: () => void;
  copyMessage: (index: number) => Promise<void>;
  editMessage: (index: number) => void;
  regenerateMessage: (index: number) => Promise<void>;
  resumeMessage: (index: number) => Promise<void>;
  resolveApproval: (approvalId: string, action: 'approve' | 'reject') => Promise<void>;
  refreshFileContext: () => void;
};

type AppViewState = {
  revision: number;
  ready: boolean;
  actions: Partial<RuntimeActions>;
  refresh: () => void;
  setReady: (ready: boolean) => void;
  installActions: (actions: Partial<RuntimeActions>) => void;
};

export const useAppStore = create<AppViewState>((set) => ({
  revision: 0,
  ready: false,
  actions: {},
  refresh: () => set((current) => ({ revision: current.revision + 1 })),
  setReady: (ready) => set({ ready }),
  installActions: (actions) => set((current) => ({ actions: { ...current.actions, ...actions } })),
}));

export const refreshAppView = () => useAppStore.getState().refresh();
export const installRuntimeActions = (actions: Partial<RuntimeActions>) => useAppStore.getState().installActions(actions);
export const markAppReady = () => useAppStore.getState().setReady(true);
