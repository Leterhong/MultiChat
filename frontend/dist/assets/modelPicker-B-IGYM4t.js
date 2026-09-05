import{g as e,w as t,x as n}from"./index-Bszfo8RR.js";function r(){if(!e.providers.length){openSettings(`providers`),n(`请先添加模型`);return}let r=[];e.providers.forEach(e=>{let t=e.models||(e.model?[e.model]:[]),n=e.name||e.id,i={pid:e.id,providerName:n,apiType:e.apiType||`openai`,initial:n.trim().slice(0,1).toUpperCase()||`M`};t.length?t.forEach(e=>r.push({...i,model:e,modelLabel:e})):r.push({...i,model:``,modelLabel:`手动输入模型名`,custom:!0})}),showModal({title:`选择模型`,body:`<div class="picker-dialog-intro">
        <span>为接下来的消息选择运行模型</span>
        <span>${r.length} 个可用模型</span>
      </div>
      <div class="model-picker-list">
      ${r.map(n=>{let r=e.selectedProvider?.id===n.pid&&e.selectedModel===n.model;return`<button type="button" class="picker-option${r?` active`:``}" data-pid="${t(n.pid)}" data-model="${t(n.model)}" data-custom="${+!!n.custom}" aria-pressed="${r}">
        <span class="picker-provider-mark" aria-hidden="true">${t(n.initial)}</span>
        <span class="picker-option-copy">
          <strong>${t(n.modelLabel)}</strong>
          <small>${t(n.providerName)} · ${t(n.apiType)}</small>
        </span>
        <span class="picker-option-state" aria-hidden="true">${r?`✓`:`›`}</span>
      </button>`}).join(``)}
      </div>`,onMount:t=>{t.classList.add(`model-picker-modal`),t.querySelectorAll(`.picker-option`).forEach(t=>{t.onclick=async()=>{let n=t.dataset.pid,r=e.providers.find(e=>e.id===n);if(!r)return;let i=t.dataset.model;if(t.dataset.custom===`1`){let e=await showPrompt({title:`自定义模型`,message:`为「${r.name||r.id}」输入模型名称`,label:`模型名称`,placeholder:`例如 deepseek-chat`,maxLength:120});if(!e)return;i=e.trim(),r.models||=[],r.models.includes(i)||r.models.push(i)}e.selectedProvider=r,e.selectedModel=i,localStorage.setItem(`multichat_lastModel`,n+`:`+i),a(),closeModal(),e.messages.length||renderContent()}})}})}function i(t,r){let i=e.providers.find(e=>e.id===t);if(!i||!(i.models||[]).includes(r)){n(`该模型已不可用，请刷新模型列表`,`error`);return}e.selectedProvider=i,e.selectedModel=r,localStorage.setItem(`multichat_lastModel`,`${t}:${r}`),a(),renderContent()}function a(){renderInspector()}function o(){}export{r as openModelPicker,a as renderTopbar,i as selectModel,o as syncModelUI};