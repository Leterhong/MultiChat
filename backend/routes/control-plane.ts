'use strict';
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const ctx = require('../lib/context');
const agentRuntime = require('../runtime/agent');
const extensions = require('../extensions/manager');

const MEMORY_FILE = 'memories.json';
const SNAPSHOT_FILE = 'snapshots.json';

function now() { return new Date().toISOString(); }
function cleanText(value, max) { return String(value || '').trim().slice(0, max); }
function risk(permissions) {
  if ((permissions || []).some(item => ['filesystem', 'process', 'external'].includes(item))) return 'high';
  if ((permissions || []).length) return 'medium';
  return 'low';
}
function sourceOf(item) {
  return item.source?.kind || (item.managed ? 'managed' : 'builtin');
}
function gitState() {
  const root = ctx.path.resolve(process.env.MULTICHAT_PROJECT_ROOT || ctx.path.join(ctx.BACKEND_ROOT, '..'));
  const run = args => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout: 3000, windowsHide: true });
    return result.status === 0 ? String(result.stdout || '').trim() : '';
  };
  return { branch: run(['branch', '--show-current']) || null, commit: run(['rev-parse', '--short', 'HEAD']) || null, dirty: Boolean(run(['status', '--porcelain'])) };
}

function capabilityPassports() {
  const skills = extensions.listSkills().map(item => ({
    type: 'skill', id: item.key || item.id, name: item.name, version: item.modifiedAt || null,
    description: item.description || '', enabled: item.enabled !== false, source: sourceOf(item), scope: item.scope || item.source?.scope || 'project',
    permissions: [], risk: item.invalid ? 'high' : 'low', trust: item.invalid ? 'invalid' : 'reviewed-local',
    integrity: item.invalid ? 'invalid' : 'discovered', path: item.path || null, issues: item.invalid ? [item.error || 'Skill 格式无效'] : [],
  }));
  const tools = ctx.store.read(ctx.SKILL_FILE, []).filter(item => !['prompt', 'mcp'].includes(item.type)).map(item => {
    const permissions = agentRuntime.skillPermissions(item);
    return { type: 'tool', id: item.id, name: item.name, description: item.description || '', enabled: item.enabled !== false, source: 'builtin', scope: 'runtime', permissions, risk: risk(permissions), trust: 'first-party', integrity: 'built-in', issues: [] };
  });
  const mcp = extensions.listMcpServers().map(item => {
    const permissions = ['network', 'external'];
    const issues = [];
    if (item.trustLevel !== 'trusted') issues.push('未标记为可信，调用前需要审批');
    if (item.lastError) issues.push(item.lastError);
    return { type: 'mcp', id: item.id, name: item.name, description: item.description || '', enabled: item.enabled !== false, source: sourceOf(item), scope: item.scope || item.source?.scope || 'project', permissions, risk: risk(permissions), trust: item.trustLevel || 'untrusted', integrity: item.source?.kind === 'plugin' ? 'plugin-declared' : 'user-configured', version: item.updatedAt || null, issues, tools: (item.tools || []).length };
  });
  const plugins = extensions.listPlugins().map(item => {
    const permissions = Array.isArray(item.policy?.permissions) ? item.policy.permissions.map(String) : [];
    const issues = [];
    if (item.invalid) issues.push('插件结构无效或组件路径越界');
    if (!item.version || item.version === '0.0.0') issues.push('未声明可追踪版本');
    return { type: 'plugin', id: item.key || item.id, name: item.name, description: item.description || '', enabled: item.enabled !== false, source: sourceOf(item), scope: item.source?.scope || 'project', permissions, risk: item.invalid ? 'high' : risk(permissions), trust: item.source?.kind === 'repo' ? 'project-owned' : 'managed', integrity: item.invalid ? 'invalid' : 'manifest-validated', version: item.version || null, author: item.author || null, components: item.components || {}, issues };
  });
  const items = [...plugins, ...skills, ...mcp, ...tools];
  return { generatedAt: now(), summary: { total: items.length, enabled: items.filter(item => item.enabled).length, highRisk: items.filter(item => item.risk === 'high').length, issues: items.reduce((sum, item) => sum + item.issues.length, 0) }, items };
}

function snapshotRows() { return ctx.store.read(SNAPSHOT_FILE, []); }
function publicSnapshot(row) {
  const { payload, ...rest } = row;
  return { ...rest, assets: payload?.assets?.length || 0, memories: payload?.memories?.length || 0, size: Buffer.byteLength(JSON.stringify(payload || {}), 'utf8') };
}
function makeSnapshot(projectId, input: Record<string, any> = {}, automatic = false) {
  const project = ctx.workspaceStore.requireProject(projectId);
  const assets = ctx.workspaceStore.assets().filter(item => item.projectId === projectId);
  const memories = ctx.store.read(MEMORY_FILE, []).filter(item => item.projectId === projectId);
  const assetBytes = assets.reduce((sum, item) => sum + Buffer.byteLength(String(item.content || ''), 'utf8'), 0);
  if (assetBytes > 7_000_000) throw new Error('snapshot project files exceed 7 MB; remove large files first');
  const agents = ctx.store.read(ctx.AGENT_FILE, []);
  const linkedAgent = project.defaultAgentId ? agents.find(item => item.id === project.defaultAgentId) || null : null;
  const payload = { project, assets, memories, linkedAgent, capabilityRefs: capabilityPassports().items.filter(item => item.enabled).map(item => ({ type: item.type, id: item.id, version: item.version || null })) };
  const serialized = JSON.stringify(payload);
  if (Buffer.byteLength(serialized, 'utf8') > 8_000_000) throw new Error('snapshot exceeds 8 MB; remove large project files first');
  const row = { id: `snap_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`, projectId, title: cleanText(input.title, 120) || (automatic ? '恢复前自动备份' : `项目快照 ${new Date().toLocaleString('zh-CN')}`), note: cleanText(input.note, 500), createdAt: now(), automatic, git: gitState(), fingerprint: crypto.createHash('sha256').update(serialized).digest('hex').slice(0, 16), payload };
  const rows = snapshotRows(); rows.unshift(row); ctx.store.write(SNAPSHOT_FILE, rows.slice(0, 50));
  return row;
}

