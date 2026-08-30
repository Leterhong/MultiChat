import { $, esc, toast, state } from '../core/index';

/* --------------------------- Model picker --------------------------- */
function openModelPicker() {
  if (!state.providers.length) { openSettings('providers'); toast('请先添加模型'); return; }
  const opts: Array<{
    pid: string;
    model: string;
    modelLabel: string;
    providerName: string;
    apiType: string;
    initial: string;
    custom?: boolean;
  }> = [];
  state.providers.forEach(p => {
    const ms = p.models || (p.model ? [p.model] : []);
    const providerName = p.name || p.id;
    const shared = {
      pid: p.id,
      providerName,
      apiType: p.apiType || 'openai',
      initial: providerName.trim().slice(0, 1).toUpperCase() || 'M',
    };
    if (ms.length) {
      ms.forEach(m => opts.push({ ...shared, model: m, modelLabel: m }));
    } else {
      opts.push({ ...shared, model: '', modelLabel: '手动输入模型名', custom: true });
    }
  });
  showModal({
    title: '选择模型',
    body: `<div class="picker-dialog-intro">
        <span>为接下来的消息选择运行模型</span>
        <span>${opts.length} 个可用模型</span>
      </div>
      <div class="model-picker-list">
      ${opts.map(o => {
        const active = state.selectedProvider?.id === o.pid && state.selectedModel === o.model;
        return `<button type="button" class="picker-option${active ? ' active' : ''}" data-pid="${esc(o.pid)}" data-model="${esc(o.model)}" data-custom="${o.custom ? 1 : 0}" aria-pressed="${active}">
        <span class="picker-provider-mark" aria-hidden="true">${esc(o.initial)}</span>
        <span class="picker-option-copy">
          <strong>${esc(o.modelLabel)}</strong>
          <small>${esc(o.providerName)} · ${esc(o.apiType)}</small>
        </span>
        <span class="picker-option-state" aria-hidden="true">${active ? '✓' : '›'}</span>
      </button>`;
      }).join('')}
      </div>`,
    onMount: (card) => {
      card.classList.add('model-picker-modal');
      card.querySelectorAll('.picker-option').forEach((t: HTMLButtonElement) => {
        t.onclick = async () => {
          const pid = t.dataset.pid;
          const p = state.providers.find(x => x.id === pid);
          if (!p) return;
          let model = t.dataset.model;
          if (t.dataset.custom === '1') {
            const name = await showPrompt({ title: '自定义模型', message: `为「${p.name || p.id}」输入模型名称`, label: '模型名称', placeholder: '例如 deepseek-chat', maxLength: 120 });
            if (!name) return;
            model = name.trim();
            if (!p.models) p.models = [];
            if (!p.models.includes(model)) p.models.push(model);
          }
          state.selectedProvider = p; state.selectedModel = model;
          localStorage.setItem('multichat_lastModel', pid + ':' + model);
          renderTopbar(); closeModal();
          if (!state.messages.length) renderContent();
        };
      });
    }
  });
}
function renderTopbar() {
  syncModelUI();
  const a = state.selectedAgent;
  $('#agentPickerName').textContent = a ? a.name : '直接对话';
  $('#workspacePickerName').textContent = state.selectedWorkspace ? state.selectedWorkspace.name : '工作区';
  const path = $('#topbarPath');
  if (path) path.textContent = `${state.selectedWorkspace?.name || '工作区'} / ${state.selectedProject?.name || '未选择项目'}`;
  renderInspector();
}
// 同步两个模型入口的显示文案。点击行为由 React runtime action 统一管理，
// 避免原生 onclick 与 React onClick 同时触发并把选择器重新覆盖成设置页。
function syncModelUI() {
  const p = state.selectedProvider, m = state.selectedModel;
  const label = (p && m) ? `${p.name || p.id} · ${m}` : '选择模型';
  [ '#heroModelTag', '#composerModelTag' ].forEach(sel => {
    const el = $(sel);
    if (!el) return;
    el.textContent = label;
    el.title = p && m ? `当前：${p.name || p.id} · ${m}\n点击切换` : '点击选择模型';
  });
}


export { openModelPicker,renderTopbar,syncModelUI };
