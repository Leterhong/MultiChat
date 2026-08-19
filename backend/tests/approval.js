'use strict';
// C1 · Approval 审批流端到端集成测试
// 验证：危险工具（web_fetch / network 权限）在 auto 模式下触发 approval_required，
// 未批准前不执行工具；批准后继续执行并返回结果；run.approvals 持久化 approved。
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}
async function requestJSON(base, route, options = {}) {
  const response = await fetch(base + route, options);
  const text = await response.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { response, text, body };
}

async function main() {
  // 1) 被 web_fetch 抓取的本地 target
  const target = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('approval-target-ok');
  });
  const targetPort = await listen(target);

  // 2) mock upstream（OpenAI 兼容 SSE）：第一次返回 tool_calls，第二次返回普通文本收尾
  let upstreamCalls = 0;
  const upstream = http.createServer((req, res) => {
    if (req.url !== '/v1/chat/completions') return res.writeHead(404).end();
    let input = '';
    req.on('data', c => { input += c; });
    req.on('end', () => {
      upstreamCalls++;
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'close' });
      if (upstreamCalls === 1) {
        const url = `http://127.0.0.1:${targetPort}/`;
        const chunks = [
          `data: ${JSON.stringify({ choices: [{ delta: { content: 'I will fetch that.' }, finish_reason: null }] })}\n\n`,
          `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'fetch_url', arguments: '' } }] }, finish_reason: null }] })}\n\n`,
          `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: JSON.stringify({ url }) } }] }, finish_reason: null }] })}\n\n`,
          `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] })}\n\n`,
        ];
        for (const c of chunks) res.write(c);
      } else {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: 'Done.' }, finish_reason: 'stop' }] })}\n\n`);
        res.write(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 } })}\n\n`);
      }
      res.end('data: [DONE]\n\n');
    });
  });
  const upstreamPort = await listen(upstream);

  // 3) backend child（隔离端口 + 临时数据目录）
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'multichat-approval-'));
  const portServer = http.createServer();
  const port = await listen(portServer);
  portServer.close();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['--import', 'tsx', 'server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', d => process.stderr.write('[be-err] ' + d));

  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('server exited before healthy');
    try { const { response } = await requestJSON(base, '/api/health'); if (response.ok) break; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }

  try {
    const provider = await requestJSON(base, '/api/providers', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'ApprovalMock', apiType: 'openai', baseUrl: `http://127.0.0.1:${upstreamPort}`, apiKey: 'test', models: ['echo'] }),
    });
    assert.equal(provider.response.status, 200);
    const providerId = provider.body.id;

    const resp = await fetch(base + '/api/agents/ag_researcher/chat', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: `${providerId}:echo`,
        messages: [{ role: 'user', content: 'fetch the page' }],
        stream: true,
        _provider: { id: providerId, apiType: 'openai', baseUrl: `http://127.0.0.1:${upstreamPort}`, apiKey: 'test' },
      }),
    });
    assert.equal(resp.status, 200);
    assert.ok(resp.body);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let runId = null, approvalId = null;
    let sawApprovalRequired = false, sawApprovalResolved = false, sawToolResult = false, preApprovalToolResult = false, approveSent = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, idx); buf = buf.slice(idx + 2);
        const line = chunk.split('\n').find(l => l.startsWith('data:'));
        if (!line) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        let j; try { j = JSON.parse(data); } catch { continue; }
        if (j.meta && j.meta.run && j.meta.run.id) runId = j.meta.run.id;
        if (j.agentEvent) {
          const ev = j.agentEvent;
          if (ev.type === 'approval_required') { sawApprovalRequired = true; approvalId = ev.approval.id; }
          else if (ev.type === 'approval_resolved') { sawApprovalResolved = true; }
        }
        if (j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.tool_result) {
          const tr = j.choices[0].delta.tool_result;
          if (String(tr.content || '').includes('approval-target-ok')) {
            if (!approveSent) preApprovalToolResult = true;
            sawToolResult = true;
          }
        }
        if (sawApprovalRequired && !approveSent && approvalId && runId) {
          approveSent = true;
          requestJSON(base, `/api/runs/${runId}/approval/${approvalId}`, {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'approve' }),
          }).then(r => { if (!r.response.ok) console.error('approve failed', r.text); });
        }
      }
    }

    assert.ok(runId, 'missing runId');
    assert.ok(approvalId, 'missing approvalId');
    assert.equal(sawApprovalRequired, true, 'expected approval_required event');
    assert.equal(preApprovalToolResult, false, 'tool result must NOT appear before approval');
    assert.equal(approveSent, true, 'approve should have been sent');
    assert.equal(sawApprovalResolved, true, 'expected approval_resolved event after approve');
    assert.equal(sawToolResult, true, 'expected tool result after approval');

    const runs = await requestJSON(base, `/api/runs/${runId}`);
    assert.equal(runs.response.status, 200);
    const ap = (runs.body.approvals || []).find(a => a.id === approvalId);
    assert.ok(ap, 'approval record persisted');
    assert.equal(ap.status, 'approved', 'approval should be approved');
    assert.equal(runs.body.status, 'completed', 'run should complete after approval');

    // 重复审批应被拒绝（已 resolved）：验证 APPROVAL_NOT_PENDING 校验
    const dup = await requestJSON(base, `/api/runs/${runId}/approval/${approvalId}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    });
    assert.equal(dup.response.status, 409);
    assert.equal(dup.body.code, 'APPROVAL_NOT_PENDING');

    console.log('C1 approval flow integration test passed');
  } finally {
    child.kill();
    await new Promise(r => target.close(r));
    await new Promise(r => upstream.close(r));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch(e => { console.error(e.stack || e.message); process.exitCode = 1; });