module.exports = function registerControlPlane(app) {
  app.get('/api/capabilities', (req, res, next) => { try { res.json(capabilityPassports()); } catch (error) { next(error); } });

  app.get('/api/memories', (req, res) => {
    let rows = ctx.store.read(MEMORY_FILE, []);
    if (req.query.projectId) rows = rows.filter(item => item.projectId === req.query.projectId);
    res.json(rows);
  });
  app.post('/api/memories', async (req, res) => {
    try {
      const project = ctx.workspaceStore.requireProject(ctx.safeId(req.body?.projectId, 'project id'));
      const title = cleanText(req.body?.title, 120), content = cleanText(req.body?.content, 4000);
      if (!title || !content) return res.status(400).json({ error: 'title and content are required' });
      const row = { id: `mem_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`, projectId: project.id, title, content, enabled: req.body?.enabled !== false, createdAt: now(), updatedAt: now() };
      await ctx.store.mutate(MEMORY_FILE, rows => [row, ...rows].slice(0, 1000), []);
      res.status(201).json(row);
    } catch (error) { res.status(400).json({ error: error.message }); }
  });
  app.put('/api/memories/:id', async (req, res) => {
    let updated = null;
    await ctx.store.mutate(MEMORY_FILE, rows => rows.map(item => {
      if (item.id !== req.params.id) return item;
      updated = { ...item, ...(req.body.title !== undefined ? { title: cleanText(req.body.title, 120) } : {}), ...(req.body.content !== undefined ? { content: cleanText(req.body.content, 4000) } : {}), ...(req.body.enabled !== undefined ? { enabled: req.body.enabled === true } : {}), updatedAt: now() };
      return updated;
    }), []);
    if (!updated) return res.status(404).json({ error: 'memory not found' });
    res.json(updated);
  });
  app.delete('/api/memories/:id', async (req, res) => {
    let found = false;
    await ctx.store.mutate(MEMORY_FILE, rows => rows.filter(item => { if (item.id === req.params.id) found = true; return item.id !== req.params.id; }), []);
    if (!found) return res.status(404).json({ error: 'memory not found' });
    res.json({ ok: true });
  });

  app.get('/api/projects/:id/search', (req, res) => {
    try {
      ctx.workspaceStore.requireProject(req.params.id);
      const query = cleanText(req.query.q, 1000);
      if (!query) return res.json([]);
      res.json(agentRuntime.projectSearch(req.params.id, query, null, Number(req.query.limit) || 12));
    } catch (error) { res.status(400).json({ error: error.message }); }
  });

  app.get('/api/snapshots', (req, res) => {
    let rows = snapshotRows();
    if (req.query.projectId) rows = rows.filter(item => item.projectId === req.query.projectId);
    res.json(rows.map(publicSnapshot));
  });
  app.post('/api/snapshots', (req, res) => {
    try { res.status(201).json(publicSnapshot(makeSnapshot(ctx.safeId(req.body?.projectId, 'project id'), req.body || {}))); }
    catch (error) { res.status(400).json({ error: error.message }); }
  });
  app.post('/api/snapshots/:id/restore', (req, res) => {
    try {
      const snapshot = snapshotRows().find(item => item.id === req.params.id);
      if (!snapshot) return res.status(404).json({ error: 'snapshot not found' });
      makeSnapshot(snapshot.projectId, { title: '恢复前自动备份', note: `即将恢复 ${snapshot.title}` }, true);
      const payload = snapshot.payload || {};
      ctx.workspaceStore.updateProject(snapshot.projectId, {
        name: payload.project?.name,
        description: payload.project?.description,
        defaultAgentId: payload.project?.defaultAgentId,
        defaultProviderId: payload.project?.defaultProviderId,
        defaultModel: payload.project?.defaultModel,
      });
      const otherAssets = ctx.workspaceStore.assets().filter(item => item.projectId !== snapshot.projectId);
      const restoredAssets = (payload.assets || []).map(item => ({ ...item, projectId: snapshot.projectId, workspaceId: payload.project.workspaceId, updatedAt: now() }));
      ctx.store.write('assets.json', [...restoredAssets, ...otherAssets]);
      const otherMemories = ctx.store.read(MEMORY_FILE, []).filter(item => item.projectId !== snapshot.projectId);
      ctx.store.write(MEMORY_FILE, [...(payload.memories || []), ...otherMemories]);
      if (payload.linkedAgent) {
        const agents = ctx.store.read(ctx.AGENT_FILE, []);
        const index = agents.findIndex(item => item.id === payload.linkedAgent.id);
        if (index >= 0) { agents[index] = payload.linkedAgent; ctx.store.write(ctx.AGENT_FILE, agents); }
      }
      res.json({ ok: true, snapshot: publicSnapshot(snapshot) });
    } catch (error) { res.status(400).json({ error: error.message }); }
  });
  app.delete('/api/snapshots/:id', (req, res) => {
    const rows = snapshotRows();
    if (!rows.some(item => item.id === req.params.id)) return res.status(404).json({ error: 'snapshot not found' });
    ctx.store.write(SNAPSHOT_FILE, rows.filter(item => item.id !== req.params.id));
    res.json({ ok: true });
  });
};

// 供每日自动快照调度复用
module.exports.makeSnapshot = makeSnapshot;
module.exports.snapshotRows = snapshotRows;
