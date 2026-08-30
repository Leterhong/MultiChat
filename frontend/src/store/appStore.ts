import { create } from 'zustand';
import { useStore } from 'zustand';
import { businessStore, type BusinessState } from '../core/state';

export type RuntimeActions = {
  send: (text?: string) => Promise<void>;
  stop: () => void;
  openSettings: (tab?: string) => void;
  openModelPicker: () => void;
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
  ready: boolean;
  actions: Partial<RuntimeActions>;
  setReady: (ready: boolean) => void;
  installActions: (actions: Partial<RuntimeActions>) => void;
};

export const useAppStore = create<AppViewState>((set) => ({
  ready: false,
  actions: {},
  setReady: (ready) => set({ ready }),
  installActions: (actions) => set((current) => ({ actions: { ...current.actions, ...actions } })),
}));

export const useBusinessStore = <T,>(selector: (current: BusinessState) => T) => useStore(businessStore, selector);
export const installRuntimeActions = (actions: Partial<RuntimeActions>) => useAppStore.getState().installActions(actions);
export const markAppReady = () => useAppStore.getState().setReady(true);
