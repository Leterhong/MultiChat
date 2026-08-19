import { $, $$, esc, api, toast, state, DEFAULT_PARAMS, loadSelectedAgent, saveSelectedAgent, saveParams } from '../core/index';

/* --------------------------- Import / Export --------------------------- */
function importBarHTML() {
  return `
    <div class="import-bar">
      <span class="import-bar-label">导入 / 引用</span>
      <button class="mini-btn" id="importFile">上传文件 (.json)</button>
      <button class="mini-btn" id="importUrl">URL 导入</button>
      <button class="mini-btn" id="gotoPlugins">从插件市场</button>
      <input type="file" id="importFileInput" accept=".json,application/json" style="display:none" />
    </div>`;
}
async function doImport(spec, sourceLabel) {
  // spec: {skills, agents} 直接包，或 {url} 让后端抓取
  try {
    const body = spec.url ? { url: spec.url, source: sourceLabel } : spec;
    const r = await api('/api/import', { method: 'POST', body: JSON.stringify(body) });
    await loadSkills(); await loadAgents();
    renderSettings(state.currentTab || (spec.agents && !spec.skills ? 'agents' : 'skills'), true);
    renderTopbar();
    if (r.plugin) {
      toast(`已安装插件：${r.plugin.name}（+${r.skills} 技能 / +${r.agents} 智能体，来源：${sourceLabel}）`);
    } else {
      toast(`已导入：+${r.skills} 技能 / +${r.agents} 智能体（来源：${sourceLabel}）`);
    }
    return r;
  } catch (e) { toast(e.message, 'error'); throw e; }
}
function normalizeImport(json) {
  if (Array.isArray(json)) return { skills: json };
  if (json && (json.skills || json.agents)) return json;
  if (json && json.id && json.systemPrompt !== undefined) return { agents: [json] };
  if (json && json.id) return { skills: [json] };
  return json;
}
function wireImportBar() {
  const body = $('#settingsBody');
  const fileBtn = body.querySelector('#importFile');
  const fileInput = body.querySelector('#importFileInput');
  const urlBtn = body.querySelector('#importUrl');
  const plugBtn = body.querySelector('#gotoPlugins');
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
  if (urlBtn) urlBtn.onclick = () => showUrlImport();
  if (plugBtn) plugBtn.onclick = () => showMarketplace();
}

