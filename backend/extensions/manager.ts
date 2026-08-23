'use strict';

// Standard extension registry for Agent Skills, MCP servers and Codex plugins.
//
// The three concepts intentionally remain separate:
//   - Skill: a directory whose entrypoint is SKILL.md.
//   - MCP server: an independently configured connection discovered at runtime.
//   - Plugin: a package rooted at .codex-plugin/plugin.json which may bundle
//             skills, MCP config and other host-specific components.
//
// Built-in repository assets are read from .agents/. User-managed assets live
// below DATA_DIR/extensions so installations persist across app restarts.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const ctx = require('../lib/context');
const { AppError } = require('../lib/errors');
import type { JsonRecord, McpServerRecord, RequestOptions } from '../types';

interface ExtensionState {
  skills: Record<string, JsonRecord>;
  plugins: Record<string, JsonRecord>;
  mcp: Record<string, JsonRecord>;
}

const PROJECT_ROOT = path.resolve(process.env.MULTICHAT_PROJECT_ROOT || path.join(__dirname, '..', '..'));
const MANAGED_ROOT = path.join(ctx.DATA_DIR, 'extensions');
const MANAGED_SKILLS_ROOT = path.join(MANAGED_ROOT, 'skills');
const MANAGED_PLUGINS_ROOT = path.join(MANAGED_ROOT, 'plugins');
const MANAGED_BUILTIN_ROOT = path.join(MANAGED_ROOT, 'builtin');
const DEMO_MCP_SOURCE = path.join(__dirname, 'demo-mcp-server.js');
const DEMO_MCP_ENTRY = path.join(MANAGED_BUILTIN_ROOT, 'demo-mcp-server.js');
const REPO_SKILLS_ROOT = path.join(PROJECT_ROOT, '.agents', 'skills');
const REPO_MARKETPLACE = path.join(PROJECT_ROOT, '.agents', 'plugins', 'marketplace.json');
const USER_SKILLS_ROOT = path.join(os.homedir(), '.agents', 'skills');
const MANAGED_MARKETPLACE = path.join(MANAGED_PLUGINS_ROOT, 'marketplace.json');
const CODEX_CONFIG = path.join(PROJECT_ROOT, '.codex', 'config.toml');
const STATE_FILE = 'extensions_state.json';
const MCP_FILE = 'mcp_servers.json';
const MANAGED_TOML_START = '# >>> MultiChat managed MCP servers';
const MANAGED_TOML_END = '# <<< MultiChat managed MCP servers';
const toolCache = new Map();

function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function jsonClone(value) { return JSON.parse(JSON.stringify(value)); }

function state(): ExtensionState {
  const value = ctx.store.read(STATE_FILE, {}) as Partial<ExtensionState>;
  value.skills ||= {};
  value.plugins ||= {};
  value.mcp ||= {};
  return value as ExtensionState;
}

function saveState(value) { ctx.store.write(STATE_FILE, value); }

function slug(value, label = 'id') {
  const result = String(value || '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  if (!result || result.length > 64) throw new AppError('INVALID_PACKAGE', `${label} 必须是 1-64 位小写字母、数字或连字符`);
  return result;
}

function isInside(root, candidate) {
  const rr = path.resolve(root);
  const cc = path.resolve(candidate);
  return cc === rr || cc.startsWith(rr + path.sep);
}

function yamlScalar(raw) {
  let value = String(raw || '').trim();
  if (!value) return '';
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    if (value[0] === '"') {
      try { return JSON.parse(value); } catch { return value.slice(1, -1); }
    }
    return value.slice(1, -1).replace(/''/g, "'");
  }
  value = value.replace(/\s+#.*$/, '').trim();
  return value;
}

function parseSkillMarkdown(contents: string, file: string) {
  const text = String(contents || '').replace(/^\uFEFF/, '');
  const match = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)([\s\S]*)$/.exec(text);
  if (!match) throw new AppError('INVALID_PACKAGE', `SKILL.md 缺少 YAML frontmatter：${file}`);
  const metadata: JsonRecord = {};
  const lines = match[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const row = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(lines[i]);
    if (!row) continue;
    if (/^[>|][+-]?$/.test(row[2])) {
      const parts = [];
      while (i + 1 < lines.length && /^\s+/.test(lines[i + 1])) parts.push(lines[++i].trim());
      metadata[row[1]] = parts.join(row[2].startsWith('>') ? ' ' : '\n');
    } else metadata[row[1]] = yamlScalar(row[2]);
  }
  if (!metadata.name || !metadata.description) {
    throw new AppError('INVALID_PACKAGE', `SKILL.md 必须包含 name 与 description：${file}`);
  }
  return { metadata, instructions: match[2].trim() };
}

function skillMetadataId(metadata: JsonRecord) {
  const raw = metadata && metadata.metadata;
  if (raw && typeof raw === 'object') {
    return raw['multichat-id'] || raw.multichatId || metadata.name;
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return parsed['multichat-id'] || parsed.multichatId || metadata.name;
    } catch {
      // `metadata` is an optional interoperability field. Invalid or
      // non-JSON metadata must not prevent an otherwise valid Skill loading.
    }
  }
  return metadata.name;
}

function readSkill(skillDir, source) {
  const file = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = parseSkillMarkdown(fs.readFileSync(file, 'utf8'), file);
    const id = String(skillMetadataId(parsed.metadata)).trim();
    const st = fs.statSync(file);
    const currentState = state();
    const stateKey = path.resolve(file).toLowerCase();
    const saved = currentState.skills[stateKey] || {};
    return {
      key: `skill_${crypto.createHash('sha256').update(path.resolve(file).toLowerCase()).digest('hex').slice(0, 16)}`,
      id,
      name: String(parsed.metadata.name),
      description: String(parsed.metadata.description),
      instructions: parsed.instructions,
      type: 'workflow',
      enabled: saved.enabled !== false && source.enabled !== false,
      managed: source.kind === 'managed' || source.kind === 'repo' || source.kind === 'plugin',
      scope: source.scope,
      source,
      path: file,
      directory: skillDir,
      modifiedAt: st.mtime.toISOString(),
      resources: ['scripts', 'references', 'assets'].filter(name => fs.existsSync(path.join(skillDir, name))),
      targets: source.kind === 'plugin' ? ['multichat'] : ['multichat', 'codex'],
    };
  } catch (error) {
    return {
      key: `skill_${crypto.createHash('sha256').update(path.resolve(file).toLowerCase()).digest('hex').slice(0, 16)}`,
      id: path.basename(skillDir),
      name: path.basename(skillDir),
      description: error.message,
      instructions: '',
      type: 'workflow',
      enabled: false,
      managed: source.kind !== 'user',
      scope: source.scope,
      source,
      path: file,
      directory: skillDir,
      invalid: true,
      error: error.message,
      resources: [],
      targets: source.kind === 'plugin' ? ['multichat'] : ['multichat', 'codex'],
    };
  }
}

