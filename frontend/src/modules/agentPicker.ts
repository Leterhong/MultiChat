import { $, $$, esc, api, toast, state, DEFAULT_PARAMS, loadSelectedAgent, saveSelectedAgent, saveParams } from '../core/index';

/* --------------------------- Agent picker --------------------------- */
$('#workspacePicker').onclick = () => {
  const opts = state.workspaces.map(workspace => ({ id: workspace.id, name: workspace.name, description: workspace.description }));
  if (!opts.length) { openSettings('workspace'); return; }
  showModal({
    title: '选择工作区',
    body: `<div style="max-height:420px;overflow:auto;">${opts.map(o => `<div class="settings-tab" data-wid="${esc(o.id)}" style="margin-bottom:4px;display:block;text-align:left;padding:12px;"><div style="font-weight:600;color:var(--label-primary);font-size:14px;">${esc(o.name)}</div>${o.description ? `<div style="font-size:11.5px;color:var(--label-caption);margin-top:2px;">${esc(o.description)}</div>` : ''}</div>`).join('')}</div>`,
    onMount: (card) => card.querySelectorAll('[data-wid]').forEach(item => item.onclick = async () => {
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
  if (!state.agents.length) { openSettings('agents'); toast('请先创建智能体'); return; }
  const opts = [{ id: '', name: '无智能体', description: '直接对话，不注入系统提示词、不提供工具' }].concat(state.agents.map(a => ({ id: a.id, name: a.name, description: a.description })));
  showModal({
    title: '选择智能体',
    body: `<div style="max-height:420px;overflow:auto;">
      ${opts.map(o => `<div class="settings-tab" data-aid="${esc(o.id)}" style="margin-bottom:4px;display:block;text-align:left;padding:12px;">
        <div style="font-weight:600;color:var(--label-primary);font-size:14px;">${esc(o.name)}</div>
        ${o.description ? `<div style="font-size:11.5px;color:var(--label-caption);margin-top:2px;">${esc(o.description)}</div>` : ''}
      </div>`).join('')}
    </div>`,
    onMount: (card) => {
      card.querySelectorAll('[data-aid]').forEach(t => {
        t.onclick = () => {
          const id = t.dataset.aid;
          state.selectedAgent = id ? state.agents.find(a => a.id === id) : null;
          saveSelectedAgent();
          renderTopbar();
          closeModal();
        };
      });
    }
  });
};

// 本模块为「副作用模块」：仅做顶层 DOM 事件绑定，无可导出的命名函数。
export {};
