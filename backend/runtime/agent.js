'use strict';
// ── Agent Runtime 核心（从 server.js 抽离）：技能 / 智能体 / 运行逻辑 ────
// 本模块不挂载路由，只导出纯逻辑函数，供 routes/chat.js 与 routes/skills.js 复用。
// 升级为结构化 Runtime（Turn/Step/Event）见任务 B1，本轮先完成安全拆分。
const ctx = require('../lib/context');

const SKILL_SCHEMAS = {
  datetime:   { name: 'current_time', desc: '获取当前日期与时间（UTC ISO + 本地格式 + 时区）', params: {} },
  calculator: { name: 'calculate',    desc: '计算数学表达式，如 "2 * (3 + 4)"',                params: { expression: 'string' } },
  web_fetch:  { name: 'fetch_url',    desc: 'HTTP GET 抓取 URL 的文本内容（最多 8000 字符）',    params: { url: 'string' } },
  web_search: { name: 'web_search',   desc: '通过 DuckDuckGo HTML 搜索关键词',                   params: { query: 'string', max_results: 'integer?' } },
  prompt:     null,
};

function skillPermissions(skill) {
  if (Array.isArray(skill?.config?.permissions)) return skill.config.permissions.map(String);
  if (skill?.type === 'web_fetch' || skill?.type === 'web_search') return ['network'];
  if (skill?.type === 'mcp') return ['external'];
  return [];
}

// MCP 连接器的信任等级：trusted（用户已声明信任，直接执行）/ untrusted（默认，执行前需审批）。
// 非 MCP 技能无信任等级概念（按 permission 兜底）。
function trustLevel(skill) {
  if (skill?.type !== 'mcp') return null;
  const t = String(skill?.config?.trustLevel || 'untrusted').toLowerCase();
  return t === 'trusted' ? 'trusted' : 'untrusted';
}

// 运行时判断：该技能的工具调用是否需要「用户审批」后才执行。
// - safe 模式下不进入审批（直接拒绝，见 isSkillAllowed）
// - 无任何权限声明 → 不需要审批
// - MCP 且信任等级为 trusted → 不需要审批
// - 其余（network/filesystem/process/external 等危险权限，或 untrusted MCP）→ 需要审批
function requiresApproval(skill, policy) {
  if (policy === 'safe') return false;
  const perms = skillPermissions(skill);
  if (!perms.length) return false;
  if (skill?.type === 'mcp' && trustLevel(skill) === 'trusted') return false;
  return true;
}

// 把权限集合映射为风险等级，用于前端审批卡片的视觉提示。
function riskLevel(perms) {
  if (!Array.isArray(perms) || !perms.length) return 'low';
  const dangerous = perms.filter(p => ['filesystem', 'process', 'external'].includes(p));
  return dangerous.length ? 'high' : 'medium';
}

function publicSkill(skill) {
  const trust = trustLevel(skill);
  const perms = skillPermissions(skill);
  const needsApproval = perms.length > 0 && !(skill?.type === 'mcp' && trust === 'trusted');
  return { ...skill, permissions: perms, trustLevel: trust, requiresApproval: needsApproval };
}

function isSkillAllowed(skill, policy) {
  if (policy !== 'safe') return true;
  return skillPermissions(skill).every(permission => !['network', 'filesystem', 'process', 'external'].includes(permission));
}

function buildToolsFor(skills) {
  const tools = [];
  for (const s of skills) {
    if (!s.enabled) continue;
    // MCP 连接器类型：直接用插件声明的工具名与参数 schema 暴露给 LLM
    if (s.type === 'mcp' && s.config && s.config.tool) {
      tools.push({
        type: 'function',
        function: {
          name: s.config.tool,
          description: s.description || ('MCP tool: ' + s.config.tool),
          parameters: s.config.schema || { type: 'object', properties: {}, required: [] },
        },
      });
      continue;
    }
    const sc = SKILL_SCHEMAS[s.type];
    if (!sc) continue;
    const properties = {};
    const required = [];
    for (const [k, v] of Object.entries(sc.params || {})) {
      const isOpt = v.endsWith('?');
      const baseType = v.replace(/\?$/, '');
      properties[k] = baseType === 'integer' ? { type: 'integer' } : { type: 'string' };
      if (!isOpt) required.push(k);
    }
    const permissionText = skillPermissions(s).length ? ` [permissions: ${skillPermissions(s).join(', ')}]` : '';
    tools.push({ type: 'function', function: { name: sc.name, description: sc.desc + permissionText, parameters: { type: 'object', properties, required } } });
  }
  return tools;
}