function scanSkillRoot(root, source) {
  if (!root || !fs.existsSync(root)) return [];
  const out = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    const item = readSkill(path.join(root, entry.name), source);
    if (item) out.push(item);
  }
  return out;
}

function marketplaceSources() {
  return [
    { file: REPO_MARKETPLACE, kind: 'repo', scope: 'project' },
    { file: MANAGED_MARKETPLACE, kind: 'managed', scope: 'global' },
  ].filter(item => fs.existsSync(item.file));
}

function resolveMarketplaceEntry(source, entry) {
  if (!entry || typeof entry !== 'object' || !entry.name || !entry.source) return null;
  if (entry.source.source !== 'local' || typeof entry.source.path !== 'string') return null;
  const root = path.dirname(source.file);
  const pluginDir = path.resolve(root, entry.source.path);
  if (!isInside(root, pluginDir)) return null;
  const manifestFile = path.join(pluginDir, '.codex-plugin', 'plugin.json');
  if (!fs.existsSync(manifestFile)) return null;
  const manifest = readJson(manifestFile, null);
  if (!manifest || typeof manifest !== 'object' || !manifest.name) return null;
  return { source, entry, pluginDir, manifestFile, manifest };
}

function resolvePluginComponentPath(pluginDir, configured, fallback) {
  if (configured === undefined || configured === null) return path.join(pluginDir, fallback);
  if (typeof configured !== 'string' || !configured.startsWith('./')) return null;
  const resolved = path.resolve(pluginDir, configured);
  return isInside(pluginDir, resolved) ? resolved : null;
}

function mcpServerMap(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const object = value as JsonRecord;
  if (object.mcpServers && typeof object.mcpServers === 'object') return object.mcpServers;
  if (object.mcp_servers && typeof object.mcp_servers === 'object') return object.mcp_servers;
  const entries = Object.entries(object).filter(([, item]) => item && typeof item === 'object' && !Array.isArray(item) && (item.command || item.url || item.type));
  return Object.fromEntries(entries);
}

function pluginRecords() {
  const out = [];
  const seen = new Set();
  const currentState = state();
  for (const source of marketplaceSources()) {
    const marketplace = readJson<JsonRecord>(source.file, {});
    for (const entry of Array.isArray(marketplace.plugins) ? marketplace.plugins : []) {
      const resolved = resolveMarketplaceEntry(source, entry);
      if (!resolved) continue;
      const key = `${source.file}:${resolved.manifest.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const { manifest, pluginDir, manifestFile } = resolved;
      const pluginState = currentState.plugins[key] || {};
      const publicKey = `plugin_${crypto.createHash('sha256').update(key.toLowerCase()).digest('hex').slice(0, 16)}`;
      const skillsPath = resolvePluginComponentPath(pluginDir, manifest.skills, 'skills');
      const mcpPath = typeof manifest.mcpServers === 'object'
        ? null
        : resolvePluginComponentPath(pluginDir, manifest.mcpServers, '.mcp.json');
      const countDirs = name => {
        const dir = path.join(pluginDir, name);
        if (!fs.existsSync(dir)) return 0;
        return fs.readdirSync(dir, { withFileTypes: true }).filter(item => item.isDirectory() && !item.name.startsWith('.')).length;
      };
      const mcpJson = mcpPath && fs.existsSync(mcpPath) ? readJson(mcpPath, {}) : {};
      const serverMap = typeof manifest.mcpServers === 'object' ? mcpServerMap(manifest.mcpServers) : mcpServerMap(mcpJson);
      const components = {
        skills: scanSkillRoot(skillsPath, { kind: 'plugin', scope: source.scope, plugin: manifest.name, root: pluginDir }).length,
        mcpServers: serverMap && typeof serverMap === 'object' ? Object.keys(serverMap).length : 0,
        agents: countDirs('agents'),
        commands: countDirs('commands'),
        hooks: fs.existsSync(path.join(pluginDir, 'hooks', 'hooks.json')) || fs.existsSync(path.join(pluginDir, 'hooks.json')) ? 1 : 0,
      };
      out.push({
        key: publicKey,
        id: String(manifest.name),
        name: manifest.interface?.displayName || manifest.name,
        version: manifest.version || '0.0.0',
        description: manifest.interface?.shortDescription || manifest.description || '',
        author: manifest.author?.name || manifest.author || '',
        category: resolved.entry.category || manifest.interface?.category || 'Other',
        enabled: pluginState.enabled !== false,
        installed: pluginState.imported === true,
        imported: pluginState.imported === true,
        removable: pluginState.imported === true && source.kind === 'repo',
        availableInProject: true,
        managed: true,
        source: { kind: source.kind, scope: source.scope, marketplace: source.file, path: pluginDir },
        path: pluginDir,
        manifestPath: manifestFile,
        components,
        policy: resolved.entry.policy || {},
        invalid: !skillsPath || (typeof manifest.mcpServers === 'string' && !mcpPath),
        _key: key,
        _manifest: manifest,
        _skillsPath: skillsPath,
        _mcpPath: mcpPath,
      });
    }
  }
  return out;
}

function listPlugins() {
  return pluginRecords().map(({ _key, _manifest, _skillsPath, _mcpPath, ...item }) => item);
}

function listSkills() {
  const out = [];
  out.push(...scanSkillRoot(MANAGED_SKILLS_ROOT, { kind: 'managed', scope: 'global', root: MANAGED_SKILLS_ROOT }));
  out.push(...scanSkillRoot(REPO_SKILLS_ROOT, { kind: 'repo', scope: 'project', root: REPO_SKILLS_ROOT }));
  if (path.resolve(USER_SKILLS_ROOT) !== path.resolve(MANAGED_SKILLS_ROOT)) {
    out.push(...scanSkillRoot(USER_SKILLS_ROOT, { kind: 'user', scope: 'user', root: USER_SKILLS_ROOT }));
  }
  for (const plugin of pluginRecords()) {
    out.push(...scanSkillRoot(plugin._skillsPath, {
      kind: 'plugin',
      scope: plugin.source.scope,
      plugin: plugin.id,
      root: plugin.path,
      enabled: plugin.enabled,
    }));
  }
  const seen = new Set();
  return out.filter(item => {
    const key = `${item.source.kind}:${item.source.plugin || ''}:${item.path}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
}

function findSkill(id) {
  const matches = listSkills().filter(item => item.key === id || item.id === id || item.name === id);
  if (!matches.length) throw new AppError('NOT_FOUND', 'skill not found');
  if (matches.length > 1 && !matches.some(item => item.key === id)) {
    throw new AppError('CONFLICT', `Skill 标识 ${id} 对应多个来源，请使用 source-qualified key`);
  }
  const exact = matches.find(item => item.key === id);
  if (exact) return exact;
  return matches[0];
}

function formatSkill({ id, name, description, instructions }) {
  const metadata = JSON.stringify({ 'multichat-id': id });
  return `---\nname: ${JSON.stringify(name)}\ndescription: ${JSON.stringify(description)}\nmetadata: ${metadata}\n---\n\n${String(instructions || '').trim()}\n`;
}

function createSkill(input) {
  const name = slug(input.name, 'skill name');
  const id = slug(input.id || name, 'skill id');
  const description = String(input.description || '').trim();
  const instructions = String(input.instructions || '').trim();
  if (!description || !instructions) throw new AppError('INVALID_PACKAGE', 'description 与 instructions 不能为空');
  const dir = path.join(REPO_SKILLS_ROOT, name);
  if (fs.existsSync(dir)) throw new AppError('CONFLICT', 'skill already exists');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), formatSkill({ id, name, description, instructions }), 'utf8');
  return readSkill(dir, { kind: 'repo', scope: 'project', root: REPO_SKILLS_ROOT });
}

