import { api, state } from '../core/index';

/* --------------------------- Providers --------------------------- */
async function loadProviders() {
  try { state.providers = await api('/api/providers'); }
  catch { state.providers = []; }
}

async function loadRuntime() {
  try { state.runtime = await api('/api/runtime'); }
  catch { state.runtime = null; }
}

async function loadRuns() {
  try { state.runs = await api('/api/runs?limit=40'); }
  catch { state.runs = []; }
}

async function loadUsage(range = state.usageRange) {
  state.usageRange = String(range || '30');
  state.usageLoading = true;
  try {
    const offset = new Date().getTimezoneOffset();
    state.usage = await api(`/api/usage?range=${encodeURIComponent(state.usageRange)}&offset=${offset}`);
  } catch { state.usage = null; }
  finally { state.usageLoading = false; }
}

async function loadCapabilities() {
  try { state.capabilities = await api('/api/capabilities'); }
  catch { state.capabilities = null; }
}

async function loadProjectControlData() {
  if (!state.selectedProject) { state.memories = []; state.snapshots = []; return; }
  try {
    [state.memories, state.snapshots] = await Promise.all([
      api('/api/memories?projectId=' + encodeURIComponent(state.selectedProject.id)),
      api('/api/snapshots?projectId=' + encodeURIComponent(state.selectedProject.id)),
    ]);
  } catch { state.memories = []; state.snapshots = []; }
}

async function loadWorkspaces() {
  try {
    state.workspaces = await api('/api/workspaces');
    const saved = localStorage.getItem('multichat_workspace');
    state.selectedWorkspace = state.workspaces.find(x => x.id === saved) || state.workspaces[0] || null;
    await loadProjects();
  } catch { state.workspaces = []; state.projects = []; }
}

async function loadProjects() {
  if (!state.selectedWorkspace) { state.projects = []; state.selectedProject = null; return; }
  try {
    state.projects = await api('/api/projects?workspaceId=' + encodeURIComponent(state.selectedWorkspace.id));
    const saved = localStorage.getItem('multichat_project');
    state.selectedProject = state.projects.find(x => x.id === saved) || state.projects.find(x => x.id === state.selectedWorkspace.defaultProjectId) || state.projects[0] || null;
    localStorage.setItem('multichat_workspace', state.selectedWorkspace.id);
    if (state.selectedProject) localStorage.setItem('multichat_project', state.selectedProject.id);
    if (state.selectedProject) {
      state.assets = await api('/api/assets?projectId=' + encodeURIComponent(state.selectedProject.id));
      // D1：切换/加载项目后，默认全选当前项目资产作为上下文（用户可在面板中取消）
      state.selectedAssetIds = new Set(state.assets.map(a => a.id));
      applyProjectDefaults();  // D1：回填项目级默认智能体/模型
      await loadProjectControlData();
    }
  } catch { state.projects = []; state.selectedProject = null; state.assets = []; state.selectedAssetIds = new Set(); }
}

/* --------------------------- Skills --------------------------- */
async function loadSkills() {
  try { state.skills = await api('/api/skills'); }
  catch { state.skills = []; }
}

async function loadTools() {
  try { state.tools = await api('/api/tools'); }
  catch { state.tools = []; }
}

async function loadMcpServers() {
  try { state.mcpServers = await api('/api/mcp-servers'); }
  catch { state.mcpServers = []; }
}

/* --------------------------- Agents --------------------------- */
async function loadAgents() {
  const selectedId = state.selectedAgent?.id;
  try {
    state.agents = await api('/api/agents');
    if (selectedId) state.selectedAgent = state.agents.find(agent => agent.id === selectedId) || null;
  }
  catch { state.agents = []; if (selectedId) state.selectedAgent = null; }
}

/* --------------------------- Plugins --------------------------- */
async function loadPlugins() {
  try { state.plugins = await api('/api/plugins'); }
  catch { state.plugins = []; }
}

export { loadProviders,loadRuntime,loadRuns,loadUsage,loadCapabilities,loadProjectControlData,loadWorkspaces,loadProjects,loadSkills,loadTools,loadMcpServers,loadAgents,loadPlugins };
