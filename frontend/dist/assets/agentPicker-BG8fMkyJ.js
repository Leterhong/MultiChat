import{d as e,f as t,h as n,p as r,u as i}from"./index-BaFLGy2p.js";r(`#workspacePicker`).onclick=()=>{let t=e.workspaces.map(e=>({id:e.id,name:e.name,description:e.description}));if(!t.length){openSettings(`workspace`);return}showModal({title:`选择工作区`,body:`<div class="picker-dialog-intro"><span>切换对话与项目所在的工作区</span><span>${t.length} 个工作区</span></div>
      <div class="model-picker-list">${t.map(t=>{let r=e.selectedWorkspace?.id===t.id;return`<button type="button" class="picker-option${r?` active`:``}" data-wid="${n(t.id)}" aria-pressed="${r}">
          <span class="picker-provider-mark" aria-hidden="true">${n(t.name.trim().slice(0,1).toUpperCase()||`W`)}</span>
          <span class="picker-option-copy"><strong>${n(t.name)}</strong><small>${n(t.description||`本地工作区`)}</small></span>
          <span class="picker-option-state" aria-hidden="true">${r?`✓`:`›`}</span>
        </button>`}).join(``)}</div>`,onMount:t=>t.querySelectorAll(`[data-wid]`).forEach(t=>t.onclick=async()=>{e.selectedWorkspace=e.workspaces.find(e=>e.id===t.dataset.wid)||null,await loadProjects(),e.currentConvId=null,e.messages=[],renderTopbar(),renderConvList(),renderContent(),closeModal()})})},r(`#agentPicker`).onclick=()=>{if(!e.agents.length){openSettings(`agents`),t(`请先创建运行配置`);return}let r=[{id:``,name:`直接对话`,description:`不注入系统提示词，也不启用工具`}].concat(e.agents.map(e=>({id:e.id,name:e.name,description:e.description})));showModal({title:`选择运行配置`,body:`<div class="picker-dialog-intro"><span>选择本轮使用的提示词与能力组合</span><span>${e.agents.length} 个配置</span></div>
      <div class="model-picker-list">
      ${r.map(t=>{let r=(e.selectedAgent?.id||``)===t.id;return`<button type="button" class="picker-option${r?` active`:``}" data-aid="${n(t.id)}" aria-pressed="${r}">
          <span class="picker-provider-mark agent" aria-hidden="true">${t.id?n(t.name.trim().slice(0,1).toUpperCase()||`A`):`—`}</span>
          <span class="picker-option-copy"><strong>${n(t.name)}</strong><small>${n(t.description||`自定义运行配置`)}</small></span>
          <span class="picker-option-state" aria-hidden="true">${r?`✓`:`›`}</span>
        </button>`}).join(``)}
    </div>`,onMount:t=>{t.querySelectorAll(`[data-aid]`).forEach(t=>{t.onclick=()=>{let n=t.dataset.aid;e.selectedAgent=n?e.agents.find(e=>e.id===n):null,i(),renderTopbar(),closeModal(),e.messages.length||renderContent()}})}})};