function updateSkill(id, input) {
  const item = findSkill(id);
  if (!['managed', 'repo'].includes(item.source.kind)) throw new AppError('PERMISSION_DENIED', '此 Skill 由用户目录或插件提供，请在来源处修改');
  const name = slug(input.name || item.name, 'skill name');
  const description = String(input.description ?? item.description).trim();
  const instructions = String(input.instructions ?? item.instructions).trim();
  if (!name || !description || !instructions) throw new AppError('INVALID_PACKAGE', 'name、description 与 instructions 不能为空');
  fs.writeFileSync(item.path, formatSkill({ id: item.id, name, description, instructions }), 'utf8');
  return readSkill(item.directory, item.source);
}

function setSkillEnabled(id, enabled) {
  const item = findSkill(id);
  const value = state();
  const key = path.resolve(item.path).toLowerCase();
  value.skills[key] = { ...(value.skills[key] || {}), enabled: !!enabled };
  saveState(value);
  return { ok: true, enabled: !!enabled };
}

function deleteSkill(id) {
  const item = findSkill(id);
  if (!['managed', 'repo'].includes(item.source.kind)) throw new AppError('PERMISSION_DENIED', '只能删除 MultiChat 托管或当前项目内的 Skill');
  if (!isInside(item.source.root, item.directory)) throw new AppError('PERMISSION_DENIED', 'skill path escaped managed root');
  fs.rmSync(item.directory, { recursive: true, force: false });
  const agents = ctx.store.read(ctx.AGENT_FILE, []);
  let changed = false;
  for (const agent of agents) {
    const next = (agent.skillIds || []).filter(skillId => skillId !== item.id);
    const nextRefs = (agent.skillRefs || []).filter(skillRef => skillRef !== item.key && skillRef !== item.id);
    if (next.length !== (agent.skillIds || []).length) { agent.skillIds = next; changed = true; }
    if (nextRefs.length !== (agent.skillRefs || []).length) { agent.skillRefs = nextRefs; changed = true; }
  }
  if (changed) ctx.store.write(ctx.AGENT_FILE, agents);
  return { ok: true };
}

function gitDiff(target) {
  const rel = path.relative(PROJECT_ROOT, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return { tracked: false, status: 'external', diff: '' };
  const status = spawnSync('git', ['status', '--short', '--', rel], { cwd: PROJECT_ROOT, encoding: 'utf8', windowsHide: true });
  if (status.error || status.status !== 0) {
    const reason = status.error?.message || String(status.stderr || '').trim() || 'Git status unavailable';
    return { tracked: false, status: 'unavailable', diff: '', error: reason.slice(0, 500) };
  }
  const diffResult = spawnSync('git', ['diff', '--no-ext-diff', '--', rel], { cwd: PROJECT_ROOT, encoding: 'utf8', windowsHide: true });
  if (diffResult.error || diffResult.status !== 0) {
    const reason = diffResult.error?.message || String(diffResult.stderr || '').trim() || 'Git diff unavailable';
    return { tracked: false, status: 'unavailable', diff: '', error: reason.slice(0, 500) };
  }
  let diff = diffResult.stdout || '';
  const statusText = String(status.stdout || '').trim();
  if (!diff && statusText.startsWith('??') && fs.existsSync(target)) {
    const files = [];
    const walk = current => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        if (files.length >= 80 || entry.name === 'node_modules' || entry.name === '.git') continue;
        const absolute = path.join(current, entry.name);
        if (entry.isDirectory()) walk(absolute);
        else if (entry.isFile() && fs.statSync(absolute).size <= 256 * 1024) files.push(absolute);
      }
    };
    if (fs.statSync(target).isFile()) files.push(target); else walk(target);
    const chunks = [];
    let remaining = 120_000;
    for (const file of files) {
      if (remaining <= 0) break;
      let contents;
      try { contents = fs.readFileSync(file, 'utf8'); } catch { continue; }
      if (contents.includes('\0')) continue;
      const header = `+++ ${path.relative(PROJECT_ROOT, file).replace(/\\/g, '/')}`;
      const added = contents.split(/\r?\n/).map(line => `+${line}`).join('\n');
      const chunk = `${header}\n${added}`.slice(0, remaining);
      chunks.push(chunk); remaining -= chunk.length;
    }
    diff = chunks.join('\n\n');
  }
  return { tracked: !statusText.startsWith('??'), status: statusText || 'clean', diff };
}

