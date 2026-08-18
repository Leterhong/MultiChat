import { $, $$, esc, api, toast, state, DEFAULT_PARAMS, loadSelectedAgent, saveSelectedAgent, saveParams } from '../core/index.js';

/* --------------------------- Model picker --------------------------- */
function openModelPicker() {
  if (!state.providers.length) { openSettings('providers'); toast('请先添加模型'); return; }
  const opts = [];
  state.providers.forEach(p => {
    const ms = p.models || (p.model ? [p.model] : []);
    if (ms.length) {
      ms.forEach(m => opts.push({ pid: p.id, model: m, label: `${p.name || p.id} · ${m}` }));
    } else {
      opts.push({ pid: p.id, model: '', label: `${p.name || p.id} · （手动输入模型名）`, custom: true });
    }
  });
  showModal({
    title: '选择模型',
    body: `<div style="max-height:420px;overflow:auto;">
      ${opts.map(o => `<div class="settings-tab" data-pid="${esc(o.pid)}" data-model="${esc(o.model)}" data-custom="${o.custom ? 1 : 0}" style="margin-bottom:4px;">
        <span style="font-size:14px;">${esc(o.label)}</span>
      </div>`).join('')}
    </div>`,
    onMount: (card) => {
      card.querySelectorAll('.settings-tab').forEach(t => {
        t.onclick = () => {
          const pid = t.dataset.pid;
          const p = state.providers.find(x => x.id === pid);
          if (!p) return;
          let model = t.dataset.model;
          if (t.dataset.custom === '1') {
            const name = prompt('输入该提供方的模型名称：\n（例如 deepseek-chat）');
            if (!name) return;
            model = name.trim();
            if (!p.models) p.models = [];
            if (!p.models.includes(model)) p.models.push(model);
          }
          state.selectedProvider = p; state.selectedModel = model;
          localStorage.setItem('multichat_lastModel', pid + ':' + model);
          renderTopbar(); closeModal();
        };
      });
    }
  });
}
function renderTopbar() {
  syncModelUI();
  const a = state.selectedAgent;
  $('#agentPickerName').textContent = a ? a.name : '无智能体';
  $('#workspacePickerName').textContent = state.selectedWorkspace ? state.selectedWorkspace.name : '工作区';
}
// 同步两个「底部」模型切换入口：首页 hero 标签 + 对话输入框旁标签。同一份文案、同一份点击行为（均打开 openModelPicker）。
function syncModelUI() {
  const p = state.selectedProvider, m = state.selectedModel;
  const label = (p && m) ? `${p.name || p.id} · ${m}` : '选择模型';
  [ '#heroModelTag', '#composerModelTag' ].forEach(sel => {
    const el = $(sel);
    if (!el) return;
    el.textContent = label;
    el.title = p && m ? `当前：${p.name || p.id} · ${m}\n点击切换` : '点击选择模型';
    el.onclick = openModelPicker;
  });
}


export { openModelPicker,renderTopbar,syncModelUI };
