'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// ── Runs（Agent 运行历史）路由 ──────────────────────────────────────────
const ctx = require('../lib/context');
module.exports = function registerRuns(app) {
    app.get('/api/runs', (req, res) => {
        const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit || '40', 10) || 40));
        let runs = ctx.store.read(ctx.RUN_FILE, []);
        if (req.query.agent)
            runs = runs.filter(x => x.agentId === req.query.agent);
        res.json(runs.slice(0, limit));
    });
    // ── 审计导出：完整 Run/Turn/Step/审批链，供合规归档（JSON，企业审计包入口）──
    app.get('/api/runs/export', (req, res) => {
        const runs = ctx.store.read(ctx.RUN_FILE, []);
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="multichat-audit-' + stamp + '.json"');
        res.json({ exportedAt: new Date().toISOString(), format: 'multichat-audit/v1', runCount: runs.length, runs });
    });
    app.get('/api/runs/:id', (req, res) => {
        const run = ctx.store.read(ctx.RUN_FILE, []).find(x => x.id === req.params.id);
        if (!run)
            return res.status(404).json({ error: 'run not found' });
        res.json(run);
    });
    // 取消正在运行的 Agent 任务：中断上游 fetch，并取消当前 MCP request。
    app.post('/api/runs/:id/cancel', (req, res) => {
        const ac = ctx.runAborts.get(req.params.id);
        if (!ac) {
            return res.status(404).json({ error: { message: '没有正在运行的任务或未注册取消句柄（可能已结束）' }, code: 'RUN_NOT_ACTIVE' });
        }
        ac.abort();
        ctx.runAborts.delete(req.params.id);
        res.json({ ok: true, id: req.params.id });
    });
    // 审批决策：写入持久化检查点，不占用原 Agent 响应连接。
    app.post('/api/runs/:id/approval/:approvalId', (req, res, next) => {
        void (async () => {
            const action = req.body && req.body.action;
            if (action !== 'approve' && action !== 'reject') {
                return res.status(400).json({ error: { message: 'action 必须是 approve 或 reject' }, code: 'BAD_REQUEST' });
            }
            let outcome = { kind: 'missing-run', status: '' };
            await ctx.store.mutate(ctx.RUN_FILE, (runs) => {
                const run = runs.find(item => item.id === req.params.id);
                if (!run)
                    return undefined;
                const rec = (run.approvals || []).find(item => item.id === req.params.approvalId);
                if (!rec || rec.status !== 'pending') {
                    outcome = { kind: 'not-pending', status: rec?.status || '' };
                    return undefined;
                }
                rec.status = action === 'approve' ? 'approved' : 'rejected';
                rec.resolvedAt = new Date().toISOString();
                run.status = 'paused';
                run.pauseReason = action === 'approve' ? 'approval granted; ready to resume' : 'approval rejected; ready to resume';
                if (run.checkpoint)
                    run.checkpoint.approvalDecision = action;
                outcome = { kind: 'updated', status: rec.status };
                return runs;
            }, []);
            if (outcome.kind === 'missing-run') {
                return res.status(404).json({ error: { message: 'run not found' }, code: 'RUN_NOT_FOUND' });
            }
            if (outcome.kind === 'not-pending') {
                return res.status(409).json({
                    error: { message: '审批请求不存在或已处理' + (outcome.status ? '（当前状态：' + outcome.status + '）' : '') },
                    code: 'APPROVAL_NOT_PENDING',
                });
            }
            res.json({ ok: true, approvalId: req.params.approvalId, action, runId: req.params.id, resumable: true });
        })().catch(next);
    });
};
//# sourceMappingURL=runs.js.map