function pluginDiff(id) {
  const matches = pluginRecords().filter(plugin => plugin.key === id || plugin.id === id);
  if (matches.length > 1 && !matches.some(plugin => plugin.key === id)) throw new AppError('CONFLICT', `插件 ${id} 来自多个 marketplace，请使用 source-qualified key`);
  const item = matches.find(plugin => plugin.key === id) || matches[0];
  if (!item) throw new AppError('NOT_FOUND', 'plugin not found');
  return gitDiff(item.path);
}

function setPluginEnabled(id, enabled) {
  const matches = pluginRecords().filter(plugin => plugin.key === id || plugin.id === id);
  if (matches.length > 1 && !matches.some(plugin => plugin.key === id)) throw new AppError('CONFLICT', `插件 ${id} 来自多个 marketplace，请使用 source-qualified key`);
  const item = matches.find(plugin => plugin.key === id) || matches[0];
  if (!item) throw new AppError('NOT_FOUND', 'plugin not found');
  const value = state();
  value.plugins[item._key] = { ...(value.plugins[item._key] || {}), enabled: !!enabled };
  saveState(value);
  ctx.closeAllMcpClients();
  toolCache.clear();
  return { ok: true, enabled: !!enabled };
}

function markPluginImported(id) {
  const matches = pluginRecords().filter(plugin => plugin.key === id || plugin.id === id);
  const item = matches.find(plugin => plugin.key === id) || matches[0];
  if (!item) throw new AppError('NOT_FOUND', 'plugin not found');
  const value = state();
  value.plugins[item._key] = { ...(value.plugins[item._key] || {}), imported: true, enabled: false };
  saveState(value);
  ctx.closeAllMcpClients();
  toolCache.clear();
  return listPlugins().find(plugin => plugin.key === item.key);
}

function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.multichat-${process.pid}-${crypto.randomBytes(5).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(temp, file);
  } finally {
    if (fs.existsSync(temp)) fs.rmSync(temp, { force: true });
  }
}

function deleteImportedPlugin(id) {
  const matches = pluginRecords().filter(plugin => plugin.key === id || plugin.id === id);
  const item = matches.find(plugin => plugin.key === id) || matches[0];
  if (!item) throw new AppError('NOT_FOUND', 'plugin not found');
  const currentState = state();
  const pluginState = currentState.plugins[item._key] || {};
  const repoPluginRoot = path.join(path.dirname(REPO_MARKETPLACE), 'plugins');
  if (pluginState.imported !== true || item.source.kind !== 'repo' || !isInside(repoPluginRoot, item.path) || path.resolve(item.path) === path.resolve(repoPluginRoot)) {
    throw new AppError('PERMISSION_DENIED', '只能卸载通过 MultiChat 导入的项目插件');
  }
  const marketplace = readJson(REPO_MARKETPLACE, null);
  if (!marketplace || !Array.isArray(marketplace.plugins)) throw new AppError('INVALID_PACKAGE', 'project marketplace.json is invalid');
  const nextMarketplace = { ...marketplace, plugins: marketplace.plugins.filter(entry => entry?.name !== item.id) };
  const allSkills = listSkills();
  const pluginSkills = allSkills.filter(skill => skill.source?.kind === 'plugin' && isInside(item.path, skill.path));
  const pluginSkillKeys = new Set(pluginSkills.map(skill => skill.key));
  const otherSkillIds = new Set(allSkills.filter(skill => !pluginSkillKeys.has(skill.key)).map(skill => skill.id));
  const removableLegacySkillIds = new Set(pluginSkills.map(skill => skill.id).filter(skillId => !otherSkillIds.has(skillId)));
  const pluginMcpIds = pluginMcpRecords().filter(server => server.source?.pluginKey === item.key).map(server => server.id);
  const nextState = jsonClone(currentState);
  delete nextState.plugins[item._key];
  for (const key of Object.keys(nextState.skills)) {
    if (key.startsWith(path.resolve(item.path).toLowerCase() + path.sep)) delete nextState.skills[key];
  }
  for (const serverId of pluginMcpIds) delete nextState.mcp[serverId];

  const originalAgents = ctx.store.read(ctx.AGENT_FILE, []);
  const nextAgents = jsonClone(Array.isArray(originalAgents) ? originalAgents : []);
  const removedMcpIds = new Set(pluginMcpIds);
  let agentsChanged = false;
  for (const agent of nextAgents) {
    const currentSkillRefs = Array.isArray(agent.skillRefs) ? agent.skillRefs : [];
    const currentSkillIds = Array.isArray(agent.skillIds) ? agent.skillIds : [];
    const currentMcpIds = Array.isArray(agent.mcpServerIds) ? agent.mcpServerIds : [];
    const nextSkillRefs = currentSkillRefs.filter(ref => !pluginSkillKeys.has(ref) && !removableLegacySkillIds.has(ref));
    const nextSkillIds = currentSkillIds.filter(ref => !pluginSkillKeys.has(ref) && !removableLegacySkillIds.has(ref));
    const nextMcpIds = currentMcpIds.filter(ref => !removedMcpIds.has(ref));
    if (nextSkillRefs.length !== currentSkillRefs.length) { agent.skillRefs = nextSkillRefs; agentsChanged = true; }
    if (nextSkillIds.length !== currentSkillIds.length) { agent.skillIds = nextSkillIds; agentsChanged = true; }
    if (nextMcpIds.length !== currentMcpIds.length) { agent.mcpServerIds = nextMcpIds; agentsChanged = true; }
  }

  const backup = path.join(repoPluginRoot, `.multichat-remove-${process.pid}-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`);
  fs.renameSync(item.path, backup);
  try {
    writeJsonAtomic(REPO_MARKETPLACE, nextMarketplace);
    saveState(nextState);
    if (agentsChanged) ctx.store.write(ctx.AGENT_FILE, nextAgents);
  } catch (error) {
    const rollbackFailures = [];
    const rollback = (label, action) => {
      try { action(); }
      catch (rollbackError) { rollbackFailures.push(`${label}: ${rollbackError.message}`); }
    };
    rollback('plugin package', () => {
      if (!fs.existsSync(item.path) && fs.existsSync(backup)) fs.renameSync(backup, item.path);
    });
    rollback('marketplace', () => writeJsonAtomic(REPO_MARKETPLACE, marketplace));
    rollback('extension state', () => saveState(currentState));
    if (agentsChanged) rollback('agent references', () => ctx.store.write(ctx.AGENT_FILE, originalAgents));
    if (rollbackFailures.length) error.rollbackFailures = rollbackFailures;
    throw error;
  }
  try { fs.rmSync(backup, { recursive: true, force: true }); }
  catch {
    // All durable registries are committed. A stale hidden backup is safer
    // than reporting failure after a successful transactional uninstall.
  }
  try { ctx.closeAllMcpClients(); } catch { /* uninstall is already committed */ }
  toolCache.clear();
  return { ok: true, id: item.id };
}

