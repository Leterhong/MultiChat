import{d as e,f as t,g as n,m as r,p as i}from"./index-B9CklcdV.js";r(`#workspacePicker`).onclick=()=>{let e=t.workspaces.map(e=>({id:e.id,name:e.name,description:e.description}));if(!e.length){openSettings(`workspace`);return}showModal({title:`选择工作区`,body:`<div class="picker-dialog-intro"><span>切换对话与项目所在的工作区</span><span>${e.length} 个工作区</span></div>
      <div class="model-picker-list">${e.map(e=>{let r=t.selectedWorkspace?.id===e.id;return`<button type="button" class="picker-option${r?` active`:``}" data-wid="${n(e.id)}" aria-pressed="${r}">
          <span class="picker-provider-mark" aria-hidden="true">${n(e.name.trim().slice(0,1).toUpperCase()||`W`)}</span>
          <span class="picker-option-copy"><strong>${n(e.name)}</strong><small>${n(e.description||`本地工作区`)}</small></span>
          <span class="picker-option-state" aria-hidden="true">${r?`✓`:`›`}</span>
        </button>`}).join(``)}</div>`,onMount:e=>e.querySelectorAll(`[data-wid]`).forEach(e=>e.onclick=async()=>{t.selectedWorkspace=t.workspaces.find(t=>t.id===e.dataset.wid)||null,await loadProjects(),t.currentConvId=null,t.messages=[],renderTopbar(),renderConvList(),renderContent(),closeModal()})})},r(`#agentPicker`).onclick=()=>{if(!t.agents.length){openSettings(`agents`),i(`请先创建运行配置`);return}let r=[{id:``,name:`直接对话`,description:`不注入系统提示词，也不启用工具`}].concat(t.agents.map(e=>({id:e.id,name:e.name,description:e.description})));showModal({title:`选择运行配置`,body:`<div class="picker-dialog-intro"><span>选择本轮使用的提示词与能力组合</span><span>${t.agents.length} 个配置</span></div>
      <div class="model-picker-list">
      ${r.map(e=>{let r=(t.selectedAgent?.id||``)===e.id;return`<button type="button" class="picker-option${r?` active`:``}" data-aid="${n(e.id)}" aria-pressed="${r}">
          <span class="picker-provider-mark agent" aria-hidden="true">${e.id?n(e.name.trim().slice(0,1).toUpperCase()||`A`):`—`}</span>
          <span class="picker-option-copy"><strong>${n(e.name)}</strong><small>${n(e.description||`自定义运行配置`)}</small></span>
          <span class="picker-option-state" aria-hidden="true">${r?`✓`:`›`}</span>
        </button>`}).join(``)}
    </div>`,onMount:n=>{n.querySelectorAll(`[data-aid]`).forEach(n=>{n.onclick=()=>{let r=n.dataset.aid;t.selectedAgent=r?t.agents.find(e=>e.id===r):null,e(),renderTopbar(),closeModal(),t.messages.length||renderContent()}})}})};