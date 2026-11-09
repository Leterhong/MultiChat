import { openOverlay, closeOverlay } from '../core/overlay';

/* --------------------------- Modal --------------------------- */
// React 渲染层收敛：弹窗内容由 OverlayLayer（createPortal）+ OVERLAY_PANELS 负责渲染，
// Esc / Tab trap / 背景点击 / 焦点 / inert 也全部迁到 OverlayLayer 的 effect。
// 本模块只保留四个同名 API，作为旧模块全局裸名调用（main.tsx 的 Object.assign）
// 的薄适配层，彻底删除 innerHTML 写入与模块级事件监听。

function showModal(spec) {
  openOverlay(spec);
}

// 全局裸名 closeModal 仍可用，且经 closeOverlay 触发 onClose 回调。
function closeModal() {
  closeOverlay();
}

type ConfirmOptions = { title?: string; message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean };
type PromptOptions = { title: string; message?: string; label?: string; value?: string; placeholder?: string; required?: boolean; maxLength?: number; multiline?: boolean; rows?: number; confirmLabel?: string };

/* Promise 化的确认/输入对话框，替代原生 confirm() 与 prompt()。
   面板改用 React 实现（component: 'confirm' | 'prompt'），不再拼 HTML 字符串。
   Esc、背景点击或取消都 resolve(false/null)；onClose 兜底保证 Promise 永不悬挂。 */
function showConfirm({ title = '请确认', message, confirmLabel = '确认', cancelLabel = '取消', danger = false }: ConfirmOptions): Promise<boolean> {
  let settled = false;
  return new Promise((resolve) => {
    const finish = (value: boolean) => { if (!settled) { settled = true; resolve(value); } };
    openOverlay({
      title,
      component: 'confirm',
      props: {
        message,
        confirmLabel,
        cancelLabel,
        danger,
        onResult: (value: boolean) => { finish(value); closeModal(); },
      },
      onClose: () => finish(false),
    });
  });
}

function showPrompt({ title, message = '', label = '名称', value = '', placeholder = '', required = true, maxLength, multiline = false, rows = 5, confirmLabel = '确定' }: PromptOptions): Promise<string | null> {
  let settled = false;
  return new Promise((resolve) => {
    const finish = (result: string | null) => { if (!settled) { settled = true; resolve(result); } };
    openOverlay({
      title,
      component: 'prompt',
      props: {
        title,
        message,
        label,
        value,
        placeholder,
        required,
        maxLength,
        multiline,
        rows,
        confirmLabel,
        onResult: (result: string | null) => { finish(result); closeModal(); },
      },
      onClose: () => finish(null),
    });
  });
}

export { showModal, closeModal, showConfirm, showPrompt };
