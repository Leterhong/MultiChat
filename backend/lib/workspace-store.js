const { safeId } = require('./catalog');

const WORKSPACE_FILE = 'workspaces.json';
const PROJECT_FILE = 'projects.json';
const ASSET_FILE = 'assets.json';

function now() { return new Date().toISOString(); }

function createWorkspaceStore(store) {
  function workspaces() { return store.read(WORKSPACE_FILE, []); }
  function projects() { return store.read(PROJECT_FILE, []); }
  function assets() { return store.read(ASSET_FILE, []); }

  function ensureSeed() {
    let rows = workspaces();
    if (!rows.length) {
      const timestamp = now();
      rows = [{ id: 'ws_default', name: '默认工作区', description: 'MultiChat 本地 Agent 工作区', createdAt: timestamp, updatedAt: timestamp, defaultProjectId: 'pr_inbox' }];
      store.write(WORKSPACE_FILE, rows);
    }
    let projectRows = projects();
    if (!projectRows.length) {
      const timestamp = now();
      projectRows = [{ id: 'pr_inbox', workspaceId: rows[0].id, name: '收件箱', description: '未分类的对话和文件', createdAt: timestamp, updatedAt: timestamp }];
      store.write(PROJECT_FILE, projectRows);
    }
    if (!store.read(ASSET_FILE, null)) store.write(ASSET_FILE, []);
  }

  function getWorkspace(id) { return workspaces().find(x => x.id === id) || null; }
  function getProject(id) { return projects().find(x => x.id === id) || null; }
  function getAsset(id) { return assets().find(x => x.id === id) || null; }
  function requireWorkspace(id) {
    const value = getWorkspace(id);
    if (!value) throw new Error('workspace not found');
    return value;
  }
  function requireProject(id) {
    const value = getProject(id);
    if (!value) throw new Error('project not found');
    return value;
  }

  function createWorkspace(input = {}) {
    const timestamp = now();
    const workspaceId = 'ws_' + Date.now().toString(36);
    const projectId = 'pr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const row = { id: workspaceId, name: String(input.name || '新工作区').trim(), description: String(input.description || '').trim(), createdAt: timestamp, updatedAt: timestamp, defaultProjectId: projectId };
    if (!row.name) throw new Error('workspace name is required');
    const project = { id: projectId, workspaceId, name: '收件箱', description: '未分类的对话和文件', createdAt: timestamp, updatedAt: timestamp };
    const rows = workspaces();
    rows.unshift(row);
    store.write(WORKSPACE_FILE, rows);
    const projectRows = projects();
    projectRows.unshift(project);
    store.write(PROJECT_FILE, projectRows);
    return row;
  }

  function updateWorkspace(id, input = {}) {
    const rows = workspaces();
    const index = rows.findIndex(x => x.id === id);
    if (index < 0) throw new Error('workspace not found');
    const current = rows[index];
    rows[index] = { ...current, ...(input.name !== undefined ? { name: String(input.name).trim() } : {}), ...(input.description !== undefined ? { description: String(input.description).trim() } : {}), updatedAt: now(), id: current.id };
    if (!rows[index].name) throw new Error('workspace name is required');
    store.write(WORKSPACE_FILE, rows);
    return rows[index];
  }

  function removeWorkspace(id) {
    const rows = workspaces();
    if (rows.length <= 1) throw new Error('at least one workspace is required');
    const workspace = requireWorkspace(id);
    const remaining = rows.filter(x => x.id !== id);
    const projectRows = projects().filter(x => x.workspaceId !== id);
    const projectIds = new Set(projects().filter(x => x.workspaceId === id).map(x => x.id));
    const assetRows = assets().filter(x => x.workspaceId !== id && !projectIds.has(x.projectId));
    store.write(WORKSPACE_FILE, remaining);
    store.write(PROJECT_FILE, projectRows);
    store.write(ASSET_FILE, assetRows);
    return workspace;
  }

  function createProject(input = {}) {
    const workspaceId = safeId(input.workspaceId || '', 'workspace id');
    requireWorkspace(workspaceId);
    const timestamp = now();
    const row = { id: 'pr_' + Date.now().toString(36), workspaceId, name: String(input.name || '新项目').trim(), description: String(input.description || '').trim(), createdAt: timestamp, updatedAt: timestamp };
    if (!row.name) throw new Error('project name is required');
    const rows = projects();
    rows.unshift(row);
    store.write(PROJECT_FILE, rows);
    return row;
  }

  function updateProject(id, input = {}) {
    const rows = projects();
    const index = rows.findIndex(x => x.id === id);
    if (index < 0) throw new Error('project not found');
    const current = rows[index];
    rows[index] = { ...current, ...(input.name !== undefined ? { name: String(input.name).trim() } : {}), ...(input.description !== undefined ? { description: String(input.description).trim() } : {}), updatedAt: now(), id: current.id, workspaceId: current.workspaceId };
    if (!rows[index].name) throw new Error('project name is required');
    store.write(PROJECT_FILE, rows);
    return rows[index];
  }

  function removeProject(id) {
    const project = requireProject(id);
    if (projects().filter(x => x.workspaceId === project.workspaceId).length <= 1) throw new Error('a workspace must keep one project');
    store.write(PROJECT_FILE, projects().filter(x => x.id !== id));
    store.write(ASSET_FILE, assets().filter(x => x.projectId !== id));
    return project;
  }

  function createAsset(input = {}) {
    const project = requireProject(safeId(input.projectId || '', 'project id'));
    const content = String(input.content || '');
    if (!content) throw new Error('asset content is required');
    if (Buffer.byteLength(content, 'utf8') > 2_000_000) throw new Error('asset content exceeds 2 MB');
    const timestamp = now();
    const row = { id: 'asset_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), workspaceId: project.workspaceId, projectId: project.id, name: String(input.name || '未命名文件').trim(), mimeType: String(input.mimeType || 'text/plain'), size: Buffer.byteLength(content, 'utf8'), source: input.source === 'url' ? 'url' : 'local', url: input.url ? String(input.url) : null, content, createdAt: timestamp, updatedAt: timestamp };
    if (!row.name) throw new Error('asset name is required');
    const rows = assets();
    rows.unshift(row);
    store.write(ASSET_FILE, rows);
    return row;
  }

  function removeAsset(id) {
    const asset = getAsset(id);
    if (!asset) throw new Error('asset not found');
    store.write(ASSET_FILE, assets().filter(x => x.id !== id));
    return asset;
  }

  return { ensureSeed, workspaces, projects, assets, getWorkspace, getProject, getAsset, requireWorkspace, requireProject, createWorkspace, updateWorkspace, removeWorkspace, createProject, updateProject, removeProject, createAsset, removeAsset };
}

module.exports = { createWorkspaceStore, WORKSPACE_FILE, PROJECT_FILE, ASSET_FILE };
