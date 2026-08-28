'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// Legacy JSON import is intentionally limited to declarative Agent records.
// Skills and plugins use their standard directory formats and MCP servers use
// /api/mcp-servers; this endpoint never accepts commands or executable config.
const ctx = require('../lib/context');
const extensions = require('../extensions/manager');
const { fail } = require('../lib/errors');
function normalizeAgent(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        throw new Error('agent must be an object');
    const id = ctx.safeId(raw.id || `ag_${Date.now().toString(36)}`, 'agent id');
    const name = String(raw.name || id).trim();
    const systemPrompt = String(raw.systemPrompt || '').trim();
    if (!name || name.length > 120)
        throw new Error('agent name must be 1-120 characters');
    if (systemPrompt.length > 30_000)
        throw new Error('systemPrompt exceeds 30000 characters');
    const stringIds = value => Array.isArray(value) ? value.map(String).filter(item => /^[A-Za-z0-9._-]{1,128}$/.test(item)) : [];
    const legacySkillIds = stringIds(raw.skillIds);
    const builtinTools = ctx.store.read(ctx.SKILL_FILE, []).filter(item => !['prompt', 'mcp'].includes(item.type));
    const builtinToolIds = new Set(builtinTools.map(item => item.id));
    const workflowSkills = extensions.listSkills();
    const skillRefs = Array.isArray(raw.skillRefs)
        ? stringIds(raw.skillRefs)
        : legacySkillIds
            .filter(item => !builtinToolIds.has(item) && item !== 'sk_mcp_time' && item !== 'sk_mcp_readfile')
            .map(item => workflowSkills.find(skill => skill.key === item || skill.id === item || skill.name === item)?.key || item);
    const toolIds = [...new Set([...stringIds(raw.toolIds), ...legacySkillIds.filter(item => builtinToolIds.has(item))])];
    const mcpServerIds = [...new Set([
            ...stringIds(raw.mcpServerIds),
            ...(legacySkillIds.some(item => item === 'sk_mcp_time' || item === 'sk_mcp_readfile') ? ['multichat-demo'] : []),
        ])];
    return {
        id,
        name,
        description: String(raw.description || '').slice(0, 1000),
        systemPrompt,
        skillIds: legacySkillIds.filter(item => !builtinToolIds.has(item) && item !== 'sk_mcp_time' && item !== 'sk_mcp_readfile'),
        skillRefs,
        toolIds,
        mcpServerIds,
        createdAt: raw.createdAt || new Date().toISOString(),
        _import: 'agent-json',
    };
}
module.exports = function registerImport(app) {
    app.post('/api/import', async (req, res) => {
        const body = req.body || {};
        if (body.url || body.format === 'zip' || body.skills || body.type || body.mcp) {
            return fail(res, 400, 'INVALID_PACKAGE', 'Skill 请导入标准 SKILL.md 目录，Plugin 请使用 .codex-plugin/plugin.json，MCP 请使用独立 MCP server 配置');
        }
        let value = body;
        if (typeof body.payload === 'string') {
            if (body.payload.length > 2_000_000)
                return fail(res, 413, 'IMPORT_FAILED', '导入文件超过 2 MB');
            try {
                value = JSON.parse(body.payload);
            }
            catch {
                return fail(res, 400, 'INVALID_PACKAGE', 'payload 不是合法 JSON');
            }
        }
        const incoming = Array.isArray(value) ? value : (Array.isArray(value.agents) ? value.agents : [value.agent || value]);
        let normalized;
        try {
            normalized = incoming.map(normalizeAgent);
        }
        catch (error) {
            return fail(res, 400, 'INVALID_PACKAGE', error.message);
        }
        await ctx.store.mutate(ctx.AGENT_FILE, agents => {
            for (const item of normalized) {
                const index = agents.findIndex(agent => agent.id === item.id);
                if (index >= 0)
                    agents[index] = item;
                else
                    agents.push(item);
            }
            return agents;
        }, []);
        res.json({ ok: true, agents: normalized.length, skills: 0 });
    });
};
//# sourceMappingURL=import.js.map