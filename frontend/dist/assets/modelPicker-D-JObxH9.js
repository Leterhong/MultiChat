import{$ as e,esc as t,state as n,toast as r}from"./core-BWSzA0FL.js";function i(){if(!n.providers.length){openSettings(`providers`),r(`请先添加模型`);return}let e=[];n.providers.forEach(t=>{let n=t.models||(t.model?[t.model]:[]),r=t.name||t.id,i={pid:t.id,providerName:r,apiType:t.apiType||`openai`,initial:r.trim().slice(0,1).toUpperCase()||`M`};n.length?n.forEach(t=>e.push({...i,model:t,modelLabel:t})):e.push({...i,model:``,modelLabel:`手动输入模型名`,custom:!0})}),showModal({title:`选择模型`,body:`<div class="picker-dialog-intro">
        <span>为接下来的消息选择运行模型</span>
        <span>${e.length} 个可用模型</span>
      </div>
      <div class="model-picker-list">
      ${e.map(e=>{let r=n.selectedProvider?.id===e.pid&&n.selectedModel===e.model;return`<button type="button" class="picker-option${r?` active`:``}" data-pid="${t(e.pid)}" data-model="${t(e.model)}" data-custom="${+!!e.custom}" aria-pressed="${r}">
        <span class="picker-provider-mark" aria-hidden="true">${t(e.initial)}</span>
        <span class="picker-option-copy">
          <strong>${t(e.modelLabel)}</strong>
          <small>${t(e.providerName)} · ${t(e.apiType)}</small>
        </span>
        <span class="picker-option-state" aria-hidden="true">${r?`✓`:`›`}</span>
      </button>`}).join(``)}
      </div>`,onMount:e=>{e.classList.add(`model-picker-modal`),e.querySelectorAll(`.picker-option`).forEach(e=>{e.onclick=()=>{let t=e.dataset.pid,r=n.providers.find(e=>e.id===t);if(!r)return;let i=e.dataset.model;if(e.dataset.custom===`1`){let e=prompt(`输入该提供方的模型名称：
（例如 deepseek-chat）`);if(!e)return;i=e.trim(),r.models||=[],r.models.includes(i)||r.models.push(i)}n.selectedProvider=r,n.selectedModel=i,localStorage.setItem(`multichat_lastModel`,t+`:`+i),a(),closeModal(),n.messages.length||renderContent()}})}})}function a(){o();let t=n.selectedAgent;e(`#agentPickerName`).textContent=t?t.name:`直接对话`,e(`#workspacePickerName`).textContent=n.selectedWorkspace?n.selectedWorkspace.name:`工作区`;let r=e(`#topbarPath`);r&&(r.textContent=`${n.selectedWorkspace?.name||`工作区`} / ${n.selectedProject?.name||`未选择项目`}`),renderInspector()}function o(){let t=n.selectedProvider,r=n.selectedModel,a=t&&r?`${t.name||t.id} · ${r}`:`选择模型`;[`#heroModelTag`,`#composerModelTag`].forEach(n=>{let o=e(n);o&&(o.textContent=a,o.title=t&&r?`当前：${t.name||t.id} · ${r}\n点击切换`:`点击选择模型`,o.onclick=i)})}export{i as openModelPicker,a as renderTopbar,o as syncModelUI};