import{$ as e,$$ as t,DEFAULT_PARAMS as n,api as r,esc as i,getTheme as a,saveParams as o,saveSelectedAgent as s,setTheme as c,state as l,toast as u}from"./core-BWSzA0FL.js";e(`#settingsBtn`).onclick=()=>f();var d=null;function f(t=`general`){let n=e(`#settings`);n.classList.contains(`open`)||(d=document.activeElement instanceof HTMLElement?document.activeElement:null),n.inert=!1,n.setAttribute(`aria-hidden`,`false`),n.classList.add(`open`),e(`#scrim`).classList.add(`open`),m(t),e(`#settingsBody`)?.focus?.({preventScroll:!0}),e(`#app`).inert=!0}function p(){let t=e(`#settings`);if(!t.classList.contains(`open`))return;let n=e(`#app`);n.inert=!1;let r=e(`#settingsBtn`),i=d?.isConnected&&n.contains(d)?d:r;try{i?.focus?.({preventScroll:!0})}catch{i?.focus?.()}t.contains(document.activeElement)&&r?.focus?.({preventScroll:!0}),t.classList.remove(`open`),t.inert=!0,t.setAttribute(`aria-hidden`,`true`),e(`#scrim`).classList.remove(`open`),d=null}e(`#scrim`).onclick=p,e(`#closeSettings`).onclick=p,e(`#closeSettingsTop`).onclick=p,document.addEventListener(`keydown`,t=>{t.key===`Escape`&&e(`#settings`).classList.contains(`open`)&&!e(`#modal`).classList.contains(`open`)&&p()}),t(`.settings-tab[data-tab]`).forEach(e=>e.onclick=()=>m(e.dataset.tab));function m(e){l.currentTab=e,t(`.settings-tab[data-tab]`).forEach(t=>t.classList.toggle(`active`,t.dataset.tab===e)),h(e),e===`usage`?loadUsage(l.usageRange).then(()=>{l.currentTab===`usage`&&h(`usage`)}):e===`capabilities`&&loadCapabilities().then(()=>{l.currentTab===`capabilities`&&h(`capabilities`)})}function h(t=`general`,d=!1){let f=e(`#settingsBody`),p=d?f.scrollTop:0;if(t===`general`){let t=l.params,r=a();f.innerHTML=`
      <h3>偏好设置</h3>
      <p class="lead">模型参数与外观</p>
      <div class="provider-card">
        <h4>模型参数</h4>
        <div class="pmeta">应用于每次对话请求（OpenAI 兼容）</div>
        <div class="field">
          <label for="pTemp">温度 Temperature：<span id="tVal">${t.temperature}</span></label>
          <input type="range" id="pTemp" min="0" max="2" step="0.1" value="${t.temperature}" />
        </div>
        <div class="field">
          <label for="pMax">最大输出 Token（max_tokens）</label>
          <input type="number" id="pMax" value="${t.max_tokens}" min="1" max="128000" />
        </div>
        <div class="field">
          <label for="pTop">Top P：<span id="pTopVal">${t.top_p}</span></label>
          <input type="range" id="pTop" min="0" max="1" step="0.05" value="${t.top_p}" />
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
          <label for="themeSel">主题</label>
          <select id="themeSel"><option value="light" ${r===`light`?`selected`:``}>浅色</option><option value="dark" ${r===`dark`?`selected`:``}>深色</option><option value="system" ${r===`system`?`selected`:``}>跟随系统</option></select>
        </div>
      </div>
      <div class="provider-card">
        <h4>关于</h4>
        <div class="pmeta">MultiChat · 本地优先的多模型工作台<br/>模型、Skills、MCP 与插件按运行配置组合。<br/>支持 OpenAI / Anthropic / Ollama / LM Studio 等兼容接口。</div>
      </div>
    `;let i=e(`#pTemp`),s=e(`#tVal`),d=e(`#pTop`),p=e(`#pTopVal`);i.oninput=()=>{s.textContent=i.value},d.oninput=()=>{p.textContent=d.value},e(`#pSave`).onclick=()=>{l.params={temperature:parseFloat(i.value),max_tokens:parseInt(e(`#pMax`).value,10)||2e3,top_p:parseFloat(d.value)},o(),u(`已保存`)},e(`#pReset`).onclick=()=>{l.params={...n},o(),h(`general`,!0),u(`已重置`)},e(`#themeSel`).onchange=e=>{c(e.target.value),u(`主题已切换`)}}else if(t===`workspace`){let t=l.selectedWorkspace,n=l.selectedProject;f.innerHTML=`
      <h3>工作区</h3>
      <p class="lead">按工作区和项目组织会话、文件与运行上下文。文件内容只保存在本地数据目录。</p>
      <div class="provider-card">
        <h4>当前空间</h4>
        <div class="field"><label>工作区</label><select id="workspaceSelect">${l.workspaces.map(e=>`<option value="${i(e.id)}" ${e.id===t?.id?`selected`:``}>${i(e.name)}</option>`).join(``)}</select></div>
        <div class="field"><label>项目</label><select id="projectSelect">${l.projects.map(e=>`<option value="${i(e.id)}" ${e.id===n?.id?`selected`:``}>${i(e.name)}</option>`).join(``)}</select></div>
        <div class="field"><label>项目默认运行配置</label><select id="projAgentSelect"><option value="">（继承全局）</option>${l.agents.map(e=>`<option value="${i(e.id)}" ${n?.defaultAgentId===e.id?`selected`:``}>${i(e.name)}</option>`).join(``)}</select></div>
        <div class="field"><label>项目默认模型</label><select id="projModelSelect"><option value="">（继承全局）</option>${l.providers.flatMap(e=>(e.models||[]).map(t=>({pid:e.id,m:t,label:(e.name||e.id)+` · `+t}))).map(e=>`<option value="${i(e.pid+`:`+e.m)}" ${n?.defaultProviderId===e.pid&&n?.defaultModel===e.m?`selected`:``}>${i(e.label)}</option>`).join(``)}</select></div>
        <div class="provider-row"><button class="btn-primary" id="saveProjDefaults" style="width:auto;padding:8px 18px;">保存项目默认</button></div>
        <div class="provider-row"><button class="btn-ghost" id="newWorkspace">新建工作区</button><button class="btn-ghost" id="newProject">新建项目</button></div>
      </div>
      <div class="provider-card">
        <h4>项目文件</h4>
        <div class="pmeta">支持本地文本文件和 URL 文本资源；对话时会按相关性截取并附带文件/行号来源。</div>
        <div class="provider-row" style="margin-top:12px;"><button class="btn-ghost" id="uploadAsset">上传本地文件</button><button class="btn-ghost" id="importAssetUrl">从 URL 添加</button><input type="file" id="assetFileInput" accept=".txt,.md,.json,.csv,.js,.ts,.py,.html,.css,.yaml,.yml" style="display:none" /></div>
        <div class="run-list" style="margin-top:14px;">${l.assets.map(e=>`<div class="run-row"><span class="run-dot completed"></span><div class="run-main"><div class="run-title">${i(e.name)}</div><div class="run-meta">${i(e.mimeType)} · ${i(e.size)} bytes · ${i(e.source)}</div></div><button class="mc-act danger" data-del-asset="${i(e.id)}" title="删除">删除</button></div>`).join(``)||`<div style="color:var(--label-caption);font-size:13px;padding:8px 0;">当前项目还没有文件。</div>`}</div>
        <form class="knowledge-search" id="knowledgeSearch"><input id="knowledgeQuery" placeholder="搜索项目知识，例如：认证流程在哪里实现？" /><button class="btn-ghost">搜索知识</button></form><div id="knowledgeResults"></div>
      </div>
      <div class="provider-card">
        <div class="control-card-head"><div><h4>项目记忆</h4><div class="pmeta">由你明确维护的事实和偏好；可逐条停用，不会从聊天中偷偷学习。</div></div><button class="btn-ghost" id="addMemory">新增记忆</button></div>
        <div class="memory-list">${(l.memories||[]).map(e=>`<article class="memory-item ${e.enabled===!1?`disabled`:``}"><button class="memory-toggle" data-toggle-memory="${i(e.id)}" aria-pressed="${e.enabled!==!1}"><i></i>${e.enabled===!1?`已停用`:`已启用`}</button><div><strong>${i(e.title)}</strong><p>${i(e.content)}</p></div><div class="memory-actions"><button class="mc-act" data-edit-memory="${i(e.id)}">编辑</button><button class="mc-act danger" data-del-memory="${i(e.id)}">删除</button></div></article>`).join(``)||`<div class="control-empty">还没有项目记忆。只保存值得长期复用的事实和偏好。</div>`}</div>
      </div>
      <div class="provider-card">
        <div class="control-card-head"><div><h4>项目时光机</h4><div class="pmeta">保存项目设置、知识文件、记忆、默认运行配置和当前 Git 状态；恢复前会自动再备份一次。</div></div><button class="btn-primary" id="createSnapshot">创建快照</button></div>
        <div class="snapshot-list">${(l.snapshots||[]).map(e=>`<article class="snapshot-item"><span class="snapshot-mark">${e.git?.commit?i(e.git.commit):`LOCAL`}</span><div><strong>${i(e.title)}</strong><p>${new Date(e.createdAt).toLocaleString(`zh-CN`)} · ${e.assets} 文件 · ${e.memories} 记忆 · ${_(e.size)}B${e.git?.branch?` · ${i(e.git.branch)}${e.git.dirty?`（有改动）`:``}`:``}</p></div><div class="memory-actions"><button class="mc-act" data-restore-snapshot="${i(e.id)}">恢复</button><button class="mc-act danger" data-del-snapshot="${i(e.id)}">删除</button></div></article>`).join(``)||`<div class="control-empty">尚未创建项目快照。</div>`}</div>
      </div>
    `,e(`#workspaceSelect`).onchange=async e=>{l.selectedWorkspace=l.workspaces.find(t=>t.id===e.target.value)||null,await loadProjects(),renderTopbar(),renderContent(),h(`workspace`,!0),renderFileContext()},e(`#projectSelect`).onchange=async e=>{l.selectedProject=l.projects.find(t=>t.id===e.target.value)||null,l.selectedProject&&localStorage.setItem(`multichat_project`,l.selectedProject.id),await loadProjects(),renderTopbar(),renderContent(),h(`workspace`,!0),renderFileContext()},e(`#saveProjDefaults`).onclick=async()=>{if(!l.selectedProject){u(`请先选择项目`,`error`);return}let t=e(`#projAgentSelect`).value||null,[n,...i]=(e(`#projModelSelect`).value||``).split(`:`),a=i.join(`:`);try{await r(`/api/projects/`+l.selectedProject.id,{method:`PUT`,body:JSON.stringify({defaultAgentId:t,defaultProviderId:n||null,defaultModel:a||null})}),Object.assign(l.selectedProject,{defaultAgentId:t,defaultProviderId:n||null,defaultModel:a||null}),applyProjectDefaults(),u(`已保存项目默认`)}catch(e){u(e.message,`error`)}},e(`#newWorkspace`).onclick=()=>b(),e(`#newProject`).onclick=()=>S(),e(`#importAssetUrl`).onclick=()=>C();let a=e(`#assetFileInput`);e(`#uploadAsset`).onclick=()=>a.click(),a.onchange=async()=>{let e=a.files?.[0];if(!(!e||!l.selectedProject)){try{await r(`/api/assets`,{method:`POST`,body:JSON.stringify({projectId:l.selectedProject.id,name:e.name,mimeType:e.type||`text/plain`,content:await e.text()})}),await loadProjects(),h(`workspace`,!0),u(`文件已加入项目`)}catch(e){u(e.message,`error`)}a.value=``}},f.querySelectorAll(`[data-del-asset]`).forEach(e=>e.onclick=async()=>{try{await r(`/api/assets/`+e.dataset.delAsset,{method:`DELETE`}),await loadProjects(),h(`workspace`,!0)}catch(e){u(e.message,`error`)}}),e(`#knowledgeSearch`).onsubmit=async t=>{t.preventDefault();let n=e(`#knowledgeQuery`).value.trim();if(!n||!l.selectedProject)return;let a=e(`#knowledgeResults`);a.innerHTML=`<div class="pmeta">正在检索…</div>`;try{a.innerHTML=(await r(`/api/projects/${encodeURIComponent(l.selectedProject.id)}/search?q=${encodeURIComponent(n)}`)).map(e=>`<article class="knowledge-hit"><strong>${i(e.name)} <span>L${e.lineStart}–L${e.lineEnd}</span></strong><p>${i(e.snippet.slice(0,500))}</p></article>`).join(``)||`<div class="control-empty">没有找到相关片段。</div>`}catch(e){a.innerHTML=`<div class="auth-error">${i(e.message)}</div>`}},e(`#addMemory`).onclick=()=>x(),f.querySelectorAll(`[data-edit-memory]`).forEach(e=>e.onclick=()=>x(e.dataset.editMemory)),f.querySelectorAll(`[data-toggle-memory]`).forEach(e=>e.onclick=async()=>{let t=l.memories.find(t=>t.id===e.dataset.toggleMemory);t&&(await r(`/api/memories/`+t.id,{method:`PUT`,body:JSON.stringify({enabled:t.enabled===!1})}),await loadProjectControlData(),h(`workspace`,!0))}),f.querySelectorAll(`[data-del-memory]`).forEach(e=>e.onclick=async()=>{confirm(`删除这条项目记忆？`)&&(await r(`/api/memories/`+e.dataset.delMemory,{method:`DELETE`}),await loadProjectControlData(),h(`workspace`,!0))}),e(`#createSnapshot`).onclick=async()=>{if(!l.selectedProject)return;let e=prompt(`快照名称`,`项目快照 ${new Date().toLocaleString(`zh-CN`)}`);if(e!=null)try{await r(`/api/snapshots`,{method:`POST`,body:JSON.stringify({projectId:l.selectedProject.id,title:e})}),await loadProjectControlData(),h(`workspace`,!0),u(`项目快照已创建`)}catch(e){u(e.message,`error`)}},f.querySelectorAll(`[data-restore-snapshot]`).forEach(e=>e.onclick=async()=>{if(confirm(`恢复该快照？当前状态会先自动备份，随后替换项目文件、记忆和默认配置。`))try{await r(`/api/snapshots/`+e.dataset.restoreSnapshot+`/restore`,{method:`POST`}),await loadProjects(),await loadAgents(),h(`workspace`),renderFileContext(),u(`快照已恢复`)}catch(e){u(e.message,`error`)}}),f.querySelectorAll(`[data-del-snapshot]`).forEach(e=>e.onclick=async()=>{confirm(`删除该项目快照？`)&&(await r(`/api/snapshots/`+e.dataset.delSnapshot,{method:`DELETE`}),await loadProjectControlData(),h(`workspace`,!0))})}else if(t===`providers`){let t=l.providers.filter(e=>!!(e.apiKeyMasked||e.apiKey)||[`ollama`,`lmstudio`,`mock`].includes((e.apiType||``).toLowerCase())).length,n=l.providers.reduce((e,t)=>e+(t.models?.length||+!!t.model),0);f.innerHTML=`
      <section class="provider-settings">
        <div class="settings-page-heading">
          <div>
            <h3>模型连接</h3>
            <p class="lead">管理提供方凭证和可选模型；所有配置仅保存在本地。</p>
          </div>
          <div class="provider-summary" aria-label="模型配置概览">
            <span><strong>${l.providers.length}</strong> 个提供方</span>
            <span><strong>${n}</strong> 个模型</span>
            <span><strong>${t}</strong> 个可用</span>
          </div>
        </div>
        <div id="providerList" class="provider-grid">
        ${l.providers.map(e=>{let t=e.models||(e.model?[e.model]:[]),n=e.name||e.id,r=[`ollama`,`lmstudio`,`mock`].includes((e.apiType||``).toLowerCase())||e.id===`mock`,a=!!(e.apiKeyMasked||e.apiKey)||r;return`
          <article class="provider-card provider-config-card" data-pid="${i(e.id)}">
            <div class="provider-card-head">
              <span class="provider-mark" aria-hidden="true">${i(n.trim().slice(0,1).toUpperCase()||`M`)}</span>
              <div class="provider-identity">
                <h4>${i(n)} <span class="provider-id">${i(e.id)}</span></h4>
                <div class="pmeta">${i(e.apiType||`openai`)} · ${t.length?`${t.length} 个模型`:`手动输入模型`}</div>
              </div>
              <span class="provider-state ${a?r?`local`:`ready`:`missing`}">${a?r?`本地`:`已配置`:`待配置`}</span>
            </div>
            <div class="provider-card-fields">
              <div class="field">
                <label for="provider-key-${i(e.id)}">API 密钥</label>
                <input id="provider-key-${i(e.id)}" type="password" data-k="${i(e.id)}" value="" placeholder="${e.apiKeyMasked?`已安全保存 ····${i(e.apiKeyPreview||``)}`:r?`本地提供方可留空`:`输入 API 密钥`}" autocomplete="new-password" spellcheck="false" />
              </div>
              <div class="field">
                <label for="provider-models-${i(e.id)}">模型列表</label>
                <textarea id="provider-models-${i(e.id)}" data-m="${i(e.id)}" rows="1" placeholder="deepseek-chat, deepseek-reasoner" spellcheck="false">${i(t.join(`, `))}</textarea>
              </div>
            </div>
            <div class="provider-card-footer">
              <label class="provider-private"><input type="checkbox" data-private="${i(e.id)}" ${e.allowPrivate?`checked`:``} /> 允许访问本机 / 内网</label>
              <div class="provider-row">
                <button class="btn-ghost danger-ghost" data-del="${i(e.id)}">删除</button>
                <button class="btn-primary" data-save="${i(e.id)}">保存</button>
              </div>
            </div>
          </article>`}).join(``)||`<div class="provider-empty">还没有添加任何模型，点击下方按钮开始配置。</div>`}
        </div>
        <div class="add-provider provider-add-grid">
          <button type="button" class="add-tile" id="addBuiltin"><span class="ico">＋</span><span><strong>添加提供方</strong><small>从内置模板快速配置</small></span></button>
          <button type="button" class="add-tile" id="addCustom"><span class="ico">＋</span><span><strong>自定义提供方</strong><small>接入 OpenAI 兼容服务</small></span></button>
        </div>
      </section>
    `,f.querySelectorAll(`[data-save]`).forEach(e=>e.onclick=async()=>{let t=e.dataset.save,n=f.querySelector(`[data-k="${t}"]`).value,i=(f.querySelector(`[data-m="${t}"]`).value||``).split(/[,\n]/).map(e=>e.trim()).filter(Boolean);try{let e=!!f.querySelector(`[data-private="${t}"]`)?.checked;await r(`/api/providers/`+t,{method:`PUT`,body:JSON.stringify({...n?{apiKey:n}:{},models:i,allowPrivate:e})}),u(`已保存`),await loadProviders(),h(`providers`,!0),renderTopbar()}catch(e){u(e.message,`error`)}}),f.querySelectorAll(`[data-del]`).forEach(e=>e.onclick=async()=>{let t=e.dataset.del;if(confirm(`删除该模型？`)){try{await r(`/api/providers/`+t,{method:`DELETE`})}catch(e){u(e.message,`error`);return}await loadProviders(),h(`providers`,!0),renderTopbar()}}),e(`#addBuiltin`).onclick=()=>showAddBuiltin(),e(`#addCustom`).onclick=()=>showAddCustom()}else if(t===`agents`){let t=l.agents;f.innerHTML=`
      <h3>运行配置</h3>
      <p class="lead">把系统提示词、Skills、内置工具和 MCP 服务保存为可复用配置。只有当前配置选中的能力才会进入一次运行。</p>
      ${importBarHTML()}
      <div class="card-grid">
        ${t.map(e=>{let t=l.selectedAgent&&l.selectedAgent.id===e.id,n=e.skillRefs||e.skillIds||[],r=e.toolIds||[],a=e.mcpServerIds||[];return`
          <div class="mc-card" data-aid="${i(e.id)}">
            <div class="mc-top">
              <div class="mc-ico"><svg viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="11" rx="2.5"/><path d="M12 8V5M9 3h6M9 13h.01M15 13h.01M9.5 16h5"/></svg></div>
              <div style="min-width:0;flex:1;">
                <div class="mc-title">${i(e.name)}</div>
                <div class="mc-sub">${i(e.id)}</div>
              </div>
              ${t?`<span class="mc-tag on">使用中</span>`:``}
            </div>
            <div class="mc-desc">${i(e.description||`（暂无描述）`)}</div>
            <div class="mc-tags">
              <span class="mc-tag">${n.length} 个技能</span>
              <span class="mc-tag">${r.length} 个内置工具</span>
              <span class="mc-tag">${a.length} 个 MCP</span>
              ${n.slice(0,3).map(e=>`<span class="mc-tag">${i(e)}</span>`).join(``)}
              ${n.length>3?`<span class="mc-tag">+${n.length-3}</span>`:``}
            </div>
            <div class="mc-actions">
              <button class="mc-act" data-export-a="${i(e.id)}" title="导出">${EXPORT_ICON}</button>
              <button class="mc-act" data-edit-a="${i(e.id)}" title="编辑"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
              <button class="mc-act danger" data-del-a="${i(e.id)}" title="删除"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg></button>
            </div>
          </div>`}).join(``)}
        <button type="button" class="mc-add" id="addAgent"><span class="plus">＋</span><span class="plus-t">新建运行配置</span></button>
      </div>
    `,f.querySelectorAll(`.mc-card[data-aid]`).forEach(e=>e.onclick=()=>showAgentModal(e.dataset.aid)),f.querySelectorAll(`[data-edit-a]`).forEach(e=>e.onclick=t=>{t.stopPropagation(),showAgentModal(e.dataset.editA)}),f.querySelectorAll(`[data-export-a]`).forEach(e=>e.onclick=t=>{t.stopPropagation();let n=l.agents.find(t=>t.id===e.dataset.exportA);n&&exportEntity(n,`agent`)}),f.querySelectorAll(`[data-del-a]`).forEach(e=>e.onclick=async t=>{t.stopPropagation();let n=e.dataset.delA;if(confirm(`删除该运行配置？`)){try{await r(`/api/agents/`+n,{method:`DELETE`})}catch(e){u(e.message,`error`);return}l.selectedAgent&&l.selectedAgent.id===n&&(l.selectedAgent=null),s(),await loadAgents(),h(l.currentTab||`agents`,!0),renderTopbar()}}),e(`#addAgent`).onclick=()=>showAgentModal(null),wireImportBar()}else if(t===`skills`){f.innerHTML=`
      <h3>Agent Skills</h3>
      <p class="lead">每个 Skill 都是一个以 <code>SKILL.md</code> 为入口的目录，可按需附带 scripts、references 和 assets。项目 Skill 保存在 <code>.agents/skills</code>，Codex 会自动发现；这里的开关控制 MultiChat 是否使用它。</p>
      <div class="resource-toolbar" aria-label="筛选 Skills">
        <label class="resource-search" for="skillSearch"><span aria-hidden="true">⌕</span><input id="skillSearch" type="search" aria-label="搜索 Skills" placeholder="搜索名称、说明或 ID" autocomplete="off" /></label>
        <select id="skillSource" aria-label="按来源筛选"><option value="">全部来源</option>${[...new Set(l.skills.map(e=>e.source?.kind||`managed`))].map(e=>`<option value="${i(e)}">${i(sourceLabel({kind:e}))}</option>`).join(``)}</select>
        <select id="skillStatus" aria-label="按状态筛选"><option value="">全部状态</option><option value="enabled">已启用</option><option value="disabled">已停用</option></select>
        <span class="resource-count" id="skillCount">${l.skills.length} 个 Skills</span>
      </div>
      <div class="card-grid" id="skillGrid">
        ${l.skills.map(e=>`
          <div class="mc-card" data-sid="${i(e.key||e.id)}" data-skill-search="${i([e.name,e.id,e.description,sourceLabel(e.source)].filter(Boolean).join(` `).toLocaleLowerCase())}" data-source="${i(e.source?.kind||`managed`)}" data-status="${e.enabled?`enabled`:`disabled`}">
            <div class="mc-top">
              <div class="mc-ico"><svg viewBox="0 0 24 24"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/></svg></div>
              <div style="min-width:0;flex:1;">
                <div class="mc-title">${i(e.name)}</div>
                <div class="mc-sub">${i(e.id)}</div>
              </div>
            </div>
            <div class="mc-desc">${i(e.description||`（暂无描述）`)}</div>
            <div class="extension-source">${i(sourceLabel(e.source))} · ${i(e.scope||`project`)}</div>
            <div class="extension-command" title="${i(e.path||``)}">${i(e.path||``)}</div>
            <div class="mc-tags">
              <span class="mc-tag ${e.enabled?`on`:``}">SKILL.md</span>
              <span class="mc-tag">MultiChat ${e.enabled?`已启用`:`已停用`}</span>
              ${(e.resources||[]).map(e=>`<span class="mc-tag">${i(e)}</span>`).join(``)}
              ${e.invalid?`<span class="mc-tag danger">格式无效</span>`:``}
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:auto;padding-top:6px;">
              <button type="button" class="mc-toggle ${e.enabled?`on`:``}" data-toggle-s="${i(e.key||e.id)}" aria-pressed="${e.enabled?`true`:`false`}"><span class="mc-switch" aria-hidden="true"></span><span>${e.enabled?`启用中`:`已停用`}</span></button>
            <div class="mc-actions" style="opacity:1;position:static;">
              ${[`repo`,`plugin`].includes(e.source?.kind)?`<button class="mc-act" data-diff-s="${i(e.key||e.id)}" title="查看 Git 变更"><svg viewBox="0 0 24 24"><path d="M8 6h8M8 12h8M8 18h5"/></svg></button>`:``}
              ${[`managed`,`repo`].includes(e.source?.kind)?`<button class="mc-act" data-edit-s="${i(e.key||e.id)}" title="编辑"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>`:``}
              ${[`managed`,`repo`].includes(e.source?.kind)?`<button class="mc-act danger" data-del-s="${i(e.key||e.id)}" title="删除"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg></button>`:``}
            </div>
            </div>
          </div>`).join(``)}
        ${l.skills.length?``:`<div class="extension-empty">还没有发现标准 Skill。</div>`}
        <div class="extension-empty" id="skillNoResults" hidden>没有符合筛选条件的 Skill。</div>
        <button type="button" class="mc-add" id="importSkill"><span class="plus">⇧</span><span class="plus-t">上传 / 导入 Skill</span><span class="mc-sub">ZIP、SKILL.md 或完整目录</span></button>
        <button type="button" class="mc-add" id="addSkill"><span class="plus">＋</span><span class="plus-t">新建 Skill</span></button>
      </div>
    `;let t=()=>{let t=(e(`#skillSearch`).value||``).trim().toLocaleLowerCase(),n=e(`#skillSource`).value,r=e(`#skillStatus`).value,i=0;f.querySelectorAll(`.mc-card[data-sid]`).forEach(e=>{let a=(!t||(e.dataset.skillSearch||``).includes(t))&&(!n||e.dataset.source===n)&&(!r||e.dataset.status===r);e.hidden=!a,a&&(i+=1)}),e(`#skillCount`).textContent=`${i} / ${l.skills.length} 个 Skills`,e(`#skillNoResults`).hidden=i!==0||l.skills.length===0};e(`#skillSearch`).oninput=t,e(`#skillSource`).onchange=t,e(`#skillStatus`).onchange=t,f.querySelectorAll(`[data-toggle-s]`).forEach(e=>e.onclick=async t=>{t.stopPropagation();let n=e.dataset.toggleS,i=l.skills.find(e=>(e.key||e.id)===n);if(!i)return;let a=!i.enabled,o=e.closest(`.mc-card`),s=t=>{e.classList.toggle(`on`,t),e.setAttribute(`aria-pressed`,String(t)),o&&(o.dataset.status=t?`enabled`:`disabled`);let n=e.querySelector(`span:last-child`);if(n&&(n.textContent=t?`启用中`:`已停用`),o){let e=o.querySelectorAll(`.mc-tag`);e[0]&&e[0].classList.toggle(`on`,t),e[1]&&(e[1].textContent=t?`MultiChat 已启用`:`MultiChat 已停用`)}};i.enabled=a,s(a);try{await r(`/api/skills/`+encodeURIComponent(n)+`/toggle`,{method:`POST`,body:JSON.stringify({enabled:a})})}catch(e){i.enabled=!a,s(!a),u(e.message,`error`)}}),f.querySelectorAll(`[data-edit-s]`).forEach(e=>e.onclick=t=>{t.stopPropagation(),showSkillModal(e.dataset.editS)}),f.querySelectorAll(`[data-diff-s]`).forEach(e=>e.onclick=async t=>{t.stopPropagation();try{let t=await r(`/api/skills/`+encodeURIComponent(e.dataset.diffS)+`/diff`);showDiff(`Skill 变更`,t)}catch(e){u(e.message,`error`)}}),f.querySelectorAll(`[data-del-s]`).forEach(e=>e.onclick=async t=>{if(t.stopPropagation(),confirm(`删除该技能？关联智能体的引用也将被移除。`)){try{await r(`/api/skills/`+encodeURIComponent(e.dataset.delS),{method:`DELETE`})}catch(e){u(e.message,`error`);return}await loadSkills(),await loadAgents(),h(l.currentTab||`skills`,!0)}}),f.querySelectorAll(`.mc-card[data-sid]`).forEach(e=>{let t=l.skills.find(t=>(t.key||t.id)===e.dataset.sid);t&&[`managed`,`repo`].includes(t.source?.kind)&&(e.onclick=()=>showSkillModal(e.dataset.sid))}),e(`#importSkill`).onclick=()=>showExtensionImport(`skill`),e(`#addSkill`).onclick=()=>showSkillModal(null)}else t===`tools`?(f.innerHTML=`
      <h3>内置工具</h3>
      <p class="lead">这些是 MultiChat 自身实现的函数调用能力，不属于 Agent Skills，也不来自 MCP server。停用后不会暴露给模型。</p>
      <div class="card-grid">
        ${(l.tools||[]).map(e=>`<div class="mc-card">
          <div class="mc-top"><div class="mc-ico"><svg viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 1 5 5l-7 7-5 1 1-5z"/><path d="M3 21l6-6"/></svg></div><div style="min-width:0;flex:1;"><div class="mc-title">${i(e.name)}</div><div class="mc-sub">${i(e.id)} · ${i(e.type||`function`)}</div></div></div>
          <div class="mc-desc">${i(e.description||``)}</div>
          <div class="mc-tags">${(e.permissions||[]).map(e=>`<span class="mc-tag">${i(e)}</span>`).join(``)}<span class="mc-tag ${e.enabled?`on`:``}">${e.enabled?`已启用`:`已停用`}</span></div>
          <div class="mc-actions" style="opacity:1;position:static;justify-content:flex-start;"><button type="button" class="mc-toggle ${e.enabled?`on`:``}" data-toggle-tool="${i(e.id)}" aria-pressed="${e.enabled?`true`:`false`}"><span class="mc-switch" aria-hidden="true"></span><span>${e.enabled?`启用中`:`已停用`}</span></button></div>
        </div>`).join(``)||`<div class="extension-empty">没有内置工具。</div>`}
      </div>`,f.querySelectorAll(`[data-toggle-tool]`).forEach(e=>e.onclick=async()=>{let t=l.tools.find(t=>t.id===e.dataset.toggleTool);if(t)try{await r(`/api/tools/`+encodeURIComponent(t.id),{method:`PUT`,body:JSON.stringify({enabled:!t.enabled})}),await loadTools(),h(`tools`,!0),u(t.enabled?`工具已停用`:`工具已启用`)}catch(e){u(e.message,`error`)}})):t===`plugins`?renderPlugins():t===`mcp`?renderMcpServers():t===`capabilities`?g():t===`usage`?y():t===`runs`&&w();d&&(f.scrollTop=Math.min(p,Math.max(0,f.scrollHeight-f.clientHeight)))}function g(){let t=e(`#settingsBody`),n=l.capabilities;if(!n){t.innerHTML=`<h3>能力审计</h3><p class="lead">正在生成能力护照…</p><div class="usage-loading"></div>`;return}let r={plugin:`插件`,skill:`Skill`,mcp:`MCP`,tool:`内置工具`},a={high:`高风险`,medium:`中风险`,low:`低风险`};t.innerHTML=`<section class="passport-page">
    <div class="settings-page-heading"><div><div class="usage-kicker">CAPABILITY PASSPORTS</div><h3>能力审计</h3><p class="lead">统一查看每项能力的来源、版本、权限、信任边界和结构完整性。</p></div><button class="btn-ghost" id="refreshCapabilities">重新扫描</button></div>
    <div class="passport-summary"><span><strong>${n.summary.total}</strong> 项能力</span><span><strong>${n.summary.enabled}</strong> 项启用</span><span class="${n.summary.highRisk?`warn`:``}"><strong>${n.summary.highRisk}</strong> 项高风险</span><span class="${n.summary.issues?`warn`:``}"><strong>${n.summary.issues}</strong> 个待处理问题</span></div>
    <div class="resource-toolbar passport-toolbar"><label class="resource-search"><span>⌕</span><input id="passportSearch" type="search" placeholder="搜索能力、来源或权限" /></label><select id="passportType"><option value="">全部类型</option>${Object.entries(r).map(([e,t])=>`<option value="${e}">${t}</option>`).join(``)}</select><select id="passportRisk"><option value="">全部风险</option><option value="high">高风险</option><option value="medium">中风险</option><option value="low">低风险</option></select><span class="resource-count" id="passportCount">${n.items.length} 项</span></div>
    <div class="passport-grid">${n.items.map(e=>`<article class="passport-card" data-passport data-type="${i(e.type)}" data-risk="${i(e.risk)}" data-search="${i([e.name,e.id,e.source,e.scope,...e.permissions||[]].join(` `).toLowerCase())}">
      <div class="passport-head"><span class="passport-type ${i(e.type)}">${r[e.type]||i(e.type)}</span><span class="passport-risk ${i(e.risk)}">${a[e.risk]||i(e.risk)}</span></div>
      <h4>${i(e.name)}</h4><code>${i(e.id)}</code><p>${i(e.description||`暂无说明`)}</p>
      <dl><div><dt>来源</dt><dd>${i(e.source)} · ${i(e.scope||`project`)}</dd></div><div><dt>版本 / 完整性</dt><dd>${i(e.version||`未声明`)} · ${i(e.integrity||`unknown`)}</dd></div><div><dt>信任</dt><dd>${i(e.trust||`unknown`)}</dd></div></dl>
      <div class="passport-perms">${(e.permissions||[]).map(e=>`<span>${i(e)}</span>`).join(``)||`<span class="none">无特殊权限</span>`}</div>
      ${(e.issues||[]).length?`<div class="passport-issues">${e.issues.map(e=>`<span>${i(e)}</span>`).join(``)}</div>`:`<div class="passport-clean">结构检查通过</div>`}
    </article>`).join(``)}</div><div class="extension-empty" id="passportEmpty" hidden>没有符合筛选条件的能力。</div>
  </section>`;let o=()=>{let r=(e(`#passportSearch`).value||``).trim().toLowerCase(),i=e(`#passportType`).value,a=e(`#passportRisk`).value,o=0;t.querySelectorAll(`[data-passport]`).forEach(e=>{let t=(!r||e.dataset.search.includes(r))&&(!i||e.dataset.type===i)&&(!a||e.dataset.risk===a);e.hidden=!t,t&&(o+=1)}),e(`#passportCount`).textContent=`${o} / ${n.items.length} 项`,e(`#passportEmpty`).hidden=o!==0};e(`#passportSearch`).oninput=o,e(`#passportType`).onchange=o,e(`#passportRisk`).onchange=o,e(`#refreshCapabilities`).onclick=async()=>{l.capabilities=null,g(),await loadCapabilities(),g()}}function _(e){let t=Number(e||0);return t>=1e9?(t/1e9).toFixed(t>=1e10?0:1)+`B`:t>=1e6?(t/1e6).toFixed(t>=1e7?0:1)+`M`:t>=1e3?(t/1e3).toFixed(t>=1e4?0:1)+`K`:t.toLocaleString(`zh-CN`)}function v(e){let t=e||[],n=Math.max(1,...t.map(e=>Number(e.totalTokens||0))),r=710/Math.max(1,t.length),a=t.map((e,t)=>{let a=38+t*r+Math.max(1,r*.16),o=Math.max(2,r*.68),s=178*Number(e.inputTokens||0)/n,c=178*Number(e.outputTokens||0)/n;return`<g><title>${i(e.date)} · ${_(e.totalTokens)} tokens</title><rect class="usage-bar-input" x="${a}" y="${196-s}" width="${o}" height="${s}" rx="2"/><rect class="usage-bar-output" x="${a}" y="${196-s-c}" width="${o}" height="${c}" rx="2"/></g>`}).join(``),o=t.map((e,t)=>`${38+t*r+r/2},${196-178*Number(e.totalTokens||0)/n}`).join(` `),s=[0,.5,1].map(e=>`<g><line x1="38" x2="748" y1="${18+178*(1-e)}" y2="${18+178*(1-e)}"/><text x="0" y="${18+178*(1-e)+4}">${_(n*e)}</text></g>`).join(``),c=t[0]?.date?.slice(5)||``,l=t[t.length-1]?.date?.slice(5)||``;return`<svg class="usage-trend" viewBox="0 0 760 226" role="img" aria-label="每日 Token 用量趋势"><g class="usage-grid">${s}</g>${a}${o?`<polyline class="usage-line" points="${o}"/>`:``}<text class="usage-date" x="38" y="221">${i(c)}</text><text class="usage-date" x="748" y="221" text-anchor="end">${i(l)}</text></svg>`}function y(){let t=e(`#settingsBody`),n=l.usage;if(l.usageLoading&&!n){t.innerHTML=`<h3>用量中心</h3><p class="lead">正在汇总本地运行记录…</p><div class="usage-loading"></div>`;return}let r=n?.totals||{},a=n?.daily?.[n.daily.length-1]||{},o=n?.models||[],s=n?.providers||[],c=[`#6158e8`,`#16aabd`,`#9b77f2`,`#ef9f52`,`#46a575`,`#d65f7a`],u=0,d=o.slice(0,6).map((e,t)=>{let n=u;return u+=Number(e.share||0)*360,`${c[t%c.length]} ${n}deg ${u}deg`}).join(`,`),f=(e,t)=>`<button class="usage-range ${l.usageRange===e?`active`:``}" data-usage-range="${e}">${t}</button>`;t.innerHTML=`
    <section class="usage-page">
      <div class="settings-page-heading usage-heading"><div><div class="usage-kicker">LOCAL USAGE LEDGER</div><h3>每日 Token 用量</h3><p class="lead">按本机请求汇总；上游未返回 usage 时会明确标记为估算，不读取任何提示词正文。</p></div>
        <div class="usage-heading-actions"><div class="usage-ranges">${f(`7`,`近 7 天`)}${f(`30`,`近 30 天`)}${f(`all`,`全部`)}</div><button class="btn-ghost" id="exportUsage">导出 CSV</button></div></div>
      <div class="usage-metrics">
        <article class="usage-metric primary"><span>Token 总量</span><strong>${_(r.totalTokens)}</strong><small>输入 ${_(r.inputTokens)} · 输出 ${_(r.outputTokens)}</small></article>
        <article class="usage-metric"><span>今日用量</span><strong>${_(a.totalTokens)}</strong><small>${a.requests||0} 次模型请求</small></article>
        <article class="usage-metric"><span>有效交互</span><strong>${_(r.messages)}</strong><small>${r.requests||0} 次模型调用</small></article>
        <article class="usage-metric"><span>活跃天数</span><strong>${r.activeDays||0}</strong><small>连续 ${r.currentStreak||0} 天 · 最长 ${r.longestStreak||0} 天</small></article>
      </div>
      <div class="usage-insights">
        <span><i class="success"></i>成功率 <strong>${((r.successRate??1)*100).toFixed(1)}%</strong></span>
        <span>日均 <strong>${_(r.averagePerActiveDay)}</strong></span>
        <span>峰值时段 <strong>${String(r.peakHour||0).padStart(2,`0`)}:00–${String(((r.peakHour||0)+1)%24).padStart(2,`0`)}:00</strong></span>
        <span>真实上报 <strong>${((r.reportedShare||0)*100).toFixed(0)}%</strong></span>
        ${r.estimatedTokens?`<span class="estimate-note">约 ${_(r.estimatedTokens)} Token 为本地估算</span>`:``}
      </div>
      <div class="usage-layout">
        <article class="usage-panel usage-wide"><div class="usage-panel-head"><div><h4>按天趋势</h4><p>紫色为输入，青色为输出；悬停柱形查看当天明细。</p></div><div class="usage-legend"><span class="input"></span>输入 <span class="output"></span>输出</div></div>${v(n?.daily||[])}</article>
        <article class="usage-panel"><div class="usage-panel-head"><div><h4>模型用量</h4><p>选定周期内的 Token 占比</p></div></div><div class="usage-model-wrap"><div class="usage-donut" style="background:conic-gradient(${d||`var(--border-l2) 0 360deg`})"><div><strong>${o.length}</strong><span>模型</span></div></div><div class="usage-model-list">${o.slice(0,6).map((e,t)=>`<div><i style="background:${c[t%c.length]}"></i><span title="${i(e.name)}">${i(e.name)}</span><strong>${(Number(e.share||0)*100).toFixed(1)}%</strong><small>${_(e.totalTokens)}</small></div>`).join(``)||`<p class="usage-empty">还没有用量记录</p>`}</div></div></article>
        <article class="usage-panel usage-wide"><div class="usage-panel-head"><div><h4>活跃热力图</h4><p>最近 26 周的本地模型调用</p></div><span>${n?.heatmap?.filter(e=>e.totalTokens>0).length||0} 个活跃日</span></div><div class="usage-heatmap" aria-label="最近 26 周活跃情况">${(n?.heatmap||[]).map(e=>`<i data-level="${e.totalTokens===0?0:e.totalTokens<1e3?1:e.totalTokens<1e4?2:e.totalTokens<1e5?3:4}"><span>${i(e.date)} · ${_(e.totalTokens)} tokens</span></i>`).join(``)}</div></article>
        <article class="usage-panel"><div class="usage-panel-head"><div><h4>提供方健康</h4><p>请求、用量与错误率</p></div></div><div class="usage-provider-list">${s.map(e=>`<div><span><i></i>${i(e.name)}</span><strong>${_(e.totalTokens)}</strong><small>${e.requests} 次 · ${e.requests?(e.errors/e.requests*100).toFixed(0):0}% 错误</small></div>`).join(``)||`<p class="usage-empty">还没有提供方记录</p>`}</div></article>
      </div>
    </section>`,t.querySelectorAll(`[data-usage-range]`).forEach(e=>e.onclick=async()=>{l.usageRange=e.dataset.usageRange,l.usage=null,y(),await loadUsage(l.usageRange),y()}),e(`#exportUsage`).onclick=()=>{let e=[[`date`,`input_tokens`,`output_tokens`,`total_tokens`,`requests`,`errors`],...(n?.daily||[]).map(e=>[e.date,e.inputTokens,e.outputTokens,e.totalTokens,e.requests,e.errors])],t=new Blob([e.map(e=>e.join(`,`)).join(`
`)],{type:`text/csv;charset=utf-8`}),r=document.createElement(`a`);r.href=URL.createObjectURL(t),r.download=`multichat-usage-${l.usageRange}d.csv`,r.click(),setTimeout(()=>URL.revokeObjectURL(r.href),1e3)}}function b(){showModal({title:`新建工作区`,body:`<form id="workspaceForm"><div class="field"><label>名称</label><input name="name" required placeholder="例如：产品研发" /></div><div class="field"><label>描述</label><input name="description" placeholder="这个工作区用于什么" /></div><div class="row"><button type="button" class="btn-ghost" id="workspaceCancel">取消</button><button class="btn-primary" type="submit">创建</button></div></form>`,onMount:t=>{e(`#workspaceCancel`,t).onclick=closeModal,e(`#workspaceForm`,t).onsubmit=async e=>{e.preventDefault();let t=Object.fromEntries(new FormData(e.target).entries());try{await r(`/api/workspaces`,{method:`POST`,body:JSON.stringify(t)}),await loadWorkspaces(),renderTopbar(),h(`workspace`),closeModal(),u(`工作区已创建`)}catch(e){u(e.message,`error`)}}}})}function x(t=null){let n=t?l.memories.find(e=>e.id===t):null;showModal({title:n?`编辑项目记忆`:`新增项目记忆`,body:`<form id="memoryForm"><div class="field"><label>标题</label><input name="title" required maxlength="120" value="${i(n?.title||``)}" placeholder="例如：代码风格" /></div><div class="field"><label>事实或偏好</label><textarea name="content" required maxlength="4000" rows="6" placeholder="只记录可长期复用、由你确认的信息。">${i(n?.content||``)}</textarea><div class="pmeta">记忆作为上下文参考，不会被当作可执行指令。</div></div><div id="memoryErr" class="auth-error"></div><div class="row"><button type="button" class="btn-ghost" id="memoryCancel">取消</button><button class="btn-primary" type="submit">保存</button></div></form>`,onMount:t=>{e(`#memoryCancel`,t).onclick=closeModal,e(`#memoryForm`,t).onsubmit=async i=>{i.preventDefault();let a={...Object.fromEntries(new FormData(i.target).entries()),projectId:l.selectedProject?.id,enabled:!n||n.enabled!==!1};try{await r(n?`/api/memories/`+n.id:`/api/memories`,{method:n?`PUT`:`POST`,body:JSON.stringify(a)}),await loadProjectControlData(),h(`workspace`,!0),closeModal(),u(`项目记忆已保存`)}catch(n){e(`#memoryErr`,t).textContent=n.message}}}})}function S(){if(!l.selectedWorkspace)return u(`请先选择工作区`,`error`);showModal({title:`新建项目`,body:`<form id="projectForm"><div class="field"><label>名称</label><input name="name" required placeholder="例如：移动端重构" /></div><div class="field"><label>描述</label><input name="description" placeholder="项目目标或范围" /></div><div class="row"><button type="button" class="btn-ghost" id="projectCancel">取消</button><button class="btn-primary" type="submit">创建</button></div></form>`,onMount:t=>{e(`#projectCancel`,t).onclick=closeModal,e(`#projectForm`,t).onsubmit=async e=>{e.preventDefault();let t=Object.fromEntries(new FormData(e.target).entries());t.workspaceId=l.selectedWorkspace.id;try{await r(`/api/projects`,{method:`POST`,body:JSON.stringify(t)}),await loadProjects(),h(`workspace`),closeModal(),u(`项目已创建`)}catch(e){u(e.message,`error`)}}}})}function C(){if(!l.selectedProject)return u(`请先选择项目`,`error`);showModal({title:`从 URL 添加文件`,body:`<form id="assetUrlForm"><div class="field"><label>URL</label><input name="url" type="url" required placeholder="https://example.com/notes.md" /></div><div class="field"><label>显示名称（可选）</label><input name="name" placeholder="自动从 URL 推断" /></div><div id="assetUrlErr" class="auth-error"></div><div class="row"><button type="button" class="btn-ghost" id="assetUrlCancel">取消</button><button class="btn-primary" type="submit">添加</button></div></form>`,onMount:t=>{e(`#assetUrlCancel`,t).onclick=closeModal,e(`#assetUrlForm`,t).onsubmit=async n=>{n.preventDefault();let i=Object.fromEntries(new FormData(n.target).entries());i.projectId=l.selectedProject.id;try{await r(`/api/assets`,{method:`POST`,body:JSON.stringify(i)}),await loadProjects(),h(`workspace`),closeModal(),u(`远程文件已加入项目`)}catch(n){e(`#assetUrlErr`,t).textContent=n.message}}}})}function w(){let t=e(`#settingsBody`),n=l.runs||[],r=n.filter(e=>e.status===`completed`).length,a=n.reduce((e,t)=>e+Number(t.usage?.totalTokens||0),0);t.innerHTML=`
    <div class="settings-page-heading"><div><div class="usage-kicker">RUN FLIGHT RECORDER</div><h3>运行黑匣子</h3><p class="lead">复盘模型请求、工具权限、上下文来源、耗时与 Token；点击记录打开上下文透镜。</p></div><button class="btn-ghost" id="refreshRuns">刷新</button></div>
    <div class="passport-summary"><span><strong>${n.length}</strong> 条记录</span><span><strong>${r}</strong> 次完成</span><span><strong>${_(a)}</strong> tokens</span><span class="${n.length-r?`warn`:``}"><strong>${n.length-r}</strong> 次未完成</span></div>
    <div class="run-list">
      ${n.map(e=>`
        <button class="run-row run-row-button" data-run-id="${i(e.id)}">
          <span class="run-dot ${i(e.status||``)}"></span>
          <div class="run-main"><div class="run-title">${i(e.agentName||e.agentId||`智能体运行`)} <span>${i(e.provider?.name||``)}</span></div><div class="run-meta">${i(e.model||`未指定模型`)} · ${i(e.steps||0)} 步 · ${i(e.toolCalls||0)} 次工具 · ${_(e.usage?.totalTokens||0)} tokens · ${e.finishedAt?((Date.parse(e.finishedAt)-Date.parse(e.startedAt))/1e3).toFixed(1)+`s`:`运行中`}</div></div>
          <span class="run-status">${e.status===`completed`?`已完成`:e.status===`error`?`失败`:e.status===`cancelled`?`已取消`:`进行中`}</span><span class="run-open">›</span>
        </button>`).join(``)||`<div style="color:var(--label-caption);font-size:13px;padding:8px 0;">还没有 Agent 运行记录。</div>`}
    </div>`,e(`#refreshRuns`).onclick=async()=>{await loadRuns(),h(`runs`,!0)},t.querySelectorAll(`[data-run-id]`).forEach(e=>e.onclick=()=>T(e.dataset.runId))}async function T(t){try{let n=await r(`/api/runs/`+encodeURIComponent(t)),a=(n.turns||[]).flatMap(e=>e.steps||[]),o=n.contextManifest||{},s=n.usage||{},c=(e,t)=>`<span><small>${i(e)}</small><strong>${i(t)}</strong></span>`,l=n.status===`completed`?`已完成`:n.status===`error`?`失败`:n.status===`cancelled`?`已取消`:`运行中`;showModal({title:`运行详情 · ${n.agentName||n.agentId}`,body:`<div class="run-detail-summary">${c(`状态`,l)}${c(`模型`,n.model||`—`)}${c(`Token`,_(s.totalTokens||0))}${c(`步骤`,String(a.length))}${c(`策略`,n.toolPolicy===`safe`?`安全`:`自动`)}</div>
        <div class="run-detail-grid"><section><h4>执行时间线</h4><div class="flight-timeline">${a.map((e,t)=>`<article class="flight-step ${i(e.status)}"><i>${t+1}</i><div><strong>${e.kind===`tool_call`?i(e.tool||`工具调用`):`模型请求 · ${i(e.model||``)}`}</strong><p>${e.kind===`tool_call`?`${i((e.permissions||[]).join(`, `)||`无特殊权限`)} · ${i(e.risk||`low`)}`:`${e.messageCount||0} 条上下文 · ${_(e.usage?.total||0)} tokens`}</p>${e.error?`<code>${i(e.error)}</code>`:``}</div><span>${e.durationMs==null?e.status:(e.durationMs/1e3).toFixed(2)+`s`}</span></article>`).join(``)||`<div class="control-empty">没有步骤轨迹。</div>`}</div></section>
        <section><h4>上下文透镜</h4><div class="context-lens"><div><span>消息</span><strong>${o.messages||0}</strong></div><div><span>系统上下文</span><strong>${_(o.systemCharacters||0)} 字</strong></div><div><span>项目文件</span><strong>${(o.assets||[]).length}</strong></div><div><span>记忆</span><strong>${(o.memories||[]).length}</strong></div></div>
        <div class="context-source"><h5>注入来源</h5>${[[`文件`,o.assets],[`记忆`,o.memories],[`Skills`,o.skills],[`工具`,o.tools],[`MCP`,o.mcpServers]].map(([e,t])=>`<div><strong>${e}</strong><span>${(t||[]).map(e=>i(e.name||e.id)).join(`、`)||`无`}</span></div>`).join(``)}</div>
        <div class="context-source"><h5>Token 构成</h5><div><strong>输入</strong><span>${_(s.inputTokens||0)}</span></div><div><strong>输出</strong><span>${_(s.outputTokens||0)}</span></div><div><strong>缓存</strong><span>${_(s.cachedTokens||0)}</span></div><div><strong>估算</strong><span>${_(s.estimatedTokens||0)}</span></div></div></section></div>
        <div class="row"><button class="btn-ghost" id="exportRun">导出运行快照</button><button class="btn-primary" id="closeRunDetail">关闭</button></div>`,onMount:t=>{t.classList.add(`run-detail-modal`),e(`#closeRunDetail`,t).onclick=closeModal,e(`#exportRun`,t).onclick=()=>{let e=new Blob([JSON.stringify(n,null,2)],{type:`application/json`}),t=document.createElement(`a`);t.href=URL.createObjectURL(e),t.download=`${n.id}.json`,t.click(),setTimeout(()=>URL.revokeObjectURL(t.href),1e3)}}})}catch(e){u(e.message,`error`)}}export{p as closeSettings,f as openSettings,g as renderCapabilities,w as renderRuns,h as renderSettings,y as renderUsage,C as showAssetUrlModal,x as showMemoryModal,S as showProjectForm,T as showRunDetail,b as showWorkspaceForm,m as switchSettingsTab};