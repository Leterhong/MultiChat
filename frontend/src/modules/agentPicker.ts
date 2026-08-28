import { $, esc, toast, state, saveSelectedAgent } from '../core/index';

/* --------------------------- Agent picker --------------------------- */
$('#workspacePicker').onclick = () => {
  const opts = state.workspaces.map(workspace => ({ id: workspace.id, name: workspace.name, description: workspace.description }));
  if (!opts.length) { openSettings('workspace'); return; }
  showModal({
    title: '选择工作区',
    body: `<div class="picker-dialog-intro"><span>切换对话与项目所在的工作区</span><span>${opts.length} 个工作区</span></div>
      <div class="model-picker-list">${opts.map(o => {
        const active = state.selectedWorkspace?.id === o.id;
        return `<button type="button" class="picker-option${active ? ' active' : ''}" data-wid="${esc(o.id)}" aria-pressed="${active}">
          <span class="picker-provider-mark" aria-hidden="true">${esc(o.name.trim().slice(0, 1).toUpperCase() || 'W')}</span>
          <span class="picker-option-copy"><strong>${esc(o.name)}</strong><small>${esc(o.description || '本地工作区')}</small></span>
          <span class="picker-option-state" aria-hidden="true">${active ? '✓' : '›'}</span>
        </button>`;
      }).join('')}</div>`,
    onMount: (card) => card.querySelectorAll('[data-wid]').forEach((item: HTMLButtonElement) => item.onclick = async () => {
      state.selectedWorkspace = state.workspaces.find(x => x.id === item.dataset.wid) || null;
      await loadProjects();
      state.currentConvId = null;
      state.messages = [];
      renderTopbar();
      renderConvList();
      renderContent();
      closeModal();
    })
  });
};

$('#agentPicker').onclick = () => {
  if (!state.agents.length) { openSettings('agents'); toast('请先创建运行配置'); return; }
  const opts = [{ id: '', name: '直接对话', description: '不注入系统提示词，也不启用工具' }].concat(state.agents.map(a => ({ id: a.id, name: a.name, description: a.description })));
  showModal({
    title: '选择运行配置',
    body: `<div class="picker-dialog-intro"><span>选择本轮使用的提示词与能力组合</span><span>${state.agents.length} 个配置</span></div>
      <div class="model-picker-list">
      ${opts.map(o => {
        const active = (state.selectedAgent?.id || '') === o.id;
        return `<button type="button" class="picker-option${active ? ' active' : ''}" data-aid="${esc(o.id)}" aria-pressed="${active}">
          <span class="picker-provider-mark agent" aria-hidden="true">${o.id ? esc(o.name.trim().slice(0, 1).toUpperCase() || 'A') : '—'}</span>
          <span class="picker-option-copy"><strong>${esc(o.name)}</strong><small>${esc(o.description || '自定义运行配置')}</small></span>
          <span class="picker-option-state" aria-hidden="true">${active ? '✓' : '›'}</span>
        </button>`;
      }).join('')}
    </div>`,
    onMount: (card) => {
      card.querySelectorAll('[data-aid]').forEach((t: HTMLButtonElement) => {
        t.onclick = () => {
          const id = t.dataset.aid;
          state.selectedAgent = id ? state.agents.find(a => a.id === id) : null;
          saveSelectedAgent();
          renderTopbar();
          closeModal();
          if (!state.messages.length) renderContent();
        };
      });
    }
  });
};

// 本模块为「副作用模块」：仅做顶层 DOM 事件绑定，无可导出的命名函数。
export {};
