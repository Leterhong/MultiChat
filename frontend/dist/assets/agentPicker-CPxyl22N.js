import{f as e,p as t,v as n,x as r,y as i}from"./index-k-fK6-R2.js";import{importProjectFolder as a}from"./assets-ROEnRNon.js";i(`#workspacePicker`).onclick=()=>{let e=t.projects.map(e=>({id:e.id,name:e.name,description:e.description}));showModal({title:`选择项目`,body:`<div class="picker-dialog-intro"><span>每个项目保存自己的文件、记忆和对话上下文</span><span>${e.length} 个项目</span></div>
      <button type="button" class="picker-import-project" data-import-project>
        <span class="picker-provider-mark folder" aria-hidden="true">＋</span>
        <span class="picker-option-copy"><strong>打开本地项目文件夹</strong><small>自动创建项目并导入可读取的源码与文档</small></span>
        <span class="picker-option-state" aria-hidden="true">›</span>
      </button>
      <div class="model-picker-list">${e.map(e=>{let n=t.selectedProject?.id===e.id,i=e.id===`pr_inbox`||e.name===`收件箱`,a=i?`临时对话`:e.name,o=i?`不载入项目文件，只进行普通对话`:e.description||`本地项目`;return`<button type="button" class="picker-option${n?` active`:``}" data-pid="${r(e.id)}" aria-pressed="${n}">
          <span class="picker-provider-mark" aria-hidden="true">${i?`—`:r(a.trim().slice(0,1).toUpperCase()||`P`)}</span>
          <span class="picker-option-copy"><strong>${r(a)}</strong><small>${r(o)}</small></span>
          <span class="picker-option-state" aria-hidden="true">${n?`✓`:`›`}</span>
        </button>`}).join(``)}</div>`,onMount:e=>{let n=e.querySelector(`[data-import-project]`);n&&(n.onclick=()=>{closeModal(),a()}),e.querySelectorAll(`[data-pid]`).forEach(e=>e.onclick=async()=>{let n=t.projects.find(t=>t.id===e.dataset.pid)||null;n&&(t.selectedProject=n,localStorage.setItem(`multichat_project`,n.id),await loadProjects(),await newConversation(),renderTopbar(),renderFileContext(),closeModal())})}})},i(`#agentPicker`).onclick=()=>{if(!t.agents.length){openSettings(`agents`),n(`请先创建运行配置`);return}let i=[{id:``,name:`直接对话`,description:`不注入系统提示词，也不启用工具`}].concat(t.agents.map(e=>({id:e.id,name:e.name,description:e.description})));showModal({title:`选择运行配置`,body:`<div class="picker-dialog-intro"><span>选择本轮使用的提示词与能力组合</span><span>${t.agents.length} 个配置</span></div>
      <div class="model-picker-list">
      ${i.map(e=>{let n=(t.selectedAgent?.id||``)===e.id;return`<button type="button" class="picker-option${n?` active`:``}" data-aid="${r(e.id)}" aria-pressed="${n}">
          <span class="picker-provider-mark agent" aria-hidden="true">${e.id?r(e.name.trim().slice(0,1).toUpperCase()||`A`):`—`}</span>
          <span class="picker-option-copy"><strong>${r(e.name)}</strong><small>${r(e.description||`自定义运行配置`)}</small></span>
          <span class="picker-option-state" aria-hidden="true">${n?`✓`:`›`}</span>
        </button>`}).join(``)}
    </div>`,onMount:n=>{n.querySelectorAll(`[data-aid]`).forEach(n=>{n.onclick=()=>{let r=n.dataset.aid;t.selectedAgent=r?t.agents.find(e=>e.id===r):null,e(),renderTopbar(),closeModal(),t.messages.length||renderContent()}})}})};