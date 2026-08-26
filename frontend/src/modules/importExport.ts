import { $, esc, api, toast, state } from '../core/index';

/* --------------------------- Import / Export --------------------------- */
function importBarHTML() {
  return `
    <div class="import-bar">
      <span class="import-bar-label">智能体备份</span>
      <button class="mini-btn" id="importFile">导入 Agent JSON</button>
      <input type="file" id="importFileInput" accept=".json,application/json" style="display:none" />
    </div>`;
}
async function doImport(spec, sourceLabel) {
  try {
    const r = await api('/api/import', { method: 'POST', body: JSON.stringify(spec) });
    await loadAgents();
    renderSettings(state.currentTab || 'agents', true);
    renderTopbar();
    toast(`已导入 ${r.agents} 个智能体（来源：${sourceLabel}）`);
    return r;
  } catch (e) { toast(e.message, 'error'); throw e; }
}
function normalizeImport(json) {
  if (Array.isArray(json)) return { agents: json };
  if (json && json.agents) return { agents: json.agents };
  if (json && typeof json === 'object' && json.id) return { agents: [json] };
  throw new Error('文件不是 Agent JSON 备份');
}
function wireImportBar() {
  const body = $('#settingsBody');
  const fileBtn = body.querySelector('#importFile');
  const fileInput = body.querySelector('#importFileInput');
  if (fileBtn && fileInput) {
    fileBtn.onclick = () => fileInput.click();
    fileInput.onchange = async () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      try {
        const text = await f.text();
        const json = JSON.parse(text);
        await doImport(normalizeImport(json), '文件 ' + f.name);
      } catch (e) { toast('解析失败：' + e.message, 'error'); }
      fileInput.value = '';
    };
  }
}

