import{$ as e,esc as t,saveSelectedAgent as n,state as r,toast as i}from"./core-BWSzA0FL.js";e(`#workspacePicker`).onclick=()=>{let e=r.workspaces.map(e=>({id:e.id,name:e.name,description:e.description}));if(!e.length){openSettings(`workspace`);return}showModal({title:`选择工作区`,body:`<div class="picker-dialog-intro"><span>切换对话与项目所在的工作区</span><span>${e.length} 个工作区</span></div>
      <div class="model-picker-list">${e.map(e=>{let n=r.selectedWorkspace?.id===e.id;return`<button type="button" class="picker-option${n?` active`:``}" data-wid="${t(e.id)}" aria-pressed="${n}">
          <span class="picker-provider-mark" aria-hidden="true">${t(e.name.trim().slice(0,1).toUpperCase()||`W`)}</span>
          <span class="picker-option-copy"><strong>${t(e.name)}</strong><small>${t(e.description||`本地工作区`)}</small></span>
          <span class="picker-option-state" aria-hidden="true">${n?`✓`:`›`}</span>
        </button>`}).join(``)}</div>`,onMount:e=>e.querySelectorAll(`[data-wid]`).forEach(e=>e.onclick=async()=>{r.selectedWorkspace=r.workspaces.find(t=>t.id===e.dataset.wid)||null,await loadProjects(),r.currentConvId=null,r.messages=[],renderTopbar(),renderConvList(),renderContent(),closeModal()})})},e(`#agentPicker`).onclick=()=>{if(!r.agents.length){openSettings(`agents`),i(`请先创建运行配置`);return}let e=[{id:``,name:`直接对话`,description:`不注入系统提示词，也不启用工具`}].concat(r.agents.map(e=>({id:e.id,name:e.name,description:e.description})));showModal({title:`选择运行配置`,body:`<div class="picker-dialog-intro"><span>选择本轮使用的提示词与能力组合</span><span>${r.agents.length} 个配置</span></div>
      <div class="model-picker-list">
      ${e.map(e=>{let n=(r.selectedAgent?.id||``)===e.id;return`<button type="button" class="picker-option${n?` active`:``}" data-aid="${t(e.id)}" aria-pressed="${n}">
          <span class="picker-provider-mark agent" aria-hidden="true">${e.id?t(e.name.trim().slice(0,1).toUpperCase()||`A`):`—`}</span>
          <span class="picker-option-copy"><strong>${t(e.name)}</strong><small>${t(e.description||`自定义运行配置`)}</small></span>
          <span class="picker-option-state" aria-hidden="true">${n?`✓`:`›`}</span>
        </button>`}).join(``)}
    </div>`,onMount:e=>{e.querySelectorAll(`[data-aid]`).forEach(e=>{e.onclick=()=>{let t=e.dataset.aid;r.selectedAgent=t?r.agents.find(e=>e.id===t):null,n(),renderTopbar(),closeModal(),r.messages.length||renderContent()}})}})};