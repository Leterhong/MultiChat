import{d as e,f as t,h as n,p as r,u as i}from"./index-Cf10N82-.js";import{importProjectFolder as a}from"./assets-BMgN2Asm.js";r(`#workspacePicker`).onclick=()=>{let t=e.projects.map(e=>({id:e.id,name:e.name,description:e.description}));showModal({title:`选择项目`,body:`<div class="picker-dialog-intro"><span>每个项目保存自己的文件、记忆和对话上下文</span><span>${t.length} 个项目</span></div>
      <button type="button" class="picker-import-project" data-import-project>
        <span class="picker-provider-mark folder" aria-hidden="true">＋</span>
        <span class="picker-option-copy"><strong>打开本地项目文件夹</strong><small>自动创建项目并导入可读取的源码与文档</small></span>
        <span class="picker-option-state" aria-hidden="true">›</span>
      </button>
      <div class="model-picker-list">${t.map(t=>{let r=e.selectedProject?.id===t.id,i=t.id===`pr_inbox`||t.name===`收件箱`,a=i?`临时对话`:t.name,o=i?`不载入项目文件，只进行普通对话`:t.description||`本地项目`;return`<button type="button" class="picker-option${r?` active`:``}" data-pid="${n(t.id)}" aria-pressed="${r}">
          <span class="picker-provider-mark" aria-hidden="true">${i?`—`:n(a.trim().slice(0,1).toUpperCase()||`P`)}</span>
          <span class="picker-option-copy"><strong>${n(a)}</strong><small>${n(o)}</small></span>
          <span class="picker-option-state" aria-hidden="true">${r?`✓`:`›`}</span>
        </button>`}).join(``)}</div>`,onMount:t=>{let n=t.querySelector(`[data-import-project]`);n&&(n.onclick=()=>{closeModal(),a()}),t.querySelectorAll(`[data-pid]`).forEach(t=>t.onclick=async()=>{let n=e.projects.find(e=>e.id===t.dataset.pid)||null;n&&(e.selectedProject=n,localStorage.setItem(`multichat_project`,n.id),await loadProjects(),await newConversation(),renderTopbar(),renderFileContext(),closeModal())})}})},r(`#agentPicker`).onclick=()=>{if(!e.agents.length){openSettings(`agents`),t(`请先创建运行配置`);return}let r=[{id:``,name:`直接对话`,description:`不注入系统提示词，也不启用工具`}].concat(e.agents.map(e=>({id:e.id,name:e.name,description:e.description})));showModal({title:`选择运行配置`,body:`<div class="picker-dialog-intro"><span>选择本轮使用的提示词与能力组合</span><span>${e.agents.length} 个配置</span></div>
      <div class="model-picker-list">
      ${r.map(t=>{let r=(e.selectedAgent?.id||``)===t.id;return`<button type="button" class="picker-option${r?` active`:``}" data-aid="${n(t.id)}" aria-pressed="${r}">
          <span class="picker-provider-mark agent" aria-hidden="true">${t.id?n(t.name.trim().slice(0,1).toUpperCase()||`A`):`—`}</span>
          <span class="picker-option-copy"><strong>${n(t.name)}</strong><small>${n(t.description||`自定义运行配置`)}</small></span>
          <span class="picker-option-state" aria-hidden="true">${r?`✓`:`›`}</span>
        </button>`}).join(``)}
    </div>`,onMount:t=>{t.querySelectorAll(`[data-aid]`).forEach(t=>{t.onclick=()=>{let n=t.dataset.aid;e.selectedAgent=n?e.agents.find(e=>e.id===n):null,i(),renderTopbar(),closeModal(),e.messages.length||renderContent()}})}})};