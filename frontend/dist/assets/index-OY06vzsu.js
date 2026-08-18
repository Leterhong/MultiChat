(function(){const s=document.createElement("link").relList;if(s&&s.supports&&s.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))o(n);new MutationObserver(n=>{for(const i of n)if(i.type==="childList")for(const r of i.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&o(r)}).observe(document,{childList:!0,subtree:!0});function a(n){const i={};return n.integrity&&(i.integrity=n.integrity),n.referrerPolicy&&(i.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?i.credentials="include":n.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function o(n){if(n.ep)return;n.ep=!0;const i=a(n);fetch(n.href,i)}})();const d=(e,s=document)=>s.querySelector(e),O=(e,s=document)=>Array.from(s.querySelectorAll(e)),c=e=>String(e??"").replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[s]);let te;function p(e,s=""){const a=d("#toast");a&&(a.textContent=e,a.className="toast show"+(s?" "+s:""),clearTimeout(te),te=setTimeout(()=>{a.className="toast"+(s?" "+s:"")},2400))}const U={temperature:.7,max_tokens:2e3,top_p:1};function se(){try{return Object.assign({},U,JSON.parse(localStorage.getItem("multichat_params")||"{}"))}catch{return{...U}}}function D(){localStorage.setItem("multichat_params",JSON.stringify(t.params))}function ae(){try{const e=localStorage.getItem("multichat_lastAgent");if(!e)return;const s=t.agents.find(a=>a.id===e);s&&(t.selectedAgent=s)}catch{}}function N(){t.selectedAgent?localStorage.setItem("multichat_lastAgent",t.selectedAgent.id):localStorage.removeItem("multichat_lastAgent")}const t={providers:[],selectedProvider:null,selectedModel:null,conversations:[],currentConvId:null,messages:[],streaming:!1,abortCtrl:null,apiBase:"",params:se(),runtime:null,runs:[],workspaces:[],projects:[],assets:[],selectedAssetIds:new Set,convSearch:"",selectedWorkspace:null,selectedProject:null,skills:[],agents:[],plugins:[],selectedAgent:null};try{const e=new URLSearchParams(location.search).get("api");e&&(t.apiBase=e.replace(/\/+$/,""))}catch{}async function f(e,s={}){var i;const a=Object.assign({"Content-Type":"application/json"},s.headers||{}),o=await fetch(t.apiBase+e,{...s,headers:a}),n=o.headers.get("content-type")||"";if(!o.ok){let r=`HTTP ${o.status}`;try{const u=await o.json();r=((i=u==null?void 0:u.error)==null?void 0:i.message)||(u==null?void 0:u.message)||r}catch{}const l=new Error(r);throw l.status=o.status,l}return n.includes("application/json")?o.json():o}const Ae=Object.freeze(Object.defineProperty({__proto__:null,$:d,$$:O,DEFAULT_PARAMS:U,api:f,esc:c,loadParams:se,loadSelectedAgent:ae,saveParams:D,saveSelectedAgent:N,state:t,toast:p},Symbol.toStringTag,{value:"Module"}));async function Ce(){await oe()}async function oe(){await Promise.all([loadProviders(),loadConversations(),loadSkills(),loadAgents(),loadPlugins(),loadRuntime(),loadRuns(),loadWorkspaces()]),ae(),renderTopbar(),renderContent(),renderSettings();const e=localStorage.getItem("multichat_lastModel");if(e){const[n,...i]=e.split(":"),r=i.join(":"),l=t.providers.find(u=>u.id===n);l&&(t.selectedProvider=l,t.selectedModel=r,renderTopbar())}if(!t.selectedProvider&&t.providers.length>0){const n=t.providers[0];t.selectedProvider=n,t.selectedModel=n.models&&n.models[0]||n.defaultModel||n.model||"",renderTopbar()}const s=d("#fcMin");s&&(s.onclick=()=>{const n=d("#fileCtxBody");n&&(n.classList.toggle("collapsed"),s.textContent=n.classList.contains("collapsed")?"▸":"▾")}),renderFileContext(),ne();const a=d("#convSearch");a&&(a.oninput=n=>{t.convSearch=n.target.value,renderConvList()});const o=d("#forkBtn");o&&(o.onclick=ie)}function ne(){const e=d("#content");e&&(e.addEventListener("dragover",s=>{s.preventDefault(),e.classList.add("drag-over")}),e.addEventListener("dragleave",s=>{s.target===e&&e.classList.remove("drag-over")}),e.addEventListener("drop",async s=>{s.preventDefault(),e.classList.remove("drag-over");const a=s.dataTransfer&&s.dataTransfer.files;if(!(!a||!a.length)){if(!t.selectedProject){p("请先在右上角选择工作区/项目","error");return}for(const o of Array.from(a)){if(o.size>2e6){p("文件超过 2MB 限制，已跳过："+o.name,"error");continue}try{const n=await o.text(),i=await f("/api/assets",{method:"POST",body:JSON.stringify({projectId:t.selectedProject.id,name:o.name,mimeType:o.type||"text/plain",content:n})});t.assets.unshift(i),t.selectedAssetIds.add(i.id),p("已添加文件："+o.name)}catch(n){p("文件添加失败："+n.message,"error")}}renderFileContext()}}))}async function ie(){var a,o,n,i;const e=t.messages.filter(r=>r.content&&!r.streaming).map(r=>({role:r.role,content:r.content,model:r.model}));if(!e.length){p("当前没有可分支的内容","error");return}const s="分支 · "+(((o=(a=e.find(r=>r.role==="user"))==null?void 0:a.content)==null?void 0:o.slice(0,20))||"新对话");t.currentConvId=null,t.messages=[],d("#topbarTitle").textContent="新对话（分支）",renderContent(),renderConvList();try{const r=await f("/api/conversations",{method:"POST",body:JSON.stringify({title:s,workspaceId:((n=t.selectedWorkspace)==null?void 0:n.id)||null,projectId:((i=t.selectedProject)==null?void 0:i.id)||null})});t.currentConvId=r.id,await f("/api/conversations/"+r.id+"/messages",{method:"POST",body:JSON.stringify(e)}),t.messages=e,d("#topbarTitle").textContent=r.title||"对话",await loadConversations(),renderContent(),renderConvList(),p("已创建分支对话")}catch(r){p("分支失败："+r.message,"error")}}const Te=Object.freeze(Object.defineProperty({__proto__:null,bootstrap:Ce,forkConversation:ie,initApp:oe,setupDrop:ne},Symbol.toStringTag,{value:"Module"}));async function je(){try{t.providers=await f("/api/providers")}catch{t.providers=[]}}async function Ie(){try{t.runtime=await f("/api/runtime")}catch{t.runtime=null}}async function _e(){try{t.runs=await f("/api/runs?limit=40")}catch{t.runs=[]}}async function Oe(){try{t.workspaces=await f("/api/workspaces");const e=localStorage.getItem("multichat_workspace");t.selectedWorkspace=t.workspaces.find(s=>s.id===e)||t.workspaces[0]||null,await le()}catch{t.workspaces=[],t.projects=[]}}async function le(){if(!t.selectedWorkspace){t.projects=[],t.selectedProject=null;return}try{t.projects=await f("/api/projects?workspaceId="+encodeURIComponent(t.selectedWorkspace.id));const e=localStorage.getItem("multichat_project");t.selectedProject=t.projects.find(s=>s.id===e)||t.projects.find(s=>s.id===t.selectedWorkspace.defaultProjectId)||t.projects[0]||null,localStorage.setItem("multichat_workspace",t.selectedWorkspace.id),t.selectedProject&&localStorage.setItem("multichat_project",t.selectedProject.id),t.selectedProject&&(t.assets=await f("/api/assets?projectId="+encodeURIComponent(t.selectedProject.id)),t.selectedAssetIds=new Set(t.assets.map(s=>s.id)),applyProjectDefaults())}catch{t.projects=[],t.selectedProject=null,t.assets=[],t.selectedAssetIds=new Set}}async function Le(){try{t.skills=await f("/api/skills")}catch{t.skills=[]}}async function Ee(){try{t.agents=await f("/api/agents")}catch{t.agents=[]}}async function Be(){try{t.plugins=await f("/api/plugins")}catch{t.plugins=[]}}const Ue=Object.freeze(Object.defineProperty({__proto__:null,loadAgents:Ee,loadPlugins:Be,loadProjects:le,loadProviders:je,loadRuns:_e,loadRuntime:Ie,loadSkills:Le,loadWorkspaces:Oe},Symbol.toStringTag,{value:"Module"}));async function qe(){try{t.conversations=await f("/api/conversations")}catch{t.conversations=[]}B()}function B(){const e=d("#convList"),s=(t.convSearch||"").trim().toLowerCase(),a=s?t.conversations.filter(o=>(o.title||"新对话").toLowerCase().includes(s)):t.conversations;if(!a.length){e.innerHTML='<div style="padding:18px 12px; color:var(--label-caption); font-size:12.5px;">'+(t.conversations.length?"没有匹配的对话":"还没有对话")+"</div>";return}e.innerHTML=a.map(o=>`
    <div class="conv-item ${o.id===t.currentConvId?"active":""}" data-id="${c(o.id)}">
      <span class="conv-dot"></span>
      <span style="overflow:hidden;text-overflow:ellipsis;">${c(o.title||"新对话")}</span>
      <button class="conv-del" data-del="${c(o.id)}" title="删除">×</button>
    </div>
  `).join(""),e.querySelectorAll(".conv-item").forEach(o=>{o.onclick=n=>{n.target.dataset.del||ce(o.dataset.id)}}),e.querySelectorAll(".conv-del").forEach(o=>{o.onclick=async n=>{n.stopPropagation();const i=o.dataset.del;if(confirm("删除该对话？")){try{await f("/api/conversations/"+i,{method:"DELETE"})}catch{}t.conversations=t.conversations.filter(r=>r.id!==i),t.currentConvId===i&&(t.currentConvId=null,t.messages=[],renderContent(),d("#topbarTitle").textContent="新对话"),B()}}})}async function re(){t.currentConvId=null,t.messages=[],d("#topbarTitle").textContent="新对话",renderContent(),B(),d("#input").focus()}d("#newChatBtn").onclick=re;async function ce(e){try{const s=await f("/api/conversations/"+e);(s.workspaceId&&(!t.selectedWorkspace||t.selectedWorkspace.id!==s.workspaceId)||s.projectId&&(!t.selectedProject||t.selectedProject.id!==s.projectId))&&(t.selectedWorkspace=t.workspaces.find(a=>a.id===s.workspaceId)||t.selectedWorkspace,t.selectedWorkspace&&await loadProjects(),s.projectId&&(t.selectedProject=t.projects.find(a=>a.id===s.projectId)||t.selectedProject,t.selectedProject&&(localStorage.setItem("multichat_project",t.selectedProject.id),t.assets=await f("/api/assets?projectId="+encodeURIComponent(t.selectedProject.id)),t.selectedAssetIds=new Set(t.assets.map(a=>a.id))))),t.currentConvId=s.id,t.messages=(s.messages||[]).map(a=>({role:a.role,content:a.content,model:a.model})),d("#topbarTitle").textContent=s.title||"对话",renderTopbar(),renderContent(),B(),q()}catch(s){p("打开对话失败："+s.message,"error")}}function de(e){try{return e<1024?e+" B":e<1024*1024?(e/1024).toFixed(1)+" KB":(e/1024/1024).toFixed(1)+" MB"}catch{return""}}function q(){if(!d("#fileCtx"))return;const s=d("#fileCtxBody");if(!s)return;const a=d("#fcCount");if(a&&(a.textContent=t.selectedAssetIds.size+" / "+t.assets.length+" 个文件作为上下文"),!t.assets.length){s.innerHTML='<div class="fc-empty">当前项目还没有文件。可在「设置 → 工作区」上传，或直接把文件拖到此处。</div>';return}s.innerHTML=t.assets.map(i=>`
    <label class="fc-item">
      <input type="checkbox" class="fc-check" data-id="${c(i.id)}" ${t.selectedAssetIds.has(i.id)?"checked":""}/>
      <span class="fc-name" title="${c(i.name)}">${c(i.name)}</span>
      <span class="fc-meta">${c((i.mimeType||"").split("/").pop())}${i.size?" · "+de(i.size):""}</span>
    </label>
  `).join("")+'<div class="fc-actions"><button class="btn-ghost" id="fcAll">全选</button><button class="btn-ghost" id="fcNone">清空</button></div>',s.querySelectorAll(".fc-check").forEach(i=>{i.onchange=()=>{const r=i.dataset.id;i.checked?t.selectedAssetIds.add(r):t.selectedAssetIds.delete(r),a&&(a.textContent=t.selectedAssetIds.size+" / "+t.assets.length+" 个文件作为上下文")}});const o=d("#fcAll");o&&(o.onclick=()=>{t.assets.forEach(i=>t.selectedAssetIds.add(i.id)),q()});const n=d("#fcNone");n&&(n.onclick=()=>{t.selectedAssetIds.clear(),q()})}function ze(){const e=t.selectedProject;if(e){if(e.defaultAgentId){const s=t.agents.find(a=>a.id===e.defaultAgentId);s&&(t.selectedAgent=s,N())}if(e.defaultProviderId&&e.defaultModel){const s=t.providers.find(a=>a.id===e.defaultProviderId);s&&(t.selectedProvider=s,t.selectedModel=e.defaultModel,localStorage.setItem("multichat_lastModel",s.id+":"+e.defaultModel))}renderTopbar()}}const Ne=Object.freeze(Object.defineProperty({__proto__:null,applyProjectDefaults:ze,fmtSize:de,loadConversations:qe,newConversation:re,openConversation:ce,renderConvList:B,renderFileContext:q},Symbol.toStringTag,{value:"Module"}));function pe(){if(!t.providers.length){openSettings("providers"),p("请先添加模型");return}const e=[];t.providers.forEach(s=>{const a=s.models||(s.model?[s.model]:[]);a.length?a.forEach(o=>e.push({pid:s.id,model:o,label:`${s.name||s.id} · ${o}`})):e.push({pid:s.id,model:"",label:`${s.name||s.id} · （手动输入模型名）`,custom:!0})}),showModal({title:"选择模型",body:`<div style="max-height:420px;overflow:auto;">
      ${e.map(s=>`<div class="settings-tab" data-pid="${c(s.pid)}" data-model="${c(s.model)}" data-custom="${s.custom?1:0}" style="margin-bottom:4px;">
        <span style="font-size:14px;">${c(s.label)}</span>
      </div>`).join("")}
    </div>`,onMount:s=>{s.querySelectorAll(".settings-tab").forEach(a=>{a.onclick=()=>{const o=a.dataset.pid,n=t.providers.find(r=>r.id===o);if(!n)return;let i=a.dataset.model;if(a.dataset.custom==="1"){const r=prompt(`输入该提供方的模型名称：
（例如 deepseek-chat）`);if(!r)return;i=r.trim(),n.models||(n.models=[]),n.models.includes(i)||n.models.push(i)}t.selectedProvider=n,t.selectedModel=i,localStorage.setItem("multichat_lastModel",o+":"+i),ue(),closeModal()}})}})}function ue(){me();const e=t.selectedAgent;d("#agentPickerName").textContent=e?e.name:"无智能体",d("#workspacePickerName").textContent=t.selectedWorkspace?t.selectedWorkspace.name:"工作区"}function me(){const e=t.selectedProvider,s=t.selectedModel,a=e&&s?`${e.name||e.id} · ${s}`:"选择模型";["#heroModelTag","#composerModelTag"].forEach(o=>{const n=d(o);n&&(n.textContent=a,n.title=e&&s?`当前：${e.name||e.id} · ${s}
点击切换`:"点击选择模型",n.onclick=pe)})}const Fe=Object.freeze(Object.defineProperty({__proto__:null,openModelPicker:pe,renderTopbar:ue,syncModelUI:me},Symbol.toStringTag,{value:"Module"}));d("#workspacePicker").onclick=()=>{const e=t.workspaces.map(s=>({id:s.id,name:s.name,description:s.description}));if(!e.length){openSettings("workspace");return}showModal({title:"选择工作区",body:`<div style="max-height:420px;overflow:auto;">${e.map(s=>`<div class="settings-tab" data-wid="${c(s.id)}" style="margin-bottom:4px;display:block;text-align:left;padding:12px;"><div style="font-weight:600;color:var(--label-primary);font-size:14px;">${c(s.name)}</div>${s.description?`<div style="font-size:11.5px;color:var(--label-caption);margin-top:2px;">${c(s.description)}</div>`:""}</div>`).join("")}</div>`,onMount:s=>s.querySelectorAll("[data-wid]").forEach(a=>a.onclick=async()=>{t.selectedWorkspace=t.workspaces.find(o=>o.id===a.dataset.wid)||null,await loadProjects(),t.currentConvId=null,t.messages=[],renderTopbar(),renderConvList(),renderContent(),closeModal()})})};d("#agentPicker").onclick=()=>{if(!t.agents.length){openSettings("agents"),p("请先创建智能体");return}const e=[{id:"",name:"无智能体",description:"直接对话，不注入系统提示词、不提供工具"}].concat(t.agents.map(s=>({id:s.id,name:s.name,description:s.description})));showModal({title:"选择智能体",body:`<div style="max-height:420px;overflow:auto;">
      ${e.map(s=>`<div class="settings-tab" data-aid="${c(s.id)}" style="margin-bottom:4px;display:block;text-align:left;padding:12px;">
        <div style="font-weight:600;color:var(--label-primary);font-size:14px;">${c(s.name)}</div>
        ${s.description?`<div style="font-size:11.5px;color:var(--label-caption);margin-top:2px;">${c(s.description)}</div>`:""}
      </div>`).join("")}
    </div>`,onMount:s=>{s.querySelectorAll("[data-aid]").forEach(a=>{a.onclick=()=>{const o=a.dataset.aid;t.selectedAgent=o?t.agents.find(n=>n.id===o):null,N(),renderTopbar(),closeModal()}})}})};const Re=Object.freeze(Object.defineProperty({__proto__:null},Symbol.toStringTag,{value:"Module"}));d("#settingsBtn").onclick=()=>ge();function ge(e="general"){d("#settings").classList.add("open"),d("#scrim").classList.add("open"),K(e)}function F(){d("#settings").classList.remove("open"),d("#scrim").classList.remove("open")}d("#scrim").onclick=F;d("#closeSettings").onclick=F;d("#closeSettingsTop").onclick=F;O(".settings-tab[data-tab]").forEach(e=>e.onclick=()=>K(e.dataset.tab));function K(e){t.currentTab=e,O(".settings-tab[data-tab]").forEach(s=>s.classList.toggle("active",s.dataset.tab===e)),P(e)}function P(e="general",s=!1){const a=d("#settingsBody"),o=s?a.scrollTop:0;if(e==="general"){const n=t.params;a.innerHTML=`
      <h3>通用设置</h3>
      <p class="lead">模型参数与外观</p>
      <div class="provider-card">
        <h4>模型参数</h4>
        <div class="pmeta">应用于每次对话请求（OpenAI 兼容）</div>
        <div class="field">
          <label>温度 Temperature：<span id="tVal">${n.temperature}</span></label>
          <input type="range" id="pTemp" min="0" max="2" step="0.1" value="${n.temperature}" />
        </div>
        <div class="field">
          <label>最大输出 Token（max_tokens）</label>
          <input type="number" id="pMax" value="${n.max_tokens}" min="1" max="128000" />
        </div>
        <div class="field">
          <label>Top P：<span id="pTopVal">${n.top_p}</span></label>
          <input type="range" id="pTop" min="0" max="1" step="0.05" value="${n.top_p}" />
        </div>
        <div class="provider-row">
          <button class="btn-ghost" id="pReset">重置</button>
          <button class="btn-primary" id="pSave" style="width:auto;padding:8px 18px;">保存</button>
        </div>
      </div>
      <div class="provider-card">
        <h4>外观</h4>
        <div class="pmeta">界面主题</div>
        <div class="field">
          <label>主题</label>
          <select id="themeSel"><option value="light" selected>浅色</option><option value="dark" disabled>深色（敬请期待）</option></select>
        </div>
      </div>
      <div class="provider-card">
        <h4>关于</h4>
        <div class="pmeta">MultiChat · 本地优先<br/>无登录 · 无计费 · 模型接入优先<br/>支持 OpenAI / Anthropic / Ollama / LM Studio 等 OpenAI 兼容协议</div>
      </div>
    `;const i=d("#pTemp"),r=d("#tVal"),l=d("#pTop"),u=d("#pTopVal");i.oninput=()=>{r.textContent=i.value},l.oninput=()=>{u.textContent=l.value},d("#pSave").onclick=()=>{t.params={temperature:parseFloat(i.value),max_tokens:parseInt(d("#pMax").value,10)||2e3,top_p:parseFloat(l.value)},D(),p("已保存")},d("#pReset").onclick=()=>{t.params={...U},D(),P("general",!0),p("已重置")}}else if(e==="workspace"){const n=t.selectedWorkspace,i=t.selectedProject;a.innerHTML=`
      <h3>工作区</h3>
      <p class="lead">按工作区和项目组织会话、文件和 Agent 上下文。文件内容只保存在本地数据目录。</p>
      <div class="provider-card">
        <h4>当前空间</h4>
        <div class="field"><label>工作区</label><select id="workspaceSelect">${t.workspaces.map(l=>`<option value="${c(l.id)}" ${l.id===(n==null?void 0:n.id)?"selected":""}>${c(l.name)}</option>`).join("")}</select></div>
        <div class="field"><label>项目</label><select id="projectSelect">${t.projects.map(l=>`<option value="${c(l.id)}" ${l.id===(i==null?void 0:i.id)?"selected":""}>${c(l.name)}</option>`).join("")}</select></div>
        <div class="field"><label>项目默认智能体</label><select id="projAgentSelect"><option value="">（继承全局）</option>${t.agents.map(l=>`<option value="${c(l.id)}" ${(i==null?void 0:i.defaultAgentId)===l.id?"selected":""}>${c(l.name)}</option>`).join("")}</select></div>
        <div class="field"><label>项目默认模型</label><select id="projModelSelect"><option value="">（继承全局）</option>${t.providers.flatMap(l=>(l.models||[]).map(u=>({pid:l.id,m:u,label:(l.name||l.id)+" · "+u}))).map(l=>`<option value="${c(l.pid+":"+l.m)}" ${(i==null?void 0:i.defaultProviderId)===l.pid&&(i==null?void 0:i.defaultModel)===l.m?"selected":""}>${c(l.label)}</option>`).join("")}</select></div>
        <div class="provider-row"><button class="btn-primary" id="saveProjDefaults" style="width:auto;padding:8px 18px;">保存项目默认</button></div>
        <div class="provider-row"><button class="btn-ghost" id="newWorkspace">新建工作区</button><button class="btn-ghost" id="newProject">新建项目</button></div>
      </div>
      <div class="provider-card">
        <h4>项目文件</h4>
        <div class="pmeta">支持本地文本文件和 URL 文本资源，单个文件最大 2 MB。</div>
        <div class="provider-row" style="margin-top:12px;"><button class="btn-ghost" id="uploadAsset">上传本地文件</button><button class="btn-ghost" id="importAssetUrl">从 URL 添加</button><input type="file" id="assetFileInput" accept=".txt,.md,.json,.csv,.js,.ts,.py,.html,.css,.yaml,.yml" style="display:none" /></div>
        <div class="run-list" style="margin-top:14px;">${t.assets.map(l=>`<div class="run-row"><span class="run-dot completed"></span><div class="run-main"><div class="run-title">${c(l.name)}</div><div class="run-meta">${c(l.mimeType)} · ${c(l.size)} bytes · ${c(l.source)}</div></div><button class="mc-act danger" data-del-asset="${c(l.id)}" title="删除">删除</button></div>`).join("")||'<div style="color:var(--label-caption);font-size:13px;padding:8px 0;">当前项目还没有文件。</div>'}</div>
      </div>
    `,d("#workspaceSelect").onchange=async l=>{t.selectedWorkspace=t.workspaces.find(u=>u.id===l.target.value)||null,await loadProjects(),renderTopbar(),P("workspace",!0),renderFileContext()},d("#projectSelect").onchange=async l=>{t.selectedProject=t.projects.find(u=>u.id===l.target.value)||null,t.selectedProject&&localStorage.setItem("multichat_project",t.selectedProject.id),await loadProjects(),renderTopbar(),P("workspace",!0),renderFileContext()},d("#saveProjDefaults").onclick=async()=>{if(!t.selectedProject){p("请先选择项目","error");return}const l=d("#projAgentSelect").value||null,u=d("#projModelSelect").value||"",[b,...v]=u.split(":"),m=v.join(":");try{await f("/api/projects/"+t.selectedProject.id,{method:"PUT",body:JSON.stringify({defaultAgentId:l,defaultProviderId:b||null,defaultModel:m||null})}),Object.assign(t.selectedProject,{defaultAgentId:l,defaultProviderId:b||null,defaultModel:m||null}),applyProjectDefaults(),p("已保存项目默认")}catch(k){p(k.message,"error")}},d("#newWorkspace").onclick=()=>ve(),d("#newProject").onclick=()=>fe(),d("#importAssetUrl").onclick=()=>he();const r=d("#assetFileInput");d("#uploadAsset").onclick=()=>r.click(),r.onchange=async()=>{var u;const l=(u=r.files)==null?void 0:u[0];if(!(!l||!t.selectedProject)){try{await f("/api/assets",{method:"POST",body:JSON.stringify({projectId:t.selectedProject.id,name:l.name,mimeType:l.type||"text/plain",content:await l.text()})}),await loadProjects(),P("workspace",!0),p("文件已加入项目")}catch(b){p(b.message,"error")}r.value=""}},a.querySelectorAll("[data-del-asset]").forEach(l=>l.onclick=async()=>{try{await f("/api/assets/"+l.dataset.delAsset,{method:"DELETE"}),await loadProjects(),P("workspace",!0)}catch(u){p(u.message,"error")}})}else if(e==="providers")a.innerHTML=`
      <h3>模型</h3>
      <p class="lead">填入各提供方的 API 密钥即可使用其模型。无登录、无计费。</p>
      <div id="providerList">
        ${t.providers.map(n=>`
          <div class="provider-card" data-pid="${c(n.id)}">
            <h4>${c(n.name||n.id)} <span style="color:var(--label-caption);font-weight:400;font-size:12px;">${c(n.id)}</span></h4>
            <div class="pmeta">${c(n.apiType||"openai")} · ${c((n.models||[]).join(", ")||n.model||n.baseUrl||"")}</div>
            <div class="field">
              <label>API 密钥</label>
              <input type="password" data-k="${c(n.id)}" value="${c(n.apiKey||"")}" placeholder="输入 API 密钥" />
            </div>
            <div class="field">
              <label>模型列表</label>
              <textarea data-m="${c(n.id)}" rows="2" placeholder="deepseek-chat, deepseek-reasoner">${c((n.models||[]).join(", "))}</textarea>
              <div style="font-size:11.5px;color:var(--label-caption);margin-top:4px;">逗号或换行分隔；留空则该提供方需在选模型时手动输入。</div>
            </div>
            <div class="provider-row">
              <button class="btn-ghost" data-del="${c(n.id)}">删除</button>
              <button class="btn-primary" data-save="${c(n.id)}" style="width:auto;padding:8px 18px;">保存</button>
            </div>
          </div>
        `).join("")||'<div style="color:var(--label-caption);font-size:13px;padding:8px 0;">还没有添加任何模型，点击下方按钮添加。</div>'}
      </div>
      <div class="add-provider">
        <div class="add-tile" id="addBuiltin"><span class="ico">＋</span>添加提供方</div>
        <div class="add-tile" id="addCustom"><span class="ico">＋</span>添加自定义提供方</div>
      </div>
    `,a.querySelectorAll("[data-save]").forEach(n=>n.onclick=async()=>{const i=n.dataset.save,r=a.querySelector(`[data-k="${i}"]`).value,l=(a.querySelector(`[data-m="${i}"]`).value||"").split(/[,\n]/).map(u=>u.trim()).filter(Boolean);try{await f("/api/providers/"+i,{method:"PUT",body:JSON.stringify({apiKey:r,models:l})}),p("已保存"),await loadProviders(),P("providers",!0),renderTopbar()}catch(u){p(u.message,"error")}}),a.querySelectorAll("[data-del]").forEach(n=>n.onclick=async()=>{const i=n.dataset.del;if(confirm("删除该模型？")){try{await f("/api/providers/"+i,{method:"DELETE"})}catch(r){p(r.message,"error");return}await loadProviders(),P("providers",!0),renderTopbar()}}),d("#addBuiltin").onclick=()=>showAddBuiltin(),d("#addCustom").onclick=()=>showAddCustom();else if(e==="agents"){const n=t.agents;a.innerHTML=`
      <h3>智能体</h3>
      <p class="lead">智能体 = 系统提示词 + 关联技能。点击卡片可编辑；对话中启用后，LLM 会按系统提示词输出并调用已启用工具。</p>
      ${importBarHTML()}
      <div class="card-grid">
        ${n.map(i=>{const r=t.selectedAgent&&t.selectedAgent.id===i.id,l=i.skillIds||[];return`
          <div class="mc-card" data-aid="${c(i.id)}">
            <div class="mc-top">
              <div class="mc-ico"><svg viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="11" rx="2.5"/><path d="M12 8V5M9 3h6M9 13h.01M15 13h.01M9.5 16h5"/></svg></div>
              <div style="min-width:0;flex:1;">
                <div class="mc-title">${c(i.name)}</div>
                <div class="mc-sub">${c(i.id)}</div>
              </div>
              ${r?'<span class="mc-tag on">使用中</span>':""}
            </div>
            <div class="mc-desc">${c(i.description||"（暂无描述）")}</div>
            <div class="mc-tags">
              <span class="mc-tag">${l.length} 个技能</span>
              ${l.slice(0,3).map(u=>`<span class="mc-tag">${c(u)}</span>`).join("")}
              ${l.length>3?`<span class="mc-tag">+${l.length-3}</span>`:""}
            </div>
            <div class="mc-actions">
              <button class="mc-act" data-export-a="${c(i.id)}" title="导出">${EXPORT_ICON}</button>
              <button class="mc-act" data-edit-a="${c(i.id)}" title="编辑"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
              <button class="mc-act danger" data-del-a="${c(i.id)}" title="删除"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg></button>
            </div>
          </div>`}).join("")}
        <div class="mc-add" id="addAgent"><span class="plus">＋</span><span class="plus-t">新建智能体</span></div>
      </div>
    `,a.querySelectorAll(".mc-card[data-aid]").forEach(i=>i.onclick=()=>showAgentModal(i.dataset.aid)),a.querySelectorAll("[data-edit-a]").forEach(i=>i.onclick=r=>{r.stopPropagation(),showAgentModal(i.dataset.editA)}),a.querySelectorAll("[data-export-a]").forEach(i=>i.onclick=r=>{r.stopPropagation();const l=t.agents.find(u=>u.id===i.dataset.exportA);l&&exportEntity(l,"agent")}),a.querySelectorAll("[data-del-a]").forEach(i=>i.onclick=async r=>{r.stopPropagation();const l=i.dataset.delA;if(confirm("删除该智能体？")){try{await f("/api/agents/"+l,{method:"DELETE"})}catch(u){p(u.message,"error");return}t.selectedAgent&&t.selectedAgent.id===l&&(t.selectedAgent=null),N(),await loadAgents(),P(t.currentTab||"agents",!0),renderTopbar()}}),d("#addAgent").onclick=()=>showAgentModal(null),wireImportBar()}else if(e==="skills"){const n=l=>({datetime:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',calculator:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15v3M8 18h4"/>',web_fetch:'<path d="M12 3v11M8 10l4 4 4-4M4 20h16"/>',web_search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>',prompt:'<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>'})[l]||'<circle cx="12" cy="12" r="9"/>',i='<svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',r='<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>';a.innerHTML=`
      <h3>技能</h3>
      <p class="lead">技能是可被智能体调用的工具 / 提示片段。工具类（时间 / 计算 / 抓取 / 搜索）与提示类（注入系统提示）均为内置能力，可在此启停。</p>
      ${importBarHTML()}
      <div class="card-grid">
        ${t.skills.map(l=>{var u;return`
          <div class="mc-card" data-sid="${c(l.id)}">
            <div class="mc-top">
              <div class="mc-ico"><svg viewBox="0 0 24 24">${n(l.type)}</svg></div>
              <div style="min-width:0;flex:1;">
                <div class="mc-title">${c(l.name)}</div>
                <div class="mc-sub">${c(l.id)}</div>
              </div>
            </div>
            <div class="mc-desc">${c(l.description||"（暂无描述）")}</div>
            <div class="mc-tags">
              <span class="mc-tag ${l.enabled?"on":""}">${c(l.type)}</span>
              <span class="mc-tag">${l.enabled?"已启用":"已停用"}</span>
              ${(u=l.permissions)!=null&&u.length?`<span class="mc-tag">权限：${c(l.permissions.join(" / "))}</span>`:""}
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:auto;padding-top:6px;">
              <span class="mc-toggle ${l.enabled?"on":""}" data-toggle-s="${c(l.id)}"><span class="mc-switch"></span><span>${l.enabled?"启用中":"已停用"}</span></span>
            <div class="mc-actions" style="opacity:1;position:static;">
              <button class="mc-act" data-export-s="${c(l.id)}" title="导出">${EXPORT_ICON}</button>
              ${l.type==="prompt"?`<button class="mc-act" data-edit-s="${c(l.id)}" title="编辑">${i}</button>`:""}
              <button class="mc-act danger" data-del-s="${c(l.id)}" title="删除">${r}</button>
            </div>
            </div>
          </div>`}).join("")}
        <div class="mc-add" id="addSkill"><span class="plus">＋</span><span class="plus-t">新建技能</span></div>
      </div>
    `,a.querySelectorAll("[data-toggle-s]").forEach(l=>l.onclick=async u=>{u.stopPropagation();const b=l.dataset.toggleS,v=t.skills.find($=>$.id===b);if(!v)return;const m=!v.enabled,k=l.closest(".mc-card"),T=$=>{l.classList.toggle("on",$);const A=l.querySelector("span:last-child");if(A&&(A.textContent=$?"启用中":"已停用"),k){const x=k.querySelectorAll(".mc-tag");x[0]&&x[0].classList.toggle("on",$),x[1]&&(x[1].textContent=$?"已启用":"已停用")}};v.enabled=m,T(m);try{const $={enabled:m};v.type==="prompt"&&v.config&&($.config=v.config),await f("/api/skills/"+b,{method:"PUT",body:JSON.stringify($)})}catch($){v.enabled=!m,T(!m),p($.message,"error")}}),a.querySelectorAll("[data-edit-s]").forEach(l=>l.onclick=u=>{u.stopPropagation(),showSkillModal(l.dataset.editS)}),a.querySelectorAll("[data-export-s]").forEach(l=>l.onclick=u=>{u.stopPropagation();const b=t.skills.find(v=>v.id===l.dataset.exportS);b&&exportEntity(b,"skill")}),a.querySelectorAll("[data-del-s]").forEach(l=>l.onclick=async u=>{if(u.stopPropagation(),!!confirm("删除该技能？关联智能体的引用也将被移除。")){try{await f("/api/skills/"+l.dataset.delS,{method:"DELETE"})}catch(b){p(b.message,"error");return}await loadSkills(),await loadAgents(),P(t.currentTab||"skills",!0)}}),a.querySelectorAll(".mc-card[data-sid]").forEach(l=>l.onclick=()=>showSkillModal(l.dataset.sid)),d("#addSkill").onclick=()=>showSkillModal(null),wireImportBar()}else e==="plugins"?renderPlugins():e==="runs"&&be();s&&(a.scrollTop=Math.min(o,Math.max(0,a.scrollHeight-a.clientHeight)))}function ve(){showModal({title:"新建工作区",body:'<form id="workspaceForm"><div class="field"><label>名称</label><input name="name" required placeholder="例如：产品研发" /></div><div class="field"><label>描述</label><input name="description" placeholder="这个工作区用于什么" /></div><div class="row"><button type="button" class="btn-ghost" id="workspaceCancel">取消</button><button class="btn-primary" type="submit">创建</button></div></form>',onMount:e=>{d("#workspaceCancel",e).onclick=closeModal,d("#workspaceForm",e).onsubmit=async s=>{s.preventDefault();const a=Object.fromEntries(new FormData(s.target).entries());try{await f("/api/workspaces",{method:"POST",body:JSON.stringify(a)}),await loadWorkspaces(),renderTopbar(),P("workspace"),closeModal(),p("工作区已创建")}catch(o){p(o.message,"error")}}}})}function fe(){if(!t.selectedWorkspace)return p("请先选择工作区","error");showModal({title:"新建项目",body:'<form id="projectForm"><div class="field"><label>名称</label><input name="name" required placeholder="例如：移动端重构" /></div><div class="field"><label>描述</label><input name="description" placeholder="项目目标或范围" /></div><div class="row"><button type="button" class="btn-ghost" id="projectCancel">取消</button><button class="btn-primary" type="submit">创建</button></div></form>',onMount:e=>{d("#projectCancel",e).onclick=closeModal,d("#projectForm",e).onsubmit=async s=>{s.preventDefault();const a=Object.fromEntries(new FormData(s.target).entries());a.workspaceId=t.selectedWorkspace.id;try{await f("/api/projects",{method:"POST",body:JSON.stringify(a)}),await loadProjects(),P("workspace"),closeModal(),p("项目已创建")}catch(o){p(o.message,"error")}}}})}function he(){if(!t.selectedProject)return p("请先选择项目","error");showModal({title:"从 URL 添加文件",body:'<form id="assetUrlForm"><div class="field"><label>URL</label><input name="url" type="url" required placeholder="https://example.com/notes.md" /></div><div class="field"><label>显示名称（可选）</label><input name="name" placeholder="自动从 URL 推断" /></div><div id="assetUrlErr" class="auth-error"></div><div class="row"><button type="button" class="btn-ghost" id="assetUrlCancel">取消</button><button class="btn-primary" type="submit">添加</button></div></form>',onMount:e=>{d("#assetUrlCancel",e).onclick=closeModal,d("#assetUrlForm",e).onsubmit=async s=>{s.preventDefault();const a=Object.fromEntries(new FormData(s.target).entries());a.projectId=t.selectedProject.id;try{await f("/api/assets",{method:"POST",body:JSON.stringify(a)}),await loadProjects(),P("workspace"),closeModal(),p("远程文件已加入项目")}catch(o){d("#assetUrlErr",e).textContent=o.message}}}})}function be(){const e=d("#settingsBody"),s=t.runs||[];e.innerHTML=`
    <h3>运行记录</h3>
    <p class="lead">查看智能体每次运行的状态、步骤和工具调用，便于复盘失败原因。</p>
    <div class="provider-row" style="margin-bottom:14px;"><button class="btn-ghost" id="refreshRuns">刷新</button><span class="pmeta">保留最近 ${s.length} 条记录</span></div>
    <div class="run-list">
      ${s.map(a=>`
        <div class="run-row">
          <span class="run-dot ${c(a.status||"")}"></span>
          <div class="run-main"><div class="run-title">${c(a.agentName||a.agentId||"智能体运行")}</div><div class="run-meta">${c(a.model||"未指定模型")} · ${c(a.steps||0)} 步 · ${c(a.toolCalls||0)} 次工具调用 · ${c(a.startedAt||"")}</div></div>
          <span class="run-status">${a.status==="completed"?"已完成":a.status==="error"?"失败":"进行中"}</span>
        </div>`).join("")||'<div style="color:var(--label-caption);font-size:13px;padding:8px 0;">还没有 Agent 运行记录。</div>'}
    </div>`,d("#refreshRuns").onclick=async()=>{await loadRuns(),P("runs",!0)}}const De=Object.freeze(Object.defineProperty({__proto__:null,closeSettings:F,openSettings:ge,renderRuns:be,renderSettings:P,showAssetUrlModal:he,showProjectForm:fe,showWorkspaceForm:ve,switchSettingsTab:K},Symbol.toStringTag,{value:"Module"})),W={mcp:'<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12l8.73-5.04M12 22V12"/>',bundle:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>'},We='<svg viewBox="0 0 24 24"><path d="M12 3v12M8 11l4 4 4-4M5 21h14"/></svg>';function Je(){const e=d("#settingsBody"),s=t.plugins||[];e.innerHTML=`
    <h3>插件 / 扩展</h3>
    <p class="lead">插件是打包好的能力合集，可一键安装 / 卸载、启用 / 停用。两类：<b>本地合集</b>（内置技能 + 智能体）与 <b>MCP 连接器</b>（通过标准 MCP 协议接入外部工具，如读取本地文件、调用 API）。安装后其技能会出现在「技能」页、智能体出现在「智能体」页，并能被其它智能体引用。</p>
    <div class="card-grid">
      ${s.map(a=>`
        <div class="mc-card" data-pid="${c(a.id)}">
          <div class="mc-top">
            <div class="mc-ico"><svg viewBox="0 0 24 24">${W[a.type]||W.bundle}</svg></div>
            <div style="min-width:0;flex:1;">
              <div class="mc-title">${c(a.name)}</div>
              <div class="mc-sub">v${c(a.version||"1.0.0")} · ${c(a.author||"")}</div>
            </div>
            <span class="mc-tag ${a.type==="mcp"?"mcp":"bundle"}">${a.type==="mcp"?"MCP 连接器":"本地合集"}</span>
          </div>
          <div class="mc-desc">${c(a.description||"")}</div>
          <div class="mc-tags">
            <span class="mc-tag">${a.skillCount} 技能</span>
            <span class="mc-tag">${a.agentCount} 智能体</span>
            ${a.installed?'<span class="mc-tag on">已安装</span>':""}
          </div>
          <div class="mc-actions" style="opacity:1;position:static;justify-content:flex-start;gap:10px;">
            ${a.installed?`<button class="mc-act wide" data-uninstall="${c(a.id)}">卸载</button>
                 <span class="mc-toggle ${a.enabled?"on":""}" data-plug-toggle="${c(a.id)}"><span class="mc-switch"></span><span>${a.enabled?"已启用":"已停用"}</span></span>`:`<button class="mc-act wide primary" data-install="${c(a.id)}">安装</button>`}
          </div>
        </div>`).join("")||'<div style="color:var(--label-caption);font-size:13px;padding:8px 0;">暂无可用插件。把插件的 manifest.json 放到后端 backend/plugins/&lt;目录&gt;/ 即可在此出现。</div>'}
    </div>
  `,e.querySelectorAll("[data-install]").forEach(a=>a.onclick=async()=>{const o=a.dataset.install;try{const n=await f("/api/plugins/"+o+"/install",{method:"POST"});await loadPlugins(),await loadSkills(),await loadAgents(),renderSettings("plugins",!0),renderTopbar(),p("已安装："+o+(n.agents?`（+${n.skills} 技能 / +${n.agents} 智能体）`:""))}catch(n){p(n.message,"error")}}),e.querySelectorAll("[data-uninstall]").forEach(a=>a.onclick=async()=>{const o=a.dataset.uninstall;if(confirm("卸载该插件？其技能与智能体将从本地移除（不影响你自己新建的）。"))try{await f("/api/plugins/"+o+"/uninstall",{method:"POST"}),await loadPlugins(),await loadSkills(),await loadAgents(),renderSettings("plugins",!0),renderTopbar(),p("已卸载："+o)}catch(n){p(n.message,"error")}}),e.querySelectorAll("[data-plug-toggle]").forEach(a=>a.onclick=async o=>{o.stopPropagation();const n=a.dataset.plugToggle,i=(t.plugins||[]).find(l=>l.id===n),r=!(i&&i.enabled);try{await f("/api/plugins/"+n+"/toggle",{method:"POST",body:JSON.stringify({enabled:r})}),await loadPlugins(),await loadSkills(),renderSettings("plugins",!0),p(r?"已启用":"已停用")}catch(l){p(l.message,"error")}})}const He=Object.freeze(Object.defineProperty({__proto__:null,EXPORT_ICON:We,PLUGIN_ICON:W,renderPlugins:Je},Symbol.toStringTag,{value:"Module"}));function Ke(){return`
    <div class="import-bar">
      <span class="import-bar-label">导入 / 引用</span>
      <button class="mini-btn" id="importFile">上传文件 (.json)</button>
      <button class="mini-btn" id="importUrl">URL 导入</button>
      <button class="mini-btn" id="gotoPlugins">从插件市场</button>
      <input type="file" id="importFileInput" accept=".json,application/json" style="display:none" />
    </div>`}async function R(e,s){try{const a=e.url?{url:e.url,source:s}:e,o=await f("/api/import",{method:"POST",body:JSON.stringify(a)});return await loadSkills(),await loadAgents(),renderSettings(t.currentTab||(e.agents&&!e.skills?"agents":"skills"),!0),renderTopbar(),o.plugin?p(`已安装插件：${o.plugin.name}（+${o.skills} 技能 / +${o.agents} 智能体，来源：${s}）`):p(`已导入：+${o.skills} 技能 / +${o.agents} 智能体（来源：${s}）`),o}catch(a){throw p(a.message,"error"),a}}function ye(e){return Array.isArray(e)?{skills:e}:e&&(e.skills||e.agents)?e:e&&e.id&&e.systemPrompt!==void 0?{agents:[e]}:e&&e.id?{skills:[e]}:e}function Ve(){const e=d("#settingsBody"),s=e.querySelector("#importFile"),a=e.querySelector("#importFileInput"),o=e.querySelector("#importUrl"),n=e.querySelector("#gotoPlugins");s&&a&&(s.onclick=()=>a.click(),a.onchange=async()=>{const i=a.files&&a.files[0];if(i){try{const r=await i.text(),l=JSON.parse(r);await R(ye(l),"文件 "+i.name)}catch(r){p("解析失败："+r.message,"error")}a.value=""}}),o&&(o.onclick=()=>V()),n&&(n.onclick=()=>ke())}function ke(){const e=[{key:"skills",icon:"🧩",title:"技能包",url:"/marketplace/skills.json",desc:"社区策展的提示词型技能：专业翻译 / 代码解释 / 长文总结 / SQL 助手。"},{key:"agents",icon:"🤖",title:"智能体包",url:"/marketplace/agents.json",desc:"社区策展的智能体：小红书文案 / 代码审查 / 旅行规划。"},{key:"plugins",icon:"🔌",title:"插件包",url:"/marketplace/plugins.json",desc:"效率合集插件（bundle）：周报 / 会议纪要 / 简历优化 + 全能写作助手。"}];showModal({title:"从市场导入",body:`
      <p class="lead" style="margin-bottom:12px;">挑一个来源一键导入；也可粘贴任意外部 URL（技能/智能体包或插件清单）。</p>
      <div id="mkList">
        ${e.map(s=>`
          <div class="mk-card" data-url="${c(s.url)}" data-title="${c(s.title)}">
            <div class="mk-ico">${s.icon}</div>
            <div class="mk-body">
              <div class="mk-title">${c(s.title)}</div>
              <div class="mk-desc">${c(s.desc)}</div>
              <div class="mk-url">${c(s.url)}</div>
            </div>
            <button class="btn-primary mk-import" style="width:auto;padding:8px 14px;">导入</button>
          </div>`).join("")}
      </div>
      <div class="mk-divider"><span>或</span></div>
      <div class="row">
        <button type="button" class="btn-ghost" id="mkPaste">粘贴外部 URL 导入</button>
      </div>
      <div id="mkErr" class="auth-error"></div>`,onMount:s=>{s.querySelectorAll(".mk-card").forEach(a=>{a.querySelector(".mk-import").onclick=async()=>{const o=a.dataset.url,n=a.dataset.title;try{await R({url:o},"市场·"+n),closeModal()}catch(i){d("#mkErr",s).textContent=i.message}}}),d("#mkPaste",s).onclick=()=>{closeModal(),V()}}})}function V(){showModal({title:"从 URL 导入",body:`<form id="urlImportForm">
      <p class="lead" style="margin-bottom:10px;">粘贴一个返回技能 / 智能体 / 插件清单 JSON 的链接。抓取由后端完成，无需对方允许跨域。</p>
      <div class="field"><label>URL</label><input name="url" placeholder="https://example.com/my-pack.json" required /></div>
      <div class="field"><label>来源标记（可选）</label><input name="source" placeholder="my-repo" /></div>
      <div id="urlErr" class="auth-error"></div>
      <div class="row">
        <button type="button" class="btn-ghost" id="urlCancel">取消</button>
        <button type="submit" class="btn-primary" style="width:auto;padding:9px 18px;">导入</button>
      </div>
    </form>`,onMount:e=>{d("#urlCancel",e).onclick=closeModal,d("#urlImportForm",e).onsubmit=async s=>{s.preventDefault();const a=(new FormData(s.target).get("url")||"").toString().trim(),o=(new FormData(s.target).get("source")||"").toString().trim()||"url";if(!a)return;const n=d("#urlErr",e);n.textContent="";try{await R({url:a},o),closeModal()}catch(i){n.textContent="导入失败："+i.message}}}})}function Qe(e,s){const a=new Blob([JSON.stringify(e,null,2)],{type:"application/json"}),o=document.createElement("a");o.href=URL.createObjectURL(a),o.download=(e.id||s)+".json",document.body.appendChild(o),o.click(),o.remove(),setTimeout(()=>URL.revokeObjectURL(o.href),1e3),p("已导出："+(e.name||e.id))}function Ge(e){const s=!!e,a=s?t.agents.find(o=>o.id===e):null;showModal({title:s?"编辑智能体":"新建智能体",body:`<form id="agentForm">
      <div class="field"><label>名称</label><input name="name" value="${a?c(a.name):""}" placeholder="中英翻译" required /></div>
      <div class="field"><label>描述</label><input name="description" value="${a?c(a.description||""):""}" placeholder="一句话描述这个智能体做什么" /></div>
      <div class="field"><label>系统提示词</label><textarea name="systemPrompt" rows="4" placeholder="你是一个...">${a?c(a.systemPrompt||""):""}</textarea></div>
      <div class="field"><label>关联技能（多选 · 仅工具类会暴露给 LLM）</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">
          ${t.skills.map(o=>{const n=a&&(a.skillIds||[]).includes(o.id)?"checked":"";return`<label style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border:1px solid var(--border-l2);border-radius:8px;font-size:12.5px;cursor:pointer;background:${n?"var(--bg-hover)":"var(--bg-elevated)"};">
              <input type="checkbox" name="skill" value="${c(o.id)}" ${n} /> ${c(o.name)}
            </label>`}).join("")}
        </div>
      </div>
      <div id="agentErr" class="auth-error"></div>
      <div class="row">
        <button type="button" class="btn-ghost" id="agentCancel">取消</button>
        <button type="submit" class="btn-primary" style="width:auto;padding:9px 18px;">${s?"保存":"创建"}</button>
      </div>
    </form>`,onMount:o=>{d("#agentCancel",o).onclick=closeModal,d("#agentForm",o).onsubmit=async n=>{n.preventDefault();const i=new FormData(n.target),r=Object.fromEntries(i.entries());r.name&&(r.name=r.name.trim()),r.description&&(r.description=r.description.trim()),r.skillIds=Array.from(n.target.querySelectorAll('input[name="skill"]:checked')).map(l=>l.value);try{s?(await f("/api/agents/"+e,{method:"PUT",body:JSON.stringify(r)}),p("已保存")):(await f("/api/agents",{method:"POST",body:JSON.stringify(r)}),p("已创建")),await loadAgents(),renderSettings(t.currentTab||"agents",!0),renderTopbar(),closeModal()}catch(l){d("#agentErr",o).textContent=l.message}}}})}function Xe(e){const s=!!e,a=s?t.skills.find(o=>o.id===e):null;showModal({title:s?"编辑技能":"新建技能（提示片段）",body:`<form id="skillForm">
      <div class="field"><label>技能 ID</label><input name="id" value="${a?c(a.id):""}" placeholder="my_skill" required pattern="[-a-zA-Z0-9_]+" ${s?"readonly":""} />
        <div style="font-size:11.5px;color:var(--label-caption);margin-top:4px;">小写字母、数字、下划线或连字符。</div></div>
      <div class="field"><label>显示名称</label><input name="name" value="${a?c(a.name):""}" placeholder="我的技能" required /></div>
      <div class="field"><label>描述</label><input name="description" value="${a?c(a.description||""):""}" placeholder="一句话说明" /></div>
      <div class="field"><label>类型</label><select name="type" ${s?"disabled":""}><option value="prompt" selected>prompt（注入系统提示）</option></select>
        <div style="font-size:11.5px;color:var(--label-caption);margin-top:4px;">目前仅开放 prompt 类型。工具类技能（时间/计算/抓取/搜索）请用内置的或扩展后端。</div></div>
      <div class="field"><label>提示内容</label><textarea name="prompt" rows="4" placeholder="注入到 system prompt 的文本...">${a&&a.config?c(a.config.prompt||""):""}</textarea></div>
      <div id="skillErr" class="auth-error"></div>
      <div class="row">
        <button type="button" class="btn-ghost" id="skillCancel">取消</button>
        <button type="submit" class="btn-primary" style="width:auto;padding:9px 18px;">${s?"保存":"创建"}</button>
      </div>
    </form>`,onMount:o=>{d("#skillCancel",o).onclick=closeModal,d("#skillForm",o).onsubmit=async n=>{n.preventDefault();const i=new FormData(n.target),r=Object.fromEntries(i.entries());r.id&&(r.id=r.id.trim()),r.name&&(r.name=r.name.trim()),r.description&&(r.description=r.description.trim()),r.config={prompt:r.prompt||""},delete r.prompt;try{if(s){const{id:l,type:u,...b}=r;await f("/api/skills/"+e,{method:"PUT",body:JSON.stringify(b)}),p("已保存")}else await f("/api/skills",{method:"POST",body:JSON.stringify(r)}),p("已创建");await loadSkills(),renderSettings(t.currentTab||"skills",!0),closeModal()}catch(l){d("#skillErr",o).textContent=l.message}}}})}const J=[{id:"openai",name:"OpenAI",apiType:"openai",baseUrl:"https://api.openai.com/v1",models:["gpt-4o","gpt-4o-mini","gpt-4-turbo"]},{id:"deepseek",name:"DeepSeek",apiType:"openai",baseUrl:"https://api.deepseek.com/v1",models:["deepseek-chat","deepseek-reasoner"]},{id:"anthropic",name:"Anthropic",apiType:"anthropic",baseUrl:"https://api.anthropic.com/v1",models:["claude-3-5-sonnet-latest","claude-3-opus-latest","claude-3-haiku-latest"]},{id:"gemini",name:"Google Gemini",apiType:"openai",baseUrl:"https://generativelanguage.googleapis.com/v1beta/openai",models:["gemini-1.5-pro","gemini-1.5-flash","gemini-2.0-flash"]},{id:"moonshot",name:"月之暗面 Kimi",apiType:"openai",baseUrl:"https://api.moonshot.cn/v1",models:["moonshot-v1-8k","moonshot-v1-32k","moonshot-v1-128k"]},{id:"zhipu",name:"智谱 GLM",apiType:"zhipu",baseUrl:"https://open.bigmodel.cn/api/paas/v4",models:["glm-4-plus","glm-4","glm-4-air"]},{id:"dashscope",name:"阿里云 DashScope",apiType:"openai",baseUrl:"https://dashscope.aliyuncs.com/compatible-mode/v1",models:["qwen-max","qwen-plus","qwen-turbo"]},{id:"ollama",name:"Ollama (本地)",apiType:"ollama",baseUrl:"http://localhost:11434/v1",models:[]},{id:"lmstudio",name:"LM Studio (本地)",apiType:"lmstudio",baseUrl:"http://localhost:1234/v1",models:[]},{id:"siliconflow",name:"硅基流动 SiliconFlow (注册送额度)",apiType:"openai",baseUrl:"https://api.siliconflow.cn/v1",models:["Qwen/Qwen2.5-72B-Instruct","deepseek-ai/DeepSeek-V3","Qwen/Qwen2.5-7B-Instruct"]}];function Ze(){showModal({title:"添加提供方",body:`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      ${J.map(e=>`<button class="add-tile" data-id="${e.id}" style="text-align:left;padding:14px;">
        <div style="font-weight:600;color:var(--label-primary);">${e.name}</div>
        <div style="font-size:11.5px;color:var(--label-caption);margin-top:2px;">${e.apiType} · ${e.baseUrl}</div>
      </button>`).join("")}
    </div>`,onMount:e=>{e.querySelectorAll("[data-id]").forEach(s=>s.onclick=async()=>{const a=J.find(o=>o.id===s.dataset.id);try{await f("/api/providers",{method:"POST",body:JSON.stringify(a)}),await loadProviders(),renderSettings("providers",!0),closeModal(),p("已添加："+a.name)}catch(o){p(o.message,"error")}})}})}function Ye(){showModal({title:"自定义提供方",body:`<form id="customForm">
      <div class="field"><label>Provider ID</label><input name="id" placeholder="acme-gateway" required pattern="[-a-zA-Z0-9_]+" />
        <div style="font-size:11.5px;color:var(--label-caption);margin-top:4px;">小写字母、数字、下划线或连字符，唯一标识该提供方。</div></div>
      <div class="field"><label>模型列表</label><textarea name="models" rows="2" placeholder="deepseek-chat, deepseek-reasoner"></textarea>
        <div style="font-size:11.5px;color:var(--label-caption);margin-top:4px;">逗号或换行分隔；如不确定可留空，稍后在模型卡片中补充。</div></div>
      <div class="field"><label>显示名称</label><input name="name" placeholder="显示名称" /></div>
      <div class="field"><label>API 地址</label><input name="baseUrl" placeholder="https://gateway.example/v1" required /></div>
      <div class="field"><label>API 协议</label><select name="apiType">
        <option value="openai">openai-completions</option>
        <option value="anthropic">anthropic-messages</option>
        <option value="ollama">ollama</option>
        <option value="lmstudio">lmstudio</option>
      </select></div>
      <div class="field"><label>API 密钥</label><input name="apiKey" type="password" placeholder="输入 API 密钥" /></div>
      <div id="customErr" class="auth-error"></div>
      <div class="row">
        <button type="button" class="btn-ghost" id="customCancel">取消</button>
        <button type="submit" class="btn-primary" style="width:auto;padding:9px 18px;">保存</button>
      </div>
    </form>`,onMount:e=>{d("#customCancel",e).onclick=closeModal,d("#customForm",e).onsubmit=async s=>{s.preventDefault();const a=new FormData(s.target),o=Object.fromEntries(a.entries()),n=(o.models||"").toString();o.models=n.split(/[,\n]/).map(i=>i.trim()).filter(Boolean),o.id&&(o.id=o.id.trim()),o.name&&(o.name=o.name.trim());try{await f("/api/providers",{method:"POST",body:JSON.stringify(o)}),await loadProviders(),renderSettings("providers",!0),closeModal(),p("已添加")}catch(i){d("#customErr",e).textContent=i.message}}}})}const et=Object.freeze(Object.defineProperty({__proto__:null,BUILTIN_PROVIDERS:J,doImport:R,exportEntity:Qe,importBarHTML:Ke,normalizeImport:ye,showAddBuiltin:Ze,showAddCustom:Ye,showAgentModal:Ge,showMarketplace:ke,showSkillModal:Xe,showUrlImport:V,wireImportBar:Ve},Symbol.toStringTag,{value:"Module"}));function tt({title:e,body:s,onMount:a}){const o=d("#modalCard");o.innerHTML=`<h3>${c(e||"")}</h3>${s||""}`,d("#modal").classList.add("open"),a&&a(o)}function $e(){d("#modal").classList.remove("open")}d("#modal").addEventListener("click",e=>{e.target.id==="modal"&&$e()});const st=Object.freeze(Object.defineProperty({__proto__:null,closeModal:$e,showModal:tt},Symbol.toStringTag,{value:"Module"}));function at(){var a;const e=d("#content"),s=d("#composerWrap");if(s&&(s.style.display=t.messages.length?"":"none"),t.messages.length)e.innerHTML=`<div class="transcript" id="transcript">${t.messages.map(Se).join("")}</div>`,t.streaming&&(e.scrollTop=e.scrollHeight);else{const o=!t.selectedProvider,n=((a=t.runtime)==null?void 0:a.counts)||{providers:t.providers.length,agents:t.agents.length,skills:t.skills.length,plugins:t.plugins.length};e.innerHTML=`
      <div class="hero">
        <div class="hero-greeting">接入你的模型，开始对话</div>
        <div class="hero-sub">${o?"先添加一个模型提供方，即可直接对话":"今天我能为你做什么？"}</div>
        <div class="hero-card" id="heroCard">
          <textarea class="hero-input" id="heroInput" placeholder="发消息…" rows="1"></textarea>
          <div class="hero-actions">
            <button class="hero-tag" id="heroModelTag">选择模型</button>
            <div class="spacer"></div>
            <button class="send-btn" id="heroSendBtn" title="发送">↑</button>
          </div>
        </div>
        <div class="workspace-summary">
          <div class="workspace-summary-head"><div class="brand-logo" style="width:24px;height:24px;border-radius:7px;font-size:12px;">M</div><div><div class="workspace-summary-title">你的 Agent 工作台</div><div class="workspace-summary-sub">模型、智能体、技能和插件都在本地组合运行</div></div></div>
          <div class="workspace-stats">
            <div class="workspace-stat"><div class="workspace-stat-value">${c(n.providers||0)}</div><div class="workspace-stat-label">模型提供方</div></div>
            <div class="workspace-stat"><div class="workspace-stat-value">${c(n.agents||0)}</div><div class="workspace-stat-label">智能体</div></div>
            <div class="workspace-stat"><div class="workspace-stat-value">${c(n.skills||0)}</div><div class="workspace-stat-label">技能</div></div>
            <div class="workspace-stat"><div class="workspace-stat-value">${c(n.plugins||0)}</div><div class="workspace-stat-label">插件</div></div>
          </div>
          <div class="workspace-actions"><button class="btn-ghost" id="heroAgents">配置智能体</button><button class="btn-ghost" id="heroSkills">浏览技能</button><button class="btn-ghost" id="heroPlugins">打开插件市场</button></div>
        </div>
        <div class="hero-hint">回车发送，Shift+Enter 换行 · 内容由 AI 生成</div>
      </div>
    `,syncModelUI();const i=d("#heroInput"),r=d("#heroSendBtn");H(i),i.addEventListener("input",()=>H(i)),i.addEventListener("keydown",l=>{l.key==="Enter"&&!l.shiftKey&&(l.preventDefault(),send())}),r.onclick=send,i.focus(),d("#heroAgents").onclick=()=>openSettings("agents"),d("#heroSkills").onclick=()=>openSettings("skills"),d("#heroPlugins").onclick=()=>showMarketplace()}}function we(e){if(!e||!e.pendingApprovals)return"";const s=Object.values(e.pendingApprovals);return s.length?`<div class="approval-wrap">${s.map(o=>{const n=o.risk==="high"?"risk-high":o.risk==="medium"?"risk-med":"risk-low",i=o.risk==="high"?"高危":o.risk==="medium"?"中危":"低危",r=["approved","rejected","timed_out","cancelled"].includes(o.status),l=o.args?JSON.stringify(o.args):"",u=l.length>240?l.slice(0,240)+"…":l,b=(o.permissions||[]).map(k=>`<span class="ap-perm">${c(k)}</span>`).join(""),v=o.trustLevel?`<span class="ap-perm ap-trust">${o.trustLevel==="trusted"?"已信任":"未信任"}</span>`:"",m=r?`<div class="ap-resolved ${o.status==="approved"?"ok":"no"}">${o.status==="approved"?"已批准，Agent 继续执行":o.status==="rejected"?"已拒绝":o.status==="timed_out"?"超时自动拒绝":"已取消"}</div>`:`<div class="ap-actions"><button class="ap-btn ap-approve" data-approve="${o.id}">批准执行</button><button class="ap-btn ap-reject" data-reject="${o.id}">拒绝</button></div>`;return`<div class="approval-card ${r?"resolved":"pending"} ${o.status==="approved"?"is-approved":r?"is-rejected":""}">
      <div class="ap-head"><span class="ap-badge ${n}">需授权 · ${i}</span><span class="ap-tool">${c(o.tool||"")}</span>${v}</div>
      <div class="ap-args"><span class="ap-args-label">参数</span><code>${c(u||"（无）")}</code></div>
      <div class="ap-perms">${b||'<span class="ap-perm">无特殊权限</span>'}</div>
      ${m}
    </div>`}).join("")}</div>`:""}function Se(e,s){let a;e.role==="assistant"?a=renderMarkdown(e.content||""):a=`<div>${c(e.content||"").replace(/\n/g,"<br/>")}</div>`;const o=e.model?`<span class="msg-model">${c(e.model)}</span>`:"",n=e.agentTag?`<span class="msg-model" style="background:var(--bg-elevated);border:1px solid var(--border-l2);">${c(e.agentTag)}</span>`:"";let i="";if(e.reasoning){const v=e.streaming||e.thinkOpen?" open":"",m=e.streaming?"running":"ok",k=e.streaming?"":`<span class="think-summary">${c((e.reasoning||"").split(`
`)[0])}</span>`;i=`<details class="think-row" data-think="${s}" data-state="${m}"${v}>
      <summary>
        <svg class="think-ico" viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.5.4.9 1 .9 1.6V16h5.2v-.5c0-.6.4-1.2.9-1.6A6 6 0 0 0 12 3z"/></svg>
        <span>思考</span>
        <span class="think-caret"></span>
        ${k}
      </summary>
      <div class="think-body">${c(e.reasoning)}</div>
    </details>`}let r="";Array.isArray(e.toolCalls)&&e.toolCalls.length>0&&(r=e.toolCalls.map((v,m)=>{const k=v.content||"",T=v._open?" open":"",$=k?k.split(`
`)[0].slice(0,90)||"返回结果":"执行完成",A=k.length>2e3?k.slice(0,2e3)+`
...(截断)`:k;return`<details class="tool-card" data-tool="${s}-${m}"${T}>
        <summary>
          <svg class="tool-ico" viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2-2 2.5-2.5z"/></svg>
          <span class="tool-name">${c(v.name)}</span>
          <span class="tool-sep"></span>
          <span class="tool-summary">${c($)}</span>
          <span class="tool-caret"></span>
        </summary>
        <pre class="tool-body">${c(A)}</pre>
      </details>`}).join(""));const l=we(e);let u="";if(Array.isArray(e.trace)&&e.trace.length>0){const v=e.trace.map(m=>{const k=m.kind==="tool_call"?'<svg class="trace-ico-svg" viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2-2 2.5-2.5z"/></svg>':'<svg class="trace-ico-svg" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',T=m.status==="success"?"ok":m.status==="error"?"err":m.status==="rejected"?"rej":"run",$=m.durationMs!=null?(m.durationMs/1e3).toFixed(1)+"s":"";let A,x;if(m.kind==="tool_call"){const I=m.args?JSON.stringify(m.args).slice(0,80):"";A=`${c(m.tool||"tool")}${I?"("+c(I)+")":""}`,x=m.result?c(String(m.result).split(`
`)[0].slice(0,90)):m.error||""}else A=`模型请求 · ${c(m.model||"")}`,x=`${m.toolCount||0} 工具 · ${m.messageCount||0} 上下文`+(m.outputLen!=null?` · 输出 ${m.outputLen} 字`:"");return`<div class="trace-step ${T}">
        ${k}
        <div class="trace-main"><span class="trace-label">${A}</span>${x?`<span class="trace-sub">${c(x)}</span>`:""}</div>
        <span class="trace-status">${m.status==="success"?"✓":m.status==="rejected"?"⊘":m.status==="error"?"✕":"…"}</span>
        ${$?`<span class="trace-dur">${$}</span>`:""}
      </div>`}).join("");u=`<details class="mc-trace"${e.streaming?" open":""}>
      <summary><span class="trace-ico">⟜</span><span class="trace-title">执行轨迹</span><span class="trace-count">${e.trace.length} 步</span></summary>
      <div class="trace-body">${v}</div>
    </details>`}let b="";if(e.role==="assistant"&&!e.streaming&&(e.usage||e.elapsedMs!=null)){const v=e.usage||{},m=v.prompt_tokens??v.input_tokens,k=v.completion_tokens??v.output_tokens,T=v.total_tokens!=null?v.total_tokens:m!=null&&k!=null?m+k:null,$=v.prompt_tokens_details&&v.prompt_tokens_details.cached_tokens||v.cached_tokens||0,A=v.completion_tokens_details&&v.completion_tokens_details.reasoning_tokens||v.reasoning_tokens||0,x=e.elapsedMs!=null?e.elapsedMs/1e3:null,I=e.elapsedMs&&k?k/(e.elapsedMs/1e3):null,L=e.providerName||"",j=[];if(T!=null){let C=`共 <strong>${fmtTok(T)}</strong> tokens`;m!=null&&k!=null&&(C+=` <span style="color:var(--label-dimmed)">(输入 ${fmtTok(m)} / 输出 ${fmtTok(k)})</span>`),A>0&&(C+=` · 推理 ${fmtTok(A)}`),j.push(C)}if($>0&&m){const C=($/m*100).toFixed(0);j.push(`缓存命中 <strong class="cached">${fmtTok($)}</strong> <span style="color:var(--label-dimmed)">(${C}%)</span>`)}if(x!=null){let C=`${x.toFixed(1)}s`;I&&(C+=` · <span class="speed">${I.toFixed(0)} tok/s</span>`),j.push(C)}if(e.model&&j.push(`模型 <strong>${c(e.model)}</strong>`),L&&j.push(`渠道 <strong>${c(L)}</strong>`),j.length){const C=j.join("  |  "),g=j.map(S=>`<span>${S}</span>`).join('<span class="sep">|</span>');b=`<div class="msg-stats" title="${c(C)}">${g}</div>`}}return`
    <div class="msg ${e.role}" data-idx="${s}">
      <div class="msg-avatar">${e.role==="user"?"我":"M"}</div>
      <div class="msg-body">
        <div class="msg-role">${e.role==="user"?"我":"MultiChat"}${n}${o}${e.streaming?'<span class="busy-label">生成中</span>':""}</div>
        ${i}
        <div class="msg-content">${a}${r}${l}${u}</div>
        ${b}
        <div class="msg-actions">
          ${e.role==="assistant"&&!e.streaming?`<button class="msg-action" data-copy="${s}">复制</button><button class="msg-action" data-regen="${s}">重新生成</button>`:""}
          ${e.role==="user"?`<button class="msg-action" data-edit="${s}">编辑</button>`:""}
        </div>
      </div>
    </div>`}function H(e){e.style.height="auto",e.style.height=Math.min(240,e.scrollHeight)+"px"}const ot=Object.freeze(Object.defineProperty({__proto__:null,autoresize:H,renderApprovalCards:we,renderContent:at,renderMessage:Se},Symbol.toStringTag,{value:"Module"}));function nt(e){return e==null?"0":e<1e3?String(e):e<1e6?(e>=1e5?String(Math.round(e/1e3)):String(Math.round(e/100)/10))+"K":(e>=1e8?String(Math.round(e/1e6)):String(Math.round(e/1e5)/10))+"M"}function it(e){if(!e)return"";let s=c(e);return s=s.replace(/```([\w-]*)\n([\s\S]*?)```/g,(o,n,i)=>`<div class="code-block"><button class="code-copy" type="button">复制</button><pre><code class="lang-${n}">${i}</code></pre></div>`),s=s.replace(/`([^`\n]+)`/g,"<code>$1</code>"),s=s.replace(/^### (.+)$/gm,"<h3>$1</h3>"),s=s.replace(/^## (.+)$/gm,"<h2>$1</h2>"),s=s.replace(/^# (.+)$/gm,"<h1>$1</h1>"),s=s.replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>"),s=s.replace(/(^|[^*])\*([^*]+)\*/g,"$1<em>$2</em>"),s=s.replace(/^&gt; (.+)$/gm,"<blockquote>$1</blockquote>"),s=s.replace(/(?:^|\n)((?:- .+(?:\n|$))+)/g,(o,n)=>`
<ul>`+n.trim().split(`
`).map(r=>`<li>${r.replace(/^- /,"")}</li>`).join("")+"</ul>"),s=s.replace(/(?:^|\n)((?:\d+\. .+(?:\n|$))+)/g,(o,n)=>`
<ol>`+n.trim().split(`
`).map(r=>`<li>${r.replace(/^\d+\. /,"")}</li>`).join("")+"</ol>"),s.split(/\n{2,}/).map(o=>(o=o.trim(),o?/^<(h\d|ul|ol|pre|blockquote)/.test(o)?o:"<p>"+o.replace(/\n/g,"<br/>")+"</p>":"")).join(`
`)}const lt=Object.freeze(Object.defineProperty({__proto__:null,fmtTok:nt,renderMarkdown:it},Symbol.toStringTag,{value:"Module"}));d("#input").addEventListener("input",e=>autoresize(e.target));d("#input").addEventListener("keydown",e=>{e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),Q())});d("#sendBtn").onclick=Q;async function Q(){if(t.streaming){Me();return}const e=t.messages.length?d("#input"):d("#heroInput"),s=((e==null?void 0:e.value)||"").trim();if(s){if(!t.selectedProvider||!t.selectedModel){p("请先在右上角选择模型","error"),openSettings("providers");return}if(t.messages.push({role:"user",content:s}),t.messages.push({role:"assistant",content:"",streaming:!0,model:t.selectedModel,providerName:t.selectedProvider.name||t.selectedProvider.id,startTime:performance.now()}),e&&(e.value=""),t.streaming=!0,z(),renderContent(),t.messages.length){const a=d("#input");a&&a.focus()}try{await xe()}catch{}await X(),t.streaming=!1,z()}}function z(){const e=t.messages.length?d("#sendBtn"):d("#heroSendBtn");e&&(t.streaming?(e.classList.add("stop"),e.textContent="■",e.title="停止"):(e.classList.remove("stop"),e.textContent="↑",e.title="发送"))}function Me(){if(t.abortCtrl&&(t.abortCtrl.abort(),t.abortCtrl=null),t.streaming){const e=t.messages[t.messages.length-1];e&&e.streaming&&(e.streaming=!1),t.streaming=!1,z(),renderContent(),G()}}async function xe(){var a,o,n,i;if(t.currentConvId)return;const e=((o=(a=t.messages.find(r=>r.role==="user"))==null?void 0:a.content)==null?void 0:o.slice(0,24))||"新对话",s=await f("/api/conversations",{method:"POST",body:JSON.stringify({title:e,workspaceId:((n=t.selectedWorkspace)==null?void 0:n.id)||null,projectId:((i=t.selectedProject)==null?void 0:i.id)||null})});t.currentConvId=s.id,d("#topbarTitle").textContent=s.title||"对话",await loadConversations()}async function G(){if(t.currentConvId)try{await f("/api/conversations/"+t.currentConvId,{method:"PUT",body:JSON.stringify({messages:t.messages.filter(e=>!e.streaming)})})}catch{}}async function X(){var k,T,$,A,x,I,L,j,C;const e=t.selectedProvider,s=t.selectedModel;if(!e){const g=t.messages[t.messages.length-1];g&&(g.content="**未选择模型**：请先在「设置 → 模型」中添加并选择模型。",g.streaming=!1),renderContent();return}if(!["ollama","lmstudio"].includes((e.apiType||"").toLowerCase())&&!e.apiKey){const g=t.messages[t.messages.length-1];g&&(g.content=`**缺少 API Key**：Provider「${e.name}」尚未填写 API Key。请到「设置 → 模型」中编辑。`,g.streaming=!1),renderContent();return}if(!e.baseUrl){const g=t.messages[t.messages.length-1];g&&(g.content=`**缺少 API 地址**：Provider「${e.name}」尚未填写 baseUrl。请到「设置 → 模型」中编辑。`,g.streaming=!1),renderContent();return}const o=!!t.selectedAgent,n=o?`/api/agents/${t.selectedAgent.id}/chat`:"/v1/chat/completions",i={model:e.id+":"+s,messages:t.messages.filter(g=>!g.streaming||g.role==="user").map(g=>({role:g.role,content:g.content})),stream:!0,temperature:t.params.temperature,max_tokens:t.params.max_tokens,top_p:t.params.top_p,workspaceId:((k=t.selectedWorkspace)==null?void 0:k.id)||null,projectId:((T=t.selectedProject)==null?void 0:T.id)||null,assetIds:[...t.selectedAssetIds]};i._provider={id:e.id,name:e.name,apiType:e.apiType||"openai",baseUrl:e.baseUrl,apiKey:e.apiKey},t.abortCtrl=new AbortController;let r;try{r=await fetch(t.apiBase+n,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(i),signal:t.abortCtrl.signal})}catch(g){if(g.name==="AbortError"){o&&t.currentRunId&&fetch(t.apiBase+"/api/runs/"+t.currentRunId+"/cancel",{method:"POST",headers:{"Content-Type":"application/json"}}).catch(()=>{});const w=t.messages[t.messages.length-1];w&&(w.streaming=!1,w.cancelled=!0,w.content||(w.content="（已停止）")),renderContent();return}const S=t.messages[t.messages.length-1];S&&(S.content="**网络错误**: "+g.message,S.streaming=!1),renderContent();return}if(!r.ok){let g="";try{const _=await r.clone().json();g=(($=_==null?void 0:_.error)==null?void 0:$.message)||(_==null?void 0:_.message)||""}catch{}const S={400:"请求参数有误（通常是 model 名不识别或 messages 格式不对）",401:"上游 API 鉴权失败 — API Key 无效或已过期",403:"上游拒绝访问 — 可能原因：API Key 被禁用 / 余额不足 / IP 地区受限",404:"上游接口或模型不存在 — 检查 baseUrl 和模型名",429:"上游限流 — 请稍后重试或降低请求频率",500:"上游服务器内部错误",502:"MultiChat 无法连接上游 — 检查 baseUrl 是否可访问",503:"上游服务暂不可用"}[r.status]||"",w=t.messages[t.messages.length-1];w&&(w.content=`**请求失败 (HTTP ${r.status})**${S?"："+S:""}`+(g?`

> ${g}`:"")+(o?`

排查建议：① 设置 → 智能体 确认 system prompt 与 skill 关联正确；② 设置 → 模型 确认 API Key 正确；③ 切换其他模型试一下。`:`

排查建议：① 设置 → 模型 中确认 API Key 正确；② baseUrl 可在浏览器直接访问；③ 切换其他模型试一下。`),w.streaming=!1),renderContent();return}if(!r.body){const g=t.messages[t.messages.length-1];g&&(g.content="**错误**: 响应无 body",g.streaming=!1),renderContent();return}const l=r.body.getReader(),u=new TextDecoder("utf-8");let b="",v="";for(;;){const{value:g,done:S}=await l.read();if(S)break;b+=u.decode(g,{stream:!0});let w;for(;(w=b.indexOf(`

`))>=0;){const _=b.slice(0,w);b=b.slice(w+2);const Z=_.split(`
`).find(h=>h.startsWith("data:"));if(!Z)continue;const Y=Z.slice(5).trim();if(Y!=="[DONE]")try{const h=JSON.parse(Y),y=t.messages[t.messages.length-1];if(!y)continue;if(h.meta&&h.meta.agent){y.agentTag=h.meta.agent.name,h.meta.run&&h.meta.run.id&&(t.currentRunId=h.meta.run.id),renderContent();continue}if(h.agentEvent){y.trace||(y.trace=[]);const M=h.agentEvent;if(M.type==="cancelled")y.cancelled=!0;else if(M.type==="approval_required")y.pendingApprovals||(y.pendingApprovals={}),y.pendingApprovals[M.approval.id]=M.approval;else if(M.type==="approval_resolved"){y.pendingApprovals||(y.pendingApprovals={});const E=y.pendingApprovals[M.approval.id]||{};y.pendingApprovals[M.approval.id]=Object.assign({},E,M.approval)}else if(M.step){const E=y.trace.findIndex(Pe=>Pe.sid===M.step.sid);E<0?y.trace.push(M.step):y.trace[E]=Object.assign({},y.trace[E],M.step)}renderContent();continue}if(h.error){v+=(v?`

`:"")+"**[错误]** "+(h.error.message||"未知错误"),y.content=v,y.streaming=!1,renderContent();continue}if(h.usage){y.usage=h.usage,h.model&&(y.model=h.model),renderContent();continue}if(h.choices&&h.choices[0]&&h.choices[0].delta&&h.choices[0].delta.tool_result){const M=h.choices[0].delta.tool_result;y.toolCalls||(y.toolCalls=[]),y.toolCalls.push({id:M.id,name:M.name,content:M.content}),renderContent();continue}if(h.choices&&h.choices[0]&&h.choices[0].delta&&h.choices[0].delta.reasoning_content){const M=h.choices[0].delta.reasoning_content;y.reasoning||(y.reasoning=""),y.reasoning+=M,renderContent();continue}const ee=((I=(x=(A=h==null?void 0:h.choices)==null?void 0:A[0])==null?void 0:x.delta)==null?void 0:I.content)??((C=(j=(L=h==null?void 0:h.choices)==null?void 0:L[0])==null?void 0:j.message)==null?void 0:C.content)??"";ee&&(v+=ee,y.content=v,renderContent())}catch{}}}const m=t.messages[t.messages.length-1];m&&(m.streaming=!1,m.startTime&&(m.elapsedMs=Math.round(performance.now()-m.startTime))),renderContent(),G(),o&&loadRuns(),O("[data-copy]").forEach(g=>g.onclick=()=>{var w;const S=+g.dataset.copy;navigator.clipboard.writeText(((w=t.messages[S])==null?void 0:w.content)||""),p("已复制")}),O("[data-edit]").forEach(g=>g.onclick=()=>{const S=+g.dataset.edit,w=prompt("编辑消息",t.messages[S].content);w!=null&&(t.messages[S].content=w,t.messages=t.messages.slice(0,S+1),renderContent())}),O("[data-regen]").forEach(g=>g.onclick=()=>{if(t.streaming)return;const S=+g.dataset.regen;t.messages=t.messages.slice(0,S),renderContent(),X()})}document.addEventListener("click",e=>{const s=e.target.closest(".code-copy");if(!s)return;const a=s.parentElement.querySelector("pre code");a&&navigator.clipboard.writeText(a.textContent).then(()=>{s.textContent="已复制",setTimeout(()=>{s.textContent="复制"},1500)}).catch(()=>p("复制失败","error"))});document.addEventListener("click",e=>{const s=e.target.closest("[data-approve],[data-reject]");if(!s)return;const a=s.getAttribute("data-approve")||s.getAttribute("data-reject");if(!a)return;const o=s.hasAttribute("data-approve")?"approve":"reject",n=t.currentRunId;if(!n){p("无法定位运行任务","error");return}s.disabled=!0,s.textContent=o==="approve"?"批准中…":"拒绝中…",fetch(t.apiBase+"/api/runs/"+n+"/approval/"+a,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:o})}).then(i=>i.json().then(r=>({ok:i.ok,j:r}))).then(({ok:i,j:r})=>{var u;if(!i){p("审批失败："+(((u=r==null?void 0:r.error)==null?void 0:u.message)||(r==null?void 0:r.error)||"未知错误"),"error"),s.disabled=!1,s.textContent=o==="approve"?"批准执行":"拒绝";return}const l=t.messages.find(b=>b.pendingApprovals&&b.pendingApprovals[a]);if(l){const b=o==="approve"?"approved":"rejected";l.pendingApprovals[a]=Object.assign({},l.pendingApprovals[a],{status:b,resolvedAt:new Date().toISOString()}),renderContent()}p(o==="approve"?"已批准，Agent 继续执行":"已拒绝")}).catch(()=>{p("网络错误","error"),s.disabled=!1,s.textContent=o==="approve"?"批准执行":"拒绝"})});document.addEventListener("toggle",e=>{const s=e.target;if(!s||!s.getAttribute)return;const a=s.getAttribute("data-think");if(a!=null){const n=t.messages[+a];n&&(n.thinkOpen=s.open);return}const o=s.getAttribute("data-tool");if(o!=null){const[n,i]=o.split("-").map(Number),r=t.messages[n];r&&r.toolCalls&&r.toolCalls[i]&&(r.toolCalls[i]._open=s.open)}},!0);const rt=Object.freeze(Object.defineProperty({__proto__:null,ensureConversation:xe,saveCurrentMessages:G,send:Q,stopStream:Me,streamReply:X,updateSendBtn:z},Symbol.toStringTag,{value:"Module"})),ct=[Ae,Te,Ue,Ne,Fe,Re,De,He,et,st,ot,lt,rt];for(const e of ct)Object.assign(globalThis,e);window.addEventListener("DOMContentLoaded",()=>{bootstrap()});window.MC={state,send,newConversation,openSettings};
