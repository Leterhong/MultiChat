import { $, esc, toast, state, saveSelectedAgent } from '../core/index';
import { importProjectFolder } from './assets';

/* --------------------------- Project / agent pickers --------------------------- */
$('#workspacePicker').onclick = () => {
  const opts = state.projects.map(project => ({ id: project.id, name: project.name, description: project.description }));
  showModal({
    title: '选择项目',
    body: `<div class="picker-dialog-intro"><span>每个项目保存自己的文件、记忆和对话上下文</span><span>${opts.length} 个项目</span></div>
      <button type="button" class="picker-import-project" data-import-project>
        <span class="picker-provider-mark folder" aria-hidden="true">＋</span>
        <span class="picker-option-copy"><strong>打开本地项目文件夹</strong><small>自动创建项目并导入可读取的源码与文档</small></span>
        <span class="picker-option-state" aria-hidden="true">›</span>
      </button>
      <div class="model-picker-list">${opts.map(o => {
        const active = state.selectedProject?.id === o.id;
        const placeholder = o.id === 'pr_inbox' || o.name === '收件箱';
        const displayName = placeholder ? '临时对话' : o.name;
        const description = placeholder ? '不载入项目文件，只进行普通对话' : (o.description || '本地项目');
        return `<button type="button" class="picker-option${active ? ' active' : ''}" data-pid="${esc(o.id)}" aria-pressed="${active}">
          <span class="picker-provider-mark" aria-hidden="true">${placeholder ? '—' : esc(displayName.trim().slice(0, 1).toUpperCase() || 'P')}</span>
          <span class="picker-option-copy"><strong>${esc(displayName)}</strong><small>${esc(description)}</small></span>
          <span class="picker-option-state" aria-hidden="true">${active ? '✓' : '›'}</span>
        </button>`;
      }).join('')}</div>`,
    onMount: (card) => {
      const importButton = card.querySelector('[data-import-project]') as HTMLButtonElement | null;
      if (importButton) importButton.onclick = () => { closeModal(); void importProjectFolder(); };
      card.querySelectorAll('[data-pid]').forEach((item: HTMLButtonElement) => item.onclick = async () => {
      const selected = state.projects.find(x => x.id === item.dataset.pid) || null;
      if (!selected) return;
      state.selectedProject = selected;
      localStorage.setItem('multichat_project', selected.id);
      await loadProjects();
      await newConversation();
      renderTopbar();
      renderFileContext();
      closeModal();
      });
    }
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