function standaloneMcpRecords(): McpServerRecord[] {
  const rows = ctx.store.read(MCP_FILE, []) as unknown;
  return Array.isArray(rows) ? rows : [];
}

function normalizeMcpInput(input: McpServerRecord, previous: McpServerRecord = {}): McpServerRecord {
  const id = slug(input.id || previous.id || input.name, 'server id');
  const transport = (input.transport || previous.transport) === 'http' || input.url ? 'http' : 'stdio';
  const record: McpServerRecord = {
    ...previous,
    id,
    name: String(input.name || previous.name || id).trim(),
    description: String(input.description ?? previous.description ?? '').trim(),
    transport,
    enabled: input.enabled === undefined ? previous.enabled !== false : input.enabled !== false,
    trustLevel: input.trustLevel === undefined ? (previous.trustLevel || 'untrusted') : (input.trustLevel === 'trusted' ? 'trusted' : 'untrusted'),
    allowPrivate: input.allowPrivate === undefined ? previous.allowPrivate === true : input.allowPrivate === true,
    targets: Array.isArray(input.targets) ? input.targets.filter(value => ['multichat', 'codex'].includes(value)) : (previous.targets || ['multichat', 'codex']),
    source: previous.source || input.source || { kind: 'managed', scope: 'project' },
  };
  if (transport === 'stdio') {
    record.command = String(input.command || previous.command || '').trim();
    if (!record.command) throw new AppError('INVALID_PACKAGE', 'STDIO server 必须提供 command');
    record.args = Array.isArray(input.args) ? input.args.map((value, index) => {
      const text = String(value);
      if ((text === '***' || /=\*\*\*$/.test(text)) && previous.args?.[index]) return String(previous.args[index]);
      return text;
    }) : (previous.args || []);
    record.cwd = String(input.cwd ?? previous.cwd ?? '').trim();
    record.env = input.env && typeof input.env === 'object' && !Array.isArray(input.env) ? Object.fromEntries(Object.entries(input.env).map(([key, value]) => [String(key), String(value)])) : (previous.env || {});
    delete record.url;
    delete record.headers;
    delete record.bearerTokenEnvVar;
  } else {
    const requestedUrl = String(input.url || '').trim();
    record.url = requestedUrl.includes('***') && previous.url ? previous.url : String(requestedUrl || previous.url || '').trim();
    if (!/^https?:\/\//i.test(record.url)) throw new AppError('INVALID_PACKAGE', 'HTTP server 必须提供 http(s) URL');
    const parsedUrl = new URL(record.url);
    if (parsedUrl.username || parsedUrl.password) throw new AppError('INVALID_PACKAGE', 'URL 中不能包含用户名或密码，请改用 bearer token 环境变量');
    record.bearerTokenEnvVar = String(input.bearerTokenEnvVar ?? previous.bearerTokenEnvVar ?? '').trim();
    record.headers = input.headers && typeof input.headers === 'object' && !Array.isArray(input.headers) ? Object.fromEntries(Object.entries(input.headers).map(([key, value]) => [String(key), String(value)])) : (previous.headers || {});
    delete record.command;
    delete record.args;
    delete record.cwd;
    delete record.env;
  }
  if ((record.targets || []).includes('codex')) {
    if (record.transport === 'stdio' && redactArgs(record.args || []).some((value, index) => value !== String(record.args[index]))) {
      throw new AppError('INVALID_PACKAGE', '面向 Codex 的 MCP 不能把 token/secret/password 写进 args，请改用环境变量');
    }
    if (record.transport === 'http' && Object.keys(record.headers || {}).length) {
      throw new AppError('INVALID_PACKAGE', '面向 Codex 的 HTTP MCP 不能保存静态 headers，请使用 bearer token 环境变量');
    }
  }
  record.updatedAt = new Date().toISOString();
  return record;
}

function expandEnvironmentTemplate(value) {
  let missing = false;
  const expanded = String(value).replace(/\$\{(?:env:)?([A-Za-z_][A-Za-z0-9_]*)\}/g, (_match, name) => {
    if (process.env[name] === undefined) {
      missing = true;
      return '';
    }
    return process.env[name];
  });
  return { value: expanded, missing };
}

function expandEnvironmentMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    const expanded = expandEnvironmentTemplate(item);
    if (!expanded.missing) out[String(key)] = expanded.value;
  }
  return out;
}

function pluginMcpRecords(): McpServerRecord[] {
  const out: McpServerRecord[] = [];
  const currentState = state();
  for (const plugin of pluginRecords()) {
    let map: JsonRecord = {};
    if (typeof plugin._manifest.mcpServers === 'object') map = mcpServerMap(plugin._manifest.mcpServers);
    else if (plugin._mcpPath && fs.existsSync(plugin._mcpPath)) {
      const json = readJson(plugin._mcpPath, {});
      map = mcpServerMap(json);
    }
    for (const [name, raw] of Object.entries(map || {})) {
      if (!raw || typeof raw !== 'object') continue;
      const id = `${plugin.key}.${name}`;
      const policy = currentState.mcp[id] || {};
      const pluginRootValue = value => String(value).replaceAll('${PLUGIN_ROOT}', plugin.path);
      const pluginMap = value => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [String(key), pluginRootValue(item)]));
      };
      const record: McpServerRecord = {
        id,
        name,
        description: `由插件 ${plugin.name} 提供`,
        transport: raw.type === 'http' || raw.url ? 'http' : 'stdio',
        command: raw.command,
        args: Array.isArray(raw.args) ? raw.args.map(value => String(value).replaceAll('${PLUGIN_ROOT}', plugin.path)) : [],
        cwd: String(raw.cwd || plugin.path).replaceAll('${PLUGIN_ROOT}', plugin.path),
        env: pluginMap(raw.env),
        url: raw.url,
        headers: pluginMap(raw.headers || raw.http_headers),
        bearerTokenEnvVar: raw.bearer_token_env_var || raw.bearerTokenEnvVar || '',
        enabled: plugin.enabled && policy.enabled !== false,
        trustLevel: policy.trustLevel === 'trusted' ? 'trusted' : 'untrusted',
        targets: Array.isArray(policy.targets) ? policy.targets.filter(value => value === 'multichat') : ['multichat'],
        allowPrivate: policy.allowPrivate === true,
        source: { kind: 'plugin', scope: plugin.source.scope, plugin: plugin.id, pluginKey: plugin.key, path: plugin._mcpPath || plugin.manifestPath },
      };
      out.push(record);
    }
  }
  return out;
}

