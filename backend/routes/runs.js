'use strict';
// ── Runs（Agent 运行历史）路由 ──────────────────────────────────────────
const ctx = require('../lib/context');

module.exports = function registerRuns(app) {
  app.get('/api/runs', (req, res) => {
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit || '40', 10) || 40));
    let runs = ctx.store.read(ctx.RUN_FILE, []);
    if (req.query.agent) runs = runs.filter(x => x.agentId === req.query.agent);
    res.json(runs.slice(0, limit));
  });

  app.get('/api/runs/:id', (req, res) => {
    const run = ctx.store.read(ctx.RUN_FILE, []).find(x => x.id === req.params.id);
    if (!run) return res.status(404).json({ error: 'run not found' });
    res.json(run);
  });

  // 取消正在运行的 Agent 任务：真正中断上游 fetch（与 MCP 子进程）。前端「停止」按钮调用。
  app.post('/api/runs/:id/cancel', (req, res) => {
    const ac = ctx.runAborts.get(req.params.id);
    if (!ac) {
      return res.status(404).json({ error: { message: '没有正在运行的任务或未注册取消句柄（可能已结束）' }, code: 'RUN_NOT_ACTIVE' });
    }
    ac.abort();
    ctx.runAborts.delete(req.params.id);
    res.json({ ok: true, id: req.params.id });
  });

  // 审批决策：危险工具 / 低信任 MCP 执行前，前端批准或拒绝。Agent 运行时挂起等待此响应。
  app.post('/api/runs/:id/approval/:approvalId', (req, res) => {
    const run = ctx.store.read(ctx.RUN_FILE, []).find(x => x.id === req.params.id);
    if (!run) return res.status(404).json({ error: { message: 'run not found' }, code: 'RUN_NOT_FOUND' });
    const pending = ctx.runApprovals.get(req.params.approvalId);
    if (!pending || pending.status !== 'pending') {
      const rec = (run.approvals || []).find(a => a.id === req.params.approvalId);
      return res.status(409).json({
        error: { message: '审批请求不存在或已处理' + (rec ? '（当前状态：' + rec.status + '）' : '') },
        code: 'APPROVAL_NOT_PENDING',
      });
    }
    const action = req.body && req.body.action;
    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ error: { message: 'action 必须是 approve 或 reject' }, code: 'BAD_REQUEST' });
    }
    pending.status = 'resolved';
    pending.resolve({ action });
    ctx.runApprovals.delete(req.params.approvalId);
    res.json({ ok: true, approvalId: req.params.approvalId, action, runId: req.params.id });
  });
};
