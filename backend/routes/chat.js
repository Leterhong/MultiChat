'use strict';
// ── Chat：OpenAI 兼容端点 + Agent 流式工具循环 ──────────────────────────
// /v1/chat/completions 与 /api/agents/:id/chat 共用 adapters + agent runtime。
const ctx = require('../lib/context');
const agent = require('../runtime/agent');

// 挂起等待用户对某个工具调用的审批决策。
// 超时（默认 5 分钟）自动拒绝；signal 触发（前端停止）则取消。
function waitForApproval(approvalId, timeoutMs, signal) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      if (ctx.runApprovals.has(approvalId)) ctx.runApprovals.delete(approvalId);
      reject(new Error('approval timed out'));
    }, timeoutMs);
    const onAbort = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (ctx.runApprovals.has(approvalId)) ctx.runApprovals.delete(approvalId);
      reject(new Error('cancelled by user'));
    };
    if (signal) {
      if (signal.aborted) { clearTimeout(timer); reject(new Error('cancelled by user')); return; }
      signal.addEventListener('abort', onAbort, { once: true });
    }
    ctx.runApprovals.set(approvalId, {
      status: 'pending',
      resolve: (decision) => { if (settled) return; settled = true; clearTimeout(timer); if (signal) signal.removeEventListener('abort', onAbort); resolve(decision); },
      reject: (err) => { if (settled) return; settled = true; clearTimeout(timer); if (signal) signal.removeEventListener('abort', onAbort); reject(err); },
    });
  });
}

