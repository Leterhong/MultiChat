import { create } from 'zustand';

// 弹窗规格。`component` 是 OVERLAY_PANELS 注册表里的字符串 key；
// `body` 是遗留 HTML 字符串（调用点已用 esc() 转义），经 OverlayLayer 的
// dangerouslySetInnerHTML 兼容渲染。二者互斥：有 component 时使用 React 面板。
export type OverlaySpec = {
  title?: string;
  body?: string;
  component?: string;
  props?: Record<string, unknown>;
  onMount?: (card: HTMLElement) => void;
  onClose?: () => void;
};

type OverlayState = OverlaySpec & {
  open: boolean;
  // 每次 openOverlay 自增：即使连续打开（open 保持 true）也能让 React effect 重跑。
  revision: number;
};

// 包含全部可选字段（显式 undefined）：zustand 的 setState 是浅合并，
// 缺少的键会保留上一次的值，必须在每次打开时全量复位，避免遗留 body/onClose 串场。
const INITIAL: OverlayState = {
  open: false,
  revision: 0,
  title: '',
  body: undefined,
  component: undefined,
  props: undefined,
  onMount: undefined,
  onClose: undefined,
};

export const useOverlayStore = create<OverlayState>(() => ({ ...INITIAL }));

export function openOverlay(spec: OverlaySpec): void {
  useOverlayStore.setState((current) => ({
    ...INITIAL,
    open: true,
    revision: current.revision + 1,
    ...spec,
  }));
}

export function closeOverlay(): void {
  const state = useOverlayStore.getState();
  if (!state.open) return;
  const onClose = state.onClose;
  useOverlayStore.setState({ open: false });
  // onClose 兜底：Esc / 背景点击 / 取消时保证 Promise 永挂起能被 resolve。
  onClose?.();
}
