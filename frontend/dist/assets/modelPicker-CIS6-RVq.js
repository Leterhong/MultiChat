import{O as e,T as t,b as n}from"./index-DnocxWzy.js";function r(){if(!n.providers.length){openSettings(`providers`),t(`请先添加模型`);return}let r=[];n.providers.forEach(e=>{let t=e.models||(e.model?[e.model]:[]),n=e.name||e.id,i={pid:e.id,providerName:n,apiType:e.apiType||`openai`,initial:n.trim().slice(0,1).toUpperCase()||`M`};t.length?t.forEach(e=>r.push({...i,model:e,modelLabel:e})):r.push({...i,model:``,modelLabel:`手动输入模型名`,custom:!0})}),showModal({title:`选择模型`,body:`<div class="picker-dialog-intro">
        <span>为接下来的消息选择运行模型</span>
        <span>${r.length} 个可用模型</span>
      </div>
      <div class="model-picker-list">
      ${r.map(t=>{let r=n.selectedProvider?.id===t.pid&&n.selectedModel===t.model;return`<button type="button" class="picker-option${r?` active`:``}" data-pid="${e(t.pid)}" data-model="${e(t.model)}" data-custom="${+!!t.custom}" aria-pressed="${r}">
        <span class="picker-provider-mark" aria-hidden="true">${e(t.initial)}</span>
        <span class="picker-option-copy">
          <strong>${e(t.modelLabel)}</strong>
          <small>${e(t.providerName)} · ${e(t.apiType)}</small>
        </span>
        <span class="picker-option-state" aria-hidden="true">${r?`✓`:`›`}</span>
      </button>`}).join(``)}
      </div>`,onMount:e=>{e.classList.add(`model-picker-modal`),e.querySelectorAll(`.picker-option`).forEach(e=>{e.onclick=async()=>{let t=e.dataset.pid,r=n.providers.find(e=>e.id===t);if(!r)return;let i=e.dataset.model;if(e.dataset.custom===`1`){let e=await showPrompt({title:`自定义模型`,message:`为「${r.name||r.id}」输入模型名称`,label:`模型名称`,placeholder:`例如 deepseek-chat`,maxLength:120});if(!e)return;i=e.trim(),r.models||=[],r.models.includes(i)||r.models.push(i)}n.selectedProvider=r,n.selectedModel=i,localStorage.setItem(`multichat_lastModel`,t+`:`+i),a(),closeModal(),n.messages.length||renderContent()}})}})}function i(e,r){let i=n.providers.find(t=>t.id===e);!i||!(i.models||[]).includes(r)?t(`该模型已不可用，请刷新模型列表`,`error`):(n.selectedProvider=i,n.selectedModel=r,localStorage.setItem(`multichat_lastModel`,`${e}:${r}`),a(),renderContent())}function a(){renderInspector()}function o(){}export{r as openModelPicker,a as renderTopbar,i as selectModel,o as syncModelUI};