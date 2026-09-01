import{_ as e,d as t,g as n,u as r,y as i}from"./index-M700RccX.js";import{importProjectFolder as a}from"./assets-j7yF9swg.js";e(`#workspacePicker`).onclick=()=>{let e=t.projects.map(e=>({id:e.id,name:e.name,description:e.description}));showModal({title:`选择项目`,body:`<div class="picker-dialog-intro"><span>每个项目保存自己的文件、记忆和对话上下文</span><span>${e.length} 个项目</span></div>
      <button type="button" class="picker-import-project" data-import-project>
        <span class="picker-provider-mark folder" aria-hidden="true">＋</span>
        <span class="picker-option-copy"><strong>打开本地项目文件夹</strong><small>自动创建项目并导入可读取的源码与文档</small></span>
        <span class="picker-option-state" aria-hidden="true">›</span>
      </button>
      <div class="model-picker-list">${e.map(e=>{let n=t.selectedProject?.id===e.id,r=e.id===`pr_inbox`||e.name===`收件箱`,a=r?`临时对话`:e.name,o=r?`不载入项目文件，只进行普通对话`:e.description||`本地项目`;return`<button type="button" class="picker-option${n?` active`:``}" data-pid="${i(e.id)}" aria-pressed="${n}">
          <span class="picker-provider-mark" aria-hidden="true">${r?`—`:i(a.trim().slice(0,1).toUpperCase()||`P`)}</span>
          <span class="picker-option-copy"><strong>${i(a)}</strong><small>${i(o)}</small></span>
          <span class="picker-option-state" aria-hidden="true">${n?`✓`:`›`}</span>
        </button>`}).join(``)}</div>`,onMount:e=>{let n=e.querySelector(`[data-import-project]`);n&&(n.onclick=()=>{closeModal(),a()}),e.querySelectorAll(`[data-pid]`).forEach(e=>e.onclick=async()=>{let n=t.projects.find(t=>t.id===e.dataset.pid)||null;n&&(t.selectedProject=n,localStorage.setItem(`multichat_project`,n.id),await loadProjects(),await newConversation(),renderTopbar(),renderFileContext(),closeModal())})}})},e(`#agentPicker`).onclick=()=>{if(!t.agents.length){openSettings(`agents`),n(`请先创建运行配置`);return}let e=[{id:``,name:`直接对话`,description:`不注入系统提示词，也不启用工具`}].concat(t.agents.map(e=>({id:e.id,name:e.name,description:e.description})));showModal({title:`选择运行配置`,body:`<div class="picker-dialog-intro"><span>选择本轮使用的提示词与能力组合</span><span>${t.agents.length} 个配置</span></div>
      <div class="model-picker-list">
      ${e.map(e=>{let n=(t.selectedAgent?.id||``)===e.id;return`<button type="button" class="picker-option${n?` active`:``}" data-aid="${i(e.id)}" aria-pressed="${n}">
          <span class="picker-provider-mark agent" aria-hidden="true">${e.id?i(e.name.trim().slice(0,1).toUpperCase()||`A`):`—`}</span>
          <span class="picker-option-copy"><strong>${i(e.name)}</strong><small>${i(e.description||`自定义运行配置`)}</small></span>
          <span class="picker-option-state" aria-hidden="true">${n?`✓`:`›`}</span>
        </button>`}).join(``)}
    </div>`,onMount:e=>{e.querySelectorAll(`[data-aid]`).forEach(e=>{e.onclick=()=>{let n=e.dataset.aid;t.selectedAgent=n?t.agents.find(e=>e.id===n):null,r(),renderTopbar(),closeModal(),t.messages.length||renderContent()}})}})};