function exportEntity(entity, kind) {
  const blob = new Blob([JSON.stringify(entity, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (entity.id || kind) + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('已导出：' + (entity.name || entity.id));
}

function showAgentModal(id) {
  const editing = !!id;
  const a = editing ? state.agents.find(x => x.id === id) : null;
  showModal({
    title: editing ? '编辑智能体' : '新建智能体',
    body: `<form id="agentForm">
      <div class="field"><label>名称</label><input name="name" value="${a ? esc(a.name) : ''}" placeholder="中英翻译" required /></div>
      <div class="field"><label>描述</label><input name="description" value="${a ? esc(a.description || '') : ''}" placeholder="一句话描述这个智能体做什么" /></div>
      <div class="field"><label>系统提示词</label><textarea name="systemPrompt" rows="4" placeholder="你是一个...">${a ? esc(a.systemPrompt || '') : ''}</textarea></div>
      <div class="field"><label>Agent Skills（先提供描述，匹配任务时再加载完整工作流）</label>
        <div class="extension-checks">
          ${state.skills.map(s => {
            const ref = s.key || s.id;
            const selected = a ? (a.skillRefs || a.skillIds || []) : [];
            const checked = selected.includes(ref) || selected.includes(s.id) ? 'checked' : '';
            return `<label>
              <input type="checkbox" name="skill" value="${esc(ref)}" ${checked} /> ${esc(s.name)} <span class="pmeta">${esc(sourceLabel(s.source))}${s.enabled ? '' : ' · 已停用'}</span>
            </label>`;
          }).join('') || '<span class="pmeta">没有已启用的 Skill</span>'}
        </div>
      </div>
      <div class="field"><label>内置工具（函数调用）</label>
        <div class="extension-checks">
          ${(state.tools || []).map(t => {
            const checked = a && (a.toolIds || []).includes(t.id) ? 'checked' : '';
            return `<label><input type="checkbox" name="tool" value="${esc(t.id)}" ${checked} /> ${esc(t.name)}${t.enabled ? '' : '（已停用）'}</label>`;
          }).join('') || '<span class="pmeta">没有已启用的内置工具</span>'}
        </div>
      </div>
      <div class="field"><label>MCP servers（工具由 tools/list 实时发现）</label>
        <div class="extension-checks">
          ${(state.mcpServers || []).filter(m => (m.targets || ['multichat']).includes('multichat')).map(m => {
            const checked = a && (a.mcpServerIds || []).includes(m.id) ? 'checked' : '';
            return `<label><input type="checkbox" name="mcpServer" value="${esc(m.id)}" ${checked} /> ${esc(m.name)} <span class="pmeta">${(m.tools || []).length} tools${m.enabled ? '' : ' · 已停用'}</span></label>`;
          }).join('') || '<span class="pmeta">没有已启用的 MCP server</span>'}
        </div>
      </div>
      <div id="agentErr" class="auth-error"></div>
      <div class="row">
        <button type="button" class="btn-ghost" id="agentCancel">取消</button>
        <button type="submit" class="btn-primary" style="width:auto;padding:9px 18px;">${editing ? '保存' : '创建'}</button>
      </div>
    </form>`,
    onMount: (card) => {
      $('#agentCancel', card).onclick = closeModal;
      $('#agentForm', card).onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const body: Record<string, any> = Object.fromEntries(fd.entries());
        if (body.name) body.name = body.name.trim();
        if (body.description) body.description = body.description.trim();
        const knownSkillRefs = new Set(state.skills.flatMap(s => [s.key || s.id, s.id]));
        const knownToolIds = new Set((state.tools || []).map(t => t.id));
        const visibleMcpIds = new Set((state.mcpServers || []).filter(m => (m.targets || ['multichat']).includes('multichat')).map(m => m.id));
        const preservedSkillRefs = editing ? (a?.skillRefs || a?.skillIds || []).filter(ref => !knownSkillRefs.has(ref)) : [];
        const preservedToolIds = editing ? (a?.toolIds || []).filter(ref => !knownToolIds.has(ref)) : [];
        const preservedMcpIds = editing ? (a?.mcpServerIds || []).filter(ref => !visibleMcpIds.has(ref)) : [];
        body.skillRefs = [...Array.from(e.target.querySelectorAll('input[name="skill"]:checked')).map((cb: any) => cb.value), ...preservedSkillRefs];
        body.toolIds = [...Array.from(e.target.querySelectorAll('input[name="tool"]:checked')).map((cb: any) => cb.value), ...preservedToolIds];
        body.mcpServerIds = [...Array.from(e.target.querySelectorAll('input[name="mcpServer"]:checked')).map((cb: any) => cb.value), ...preservedMcpIds];
        try {
            if (editing) {
              await api('/api/agents/' + id, { method: 'PUT', body: JSON.stringify(body) });
              toast('已保存');
            } else {
              await api('/api/agents', { method: 'POST', body: JSON.stringify(body) });
              toast('已创建');
            }
          await loadAgents(); renderSettings(state.currentTab || 'agents', true); renderTopbar(); closeModal();
          } catch (err) { $('#agentErr', card).textContent = err.message; }
      };
    }
  });
}

function showSkillModal(id) {
  const editing = !!id;
  const s = editing ? state.skills.find(x => (x.key || x.id) === id) : null;
  showModal({
    title: editing ? '编辑 Agent Skill' : '新建 Agent Skill',
    body: `<form id="skillForm">
      <div class="field"><label>Skill ID</label><input name="id" value="${s ? esc(s.id) : ''}" placeholder="release-notes" required pattern="[a-z0-9-]+" ${editing ? 'readonly' : ''} />
        <div class="pmeta">1–64 位小写字母、数字或连字符；写入 SKILL.md frontmatter。</div></div>
      <div class="field"><label>Skill name</label><input name="name" value="${s ? esc(s.name) : ''}" placeholder="release-notes" required pattern="[a-z0-9-]+" ${editing ? 'readonly' : ''} /></div>
      <div class="field"><label>Description</label><textarea name="description" rows="3" placeholder="说明何时应使用此 Skill，以及它能完成什么。" required>${s ? esc(s.description || '') : ''}</textarea></div>
      <div class="field"><label>Instructions（SKILL.md 正文）</label><textarea name="instructions" rows="9" placeholder="# Workflow&#10;&#10;1. ..." required>${s ? esc(s.instructions || '') : ''}</textarea>
        <div class="pmeta">需要脚本、参考资料或模板时，可在对应 Skill 目录添加 scripts、references、assets。</div></div>
      <div id="skillErr" class="auth-error"></div>
      <div class="row">
        <button type="button" class="btn-ghost" id="skillCancel">取消</button>
        <button type="submit" class="btn-primary" style="width:auto;padding:9px 18px;">${editing ? '保存' : '创建'}</button>
      </div>
    </form>`,
    onMount: (card) => {
      $('#skillCancel', card).onclick = closeModal;
      $('#skillForm', card).onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const body: Record<string, any> = Object.fromEntries(fd.entries());
        if (body.id) body.id = body.id.trim();
        if (body.name) body.name = body.name.trim();
        if (body.description) body.description = body.description.trim();
        if (body.instructions) body.instructions = body.instructions.trim();
        try {
          if (editing) {
            const rest = { ...body };
            delete rest.id;
            await api('/api/skills/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(rest) });
            toast('已保存');
          } else {
            await api('/api/skills', { method: 'POST', body: JSON.stringify(body) });
            toast('已创建');
          }
          await loadSkills(); renderSettings(state.currentTab || 'skills', true); closeModal();
        } catch (err) { $('#skillErr', card).textContent = err.message; }
      };
    }
  });
}

const BUILTIN_PROVIDERS = [
  { id: 'openai',     name: 'OpenAI',           apiType: 'openai',    baseUrl: 'https://api.openai.com/v1', models: ['gpt-4o','gpt-4o-mini','gpt-4-turbo'] },
  { id: 'deepseek',   name: 'DeepSeek',         apiType: 'openai',    baseUrl: 'https://api.deepseek.com/v1', models: ['deepseek-chat','deepseek-reasoner'] },
  { id: 'anthropic',  name: 'Anthropic',        apiType: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', models: ['claude-3-5-sonnet-latest','claude-3-opus-latest','claude-3-haiku-latest'] },
  { id: 'gemini',     name: 'Google Gemini',    apiType: 'openai',    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', models: ['gemini-1.5-pro','gemini-1.5-flash','gemini-2.0-flash'] },
  { id: 'moonshot',   name: '月之暗面 Kimi',    apiType: 'openai',    baseUrl: 'https://api.moonshot.cn/v1', models: ['moonshot-v1-8k','moonshot-v1-32k','moonshot-v1-128k'] },
  { id: 'zhipu',      name: '智谱 GLM',         apiType: 'zhipu',     baseUrl: 'https://open.bigmodel.cn/api/paas/v4', models: ['glm-4-plus','glm-4','glm-4-air'] },
  { id: 'dashscope',  name: '阿里云 DashScope', apiType: 'openai',    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-max','qwen-plus','qwen-turbo'] },
  { id: 'ollama',     name: 'Ollama (本地)',    apiType: 'ollama',    baseUrl: 'http://localhost:11434/v1', models: [] },
  { id: 'lmstudio',   name: 'LM Studio (本地)', apiType: 'lmstudio',  baseUrl: 'http://localhost:1234/v1', models: [] },
  { id: 'siliconflow', name: '硅基流动 SiliconFlow (注册送额度)', apiType: 'openai', baseUrl: 'https://api.siliconflow.cn/v1', models: ['Qwen/Qwen2.5-72B-Instruct','deepseek-ai/DeepSeek-V3','Qwen/Qwen2.5-7B-Instruct'] }
];
function showAddBuiltin() {
  showModal({
    title: '添加提供方',
    body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      ${BUILTIN_PROVIDERS.map(p => `<button class="add-tile" data-id="${p.id}" style="text-align:left;padding:14px;">
        <div style="font-weight:600;color:var(--label-primary);">${p.name}</div>
        <div style="font-size:11.5px;color:var(--label-caption);margin-top:2px;">${p.apiType} · ${p.baseUrl}</div>
      </button>`).join('')}
    </div>`,
    onMount: (card) => {
      card.querySelectorAll('[data-id]').forEach(b => b.onclick = async () => {
        const tpl = BUILTIN_PROVIDERS.find(p => p.id === b.dataset.id);
        try {
          await api('/api/providers', { method: 'POST', body: JSON.stringify(tpl) });
          await loadProviders(); renderSettings('providers', true); closeModal(); toast('已添加：' + tpl.name);
        } catch (e) { toast(e.message, 'error'); }
      });
    }
  });
}
function showAddCustom() {
  showModal({
    title: '自定义提供方',
    body: `<form id="customForm">
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
    </form>`,
    onMount: (card) => {
      $('#customCancel', card).onclick = closeModal;
      $('#customForm', card).onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const body: Record<string, any> = Object.fromEntries(fd.entries());
        const raw = (body.models || '').toString();
        body.models = raw.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
        body.allowPrivate = fd.get('allowPrivate') === 'on';
        if (body.id) body.id = body.id.trim();
        if (body.name) body.name = body.name.trim();
        try {
          await api('/api/providers', { method: 'POST', body: JSON.stringify(body) });
          await loadProviders(); renderSettings('providers', true); closeModal(); toast('已添加');
        } catch (err) { $('#customErr', card).textContent = err.message; }
      };
    }
  });
}

export { importBarHTML,doImport,normalizeImport,wireImportBar,exportEntity,showAgentModal,showSkillModal,BUILTIN_PROVIDERS,showAddBuiltin,showAddCustom };
