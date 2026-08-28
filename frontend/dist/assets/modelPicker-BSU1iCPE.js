import{f as e,g as t,m as n,p as r}from"./index-pV9jFbC9.js";function i(){if(!e.providers.length){openSettings(`providers`),r(`请先添加模型`);return}let n=[];e.providers.forEach(e=>{let t=e.models||(e.model?[e.model]:[]),r=e.name||e.id,i={pid:e.id,providerName:r,apiType:e.apiType||`openai`,initial:r.trim().slice(0,1).toUpperCase()||`M`};t.length?t.forEach(e=>n.push({...i,model:e,modelLabel:e})):n.push({...i,model:``,modelLabel:`手动输入模型名`,custom:!0})}),showModal({title:`选择模型`,body:`<div class="picker-dialog-intro">
        <span>为接下来的消息选择运行模型</span>
        <span>${n.length} 个可用模型</span>
      </div>
      <div class="model-picker-list">
      ${n.map(n=>{let r=e.selectedProvider?.id===n.pid&&e.selectedModel===n.model;return`<button type="button" class="picker-option${r?` active`:``}" data-pid="${t(n.pid)}" data-model="${t(n.model)}" data-custom="${+!!n.custom}" aria-pressed="${r}">
        <span class="picker-provider-mark" aria-hidden="true">${t(n.initial)}</span>
        <span class="picker-option-copy">
          <strong>${t(n.modelLabel)}</strong>
          <small>${t(n.providerName)} · ${t(n.apiType)}</small>
        </span>
        <span class="picker-option-state" aria-hidden="true">${r?`✓`:`›`}</span>
      </button>`}).join(``)}
      </div>`,onMount:t=>{t.classList.add(`model-picker-modal`),t.querySelectorAll(`.picker-option`).forEach(t=>{t.onclick=()=>{let n=t.dataset.pid,r=e.providers.find(e=>e.id===n);if(!r)return;let i=t.dataset.model;if(t.dataset.custom===`1`){let e=prompt(`输入该提供方的模型名称：
（例如 deepseek-chat）`);if(!e)return;i=e.trim(),r.models||=[],r.models.includes(i)||r.models.push(i)}e.selectedProvider=r,e.selectedModel=i,localStorage.setItem(`multichat_lastModel`,n+`:`+i),a(),closeModal(),e.messages.length||renderContent()}})}})}function a(){o();let t=e.selectedAgent;n(`#agentPickerName`).textContent=t?t.name:`直接对话`,n(`#workspacePickerName`).textContent=e.selectedWorkspace?e.selectedWorkspace.name:`工作区`;let r=n(`#topbarPath`);r&&(r.textContent=`${e.selectedWorkspace?.name||`工作区`} / ${e.selectedProject?.name||`未选择项目`}`),renderInspector()}function o(){let t=e.selectedProvider,r=e.selectedModel,a=t&&r?`${t.name||t.id} · ${r}`:`选择模型`;[`#heroModelTag`,`#composerModelTag`].forEach(e=>{let o=n(e);o&&(o.textContent=a,o.title=t&&r?`当前：${t.name||t.id} · ${r}\n点击切换`:`点击选择模型`,o.onclick=i)})}export{i as openModelPicker,a as renderTopbar,o as syncModelUI};