module.exports = function registerChat(app) {
  // ── OpenAI 兼容统一端点（透传上游，做 SSE 适配） ──
  app.post('/v1/chat/completions', async (req, res) => {
    const body = req.body;
    const requestedModel = body.model || '';

    // model format: "providerId:modelName" or plain "modelName"
    // modelName may contain colons (e.g. Ollama: "llama3:latest")
    const colonIdx = requestedModel.indexOf(':');
    let providerId, modelName;
    if (colonIdx > 0) {
      providerId = requestedModel.substring(0, colonIdx);
      modelName = requestedModel.substring(colonIdx + 1);
    } else {
      modelName = requestedModel;
      providerId = null;
    }

    // 优先使用前端传来的 provider 配置（_provider 字段）
    // 兼容 IndexedDB 前端存储 + providers.json 后端存储
    console.log('[DEBUG] body._provider =', body._provider ? 'present (' + body._provider.id + ', ' + body._provider.apiType + ')' : 'MISSING', '| providerId from model =', providerId, '| model =', requestedModel);
    let provider = body._provider || null;

    if (!provider && providerId) {
      // 回退到 providers.json 文件查找
      const providers = ctx.store.read('providers.json', []);
      provider = providers.find(p => p.id === providerId) || null;
    }

    // 最后防线：如果 _provider 字段存在但缺少关键字段，补全
    if (provider && !provider.apiType) {
      if (provider.baseUrl && provider.baseUrl.includes('localhost:1234')) {
        provider.apiType = 'lmstudio';
      } else if (provider.baseUrl && provider.baseUrl.includes('localhost:11434')) {
        provider.apiType = 'ollama';
      } else {
        provider.apiType = 'openai';
      }
      console.log('[DEBUG] Inferred apiType =', provider.apiType, 'for provider', provider.id);
    }

    if (!provider && providerId) {
      return res.status(400).json({ error: { message: `Provider "${providerId}" not found` } });
    }

    if (!provider) {
      return res.status(400).json({ error: { message: 'No provider specified and no provider config in request body' } });
    }

    const stream = body.stream === true;

    try {
      const adapter = ctx.createAdapter(provider);
      await adapter.prepare();
      const upstreamUrl = adapter.getEndpoint();
      // 透传 OpenAI 标准字段（保持 /v1/chat/completions 协议完整兼容）
      const PASS_THROUGH = ['temperature', 'max_tokens', 'top_p', 'tools', 'tool_choice',
        'stream_options', 'response_format', 'logprobs', 'stop', 'frequency_penalty',
        'presence_penalty', 'seed', 'n', 'user', 'parallel_tool_calls'];
      const extra = {};
      for (const k of PASS_THROUGH) {
        if (body[k] !== undefined) extra[k] = body[k];
      }
      if (body.tools && body.tool_choice === undefined) extra.tool_choice = 'auto';
      // 始终要求上游在流式末尾返回 usage 块（OpenAI 兼容协议；非 OpenAI provider 忽略该字段也无副作用）
      extra.stream_options = Object.assign({ include_usage: true }, extra.stream_options || {});
      // 普通模式也支持「文件上下文」：把当前项目被选中的资产内容注入 system，
      // 与 agent 模式（buildAssetContext）保持一致，由前端勾选 assetIds 决定注入哪些文件。
      let messages = body.messages;
      if (body.projectId) {
        const assetCtx = agent.buildAssetContext(body.projectId, body.assetIds);
        if (assetCtx) messages = [{ role: 'system', content: assetCtx }].concat(messages);
      }
      const upstreamBody = adapter.buildRequestBody(modelName, messages, stream, extra);

      const upstream = await fetch(upstreamUrl, {
        method: 'POST',
        headers: adapter.getHeaders(),
        body: JSON.stringify(upstreamBody),
      });

      if (!upstream.ok) {
        const errText = await upstream.text();
        return res.status(upstream.status).type('application/json').send(errText);
      }

      if (stream) {
        // SSE with adapter transformation
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        (async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (!line.trim()) continue;

                const transformed = adapter.transformSSEChunk(line);
                if (transformed) {
                  res.write(`data: ${JSON.stringify(transformed)}\n\n`);
                }
              }
            }
          } catch (e) {
            console.error('Stream read error:', e.message);
          } finally {
            res.write('data: [DONE]\n\n');
            res.end();
          }
        })();
      } else {
        const data = await upstream.json();
        const transformed = adapter.transformResponse(data);
        res.json(transformed);
      }
    } catch (err) {
      console.error('Upstream error:', err.message);
      res.status(502).json({ error: { message: `Upstream request failed: ${err.message}` } });
    }
  });

  // ── Agent chat: inject system + tools, run tool-call loop (streaming) ─
  app.post('/api/agents/:id/chat', async (req, res) => {
    const agents = ctx.store.read(ctx.AGENT_FILE, []);
    const found = agents.find(a => a.id === req.params.id);
    if (!found) return res.status(404).json({ error: { message: 'Agent not found: ' + req.params.id } });

    const body = req.body || {};
    const requestedModel = body.model || '';
    const colonIdx = requestedModel.indexOf(':');
    let providerId, modelName;
    if (colonIdx > 0) {
      providerId = requestedModel.substring(0, colonIdx);
      modelName = requestedModel.substring(colonIdx + 1);
    } else {
      modelName = requestedModel;
      providerId = null;
    }
    let provider = body._provider || null;
    if (!provider && providerId) provider = ctx.store.read('providers.json', []).find(p => p.id === providerId) || null;
    if (!provider) return res.status(400).json({ error: { message: 'No provider specified' } });
    if (!provider.apiType) provider.apiType = 'openai';

    const skills = ctx.store.read(ctx.SKILL_FILE, []);
    const enabledSkills = (found.skillIds || []).map(id => skills.find(s => s.id === id)).filter(s => s && s.enabled);
    const tools = agent.buildToolsFor(enabledSkills);
    const systemParts = [agent.buildAgentSystemText(found, skills), agent.buildAssetContext(body.projectId, body.assetIds)].filter(Boolean);
    const systemText = systemParts.join('\n\n');
    const run = await agent.createRun(found, body);
    // 注册取消句柄：前端停止时可真正中断上游 fetch 与 MCP 子进程
    const runAbort = new AbortController();
    ctx.runAborts.set(run.id, runAbort);
    const clearAbort = () => { ctx.runAborts.delete(run.id); };
    const nowIso = () => new Date().toISOString();
    const emit = (type, step) => res.write('data: ' + JSON.stringify({ agentEvent: { type, step } }) + '\n\n');

    // 结构化轨迹：一次用户请求 = 一个 Turn；Turn 内含若干 Step
    const turn = { turn: 1, startedAt: nowIso(), finishedAt: null, steps: [] };
    run.turns = [turn];

    const toolPolicy = body.toolPolicy === 'safe' ? 'safe' : 'auto';

    let messages = Array.isArray(body.messages) ? body.messages.map(m => ({ role: m.role, content: m.content })) : [];
    if (systemText) messages = [{ role: 'system', content: systemText }, ...messages];

    // 透传 OpenAI 字段
    const PASS_THROUGH = ['temperature', 'max_tokens', 'top_p', 'stream_options', 'response_format', 'logprobs', 'stop', 'frequency_penalty', 'presence_penalty', 'seed', 'n', 'user', 'parallel_tool_calls'];
    const extra = {};
    for (const k of PASS_THROUGH) if (body[k] !== undefined) extra[k] = body[k];
    // 始终要求上游在流式末尾返回 usage 块
    extra.stream_options = Object.assign({ include_usage: true }, extra.stream_options || {});

    const stream = body.stream !== false; // 默认 true
    if (!stream) return res.status(400).json({ error: { message: 'Only streaming mode is supported for agent chat' } });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // 写一个 meta 事件，前端用以展示当前 agent 名称
    res.write('data: ' + JSON.stringify({ meta: { agent: { id: found.id, name: found.name }, run, systemText } }) + '\n\n');

    try {
      const adapter = ctx.createAdapter(provider);
      await adapter.prepare();
      const upstreamUrl = adapter.getEndpoint();
      const adapterHeaders = adapter.getHeaders();

      let iter = 0;
      while (iter++ < 5) {
        run.steps = iter;
        // ── Step: 模型请求（结构化轨迹 + 实时事件）──
        const modelStep = {
          sid: 't1-s' + iter + '-model',
          kind: 'model_request',
          index: iter,
          status: 'running',
          startedAt: nowIso(),
          model: modelName,
          toolCount: tools.length,
          messageCount: messages.length,
        };
        turn.steps.push(modelStep);
        emit('step', modelStep);
        await agent.persistRun(run);

        const requestOptions = tools.length > 0 ? { ...extra, tools, tool_choice: 'auto' } : extra;
        const upstreamBody = adapter.buildRequestBody(modelName, messages, true, requestOptions);

        // 合并超时与用户取消信号：取消时可真正中断上游
        const signal = (typeof AbortSignal !== 'undefined' && AbortSignal.any)
          ? AbortSignal.any([AbortSignal.timeout(180000), runAbort.signal])
          : runAbort.signal;

        let upstream;
        try {
          upstream = await fetch(upstreamUrl, {
            method: 'POST',
            headers: adapterHeaders,
            body: JSON.stringify(upstreamBody),
            signal,
          });
        } catch (fe) {
          const cancelled = fe.name === 'AbortError';
          modelStep.status = 'error';
          modelStep.finishedAt = nowIso();
          modelStep.error = cancelled ? 'cancelled by user' : fe.message;
          emit('step_update', modelStep);
          run.status = cancelled ? 'cancelled' : 'error';
          run.error = modelStep.error;
          await agent.persistRun(run);
          if (cancelled) res.write('data: ' + JSON.stringify({ agentEvent: { type: 'cancelled' } }) + '\n\n');
          else res.write('data: ' + JSON.stringify({ error: { message: 'Upstream request failed: ' + fe.message } }) + '\n\n');
          res.write('data: [DONE]\n\n'); res.end(); clearAbort(); return;
        }
        if (!upstream.ok) {
          const errText = await upstream.text();
          modelStep.status = 'error';
          modelStep.finishedAt = nowIso();
          modelStep.error = 'Upstream HTTP ' + upstream.status;
          emit('step_update', modelStep);
          run.status = 'error';
          run.error = modelStep.error;
          await agent.persistRun(run);
          res.write('data: ' + JSON.stringify({ error: { message: 'Upstream HTTP ' + upstream.status + ': ' + errText.substring(0, 500), upstreamStatus: upstream.status } }) + '\n\n');
          res.write('data: [DONE]\n\n'); res.end(); clearAbort(); return;
        }
        if (!upstream.body) {
          modelStep.status = 'error';
          modelStep.finishedAt = nowIso();
          modelStep.error = 'upstream has no body';
          emit('step_update', modelStep);
          run.status = 'error';
          run.error = modelStep.error;
          await agent.persistRun(run);
          res.write('data: ' + JSON.stringify({ error: { message: 'upstream has no body' } }) + '\n\n');
          res.write('data: [DONE]\n\n'); res.end(); clearAbort(); return;
        }

        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accContent = '';
        const toolCalls = {}; // by index
        let finishReason = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.trim()) continue;
            const transformed = adapter.transformSSEChunk(line);
            if (!transformed) continue;
            res.write('data: ' + JSON.stringify(transformed) + '\n\n');
            if (transformed.choices) {
              for (const ch of transformed.choices) {
                const delta = ch.delta || {};
                if (delta.content) accContent += delta.content;
                if (Array.isArray(delta.tool_calls)) {
                  for (const tc of delta.tool_calls) {
                    const i = tc.index || 0;
                    if (!toolCalls[i]) toolCalls[i] = { id: '', type: 'function', function: { name: '', arguments: '' } };
                    if (tc.id) toolCalls[i].id = tc.id;
                    if (tc.type) toolCalls[i].type = tc.type;
                    if (tc.function && tc.function.name) toolCalls[i].function.name += tc.function.name;
                    if (tc.function && tc.function.arguments) toolCalls[i].function.arguments += tc.function.arguments;
                  }
                }
                if (ch.finish_reason) finishReason = ch.finish_reason;
              }
            }
          }
        }

        // 模型请求 step 完成
        modelStep.finishedAt = nowIso();
        modelStep.durationMs = Date.parse(modelStep.finishedAt) - Date.parse(modelStep.startedAt);
        modelStep.outputLen = accContent.length;
        modelStep.status = 'success';
        emit('step_update', modelStep);
        await agent.persistRun(run);

        const toolCallsArr = Object.values(toolCalls).filter(tc => tc.function && tc.function.name);
        if (toolCallsArr.length === 0 || finishReason !== 'tool_calls') {
          run.status = 'completed';
          turn.finishedAt = nowIso();
          await agent.finishRun(run, { status: 'completed', steps: iter, toolCalls: run.toolCalls, turns: run.turns });
          res.write('data: [DONE]\n\n'); res.end(); clearAbort(); return;
        }
        run.toolCalls += toolCallsArr.length;

        // 追加 assistant 消息（包含 tool_calls）
        messages.push({
          role: 'assistant',
          content: accContent || null,
          tool_calls: toolCallsArr.map(tc => ({ id: tc.id, type: 'function', function: { name: tc.function.name, arguments: tc.function.arguments } })),
        });

        // 顺序执行工具调用
        for (const tc of toolCallsArr) {
          let args = {};
          try { args = JSON.parse(tc.function.arguments || '{}'); } catch (e) { /* 保持 args 为空对象 */ }
          const skill = agent.findSkillForTool(tc.function.name, enabledSkills);
          // ── Step: 工具调用（结构化轨迹 + 实时事件）──
          const tstep = {
            sid: 't1-s' + iter + '-tool-' + tc.id,
            kind: 'tool_call',
            index: iter,
            tool: tc.function.name,
            args,
            status: 'running',
            startedAt: nowIso(),
            permissions: skill ? agent.skillPermissions(skill) : [],
          };
          turn.steps.push(tstep);
          emit('step', tstep);
          await agent.persistRun(run);

          let result;
          if (!skill) {
            result = { ok: false, error: 'unknown tool: ' + tc.function.name };
          } else if (!agent.isSkillAllowed(skill, toolPolicy)) {
            result = { ok: false, error: 'permission denied by safe policy', policy: toolPolicy, permissions: agent.skillPermissions(skill) };
          } else if (agent.requiresApproval(skill, toolPolicy)) {
            // ── Approval 审批流：危险工具 / 低信任 MCP 执行前暂停，等待用户批准 ──
            const approvalId = 'ap_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
            const perms = agent.skillPermissions(skill);
            const approval = {
              id: approvalId,
              tool: tc.function.name,
              args,
              permissions: perms,
              trustLevel: agent.trustLevel(skill),
              risk: agent.riskLevel(perms),
              requestedAt: nowIso(),
              status: 'pending',
            };
            // 轨迹步骤进入「等待审批」态
            tstep.status = 'waiting_approval';
            tstep.approvalId = approvalId;
            tstep.permissions = perms;
            tstep.risk = approval.risk;
            emit('step_update', tstep);
            // 通知前端需要授权
            res.write('data: ' + JSON.stringify({ agentEvent: { type: 'approval_required', approval } }) + '\n\n');
            // 记录审批历史（持久化，便于恢复/重放）
            run.approvals.push(approval);
            await agent.persistRun(run);

            // 挂起等待用户决策（带超时 + 可被取消信号中断）
            let decision;
            try {
              decision = await waitForApproval(approvalId, 300000, runAbort.signal);
            } catch (err) {
              decision = { action: (err && err.message === 'approval timed out') ? 'timeout' : 'cancel' };
            }
            // 更新审批状态
            approval.status = decision.action === 'approve' ? 'approved'
              : decision.action === 'reject' ? 'rejected'
              : decision.action === 'timeout' ? 'timed_out' : 'cancelled';
            approval.resolvedAt = nowIso();
            run.approvals = run.approvals.map(a => a.id === approvalId ? approval : a);
            tstep.approvalStatus = approval.status;
            // 通知前端审批已解决（卡片状态更新）
            res.write('data: ' + JSON.stringify({ agentEvent: { type: 'approval_resolved', approval } }) + '\n\n');

            if (decision.action === 'approve') {
              result = await agent.executeSkill(skill, args);
            } else {
              const reason = decision.action === 'reject' ? 'rejected by user'
                : decision.action === 'timeout' ? 'approval timed out (auto-rejected)'
                : 'cancelled by user';
              result = { ok: false, error: reason, approvalId, status: approval.status };
            }
          } else {
            result = await agent.executeSkill(skill, args);
          }

          const tEnd = nowIso();
          tstep.status = (result && result.ok) ? 'success' : (tstep.approvalStatus && tstep.approvalStatus !== 'approved' ? 'rejected' : 'error');
          tstep.finishedAt = tEnd;
          tstep.durationMs = Date.parse(tEnd) - Date.parse(tstep.startedAt);
          const resultText = (typeof result === 'string') ? result : JSON.stringify(result);
          tstep.result = resultText.slice(0, 500);
          emit('step_update', tstep);
          await agent.persistRun(run);

          const toolMsg = { role: 'tool', tool_call_id: tc.id, content: resultText };
          messages.push(toolMsg);
          res.write('data: ' + JSON.stringify({ choices: [{ delta: { tool_result: { id: tc.id, name: tc.function.name, content: resultText } } }] }) + '\n\n');
        }
      }
      run.status = 'error';
      run.error = 'agent tool-call loop exceeded 5 iterations';
      await agent.finishRun(run, { status: 'error', error: run.error, steps: 5, toolCalls: run.toolCalls, turns: run.turns });
      res.write('data: ' + JSON.stringify({ error: { message: 'agent tool-call loop exceeded 5 iterations' } }) + '\n\n');
      res.write('data: [DONE]\n\n'); res.end(); clearAbort(); return;
    } catch (err) {
      const cancelled = err.name === 'AbortError';
      run.status = cancelled ? 'cancelled' : 'error';
      run.error = cancelled ? 'cancelled by user' : ('agent error: ' + err.message);
      turn.finishedAt = nowIso();
      await agent.finishRun(run, { status: run.status, error: run.error, steps: run.steps, toolCalls: run.toolCalls, turns: run.turns });
      res.write('data: ' + JSON.stringify({ error: { message: run.error } }) + '\n\n');
      res.write('data: [DONE]\n\n'); res.end(); clearAbort(); return;
    }
  });
};
