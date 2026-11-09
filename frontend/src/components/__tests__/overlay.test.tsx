import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OverlayLayer } from '../OverlayLayer';
import { CommandList, InspectorBody, type InspectorView } from '../workbenchPanels';
import { openOverlay, closeOverlay, useOverlayStore } from '../../core/overlay';
import { showModal, closeModal, showConfirm, showPrompt } from '../../modules/modal';
import { renderCommands, renderInspector } from '../../modules/workbench';

// axe 扫描在负载下可能超过默认 5s 预算
vi.setConfig({ testTimeout: 20000 });

function fixture() {
  document.body.innerHTML = `
    <div id="app"><button id="settingsBtn" type="button">设置</button></div>
    <div id="settings" aria-hidden="true" inert><div id="settingsBody"></div></div>
    <div class="modal" id="modal" role="dialog" aria-modal="true" aria-live="polite" aria-hidden="true" inert>
      <div class="modal-card" id="modalCard" tabindex="-1"></div>
    </div>
    <div class="command-list" id="commandList"></div>
    <div id="inspectorBody"></div>
  `;
}

beforeEach(() => {
  fixture();
  useOverlayStore.setState({
    open: false,
    revision: 0,
    title: '',
    body: undefined,
    component: undefined,
    props: undefined,
    onMount: undefined,
    onClose: undefined,
  });
});

afterEach(() => {
  cleanup();
});

const card = () => document.getElementById('modalCard') as HTMLElement;
const modal = () => document.getElementById('modal') as HTMLElement;