// 市场：列出三类可一键导入的真实来源（由后端以 URL 提供），并支持粘贴任意外部 URL
function showMarketplace() {
  const items = [
    { key: 'skills', icon: '🧩', title: '技能包', url: '/marketplace/skills.json', desc: '社区策展的提示词型技能：专业翻译 / 代码解释 / 长文总结 / SQL 助手。' },
    { key: 'agents', icon: '🤖', title: '智能体包', url: '/marketplace/agents.json', desc: '社区策展的智能体：小红书文案 / 代码审查 / 旅行规划。' },
    { key: 'plugins', icon: '🔌', title: '插件包', url: '/marketplace/plugins.json', desc: '效率合集插件（bundle）：周报 / 会议纪要 / 简历优化 + 全能写作助手。' },
  ];
  showModal({
    title: '从市场导入',
    body: `
      <p class="lead" style="margin-bottom:12px;">挑一个来源一键导入；也可粘贴任意外部 URL（技能/智能体包或插件清单）。</p>
      <div id="mkList">
        ${items.map(it => `
          <div class="mk-card" data-url="${esc(it.url)}" data-title="${esc(it.title)}">
            <div class="mk-ico">${it.icon}</div>
            <div class="mk-body">
              <div class="mk-title">${esc(it.title)}</div>
              <div class="mk-desc">${esc(it.desc)}</div>
              <div class="mk-url">${esc(it.url)}</div>
            </div>
            <button class="btn-primary mk-import" style="width:auto;padding:8px 14px;">导入</button>
          </div>`).join('')}
      </div>
      <div class="mk-divider"><span>或</span></div>
      <div class="row">
        <button type="button" class="btn-ghost" id="mkPaste">粘贴外部 URL 导入</button>
      </div>
      <div id="mkErr" class="auth-error"></div>`,
    onMount: (card) => {
      card.querySelectorAll('.mk-card').forEach(c => {
        c.querySelector('.mk-import').onclick = async () => {
          const url = c.dataset.url, title = c.dataset.title;
          try { await doImport({ url }, '市场·' + title); closeModal(); }
          catch (e) { $('#mkErr', card).textContent = e.message; }
        };
      });
      $('#mkPaste', card).onclick = () => { closeModal(); showUrlImport(); };
    }
  });
}
function showUrlImport() {
  showModal({
    title: '从 URL 导入',
    body: `<form id="urlImportForm">
      <p class="lead" style="margin-bottom:10px;">粘贴一个返回技能 / 智能体 / 插件清单 JSON 的链接。抓取由后端完成，无需对方允许跨域。</p>
      <div class="field"><label>URL</label><input name="url" placeholder="https://example.com/my-pack.json" required /></div>
      <div class="field"><label>来源标记（可选）</label><input name="source" placeholder="my-repo" /></div>
      <div id="urlErr" class="auth-error"></div>
      <div class="row">
        <button type="button" class="btn-ghost" id="urlCancel">取消</button>
        <button type="submit" class="btn-primary" style="width:auto;padding:9px 18px;">导入</button>
      </div>
    </form>`,
    onMount: (card) => {
      $('#urlCancel', card).onclick = closeModal;
      $('#urlImportForm', card).onsubmit = async (e) => {
        e.preventDefault();
        const url = (new FormData(e.target).get('url') || '').toString().trim();
        const source = (new FormData(e.target).get('source') || '').toString().trim() || 'url';
        if (!url) return;
        const errEl = $('#urlErr', card); errEl.textContent = '';
        try {
          await doImport({ url }, source);
          closeModal();
        } catch (e) { errEl.textContent = '导入失败：' + e.message; }
      };
    }
  });
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
      <div class="field"><label>关联技能（多选 · 仅工具类会暴露给 LLM）</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">
          ${state.skills.map(s => {
            const checked = a && (a.skillIds || []).includes(s.id) ? 'checked' : '';
            return `<label style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border:1px solid var(--border-l2);border-radius:8px;font-size:12.5px;cursor:pointer;background:${checked ? 'var(--bg-hover)' : 'var(--bg-elevated)'};">
              <input type="checkbox" name="skill" value="${esc(s.id)}" ${checked} /> ${esc(s.name)}
            </label>`;
          }).join('')}
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
        const body = Object.fromEntries(fd.entries());
        if (body.name) body.name = body.name.trim();
        if (body.description) body.description = body.description.trim();
        body.skillIds = Array.from(e.target.querySelectorAll('input[name="skill"]:checked')).map(cb => cb.value);
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
  const s = editing ? state.skills.find(x => x.id === id) : null;
  showModal({
    title: editing ? '编辑技能' : '新建技能（提示片段）',
    body: `<form id="skillForm">
      <div class="field"><label>技能 ID</label><input name="id" value="${s ? esc(s.id) : ''}" placeholder="my_skill" required pattern="[-a-zA-Z0-9_]+" ${editing ? 'readonly' : ''} />
        <div style="font-size:11.5px;color:var(--label-caption);margin-top:4px;">小写字母、数字、下划线或连字符。</div></div>
      <div class="field"><label>显示名称</label><input name="name" value="${s ? esc(s.name) : ''}" placeholder="我的技能" required /></div>
      <div class="field"><label>描述</label><input name="description" value="${s ? esc(s.description || '') : ''}" placeholder="一句话说明" /></div>
      <div class="field"><label>类型</label><select name="type" ${editing ? 'disabled' : ''}><option value="prompt" selected>prompt（注入系统提示）</option></select>
        <div style="font-size:11.5px;color:var(--label-caption);margin-top:4px;">目前仅开放 prompt 类型。工具类技能（时间/计算/抓取/搜索）请用内置的或扩展后端。</div></div>
      <div class="field"><label>提示内容</label><textarea name="prompt" rows="4" placeholder="注入到 system prompt 的文本...">${s && s.config ? esc(s.config.prompt || '') : ''}</textarea></div>
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
        const body = Object.fromEntries(fd.entries());
        if (body.id) body.id = body.id.trim();
        if (body.name) body.name = body.name.trim();
        if (body.description) body.description = body.description.trim();
        body.config = { prompt: body.prompt || '' };
        delete body.prompt;
        try {
          if (editing) {
            const { id: _id, type: _t, ...rest } = body;
            await api('/api/skills/' + id, { method: 'PUT', body: JSON.stringify(rest) });
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
        const body = Object.fromEntries(fd.entries());
        const raw = (body.models || '').toString();
        body.models = raw.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
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

export { importBarHTML,doImport,normalizeImport,wireImportBar,showMarketplace,showUrlImport,exportEntity,showAgentModal,showSkillModal,BUILTIN_PROVIDERS,showAddBuiltin,showAddCustom };
