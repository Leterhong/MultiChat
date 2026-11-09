import { createElement, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { closeOverlay, useOverlayStore } from '../core/overlay';
import { OVERLAY_PANELS } from './overlayPanels';

// 标题 h3 的稳定 id：#modal 的 aria-labelledby 指向它，多头面板共用不会冲突。
const HEADING_ID = 'mcOverlayTitle';
const MODAL_FOCUSABLE =
  'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex="0"]';

function focusWithoutScroll(target: HTMLElement | null) {
  if (!target) return;
  try {
    target.focus({ preventScroll: true });
  } catch {
    target.focus();
  }
}

export function OverlayLayer() {
  const { open, revision, title, body, component, props, onMount } = useOverlayStore();
  // 一次「打开会话」的返回焦点目标；嵌套换内容（open 保持 true）时不重置。
  const sessionRef = useRef<{ returnFocus: HTMLElement | null } | null>(null);

  // Esc / Tab trap / 背景点击：全局监听挂在 effect 里，命令式读取 open 避免闭包过期。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modal = document.getElementById('modal');
      if (!useOverlayStore.getState().open || !modal?.classList.contains('open')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeOverlay();
        return;
      }
      if (event.key !== 'Tab') return;
      const card = document.getElementById('modalCard');
      if (!card) return;
      const focusable = Array.from(card.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE));
      if (!focusable.length) {
        event.preventDefault();
        card.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const onModalClick = (event: MouseEvent) => {
      if ((event.target as HTMLElement).id === 'modal') closeOverlay();
    };
    document.addEventListener('keydown', onKeyDown);
    document.getElementById('modal')?.addEventListener('click', onModalClick);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.getElementById('modal')?.removeEventListener('click', onModalClick);
    };
  }, []);

  // 打开/关闭生命周期：class、aria、inert、焦点、返回焦点、onMount 全部在 effect 内。
  // useLayoutEffect 保证 portal 内容已提交到 DOM 之后、绘制之前执行，onMount 能查到节点。
  useLayoutEffect(() => {
    const modal = document.getElementById('modal');
    const card = document.getElementById('modalCard');
    const app = document.getElementById('app');
    const settings = document.getElementById('settings');
    if (!modal || !card) return;

    if (!open) {
      // 仅在实际关闭过（存在会话）时做收尾，避免初次挂载误抢焦点。
      const session = sessionRef.current;
      if (!session) return;
      sessionRef.current = null;

      const settingsOpen = settings?.classList.contains('open') ?? false;
      const destination = settingsOpen ? settings : app;
      if (app) app.inert = settingsOpen;
      if (settings) settings.inert = !settingsOpen;

      const fallback = (settingsOpen
        ? document.getElementById('settingsBody')
        : document.getElementById('settingsBtn')) as HTMLElement | null;
      const target =
        session.returnFocus?.isConnected && destination?.contains(session.returnFocus)
          ? session.returnFocus
          : fallback;
      focusWithoutScroll(target);
      if (card.contains(document.activeElement)) focusWithoutScroll(fallback);

      modal.classList.remove('open');
      modal.inert = true;
      modal.setAttribute('aria-hidden', 'true');
      return;
    }

    // 首次打开才记录返回焦点；嵌套换面板沿用原触发元素。
    if (!sessionRef.current) {
      sessionRef.current = {
        returnFocus: document.activeElement instanceof HTMLElement ? document.activeElement : null,
      };
    }

    card.className = 'modal-card';
    modal.setAttribute('aria-labelledby', HEADING_ID);
    modal.setAttribute('aria-hidden', 'false');
    modal.inert = false;
    modal.classList.add('open');

    // React 内容已渲染进 DOM：遗留调用点的 onMount(card) 现在可以查询/绑定。
    onMount?.(card);

    const first = Array.from(card.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE)).find(
      (element) => !element.classList.contains('modal-close')
    );
    focusWithoutScroll(first || card);
    if (app) app.inert = true;
    if (settings) settings.inert = true;
  }, [open, revision]);

  const card = document.getElementById('modalCard');
  if (!open || !card) return null;

  const Panel = component ? OVERLAY_PANELS[component] : undefined;
  const content = Panel ? (
    createElement(Panel, props || {})
  ) : (
    // 遗留 body（已由 esc() 转义）。display:contents 让子节点在布局上等价于
    // 直接放在 .modal-card 下，不引入额外的盒子，保持旧 CSS 表现。
    <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: body || '' }} />
  );

  return createPortal(
    <>
      <div className="modal-heading">
        <h3 id={HEADING_ID}>{title}</h3>
        <button type="button" className="modal-close" aria-label="关闭弹窗" title="关闭" onClick={closeOverlay}>
          ✕
        </button>
      </div>
      {content}
    </>,
    card
  );
}