function privateMcpRecords(): McpServerRecord[] {
  return [...standaloneMcpRecords(), ...pluginMcpRecords()];
}

function redactUrl(value) {
  if (!value) return value;
  try {
    const url = new URL(value);
    if (url.username) url.username = 'redacted';
    if (url.password) url.password = 'redacted';
    for (const key of [...url.searchParams.keys()]) url.searchParams.set(key, '***');
    return url.toString();
  } catch { return String(value).replace(/([?&][^=]+)=([^&]+)/g, '$1=***'); }
}

function redactArgs(values) {
  const out = [];
  let redactNext = false;
  for (const raw of values || []) {
    const value = String(raw);
    if (redactNext) { out.push('***'); redactNext = false; continue; }
    if (/^--?(?:api[-_]?key|token|secret|password|authorization)$/i.test(value)) {
      out.push(value); redactNext = true; continue;
    }
    out.push(value.replace(/(--?(?:api[-_]?key|token|secret|password|authorization)=).+/i, '$1***'));
  }
  return out;
}

function publicMcp(record: McpServerRecord) {
  const cached = toolCache.get(record.id);
  return {
    id: record.id,
    name: record.name,
    description: record.description || '',
    transport: record.transport,
    command: record.command,
    args: redactArgs(record.args || []),
    cwd: record.cwd || '',
    url: redactUrl(record.url),
    envKeys: Object.keys(record.env || {}),
    headerKeys: Object.keys(record.headers || {}),
    bearerTokenEnvVar: record.bearerTokenEnvVar || '',
    enabled: record.enabled !== false,
    trustLevel: record.trustLevel || 'untrusted',
    allowPrivate: record.allowPrivate === true,
    targets: record.targets || [],
    source: record.source || { kind: 'managed', scope: 'project' },
    tools: cached?.tools || [],
    status: cached?.status || 'unknown',
    error: cached?.error || null,
    instructions: cached?.instructions || '',
    serverInfo: cached?.serverInfo || null,
    lastCheckedAt: cached?.checkedAt || null,
  };
}

function listMcpServers() { return privateMcpRecords().map(publicMcp); }

function findPrivateMcp(id) {
  const record = privateMcpRecords().find(item => item.id === id);
  if (!record) throw new AppError('NOT_FOUND', 'MCP server not found');
  return record;
}

function createMcpServer(input) {
  const rows = standaloneMcpRecords();
  const record = normalizeMcpInput(input);
  if (rows.some(item => item.id === record.id) || pluginMcpRecords().some(item => item.id === record.id)) throw new AppError('CONFLICT', 'MCP server already exists');
  rows.push(record);
  ctx.store.write(MCP_FILE, rows);
  syncCodexMcpConfig();
  return publicMcp(record);
}

// Import several standalone servers in one registry write.  The importer has
// already performed package inspection, but this function repeats the runtime
// normalization and conflict checks so the final write cannot partially apply.
// Imported servers deliberately remain disabled and untrusted until the user
// reviews and enables them from the MCP page.
function importMcpServers(inputs, conflictPolicy = 'reject') {
  if (!Array.isArray(inputs) || !inputs.length || inputs.length > 50) {
    throw new AppError('INVALID_PACKAGE', 'MCP import must contain 1-50 servers');
  }
  const rows = standaloneMcpRecords();
  const pluginIds = new Set(pluginMcpRecords().map(item => item.id));
  const ids = new Set();
  const normalized = inputs.map(input => {
    const record = normalizeMcpInput({
      ...input,
      enabled: false,
      trustLevel: 'untrusted',
      allowPrivate: false,
      source: { kind: 'managed', scope: 'project', imported: true },
    });
    if (ids.has(record.id)) throw new AppError('CONFLICT', `duplicate MCP server id: ${record.id}`);
    ids.add(record.id);
    if (pluginIds.has(record.id)) throw new AppError('PERMISSION_DENIED', `MCP server ${record.id} is provided by a plugin and cannot be replaced`);
    return record;
  });
  const conflicts = normalized.filter(record => rows.some(item => item.id === record.id));
  const protectedConflicts = conflicts.filter(record => rows.find(item => item.id === record.id)?.source?.kind !== 'managed');
  if (protectedConflicts.length) {
    throw new AppError('PERMISSION_DENIED', `protected MCP server cannot be replaced: ${protectedConflicts.map(item => item.id).join(', ')}`);
  }
  if (conflicts.length && conflictPolicy !== 'replace') {
    throw new AppError('CONFLICT', `MCP server already exists: ${conflicts.map(item => item.id).join(', ')}`);
  }
  const replacedIds = new Set(normalized.map(item => item.id));
  const previous = rows.filter(item => replacedIds.has(item.id));
  const next = [...rows.filter(item => !replacedIds.has(item.id)), ...normalized];
  ctx.store.write(MCP_FILE, next);
  try { syncCodexMcpConfig(); }
  catch (error) {
    ctx.store.write(MCP_FILE, rows);
    try { syncCodexMcpConfig(); } catch { /* preserve the original error */ }
    throw error;
  }
  for (const record of previous) ctx.closeMcpClient(mcpLaunch(record));
  for (const id of replacedIds) toolCache.delete(id);
  return normalized.map(publicMcp);
}

