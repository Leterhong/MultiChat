'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// ── Workspaces / Projects / Assets / Prompts 路由 ───────────────────────
const ctx = require('../lib/context');
const { assetMeta, readResponseText } = require('../lib/util');
function sendWorkspaceError(res, error) {
    const status = /not found/i.test(error.message) ? 404 : 400;
    res.status(status).json({ error: error.message });
}
module.exports = function registerWorkspaces(app) {
    app.get('/api/workspaces', (req, res) => {
        const projects = ctx.workspaceStore.projects();
        res.json(ctx.workspaceStore.workspaces().map(workspace => ({ ...workspace, projectCount: projects.filter(project => project.workspaceId === workspace.id).length })));
    });
    app.get('/api/workspaces/:id', (req, res) => {
        const workspace = ctx.workspaceStore.getWorkspace(req.params.id);
        if (!workspace)
            return res.status(404).json({ error: 'workspace not found' });
        res.json({ ...workspace, projects: ctx.workspaceStore.projects().filter(project => project.workspaceId === workspace.id) });
    });
    app.post('/api/workspaces', (req, res) => {
        try {
            res.status(201).json(ctx.workspaceStore.createWorkspace(req.body));
        }
        catch (error) {
            sendWorkspaceError(res, error);
        }
    });
    app.put('/api/workspaces/:id', (req, res) => {
        try {
            res.json(ctx.workspaceStore.updateWorkspace(req.params.id, req.body));
        }
        catch (error) {
            sendWorkspaceError(res, error);
        }
    });
    app.delete('/api/workspaces/:id', (req, res) => {
        try {
            res.json({ ok: true, workspace: ctx.workspaceStore.removeWorkspace(req.params.id) });
        }
        catch (error) {
            sendWorkspaceError(res, error);
        }
    });
    app.get('/api/projects', (req, res) => {
        let projects = ctx.workspaceStore.projects();
        if (req.query.workspaceId)
            projects = projects.filter(project => project.workspaceId === req.query.workspaceId);
        res.json(projects);
    });
    app.get('/api/projects/:id', (req, res) => {
        const project = ctx.workspaceStore.getProject(req.params.id);
        if (!project)
            return res.status(404).json({ error: 'project not found' });
        res.json({ ...project, assets: ctx.workspaceStore.assets().filter(asset => asset.projectId === project.id).map(assetMeta) });
    });
    app.post('/api/projects', (req, res) => {
        try {
            const project = ctx.workspaceStore.createProject(req.body);
            const workspace = ctx.workspaceStore.getWorkspace(project.workspaceId);
            if (workspace && !workspace.defaultProjectId)
                ctx.workspaceStore.updateWorkspace(workspace.id, { defaultProjectId: project.id });
            res.status(201).json(project);
        }
        catch (error) {
            sendWorkspaceError(res, error);
        }
    });
    app.put('/api/projects/:id', (req, res) => {
        try {
            res.json(ctx.workspaceStore.updateProject(req.params.id, req.body));
        }
        catch (error) {
            sendWorkspaceError(res, error);
        }
    });
    app.delete('/api/projects/:id', (req, res) => {
        try {
            res.json({ ok: true, project: ctx.workspaceStore.removeProject(req.params.id) });
        }
        catch (error) {
            sendWorkspaceError(res, error);
        }
    });
    app.get('/api/assets', (req, res) => {
        let assets = ctx.workspaceStore.assets();
        if (req.query.projectId)
            assets = assets.filter(asset => asset.projectId === req.query.projectId);
        if (req.query.workspaceId)
            assets = assets.filter(asset => asset.workspaceId === req.query.workspaceId);
        res.json(assets.map(assetMeta));
    });
    app.get('/api/assets/:id', (req, res) => {
        const asset = ctx.workspaceStore.getAsset(req.params.id);
        if (!asset)
            return res.status(404).json({ error: 'asset not found' });
        res.json(asset);
    });
    app.post('/api/assets', async (req, res) => {
        const body = req.body || {};
        try {
            let content = body.content;
            let source = 'local';
            let url = null;
            let mimeType = body.mimeType || 'text/plain';
            let name = body.name || '';
            if (body.url) {
                let value = String(body.url).trim();
                let sameOrigin = false;
                if (value.startsWith('/')) {
                    value = 'http://127.0.0.1:' + ctx.PORT + value;
                    sameOrigin = true;
                }
                if (!/^https?:\/\//i.test(value))
                    return res.status(400).json({ error: 'only http(s) URL is allowed' });
                const response = await ctx.safeFetch(value, { signal: AbortSignal.timeout(20000), headers: { accept: 'text/plain, text/markdown, application/json, text/html' } }, sameOrigin);
                if (!response.ok)
                    return res.status(502).json({ error: 'asset fetch failed with HTTP ' + response.status });
                const contentType = response.headers.get('content-type') || '';
                if (!/^(text\/|application\/(json|xml))/i.test(contentType)) {
                    return res.status(415).json({ error: '不支持的内容类型: ' + contentType });
                }
                content = await readResponseText(response, 2_000_000);
                source = 'url';
                url = value;
                mimeType = response.headers.get('content-type') || mimeType;
                if (!name)
                    name = value.split('/').pop().split('?')[0] || '远程文件';
            }
            const asset = ctx.workspaceStore.createAsset({ ...body, content, source, url, mimeType, name });
            res.status(201).json(assetMeta(asset));
        }
        catch (error) {
            sendWorkspaceError(res, error);
        }
    });
    app.delete('/api/assets/:id', (req, res) => {
        try {
            res.json({ ok: true, asset: assetMeta(ctx.workspaceStore.removeAsset(req.params.id)) });
        }
        catch (error) {
            sendWorkspaceError(res, error);
        }
    });
    // ── Prompt Templates ──
    app.get('/api/prompts', (req, res) => {
        const file = ctx.path.join(ctx.BACKEND_ROOT, 'prompts.json');
        if (!ctx.fs.existsSync(file))
            return res.json([]);
        try {
            res.json(JSON.parse(ctx.fs.readFileSync(file, 'utf-8')));
        }
        catch {
            res.json([]);
        }
    });
};
//# sourceMappingURL=workspaces.js.map