describe('OverlayLayer React 面板', () => {
  it('渲染 confirm 面板、标题栏与结果回调，且无 a11y 违规', async () => {
    render(<OverlayLayer />);
    const onResult = vi.fn();
    act(() => {
      openOverlay({
        title: '删除确认',
        component: 'confirm',
        props: { message: '确定要删除吗？', confirmLabel: '删除', cancelLabel: '取消', danger: true, onResult },
      });
    });

    expect(card().querySelector('.modal-heading h3')?.textContent).toBe('删除确认');
    expect(card().querySelector('.modal-close')).not.toBeNull();
    expect(card().querySelector('.confirm-message')?.textContent).toBe('确定要删除吗？');
    expect(card().querySelector('#dialogCancel')).toHaveClass('btn-ghost');
    const accept = card().querySelector('#dialogAccept') as HTMLElement;
    expect(accept).toHaveClass('btn-danger');

    // 打开时 React effect 设置的 aria / inert
    expect(modal()).toHaveClass('open');
    expect(modal().getAttribute('aria-hidden')).toBe('false');
    expect((document.getElementById('app') as HTMLElement).inert).toBe(true);

    fireEvent.click(accept);
    expect(onResult).toHaveBeenCalledWith(true);
    expect(await axe(card())).toHaveNoViolations();
  });

  it('渲染 prompt 表单、提交结果，且无 a11y 违规', async () => {
    render(<OverlayLayer />);
    const onResult = vi.fn();
    act(() => {
      openOverlay({
        title: '重命名',
        component: 'prompt',
        props: {
          title: '重命名', message: '输入新名称', label: '名称', value: '旧名称',
          placeholder: '请输入', required: true, maxLength: 50, confirmLabel: '保存', onResult,
        },
      });
    });

    expect(card().querySelector('#dialogPromptForm')).not.toBeNull();
    expect(card().querySelector('.field label')?.textContent).toBe('名称');
    expect(card().querySelector('.lead')?.textContent).toBe('输入新名称');
    expect(card().querySelector('#dialogCancel')).toHaveClass('btn-ghost');
    expect(card().querySelector('.btn-primary')).not.toBeNull();
    const input = card().querySelector('[name="value"]') as HTMLInputElement;
    expect(input.value).toBe('旧名称');

    fireEvent.change(input, { target: { value: '新名称' } });
    fireEvent.submit(card().querySelector('#dialogPromptForm') as HTMLFormElement);
    expect(onResult).toHaveBeenCalledWith('新名称');
    expect(await axe(card())).toHaveNoViolations();
  });

  it('showConfirm 的 Promise 在确认/取消/Esc 下正确 resolve', async () => {
    render(<OverlayLayer />);

    let accepted: Promise<boolean>;
    act(() => { accepted = showConfirm({ title: '确认', message: '继续？' }); });
    fireEvent.click(card().querySelector('#dialogAccept') as HTMLElement);
    await expect(accepted!).resolves.toBe(true);

    let cancelled: Promise<boolean>;
    act(() => { cancelled = showConfirm({ title: '确认', message: '继续？' }); });
    fireEvent.click(card().querySelector('#dialogCancel') as HTMLElement);
    await expect(cancelled!).resolves.toBe(false);

    let escaped: Promise<boolean>;
    act(() => { escaped = showConfirm({ title: '确认', message: '继续？' }); });
    fireEvent.keyDown(document, { key: 'Escape' });
    await expect(escaped!).resolves.toBe(false);
  });

  it('showPrompt 的 Promise 在提交/取消/Esc 下正确 resolve', async () => {
    render(<OverlayLayer />);

    let submitted: Promise<string | null>;
    act(() => { submitted = showPrompt({ title: '名称', label: '名称' }); });
    const input = card().querySelector('[name="value"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '我的项目' } });
    fireEvent.submit(card().querySelector('#dialogPromptForm') as HTMLFormElement);
    await expect(submitted!).resolves.toBe('我的项目');

    let cancelled: Promise<string | null>;
    act(() => { cancelled = showPrompt({ title: '名称', label: '名称' }); });
    fireEvent.click(card().querySelector('#dialogCancel') as HTMLElement);
    await expect(cancelled!).resolves.toBeNull();

    let escaped: Promise<string | null>;
    act(() => { escaped = showPrompt({ title: '名称', label: '名称' }); });
    fireEvent.keyDown(document, { key: 'Escape' });
    await expect(escaped!).resolves.toBeNull();
  });

  it('遗留 body 用 dangerouslySetInnerHTML 渲染，onMount 在内容进入 DOM 后调用', () => {
    render(<OverlayLayer />);
    let mountedCard: HTMLElement | null = null;
    act(() => {
      showModal({
        title: '遗留弹窗',
        body: '<div class="confirm-message">旧内容 <b>加粗</b></div>',
        onMount: (el: HTMLElement) => {
          mountedCard = el;
          el.querySelector('.confirm-message')!.setAttribute('data-mounted', 'yes');
        },
      });
    });

    expect(card().querySelector('.confirm-message b')?.textContent).toBe('加粗');
    expect(card().querySelector('.modal-heading h3')?.textContent).toBe('遗留弹窗');
    expect(mountedCard).toBe(card());
    expect(card().querySelector('.confirm-message')?.getAttribute('data-mounted')).toBe('yes');
  });

  it('closeModal 触发 onClose 一次并关闭弹窗、恢复 inert', () => {
    render(<OverlayLayer />);
    const onClose = vi.fn();
    act(() => { openOverlay({ title: 'x', body: '<p>hi</p>', onClose }); });
    expect(modal()).toHaveClass('open');

    act(() => { closeModal(); });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(modal()).not.toHaveClass('open');
    expect(modal().getAttribute('aria-hidden')).toBe('true');
    expect((document.getElementById('app') as HTMLElement).inert).toBe(false);
  });

  it('closeOverlay 在未打开时不重复触发 onClose', () => {
    render(<OverlayLayer />);
    const onClose = vi.fn();
    act(() => { openOverlay({ title: 'x', body: '<p>hi</p>', onClose }); });
    act(() => { closeOverlay(); closeOverlay(); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('命令列表 / Inspector 的 React 渲染', () => {
  it('CommandList 保留原 class/data-command 并回调点击的 id，且无 a11y 违规', async () => {
    const onRun = vi.fn();
    const view = render(
      <CommandList
        items={[
          { id: 'new', label: '新任务', description: '开始任务', group: '任务', shortcut: 'Ctrl N' },
          { id: 'settings', label: '打开设置', description: '配置', group: '工作区' },
        ]}
        onRun={onRun}
      />
    );
    expect(view.container.querySelectorAll('.command-item')).toHaveLength(2);
    const first = view.container.querySelector('.command-item') as HTMLElement;
    expect(first).toHaveAttribute('data-command', 'new');
    expect(first.querySelector('.command-item-group')?.textContent).toBe('任务');
    expect(first.querySelector('.command-item-copy strong')?.textContent).toBe('新任务');
    expect(first.querySelector('kbd')?.textContent).toBe('Ctrl N');
    expect(view.container.querySelectorAll('.command-arrow')).toHaveLength(1);

    fireEvent.click(first);
    expect(onRun).toHaveBeenCalledWith('new');
    expect(await axe(view.container)).toHaveNoViolations();
  });

  it('CommandList 空结果显示 .command-empty', () => {
    const view = render(<CommandList items={[]} onRun={vi.fn()} />);
    expect(view.container.querySelector('.command-empty')?.textContent).toBe('没有匹配的操作');
  });

  it('InspectorBody 保留 inspector-* / data-inspector-settings 并回调 tab，且无 a11y 违规', async () => {
    const onSettings = vi.fn();
    const data: InspectorView = {
      ready: false,
      readiness: 75,
      selectedModel: 'gpt-4o',
      agentName: '研究助手',
      projectName: 'MultiChat',
      selectedFiles: 3,
      enabledMemories: 2,
      skills: 1,
      tools: 4,
      mcp: 2,
      estimatedLabel: '1,024',
      budgetWidth: 40,
      agentNote: '1 Skills · 4 内置工具 · 2 MCP 服务',
      checks: [
        { label: '模型选择', ok: true, detail: 'OK', tab: 'providers' },
        { label: '连接配置', ok: false, detail: '需要凭据', tab: 'providers' },
      ],
      latest: { statusClass: 'completed', statusLabel: '已完成', name: '研究助手', steps: 5, toolCalls: 3, tokens: '1,024' },
    };
    const view = render(<InspectorBody view={data} onSettings={onSettings} />);
    expect(view.container.querySelector('.inspector-status')).toHaveClass('needs-attention');
    expect(view.container.querySelector('.inspector-score strong')?.textContent).toBe('75');
    expect(view.container.querySelectorAll('.inspector-check')).toHaveLength(2);
    expect(view.container.querySelector('.inspector-run')).not.toBeNull();

    fireEvent.click(view.container.querySelector('[data-inspector-settings="workspace"]') as HTMLElement);
    expect(onSettings).toHaveBeenCalledWith('workspace');
    expect(await axe(view.container)).toHaveNoViolations();
  });

  it('renderCommands / renderInspector 通过 createRoot 把 React 面板写进原容器', async () => {
    await act(async () => {
      renderCommands();
      renderInspector();
    });
    const list = document.getElementById('commandList') as HTMLElement;
    const inspector = document.getElementById('inspectorBody') as HTMLElement;
    expect(list.querySelectorAll('.command-item').length).toBeGreaterThan(0);
    expect(list.querySelector('[data-command]')).not.toBeNull();
    expect(inspector.querySelector('.inspector-status')).not.toBeNull();
    expect(inspector.querySelector('[data-inspector-settings]')).not.toBeNull();
  });
});
