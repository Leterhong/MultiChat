import{a as e,p as t,v as n,x as r,y as i}from"./index-Cv3_ss_R.js";function a(){return`
    <div class="import-bar">
      <span class="import-bar-label">运行配置备份</span>
      <button class="mini-btn" id="importFile">导入配置 JSON</button>
      <input type="file" id="importFileInput" accept=".json,application/json" style="display:none" />
    </div>`}async function o(r,i){try{let a=await e(`/api/import`,{method:`POST`,body:JSON.stringify(r)});return await loadAgents(),renderSettings(t.currentTab||`agents`,!0),renderTopbar(),n(`已导入 ${a.agents} 个运行配置（来源：${i}）`),a}catch(e){throw n(e.message,`error`),e}}function s(e){if(Array.isArray(e))return{agents:e};if(e&&e.agents)return{agents:e.agents};if(e&&typeof e==`object`&&e.id)return{agents:[e]};throw Error(`文件不是 Agent JSON 备份`)}function c(){let e=i(`#settingsBody`),t=e.querySelector(`#importFile`),r=e.querySelector(`#importFileInput`);t&&r&&(t.onclick=()=>r.click(),r.onchange=async()=>{let e=r.files&&r.files[0];if(e){try{let t=await e.text();await o(s(JSON.parse(t)),`文件 `+e.name)}catch(e){n(`解析失败：`+e.message,`error`)}r.value=``}})}function l(e,t){let r=new Blob([JSON.stringify(e,null,2)],{type:`application/json`}),i=document.createElement(`a`);i.href=URL.createObjectURL(r),i.download=(e.id||t)+`.json`,document.body.appendChild(i),i.click(),i.remove(),setTimeout(()=>URL.revokeObjectURL(i.href),1e3),n(`已导出：`+(e.name||e.id))}function u(a){let o=!!a,s=o?t.agents.find(e=>e.id===a):null;showModal({title:o?`编辑运行配置`:`新建运行配置`,body:`<form id="agentForm">
      <div class="field"><label>名称</label><input name="name" value="${s?r(s.name):``}" placeholder="中英翻译" required /></div>
      <div class="field"><label>描述</label><input name="description" value="${s?r(s.description||``):``}" placeholder="一句话说明这套配置适合什么任务" /></div>
      <div class="field"><label>系统提示词 <button type="button" class="btn-ghost tpl-save" id="savePromptTpl" style="float:right;font-size:11px;">存为模板</button></label>
        <select id="promptTplPick" class="form-control" style="margin-bottom:6px;"><option value="">从模板填充…</option></select>
        <textarea name="systemPrompt" rows="4" placeholder="你是一个...">${s?r(s.systemPrompt||``):``}</textarea></div>
      <div class="field"><label>单次最大执行轮数</label><input name="maxIterations" type="number" min="1" max="30" step="1" value="${r(s?.maxIterations||12)}" /><div class="pmeta">达到上限后保存检查点，可在对话中继续运行。</div></div>
      <div class="field"><label>Agent Skills（先提供描述，匹配任务时再加载完整工作流）</label>
        <div class="extension-checks">
          ${t.skills.map(e=>{let t=e.key||e.id,n=s&&(s.skillRefs||s.skillIds)||[],i=n.includes(t)||n.includes(e.id)?`checked`:``;return`<label>
              <input type="checkbox" name="skill" value="${r(t)}" ${i} /> ${r(e.name)} <span class="pmeta">${r(sourceLabel(e.source))}${e.enabled?``:` · 已停用`}</span>
            </label>`}).join(``)||`<span class="pmeta">没有已启用的 Skill</span>`}
        </div>
      </div>
      <div class="field"><label>内置工具（函数调用）</label>
        <div class="extension-checks">
          ${(t.tools||[]).map(e=>{let t=s&&(s.toolIds||[]).includes(e.id)?`checked`:``;return`<label><input type="checkbox" name="tool" value="${r(e.id)}" ${t} /> ${r(e.name)}${e.enabled?``:`（已停用）`}</label>`}).join(``)||`<span class="pmeta">没有已启用的内置工具</span>`}
        </div>
      </div>
      <div class="field"><label>MCP servers（工具由 tools/list 实时发现）</label>
        <div class="extension-checks">
          ${(t.mcpServers||[]).filter(e=>(e.targets||[`multichat`]).includes(`multichat`)).map(e=>{let t=s&&(s.mcpServerIds||[]).includes(e.id)?`checked`:``;return`<label><input type="checkbox" name="mcpServer" value="${r(e.id)}" ${t} /> ${r(e.name)} <span class="pmeta">${(e.tools||[]).length} tools${e.enabled?``:` · 已停用`}</span></label>`}).join(``)||`<span class="pmeta">没有已启用的 MCP server</span>`}
        </div>
      </div>
      <div id="agentErr" class="auth-error"></div>
      <div class="row">
        <button type="button" class="btn-ghost" id="agentCancel">取消</button>
        <button type="submit" class="btn-primary btn-auto">${o?`保存`:`创建`}</button>
      </div>
    </form>`,onMount:r=>{i(`#agentCancel`,r).onclick=closeModal;let c=i(`#promptTplPick`,r),l=r.querySelector(`[name="systemPrompt"]`);(async()=>{try{let t=await e(`/api/prompt-templates`);for(let e of t){let t=document.createElement(`option`);t.value=e.id,t.textContent=e.name,c.appendChild(t)}}catch{}})(),c.onchange=async()=>{if(!c.value)return;let t=(await e(`/api/prompt-templates`)).find(e=>e.id===c.value);t&&(l.value=t.content)},i(`#savePromptTpl`,r).onclick=async()=>{let t=l.value.trim();if(!t){n(`提示词为空，无法存为模板`,`error`);return}let r=await showPrompt({title:`保存为提示词模板`,label:`模板名称`,placeholder:`例如：代码审查员`,maxLength:80});if(r)try{await e(`/api/prompt-templates`,{method:`POST`,body:JSON.stringify({name:r,content:t})});let i=document.createElement(`option`);i.value=(await e(`/api/prompt-templates`)).find(e=>e.name===r)?.id||``,i.textContent=r,i.selected=!0,c.appendChild(i),n(`已保存模板：`+r)}catch(e){n(e.message,`error`)}},i(`#agentForm`,r).onsubmit=async c=>{c.preventDefault();let l=new FormData(c.target),u=Object.fromEntries(l.entries());u.name&&=u.name.trim(),u.description&&=u.description.trim(),u.maxIterations=Math.max(1,Math.min(30,Number.parseInt(u.maxIterations||`12`,10)||12));let d=new Set(t.skills.flatMap(e=>[e.key||e.id,e.id])),f=new Set((t.tools||[]).map(e=>e.id)),p=new Set((t.mcpServers||[]).filter(e=>(e.targets||[`multichat`]).includes(`multichat`)).map(e=>e.id)),m=o?(s?.skillRefs||s?.skillIds||[]).filter(e=>!d.has(e)):[],h=o?(s?.toolIds||[]).filter(e=>!f.has(e)):[],g=o?(s?.mcpServerIds||[]).filter(e=>!p.has(e)):[];u.skillRefs=[...Array.from(c.target.querySelectorAll(`input[name="skill"]:checked`)).map(e=>e.value),...m],u.toolIds=[...Array.from(c.target.querySelectorAll(`input[name="tool"]:checked`)).map(e=>e.value),...h],u.mcpServerIds=[...Array.from(c.target.querySelectorAll(`input[name="mcpServer"]:checked`)).map(e=>e.value),...g];try{o?(await e(`/api/agents/`+a,{method:`PUT`,body:JSON.stringify(u)}),n(`已保存`)):(await e(`/api/agents`,{method:`POST`,body:JSON.stringify(u)}),n(`已创建`)),await loadAgents(),renderSettings(t.currentTab||`agents`,!0),renderTopbar(),closeModal()}catch(e){i(`#agentErr`,r).textContent=e.message}}}})}function d(a){let o=!!a,s=o?t.skills.find(e=>(e.key||e.id)===a):null;showModal({title:o?`编辑 Agent Skill`:`新建 Agent Skill`,body:`<form id="skillForm">
      <div class="field"><label>Skill ID</label><input name="id" value="${s?r(s.id):``}" placeholder="release-notes" required pattern="[a-z0-9-]+" ${o?`readonly`:``} />
        <div class="pmeta">1–64 位小写字母、数字或连字符；写入 SKILL.md frontmatter。</div></div>
      <div class="field"><label>Skill name</label><input name="name" value="${s?r(s.name):``}" placeholder="release-notes" required pattern="[a-z0-9-]+" ${o?`readonly`:``} /></div>
      <div class="field"><label>Description</label><textarea name="description" rows="3" placeholder="说明何时应使用此 Skill，以及它能完成什么。" required>${s?r(s.description||``):``}</textarea></div>
      <div class="field"><label>Instructions（SKILL.md 正文）</label><textarea name="instructions" rows="9" placeholder="# Workflow&#10;&#10;1. ..." required>${s?r(s.instructions||``):``}</textarea>
        <div class="pmeta">需要脚本、参考资料或模板时，可在对应 Skill 目录添加 scripts、references、assets。</div></div>
      <div id="skillErr" class="auth-error"></div>
      <div class="row">
        <button type="button" class="btn-ghost" id="skillCancel">取消</button>
        <button type="submit" class="btn-primary btn-auto">${o?`保存`:`创建`}</button>
      </div>
    </form>`,onMount:r=>{i(`#skillCancel`,r).onclick=closeModal,i(`#skillForm`,r).onsubmit=async s=>{s.preventDefault();let c=new FormData(s.target),l=Object.fromEntries(c.entries());l.id&&=l.id.trim(),l.name&&=l.name.trim(),l.description&&=l.description.trim(),l.instructions&&=l.instructions.trim();try{if(o){let t={...l};delete t.id,await e(`/api/skills/`+encodeURIComponent(a),{method:`PUT`,body:JSON.stringify(t)}),n(`已保存`)}else await e(`/api/skills`,{method:`POST`,body:JSON.stringify(l)}),n(`已创建`);await loadSkills(),renderSettings(t.currentTab||`skills`,!0),closeModal()}catch(e){i(`#skillErr`,r).textContent=e.message}}}})}var f=[{id:`mock`,name:`本地体验（无需密钥）`,apiType:`openai`,baseUrl:`http://127.0.0.1:3099`,models:[`echo`],allowPrivate:!0},{id:`openai`,name:`OpenAI`,apiType:`openai`,baseUrl:`https://api.openai.com/v1`,models:[`gpt-4o`,`gpt-4o-mini`,`gpt-4-turbo`]},{id:`deepseek`,name:`DeepSeek`,apiType:`openai`,baseUrl:`https://api.deepseek.com/v1`,models:[`deepseek-chat`,`deepseek-reasoner`]},{id:`anthropic`,name:`Anthropic`,apiType:`anthropic`,baseUrl:`https://api.anthropic.com/v1`,models:[`claude-3-5-sonnet-latest`,`claude-3-opus-latest`,`claude-3-haiku-latest`]},{id:`gemini`,name:`Google Gemini`,apiType:`openai`,baseUrl:`https://generativelanguage.googleapis.com/v1beta/openai`,models:[`gemini-1.5-pro`,`gemini-1.5-flash`,`gemini-2.0-flash`]},{id:`moonshot`,name:`月之暗面 Kimi`,apiType:`openai`,baseUrl:`https://api.moonshot.cn/v1`,models:[`moonshot-v1-8k`,`moonshot-v1-32k`,`moonshot-v1-128k`]},{id:`zhipu`,name:`智谱 GLM`,apiType:`zhipu`,baseUrl:`https://open.bigmodel.cn/api/paas/v4`,models:[`glm-4-plus`,`glm-4`,`glm-4-air`]},{id:`dashscope`,name:`阿里云 DashScope`,apiType:`openai`,baseUrl:`https://dashscope.aliyuncs.com/compatible-mode/v1`,models:[`qwen-max`,`qwen-plus`,`qwen-turbo`]},{id:`ollama`,name:`Ollama (本地)`,apiType:`ollama`,baseUrl:`http://localhost:11434/v1`,models:[]},{id:`lmstudio`,name:`LM Studio (本地)`,apiType:`lmstudio`,baseUrl:`http://localhost:1234/v1`,models:[]},{id:`siliconflow`,name:`硅基流动 SiliconFlow (注册送额度)`,apiType:`openai`,baseUrl:`https://api.siliconflow.cn/v1`,models:[`Qwen/Qwen2.5-72B-Instruct`,`deepseek-ai/DeepSeek-V3`,`Qwen/Qwen2.5-7B-Instruct`]}];function p(){showModal({title:`添加提供方`,body:`<div class="provider-template-grid">
      ${f.map(e=>`<button class="add-tile" data-id="${e.id}"><div class="tpl-name">${e.name}</div><div class="tpl-meta">${e.apiType} · ${e.baseUrl}</div></button>`).join(``)}
    </div>`,onMount:t=>{t.querySelectorAll(`[data-id]`).forEach(t=>t.onclick=async()=>{let r=f.find(e=>e.id===t.dataset.id);try{await e(`/api/providers`,{method:`POST`,body:JSON.stringify(r)}),await loadProviders(),renderSettings(`providers`,!0),closeModal(),n(`已添加：`+r.name)}catch(e){n(e.message,`error`)}})}})}function m(){showModal({title:`自定义提供方`,body:`<form id="customForm">
      <div class="field"><label>Provider ID（留空自动生成）</label><input name="id" placeholder="留空自动生成，例如 acme-gateway" />
        <div class="field-hint">小写字母、数字、下划线或连字符，唯一标识该提供方；不确定就留空。</div></div>
      <div class="field"><label>模型列表</label><textarea name="models" rows="2" placeholder="deepseek-chat, deepseek-reasoner"></textarea>
        <div class="field-hint">逗号或换行分隔；如不确定可留空，稍后在模型卡片中补充。</div></div>
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
        <button type="submit" class="btn-primary btn-auto">保存</button>
      </div>
    </form>`,onMount:t=>{i(`#customCancel`,t).onclick=closeModal,i(`#customForm`,t).onsubmit=async r=>{r.preventDefault();let a=new FormData(r.target),o=Object.fromEntries(a.entries());o.models=(o.models||``).toString().split(/[,\n]/).map(e=>e.trim()).filter(Boolean),o.allowPrivate=a.get(`allowPrivate`)===`on`,o.id&&=o.id.trim(),o.name&&=o.name.trim();try{await e(`/api/providers`,{method:`POST`,body:JSON.stringify(o)}),await loadProviders(),renderSettings(`providers`,!0),closeModal(),n(`已添加`)}catch(e){i(`#customErr`,t).textContent=e.message}}}})}export{f as BUILTIN_PROVIDERS,o as doImport,l as exportEntity,a as importBarHTML,s as normalizeImport,p as showAddBuiltin,m as showAddCustom,u as showAgentModal,d as showSkillModal,c as wireImportBar};