function updateMcpServer(id, input) {
  const rows = standaloneMcpRecords();
  const index = rows.findIndex(item => item.id === id);
  if (index < 0) {
    const pluginRecord = pluginMcpRecords().find(item => item.id === id);
    if (!pluginRecord) throw new AppError('NOT_FOUND', 'MCP server not found');
    const allowed = new Set(['enabled', 'trustLevel', 'targets', 'allowPrivate']);
    if (Object.keys(input).some(key => !allowed.has(key))) throw new AppError('PERMISSION_DENIED', '插件内 MCP server 只能修改启停、信任和作用域策略');
    const value = state();
    value.mcp[id] = {
      ...(value.mcp[id] || {}),
      ...(input.enabled === undefined ? {} : { enabled: input.enabled !== false }),
      ...(input.trustLevel === undefined ? {} : { trustLevel: input.trustLevel === 'trusted' ? 'trusted' : 'untrusted' }),
      ...(input.targets === undefined ? {} : { targets: Array.isArray(input.targets) && input.targets.includes('multichat') ? ['multichat'] : [] }),
      ...(input.allowPrivate === undefined ? {} : { allowPrivate: input.allowPrivate === true }),
    };
    saveState(value);
    ctx.closeMcpClient(mcpLaunch(pluginRecord));
    toolCache.delete(id);
    return publicMcp(pluginMcpRecords().find(item => item.id === id));
  }
  const previousLaunch = mcpLaunch(rows[index]);
  rows[index] = normalizeMcpInput({ ...input, id }, rows[index]);
  ctx.store.write(MCP_FILE, rows);
  ctx.closeMcpClient(previousLaunch);
  toolCache.delete(id);
  syncCodexMcpConfig();
  return publicMcp(rows[index]);
}

function deleteMcpServer(id) {
  const rows = standaloneMcpRecords();
  const previous = rows.find(item => item.id === id);
  const next = rows.filter(item => item.id !== id);
  if (next.length === rows.length) throw new AppError('PERMISSION_DENIED', '插件内 MCP server 不能单独删除');
  ctx.store.write(MCP_FILE, next);
  if (previous) ctx.closeMcpClient(mcpLaunch(previous));
  toolCache.delete(id);
  syncCodexMcpConfig();
  return { ok: true };
}

function mcpLaunch(record: McpServerRecord) {
  if (record.transport === 'http') {
    const headers = expandEnvironmentMap(record.headers);
    if (record.bearerTokenEnvVar && process.env[record.bearerTokenEnvVar]) headers.Authorization = `Bearer ${process.env[record.bearerTokenEnvVar]}`;
    return {
      url: record.url,
      headers,
      fetchImpl: (url, options) => ctx.safeFetch(url, options, record.allowPrivate === true),
    };
  }
  return {
    command: record.command,
    args: record.args || [],
    cwd: record.cwd ? (path.isAbsolute(record.cwd) ? record.cwd : path.resolve(PROJECT_ROOT, record.cwd)) : undefined,
    env: expandEnvironmentMap(record.env),
  };
}

async function discoverMcpTools(id: string, force = false, options: RequestOptions = {}) {
  const record = findPrivateMcp(id);
  if (!record.enabled) throw new AppError('PERMISSION_DENIED', 'MCP server is disabled');
  if (!force && toolCache.get(id)?.status === 'ready') return toolCache.get(id);
  try {
    const client = ctx.getMcpClient(mcpLaunch(record));
    const tools = (await client.listTools(options)).map(tool => ({
      name: String(tool.name || ''),
      description: String(tool.description || ''),
      inputSchema: tool.inputSchema || { type: 'object', properties: {} },
      annotations: tool.annotations || {},
    }));
    const value = { status: 'ready', tools, checkedAt: new Date().toISOString(), error: null, instructions: client.instructions || '', serverInfo: client.serverInfo || null };
    toolCache.set(id, value);
    return value;
  } catch (error) {
    const value = { status: 'error', tools: [], checkedAt: new Date().toISOString(), error: error.message };
    toolCache.set(id, value);
    throw new AppError('MCP_CONNECTION_FAILED', error.message);
  }
}

function toolFunctionName(serverId, toolName) {
  const clean = value => String(value).replace(/[^A-Za-z0-9_-]/g, '_');
  const raw = `mcp__${clean(serverId)}__${clean(toolName)}`;
  if (raw.length <= 64) return raw;
  const suffix = crypto.createHash('sha256').update(`${serverId}\0${toolName}`).digest('hex').slice(0, 10);
  return `${raw.slice(0, 53)}_${suffix}`;
}

async function runtimeMcpTools(serverIds: string[], options: RequestOptions = {}) {
  const ids = new Set(Array.isArray(serverIds) ? serverIds : []);
  const definitions = [];
  const calls = new Map();
  const errors = [];
  const records = privateMcpRecords().filter(item => item.enabled && ids.has(item.id) && (item.targets || []).includes('multichat'));
  const discoveredRecords = await Promise.all(records.map(async record => {
    try { return { record, discovered: await discoverMcpTools(record.id, false, options) }; }
    catch (error) {
      if (options.signal?.aborted) throw error;
      return { record, error };
    }
  }));
  for (const { record, discovered, error } of discoveredRecords) {
    if (error) { errors.push({ serverId: record.id, name: record.name, error: error.message }); continue; }
    for (const tool of discovered.tools) {
      const name = toolFunctionName(record.id, tool.name);
      definitions.push({ type: 'function', function: { name, description: `${tool.description || tool.name} [MCP: ${record.name}]`, parameters: tool.inputSchema || { type: 'object', properties: {} } } });
      calls.set(name, {
        skill: {
          id: `mcp:${record.id}:${tool.name}`,
          name: tool.name,
          description: tool.description || '',
          type: 'mcp',
          enabled: true,
          config: { mcp: mcpLaunch(record), tool: tool.name, permissions: ['external'], trustLevel: record.trustLevel || 'untrusted' },
        },
      });
    }
  }
  return { definitions, calls, errors };
}

function tomlString(value) { return JSON.stringify(String(value)); }
function tomlKey(value) { return /^[A-Za-z0-9_-]+$/.test(value) ? value : tomlString(value); }
function tomlArray(values) { return `[${values.map(tomlString).join(', ')}]`; }

function codexMcpBlock() {
  const lines = [MANAGED_TOML_START, '# Generated from MultiChat MCP registry. Edit servers in MultiChat, not in this block.'];
  for (const record of standaloneMcpRecords().filter(item => item.enabled && (item.targets || []).includes('codex'))) {
    lines.push('', `[mcp_servers.${tomlKey(record.id)}]`);
    if (record.transport === 'http') {
      lines.push(`url = ${tomlString(record.url)}`);
      if (record.bearerTokenEnvVar) lines.push(`bearer_token_env_var = ${tomlString(record.bearerTokenEnvVar)}`);
    } else {
      lines.push(`command = ${tomlString(record.command)}`);
      if ((record.args || []).length) lines.push(`args = ${tomlArray(record.args)}`);
      if (record.cwd) lines.push(`cwd = ${tomlString(record.cwd)}`);
      if (Object.keys(record.env || {}).length) lines.push(`env_vars = ${tomlArray(Object.keys(record.env))}`);
    }
    lines.push('enabled = true');
    lines.push(`default_tools_approval_mode = ${tomlString(record.trustLevel === 'trusted' ? 'auto' : 'prompt')}`);
  }
  lines.push('', MANAGED_TOML_END);
  return lines.join('\n');
}

