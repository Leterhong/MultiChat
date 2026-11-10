import{E as e,O as t,T as n,b as r,y as i}from"./index-Bu64e5Lw.js";import{importProjectFolder as a}from"./assets-Cg7CH6aI.js";e(`#workspacePicker`).onclick=()=>{let e=r.projects.map(e=>({id:e.id,name:e.name,description:e.description}));showModal({title:`选择项目`,body:`<div class="picker-dialog-intro"><span>每个项目保存自己的文件、记忆和对话上下文</span><span>${e.length} 个项目</span></div>
      <button type="button" class="picker-import-project" data-import-project>
        <span class="picker-provider-mark folder" aria-hidden="true">＋</span>
        <span class="picker-option-copy"><strong>打开本地项目文件夹</strong><small>自动创建项目并导入可读取的源码与文档</small></span>
        <span class="picker-option-state" aria-hidden="true">›</span>
      </button>
      <div class="model-picker-list">${e.map(e=>{let n=r.selectedProject?.id===e.id,i=e.id===`pr_inbox`||e.name===`收件箱`,a=i?`临时对话`:e.name,o=i?`不载入项目文件，只进行普通对话`:e.description||`本地项目`;return`<button type="button" class="picker-option${n?` active`:``}" data-pid="${t(e.id)}" aria-pressed="${n}">
          <span class="picker-provider-mark" aria-hidden="true">${i?`—`:t(a.trim().slice(0,1).toUpperCase()||`P`)}</span>
          <span class="picker-option-copy"><strong>${t(a)}</strong><small>${t(o)}</small></span>
          <span class="picker-option-state" aria-hidden="true">${n?`✓`:`›`}</span>
        </button>`}).join(``)}</div>`,onMount:e=>{let t=e.querySelector(`[data-import-project]`);t&&(t.onclick=()=>{closeModal(),a()}),e.querySelectorAll(`[data-pid]`).forEach(e=>e.onclick=async()=>{let t=r.projects.find(t=>t.id===e.dataset.pid)||null;t&&(r.selectedProject=t,localStorage.setItem(`multichat_project`,t.id),await loadProjects(),await newConversation(),renderTopbar(),renderFileContext(),closeModal())})}})},e(`#agentPicker`).onclick=()=>{if(!r.agents.length){openSettings(`agents`),n(`请先创建运行配置`);return}let e=[{id:``,name:`直接对话`,description:`不注入系统提示词，也不启用工具`}].concat(r.agents.map(e=>({id:e.id,name:e.name,description:e.description})));showModal({title:`选择运行配置`,body:`<div class="picker-dialog-intro"><span>选择本轮使用的提示词与能力组合</span><span>${r.agents.length} 个配置</span></div>
      <div class="model-picker-list">
      ${e.map(e=>{let n=(r.selectedAgent?.id||``)===e.id;return`<button type="button" class="picker-option${n?` active`:``}" data-aid="${t(e.id)}" aria-pressed="${n}">
          <span class="picker-provider-mark agent" aria-hidden="true">${e.id?t(e.name.trim().slice(0,1).toUpperCase()||`A`):`—`}</span>
          <span class="picker-option-copy"><strong>${t(e.name)}</strong><small>${t(e.description||`自定义运行配置`)}</small></span>
          <span class="picker-option-state" aria-hidden="true">${n?`✓`:`›`}</span>
        </button>`}).join(``)}
    </div>`,onMount:e=>{e.querySelectorAll(`[data-aid]`).forEach(e=>{e.onclick=()=>{let t=e.dataset.aid;r.selectedAgent=t?r.agents.find(e=>e.id===t):null,i(),renderTopbar(),closeModal(),r.messages.length||renderContent()}})}})};