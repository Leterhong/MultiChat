import{$ as e,api as t,esc as n,state as r,toast as i}from"./core-BWSzA0FL.js";function a(){return`
    <div class="import-bar">
      <span class="import-bar-label">运行配置备份</span>
      <button class="mini-btn" id="importFile">导入配置 JSON</button>
      <input type="file" id="importFileInput" accept=".json,application/json" style="display:none" />
    </div>`}async function o(e,n){try{let a=await t(`/api/import`,{method:`POST`,body:JSON.stringify(e)});return await loadAgents(),renderSettings(r.currentTab||`agents`,!0),renderTopbar(),i(`已导入 ${a.agents} 个运行配置（来源：${n}）`),a}catch(e){throw i(e.message,`error`),e}}function s(e){if(Array.isArray(e))return{agents:e};if(e&&e.agents)return{agents:e.agents};if(e&&typeof e==`object`&&e.id)return{agents:[e]};throw Error(`文件不是 Agent JSON 备份`)}function c(){let t=e(`#settingsBody`),n=t.querySelector(`#importFile`),r=t.querySelector(`#importFileInput`);n&&r&&(n.onclick=()=>r.click(),r.onchange=async()=>{let e=r.files&&r.files[0];if(e){try{let t=await e.text();await o(s(JSON.parse(t)),`文件 `+e.name)}catch(e){i(`解析失败：`+e.message,`error`)}r.value=``}})}function l(e,t){let n=new Blob([JSON.stringify(e,null,2)],{type:`application/json`}),r=document.createElement(`a`);r.href=URL.createObjectURL(n),r.download=(e.id||t)+`.json`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(r.href),1e3),i(`已导出：`+(e.name||e.id))}function u(a){let o=!!a,s=o?r.agents.find(e=>e.id===a):null;showModal({title:o?`编辑运行配置`:`新建运行配置`,body:`<form id="agentForm">
      <div class="field"><label>名称</label><input name="name" value="${s?n(s.name):``}" placeholder="中英翻译" required /></div>
      <div class="field"><label>描述</label><input name="description" value="${s?n(s.description||``):``}" placeholder="一句话说明这套配置适合什么任务" /></div>
      <div class="field"><label>系统提示词</label><textarea name="systemPrompt" rows="4" placeholder="你是一个...">${s?n(s.systemPrompt||``):``}</textarea></div>
      <div class="field"><label>Agent Skills（先提供描述，匹配任务时再加载完整工作流）</label>
        <div class="extension-checks">
          ${r.skills.map(e=>{let t=e.key||e.id,r=s&&(s.skillRefs||s.skillIds)||[],i=r.includes(t)||r.includes(e.id)?`checked`:``;return`<label>
              <input type="checkbox" name="skill" value="${n(t)}" ${i} /> ${n(e.name)} <span class="pmeta">${n(sourceLabel(e.source))}${e.enabled?``:` · 已停用`}</span>
            </label>`}).join(``)||`<span class="pmeta">没有已启用的 Skill</span>`}
        </div>
      </div>
      <div class="field"><label>内置工具（函数调用）</label>
        <div class="extension-checks">
          ${(r.tools||[]).map(e=>{let t=s&&(s.toolIds||[]).includes(e.id)?`checked`:``;return`<label><input type="checkbox" name="tool" value="${n(e.id)}" ${t} /> ${n(e.name)}${e.enabled?``:`（已停用）`}</label>`}).join(``)||`<span class="pmeta">没有已启用的内置工具</span>`}
        </div>
      </div>
      <div class="field"><label>MCP servers（工具由 tools/list 实时发现）</label>
        <div class="extension-checks">
          ${(r.mcpServers||[]).filter(e=>(e.targets||[`multichat`]).includes(`multichat`)).map(e=>{let t=s&&(s.mcpServerIds||[]).includes(e.id)?`checked`:``;return`<label><input type="checkbox" name="mcpServer" value="${n(e.id)}" ${t} /> ${n(e.name)} <span class="pmeta">${(e.tools||[]).length} tools${e.enabled?``:` · 已停用`}</span></label>`}).join(``)||`<span class="pmeta">没有已启用的 MCP server</span>`}
        </div>
      </div>
      <div id="agentErr" class="auth-error"></div>
      <div class="row">
        <button type="button" class="btn-ghost" id="agentCancel">取消</button>
        <button type="submit" class="btn-primary" style="width:auto;padding:9px 18px;">${o?`保存`:`创建`}</button>
      </div>
    </form>`,onMount:n=>{e(`#agentCancel`,n).onclick=closeModal,e(`#agentForm`,n).onsubmit=async c=>{c.preventDefault();let l=new FormData(c.target),u=Object.fromEntries(l.entries());u.name&&=u.name.trim(),u.description&&=u.description.trim();let d=new Set(r.skills.flatMap(e=>[e.key||e.id,e.id])),f=new Set((r.tools||[]).map(e=>e.id)),p=new Set((r.mcpServers||[]).filter(e=>(e.targets||[`multichat`]).includes(`multichat`)).map(e=>e.id)),m=o?(s?.skillRefs||s?.skillIds||[]).filter(e=>!d.has(e)):[],h=o?(s?.toolIds||[]).filter(e=>!f.has(e)):[],g=o?(s?.mcpServerIds||[]).filter(e=>!p.has(e)):[];u.skillRefs=[...Array.from(c.target.querySelectorAll(`input[name="skill"]:checked`)).map(e=>e.value),...m],u.toolIds=[...Array.from(c.target.querySelectorAll(`input[name="tool"]:checked`)).map(e=>e.value),...h],u.mcpServerIds=[...Array.from(c.target.querySelectorAll(`input[name="mcpServer"]:checked`)).map(e=>e.value),...g];try{o?(await t(`/api/agents/`+a,{method:`PUT`,body:JSON.stringify(u)}),i(`已保存`)):(await t(`/api/agents`,{method:`POST`,body:JSON.stringify(u)}),i(`已创建`)),await loadAgents(),renderSettings(r.currentTab||`agents`,!0),renderTopbar(),closeModal()}catch(t){e(`#agentErr`,n).textContent=t.message}}}})}function d(a){let o=!!a,s=o?r.skills.find(e=>(e.key||e.id)===a):null;showModal({title:o?`编辑 Agent Skill`:`新建 Agent Skill`,body:`<form id="skillForm">
      <div class="field"><label>Skill ID</label><input name="id" value="${s?n(s.id):``}" placeholder="release-notes" required pattern="[a-z0-9-]+" ${o?`readonly`:``} />
        <div class="pmeta">1–64 位小写字母、数字或连字符；写入 SKILL.md frontmatter。</div></div>
      <div class="field"><label>Skill name</label><input name="name" value="${s?n(s.name):``}" placeholder="release-notes" required pattern="[a-z0-9-]+" ${o?`readonly`:``} /></div>
      <div class="field"><label>Description</label><textarea name="description" rows="3" placeholder="说明何时应使用此 Skill，以及它能完成什么。" required>${s?n(s.description||``):``}</textarea></div>
      <div class="field"><label>Instructions（SKILL.md 正文）</label><textarea name="instructions" rows="9" placeholder="# Workflow&#10;&#10;1. ..." required>${s?n(s.instructions||``):``}</textarea>
        <div class="pmeta">需要脚本、参考资料或模板时，可在对应 Skill 目录添加 scripts、references、assets。</div></div>
      <div id="skillErr" class="auth-error"></div>
      <div class="row">
        <button type="button" class="btn-ghost" id="skillCancel">取消</button>
        <button type="submit" class="btn-primary" style="width:auto;padding:9px 18px;">${o?`保存`:`创建`}</button>
      </div>
    </form>`,onMount:n=>{e(`#skillCancel`,n).onclick=closeModal,e(`#skillForm`,n).onsubmit=async s=>{s.preventDefault();let c=new FormData(s.target),l=Object.fromEntries(c.entries());l.id&&=l.id.trim(),l.name&&=l.name.trim(),l.description&&=l.description.trim(),l.instructions&&=l.instructions.trim();try{if(o){let e={...l};delete e.id,await t(`/api/skills/`+encodeURIComponent(a),{method:`PUT`,body:JSON.stringify(e)}),i(`已保存`)}else await t(`/api/skills`,{method:`POST`,body:JSON.stringify(l)}),i(`已创建`);await loadSkills(),renderSettings(r.currentTab||`skills`,!0),closeModal()}catch(t){e(`#skillErr`,n).textContent=t.message}}}})}var f=[{id:`openai`,name:`OpenAI`,apiType:`openai`,baseUrl:`https://api.openai.com/v1`,models:[`gpt-4o`,`gpt-4o-mini`,`gpt-4-turbo`]},{id:`deepseek`,name:`DeepSeek`,apiType:`openai`,baseUrl:`https://api.deepseek.com/v1`,models:[`deepseek-chat`,`deepseek-reasoner`]},{id:`anthropic`,name:`Anthropic`,apiType:`anthropic`,baseUrl:`https://api.anthropic.com/v1`,models:[`claude-3-5-sonnet-latest`,`claude-3-opus-latest`,`claude-3-haiku-latest`]},{id:`gemini`,name:`Google Gemini`,apiType:`openai`,baseUrl:`https://generativelanguage.googleapis.com/v1beta/openai`,models:[`gemini-1.5-pro`,`gemini-1.5-flash`,`gemini-2.0-flash`]},{id:`moonshot`,name:`月之暗面 Kimi`,apiType:`openai`,baseUrl:`https://api.moonshot.cn/v1`,models:[`moonshot-v1-8k`,`moonshot-v1-32k`,`moonshot-v1-128k`]},{id:`zhipu`,name:`智谱 GLM`,apiType:`zhipu`,baseUrl:`https://open.bigmodel.cn/api/paas/v4`,models:[`glm-4-plus`,`glm-4`,`glm-4-air`]},{id:`dashscope`,name:`阿里云 DashScope`,apiType:`openai`,baseUrl:`https://dashscope.aliyuncs.com/compatible-mode/v1`,models:[`qwen-max`,`qwen-plus`,`qwen-turbo`]},{id:`ollama`,name:`Ollama (本地)`,apiType:`ollama`,baseUrl:`http://localhost:11434/v1`,models:[]},{id:`lmstudio`,name:`LM Studio (本地)`,apiType:`lmstudio`,baseUrl:`http://localhost:1234/v1`,models:[]},{id:`siliconflow`,name:`硅基流动 SiliconFlow (注册送额度)`,apiType:`openai`,baseUrl:`https://api.siliconflow.cn/v1`,models:[`Qwen/Qwen2.5-72B-Instruct`,`deepseek-ai/DeepSeek-V3`,`Qwen/Qwen2.5-7B-Instruct`]}];function p(){showModal({title:`添加提供方`,body:`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      ${f.map(e=>`<button class="add-tile" data-id="${e.id}" style="text-align:left;padding:14px;">
        <div style="font-weight:600;color:var(--label-primary);">${e.name}</div>
        <div style="font-size:11.5px;color:var(--label-caption);margin-top:2px;">${e.apiType} · ${e.baseUrl}</div>
      </button>`).join(``)}
    </div>`,onMount:e=>{e.querySelectorAll(`[data-id]`).forEach(e=>e.onclick=async()=>{let n=f.find(t=>t.id===e.dataset.id);try{await t(`/api/providers`,{method:`POST`,body:JSON.stringify(n)}),await loadProviders(),renderSettings(`providers`,!0),closeModal(),i(`已添加：`+n.name)}catch(e){i(e.message,`error`)}})}})}function m(){showModal({title:`自定义提供方`,body:`<form id="customForm">
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
      <label class="provider-private"><input name="allowPrivate" type="checkbox" /> 允许该提供方访问本机或内网地址（仅本地网关需要）</label>
      <div id="customErr" class="auth-error"></div>
      <div class="row">
        <button type="button" class="btn-ghost" id="customCancel">取消</button>
        <button type="submit" class="btn-primary" style="width:auto;padding:9px 18px;">保存</button>
      </div>
    </form>`,onMount:n=>{e(`#customCancel`,n).onclick=closeModal,e(`#customForm`,n).onsubmit=async r=>{r.preventDefault();let a=new FormData(r.target),o=Object.fromEntries(a.entries());o.models=(o.models||``).toString().split(/[,\n]/).map(e=>e.trim()).filter(Boolean),o.allowPrivate=a.get(`allowPrivate`)===`on`,o.id&&=o.id.trim(),o.name&&=o.name.trim();try{await t(`/api/providers`,{method:`POST`,body:JSON.stringify(o)}),await loadProviders(),renderSettings(`providers`,!0),closeModal(),i(`已添加`)}catch(t){e(`#customErr`,n).textContent=t.message}}}})}export{f as BUILTIN_PROVIDERS,o as doImport,l as exportEntity,a as importBarHTML,s as normalizeImport,p as showAddBuiltin,m as showAddCustom,u as showAgentModal,d as showSkillModal,c as wireImportBar};