function syncCodexMcpConfig() {
  fs.mkdirSync(path.dirname(CODEX_CONFIG), { recursive: true });
  const existing = fs.existsSync(CODEX_CONFIG) ? fs.readFileSync(CODEX_CONFIG, 'utf8') : '';
  const pattern = new RegExp(`${MANAGED_TOML_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${MANAGED_TOML_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'g');
  const unmanaged = existing.replace(pattern, '').trimEnd();
  const next = `${unmanaged}${unmanaged ? '\n\n' : ''}${codexMcpBlock()}\n`;
  fs.writeFileSync(CODEX_CONFIG, next, 'utf8');
  return { ok: true, path: CODEX_CONFIG, servers: standaloneMcpRecords().filter(item => item.enabled && (item.targets || []).includes('codex')).length };
}

function migrateLegacyAgents() {
  const agents = ctx.store.read(ctx.AGENT_FILE, []);
  if (!Array.isArray(agents) || !agents.length) return;
  const skills = listSkills();
  const builtinTools = ctx.store.read(ctx.SKILL_FILE, []).filter(item => !['prompt', 'mcp'].includes(item.type));
  const builtinToolIds = new Set(builtinTools.map(item => item.id));
  let changed = false;
  for (const agent of agents) {
    if (!Array.isArray(agent.skillRefs)) {
      agent.skillRefs = (agent.skillIds || []).map(id => skills.find(skill => skill.id === id)?.key).filter(Boolean);
      changed = true;
    }
    const legacyToolIds = (agent.skillIds || []).filter(id => builtinToolIds.has(id));
    if (!Array.isArray(agent.toolIds)) {
      agent.toolIds = legacyToolIds;
      changed = true;
    } else {
      const mergedToolIds = [...new Set([...agent.toolIds, ...legacyToolIds])];
      if (mergedToolIds.length !== agent.toolIds.length) {
        agent.toolIds = mergedToolIds;
        changed = true;
      }
    }
    if (legacyToolIds.length) {
      agent.skillIds = (agent.skillIds || []).filter(id => !builtinToolIds.has(id));
      changed = true;
    }
    if (!Array.isArray(agent.mcpServerIds)) { agent.mcpServerIds = []; changed = true; }
    if ((agent.skillIds || []).some(id => id === 'sk_mcp_time' || id === 'sk_mcp_readfile')) {
      if (!agent.mcpServerIds.includes('multichat-demo')) agent.mcpServerIds.push('multichat-demo');
      agent.skillIds = agent.skillIds.filter(id => id !== 'sk_mcp_time' && id !== 'sk_mcp_readfile');
      agent.name = agent.name === 'MCP 演示助手' ? 'MCP 示例助手' : agent.name;
      agent.description = '接入标准 MCP server 的示例智能体，可获取当前时间并查看项目摘要。';
      agent.systemPrompt = '你是一个接入了 MCP 工具的助手。需要时间时调用 get_current_time；需要了解当前项目时调用 get_project_summary。';
      changed = true;
    }
  }
  if (changed) ctx.store.write(ctx.AGENT_FILE, agents);
}

function ensureDefaults() {
  fs.mkdirSync(MANAGED_SKILLS_ROOT, { recursive: true });
  fs.mkdirSync(MANAGED_PLUGINS_ROOT, { recursive: true });
  fs.mkdirSync(MANAGED_BUILTIN_ROOT, { recursive: true });
  fs.mkdirSync(REPO_SKILLS_ROOT, { recursive: true });
  // Keep the bundled demo server in the persistent data directory. A CLI package
  // may live in an npm cache, while DATA_DIR is stable across downloads/upgrades.
  fs.copyFileSync(DEMO_MCP_SOURCE, DEMO_MCP_ENTRY);
  const existingServers = ctx.store.read(MCP_FILE, null) as McpServerRecord[] | null;
  if (!existingServers) {
    ctx.store.write(MCP_FILE, [{
      id: 'multichat-demo',
      name: 'MultiChat 示例工具',
      description: '标准 MCP STDIO 示例：提供当前时间和项目摘要两个只读工具。',
      transport: 'stdio',
      command: process.execPath,
      args: [DEMO_MCP_ENTRY],
      cwd: PROJECT_ROOT,
      env: {},
      enabled: true,
      trustLevel: 'trusted',
      targets: ['multichat', 'codex'],
      source: { kind: 'builtin', scope: 'project' },
      updatedAt: new Date().toISOString(),
    }]);
  } else {
    const demo = existingServers.find(server => server.id === 'multichat-demo' && server.source?.kind === 'builtin');
    if (demo && (demo.command !== process.execPath || demo.args?.[0] !== DEMO_MCP_ENTRY || demo.cwd !== PROJECT_ROOT)) {
      demo.command = process.execPath;
      demo.args = [DEMO_MCP_ENTRY];
      demo.cwd = PROJECT_ROOT;
      demo.updatedAt = new Date().toISOString();
      ctx.store.write(MCP_FILE, existingServers);
    }
  }
  if (!ctx.store.read(STATE_FILE, null)) saveState(state());
  migrateLegacyAgents();
  syncCodexMcpConfig();
}

module.exports = {
  PROJECT_ROOT,
  MANAGED_ROOT,
  REPO_MARKETPLACE,
  CODEX_CONFIG,
  parseSkillMarkdown,
  mcpServerMap,
  listSkills,
  findSkill,
  createSkill,
  updateSkill,
  setSkillEnabled,
  deleteSkill,
  gitDiff,
  listPlugins,
  setPluginEnabled,
  markPluginImported,
  deleteImportedPlugin,
  pluginDiff,
  listMcpServers,
  createMcpServer,
  importMcpServers,
  updateMcpServer,
  deleteMcpServer,
  discoverMcpTools,
  runtimeMcpTools,
  syncCodexMcpConfig,
  ensureDefaults,
  _test: { expandEnvironmentMap },
};
