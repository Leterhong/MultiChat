import { type ComponentType, type FormEvent } from 'react';

// 这些面板完全用 React 表单实现，替换了 modal.ts 里 showConfirm/showPrompt
// 拼装的 HTML 字符串。刻意保留全部原有 DOM id / class，使旧 CSS 与 onMount
// 时代的选择器仍然生效。

export type ConfirmPanelProps = {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onResult: (value: boolean) => void;
};

export function ConfirmPanel({
  message,
  confirmLabel = '确认',
  cancelLabel = '取消',
  danger = false,
  onResult,
}: ConfirmPanelProps) {
  return (
    <>
      <div className="confirm-message">{message}</div>
      <div className="row">
        <button type="button" className="btn-ghost" id="dialogCancel" onClick={() => onResult(false)}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={`${danger ? 'btn-danger' : 'btn-primary'} btn-auto`}
          id="dialogAccept"
          onClick={() => onResult(true)}
        >
          {confirmLabel}
        </button>
      </div>
    </>
  );
}

export type PromptPanelProps = {
  title: string;
  message?: string;
  label?: string;
  value?: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  multiline?: boolean;
  rows?: number;
  confirmLabel?: string;
  onResult: (value: string | null) => void;
};

export function PromptPanel({
  title,
  message = '',
  label = '名称',
  value = '',
  placeholder = '',
  required = true,
  maxLength,
  multiline = false,
  rows = 5,
  confirmLabel = '确定',
  onResult,
}: PromptPanelProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = event.currentTarget.querySelector<HTMLInputElement | HTMLTextAreaElement>('[name="value"]');
    const text = (input?.value ?? '').trim();
    if (required && !text) return;
    onResult(text);
  };

  const control = multiline ? (
    <textarea
      id="dialogValue"
      name="value"
      rows={rows}
      placeholder={placeholder}
      maxLength={maxLength}
      defaultValue={value}
      autoFocus
    />
  ) : (
    <input
      id="dialogValue"
      name="value"
      defaultValue={value}
      placeholder={placeholder}
      maxLength={maxLength}
      autoFocus
    />
  );

  return (
    <>
      {message ? <p className="lead lead-tight">{message}</p> : null}
      <form id="dialogPromptForm" onSubmit={handleSubmit} aria-label={title}>
        <div className="field">
          <label htmlFor="dialogValue">{label}</label>
          {control}
        </div>
        <div className="row">
          <button type="button" className="btn-ghost" id="dialogCancel" onClick={() => onResult(null)}>
            取消
          </button>
          <button className="btn-primary btn-auto" type="submit">
            {confirmLabel}
          </button>
        </div>
      </form>
    </>
  );
}

// key → 面板组件。openOverlay 的 `component` 字段用这里的字符串 key 索引。
export const OVERLAY_PANELS: Record<string, ComponentType<any>> = {
  confirm: ConfirmPanel,
  prompt: PromptPanel,
};