async function executeSkill(skill, args) {
  const wrap = (val) => ({ ok: true, data: val });
  const fail = (msg) => ({ ok: false, error: msg });
  try {
    switch (skill.type) {
      case 'datetime':
        return wrap({ utc: new Date().toISOString(), local: new Date().toString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      case 'calculator': {
        const expr = String((args && args.expression) || '').trim();
        if (!expr) return fail('expression is required');
        if (!/^[\d+\-*/().,\s%. ]+$/.test(expr)) return fail('expression contains disallowed characters');
        try { return wrap(String(Function('return (' + expr + ')')())); }
        catch (e) { return fail('eval error: ' + e.message); }
      }
      case 'web_fetch': {
        const url = String((args && args.url) || '').trim();
        if (!/^https?:\/\//i.test(url)) return fail('only http(s) URL allowed');
        const r = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Mozilla/5.0 (MultiChat)' } });
        if (!r.ok) return fail('HTTP ' + r.status);
        const text = await r.text();
        return wrap({ url, status: r.status, length: text.length, content: text.substring(0, 8000) });
      }
      case 'web_search': {
        const q = String((args && args.query) || '').trim();
        if (!q) return fail('query is required');
        const max = Math.min(10, parseInt((args && args.max_results) || 5, 10));
        const u = 'https://duckduckgo.com/html/?q=' + encodeURIComponent(q);
        const r = await fetch(u, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!r.ok) return fail('HTTP ' + r.status);
        const text = await r.text();
        const results = [];
        const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
        let m;
        while ((m = re.exec(text)) && results.length < max) {
          results.push({ title: m[2].replace(/<[^>]+>/g, '').trim(), url: m[1] });
        }
        return wrap(results);
      }
      case 'prompt':
        return wrap(skill.config?.prompt || skill.description || '');
      case 'mcp': {
        const launch = skill.config && skill.config.mcp;
        const tool = skill.config && skill.config.tool;
        if (!launch || !tool) return fail('mcp skill missing launch config or tool name');
        const client = ctx.getMcpClient(launch);
        if (!client) return fail('cannot start mcp client');
        const r = await client.callTool(tool, args);
        if (!r) return fail('empty mcp response');
        if (r.isError) return fail(String(r.content && r.content[0] && r.content[0].text || 'mcp error'));
        const text = (r.content || []).map(c => c.text || '').join('\n');
        return wrap(text);
      }
      default:
        return fail('unknown skill type: ' + skill.type);
    }
  } catch (e) {
    return fail(e.message);
  }
}

function findSkillForTool(name, skills) {
  for (const s of skills) {
    if (s.type === 'mcp' && s.config && s.config.tool === name) return s;
    const sc = SKILL_SCHEMAS[s.type];
    if (sc && sc.name === name) return s;
  }
  return null;
}

function buildAgentSystemText(agent, skills) {
  const parts = [];
  if (agent.systemPrompt && agent.systemPrompt.trim()) parts.push(agent.systemPrompt.trim());
  for (const sId of (agent.skillIds || [])) {
    const s = skills.find(x => x.id === sId);
    if (!s || !s.enabled || s.type !== 'prompt') continue;
    const body = s.config?.prompt || s.description;
    if (body) parts.push('[Skill: ' + s.name + ']\n' + body);
  }
  return parts.join('\n\n');
}

function buildAssetContext(projectId, assetIds) {
  if (!projectId) return '';
  // 传入数组（含空数组）即严格按数组：空数组 => 不注入任何文件；
  // 仅当未提供 assetIds（undefined）时才回落「注入该项目全部资产」，保持向后兼容。
  const requested = Array.isArray(assetIds) ? new Set(assetIds) : null;
  const rows = ctx.workspaceStore.assets().filter(asset => asset.projectId === projectId && (!requested || requested.has(asset.id)));
  let total = 0;
  const parts = [];
  for (const asset of rows) {
    const content = String(asset.content || '');
    if (!content) continue;
    const remaining = 60_000 - total;
    if (remaining <= 0) break;
    const excerpt = content.slice(0, remaining);
    parts.push(`### ${asset.name}\n${excerpt}`);
    total += excerpt.length;
  }
  return parts.length ? '[Project files]\n' + parts.join('\n\n') : '';
}

function defaultSkills() {
  return [
    { id: 'sk_datetime',   name: '当前时间',   description: '返回当前日期与时间（UTC + 本地 + 时区）', type: 'datetime',   enabled: true, config: {} },
    { id: 'sk_calculator', name: '计算器',     description: '评估数学表达式',                          type: 'calculator', enabled: true, config: {} },
    { id: 'sk_web_fetch',  name: '网页抓取',   description: 'GET 抓取 URL 文本内容',                   type: 'web_fetch',  enabled: true, config: {} },
    { id: 'sk_web_search', name: '联网搜索',   description: '通过 DuckDuckGo 搜索',                    type: 'web_search', enabled: true, config: {} },
  ];
}

function defaultAgents() {
  const now = new Date().toISOString();
  return [
    { id: 'ag_translator', name: '中英翻译',     description: '中英文互译，只输出译文',                systemPrompt: '你是一个翻译引擎。用户给中文就翻译成英文；给英文就翻译成中文。严格只输出译文，不要任何解释、注释或前缀。', skillIds: [], createdAt: now },
    { id: 'ag_researcher', name: '联网研究助手', description: '可联网搜索 + 抓取网页 + 报时，答案末尾标注 [n] 来源 URL', systemPrompt: '你是一个研究员，可以联网获取最新信息。回答末尾用 [1]、[2] 这样的脚注标注信息来源的 URL，便于用户查证。', skillIds: ['sk_web_search', 'sk_web_fetch', 'sk_datetime'], createdAt: now },
    { id: 'ag_devops',     name: '运维小助手',   description: '系统运维：算时间 + 算表达式 + 抓 URL 验证', systemPrompt: '你是一个 Linux/系统运维助手。回答简洁准确，需要时使用工具查时间、计算、抓网页验证信息。', skillIds: ['sk_datetime', 'sk_calculator', 'sk_web_fetch'], createdAt: now },
  ];
}

function ensureSeed() {
  let seeded = false;
  if (!ctx.fs.existsSync(ctx.path.join(ctx.DATA_DIR, ctx.SKILL_FILE))) { ctx.store.write(ctx.SKILL_FILE, defaultSkills()); seeded = true; }
  if (!ctx.fs.existsSync(ctx.path.join(ctx.DATA_DIR, ctx.AGENT_FILE))) { ctx.store.write(ctx.AGENT_FILE, defaultAgents()); seeded = true; }
  ctx.workspaceStore.ensureSeed();
  return seeded;
}

// ── Run（运行历史）：结构化 Turn / Step 轨迹 ───────────────────────────
// 一次用户请求 = 一个 Turn；Turn 内每次模型请求或工具执行 = 一个 Step。
// run.turns 保存完整执行轨迹，支持恢复、重放、导出。
function createRun(agent, body) {
  const run = {
    id: 'run_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    agentId: agent.id,
    agentName: agent.name,
    model: String(body.model || ''),
    toolPolicy: body.toolPolicy === 'safe' ? 'safe' : 'auto',
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    steps: 0,
    toolCalls: 0,
    error: null,
    turns: [],
    approvals: [],
  };
  return ctx.store.mutate(ctx.RUN_FILE, (runs) => {
    runs.unshift(run);
    return runs.slice(0, ctx.MAX_RUNS);
  }, []).then(() => run);
}

// 把内存中 run 的最新 steps / toolCalls / turns / status 落库（每步调用，支持重放/恢复）。
function persistRun(run) {
  if (!run || !run.id) return Promise.resolve();
  return ctx.store.mutate(ctx.RUN_FILE, (runs) => {
    const idx = runs.findIndex(x => x.id === run.id);
    if (idx < 0) return runs;
    runs[idx] = { ...runs[idx], ...run };
    return runs;
  }, []);
}

function finishRun(run, patch = {}) {
  if (!run || !run.id) return Promise.resolve();
  return ctx.store.mutate(ctx.RUN_FILE, (runs) => {
    const idx = runs.findIndex(x => x.id === run.id);
    if (idx < 0) return runs;
    runs[idx] = { ...runs[idx], ...run, ...patch, finishedAt: patch.finishedAt || new Date().toISOString() };
    return runs;
  });
}

module.exports = {
  SKILL_SCHEMAS,
  skillPermissions,
  trustLevel,
  requiresApproval,
  riskLevel,
  publicSkill,
  isSkillAllowed,
  buildToolsFor,
  executeSkill,
  findSkillForTool,
  buildAgentSystemText,
  buildAssetContext,
  defaultSkills,
  defaultAgents,
  ensureSeed,
  createRun,
  persistRun,
  finishRun,
};
