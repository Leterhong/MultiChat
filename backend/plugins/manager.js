'use strict';
// ── 插件管理（从 server.js 抽离）：本地插件市场 + MCP 连接器 ─────────────
const ctx = require('../lib/context');
const { AppError } = require('../lib/errors');

function listPluginManifests() {
  if (!ctx.fs.existsSync(ctx.PLUGIN_DIR)) return [];
  const out = [];
  for (const name of ctx.fs.readdirSync(ctx.PLUGIN_DIR)) {
    const dir = ctx.path.join(ctx.PLUGIN_DIR, name);
    if (!ctx.fs.statSync(dir).isDirectory()) continue;
    const mf = ctx.path.join(dir, 'manifest.json');
    if (!ctx.fs.existsSync(mf)) continue;
    try { out.push({ dir, manifest: JSON.parse(ctx.fs.readFileSync(mf, 'utf-8')) }); }
    catch (e) { console.error('[plugin] bad manifest', mf, e.message); }
  }
  return out;
}

function pluginState() { return ctx.store.read(ctx.PLUGIN_STATE, {}); }

function resolveMcpLaunch(manifest, pluginDir) {
  const m = manifest.mcp || {};
  const command = m.command === 'node' ? process.execPath : (m.command || 'node');
  const args = (m.args || []).map(a => ctx.path.isAbsolute(a) ? a : ctx.path.join(pluginDir, a));
  return { command, args, cwd: pluginDir, env: m.env || {} };
}

function installPlugin(manifest, pluginDir) {
  const state = pluginState();
  state[manifest.id] = { installed: true, enabled: true, type: manifest.type, version: manifest.version };
  ctx.store.write(ctx.PLUGIN_STATE, state);

  const skills = ctx.store.read(ctx.SKILL_FILE, []);
  const agents = ctx.store.read(ctx.AGENT_FILE, []);
  const mcpLaunch = manifest.type === 'mcp' ? resolveMcpLaunch(manifest, pluginDir) : null;

  for (const s of (manifest.skills || [])) {
    const clone = JSON.parse(JSON.stringify(s));
    clone._plugin = manifest.id;
    clone.enabled = true;
    if (manifest.type === 'mcp' && clone.type === 'mcp') {
      clone.config = Object.assign({}, clone.config, { mcp: mcpLaunch });
    }
    const idx = skills.findIndex(x => x.id === clone.id);
    if (idx >= 0) skills[idx] = Object.assign({}, skills[idx], clone);
    else skills.push(clone);
  }
  for (const a of (manifest.agents || [])) {
    const clone = JSON.parse(JSON.stringify(a));
    clone._plugin = manifest.id;
    const idx = agents.findIndex(x => x.id === clone.id);
    if (idx >= 0) agents[idx] = Object.assign({}, agents[idx], clone);
    else agents.push(clone);
  }
  ctx.store.write(ctx.SKILL_FILE, skills);
  ctx.store.write(ctx.AGENT_FILE, agents);
  return { skills: (manifest.skills || []).length, agents: (manifest.agents || []).length };
}

function uninstallPlugin(manifest) {
  const state = pluginState();
  delete state[manifest.id];
  ctx.store.write(ctx.PLUGIN_STATE, state);
  let skills = ctx.store.read(ctx.SKILL_FILE, []);
  let agents = ctx.store.read(ctx.AGENT_FILE, []);
  skills = skills.filter(s => s._plugin !== manifest.id);
  agents = agents.filter(a => a._plugin !== manifest.id);
  ctx.store.write(ctx.SKILL_FILE, skills);
  ctx.store.write(ctx.AGENT_FILE, agents);
  return { ok: true };
}

function setPluginEnabled(manifest, enabled) {
  const state = pluginState();
  if (!state[manifest.id]) state[manifest.id] = { installed: true, type: manifest.type, version: manifest.version };
  state[manifest.id].enabled = enabled;
  ctx.store.write(ctx.PLUGIN_STATE, state);
  const skills = ctx.store.read(ctx.SKILL_FILE, []);
  for (const s of skills) if (s._plugin === manifest.id) s.enabled = enabled;
  ctx.store.write(ctx.SKILL_FILE, skills);
  return { ok: true, enabled };
}

// 从 URL 导入插件清单：写入 backend/plugins/<id>/manifest.json 并安装（与本地插件同一路径）
function importPluginFromUrlManifest(manifest, options = {}) {
  const normalized = ctx.normalizePackage(manifest);
  if (!normalized.id || !normalized.type) {
    throw new AppError('INVALID_PACKAGE', '不是合法的插件清单（需含 id 与 type: mcp|bundle）');
  }
  if (options.remote && normalized.type === 'mcp' && !ctx.ALLOW_REMOTE_MCP) {
    throw new AppError('PERMISSION_DENIED', '为避免远程代码执行，远程 MCP 插件默认关闭；设置 MULTICHAT_ALLOW_REMOTE_MCP=1 后重试');
  }
  const dir = ctx.path.join(ctx.PLUGIN_DIR, ctx.safeId(normalized.id, 'plugin id'));
  if (!ctx.fs.existsSync(dir)) ctx.fs.mkdirSync(dir, { recursive: true });
  // 清理该插件此前可能残留的 skills/agents 标记，避免重复累积
  uninstallPlugin(normalized);
  ctx.fs.writeFileSync(ctx.path.join(dir, 'manifest.json'), JSON.stringify(normalized, null, 2));
  const r = installPlugin(normalized, dir);
  return { id: normalized.id, name: normalized.name, type: normalized.type, ...r };
}

module.exports = {
  listPluginManifests,
  pluginState,
  resolveMcpLaunch,
  installPlugin,
  uninstallPlugin,
  setPluginEnabled,
  importPluginFromUrlManifest,
};
