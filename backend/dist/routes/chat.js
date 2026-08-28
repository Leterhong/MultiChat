'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// ── Chat：OpenAI 兼容端点 + Agent 流式工具循环 ──────────────────────────
// /v1/chat/completions 与 /api/agents/:id/chat 共用 adapters + agent runtime。
const ctx = require('../lib/context');
const agent = require('../runtime/agent');
const extensions = require('../extensions/manager');
const usageLedger = require('../lib/usage');
const { readResponseText, readResponseJson } = require('../lib/util');
const { redactSecrets } = require('../lib/redact');
const { SSEDecoder } = require('../lib/sse');
function configuredProvider(providerId, modelName) {
    const providers = ctx.providerStore.list();
    if (providerId) {
        const provider = providers.find(item => item.id === providerId) || null;
        if (provider?.id === 'mock' && /(?:127\.0\.0\.1|localhost):3099/i.test(String(provider.baseUrl || ''))) {
            return { ...provider, apiType: 'openai', baseUrl: `http://127.0.0.1:${ctx.PORT}/api/mock`, allowPrivate: true };
        }
        return provider;
    }
    const matches = providers.filter(provider => (provider.models || []).includes(modelName));
    return matches.length === 1 ? matches[0] : null;
}
function allowPrivateProvider(provider) {
    return provider.allowPrivate === true || ['ollama', 'lmstudio'].includes(String(provider.apiType || '').toLowerCase());
}
function usageContext(body, provider, modelName, extra = {}) {
    return {
        providerId: provider.id,
        providerName: provider.name || provider.id,
        model: modelName,
        workspaceId: body.workspaceId || null,
        projectId: body.projectId || null,
        conversationId: body.conversationId || null,
        ...extra,
    };
}
module.exports = function registerChat(app) {
    // ── OpenAI 兼容统一端点（透传上游，做 SSE 适配） ──
    app.post('/v1/chat/completions', async (req, res) => {
        const body = req.body;
        const requestStartedAt = new Date().toISOString();
        const requestStartedMs = Date.now();
        const requestedModel = body.model || '';
        // model format: "providerId:modelName" or plain "modelName"
        // modelName may contain colons (e.g. Ollama: "llama3:latest")
        const explicitProviderId = String(body.providerId || body.provider || '').trim();
        const colonIdx = requestedModel.indexOf(':');
        let providerId, modelName;
        if (explicitProviderId) {
            providerId = explicitProviderId;
            modelName = colonIdx > 0 && requestedModel.substring(0, colonIdx) === explicitProviderId
                ? requestedModel.substring(colonIdx + 1)
                : requestedModel;
        }
        else if (colonIdx > 0) {
            providerId = requestedModel.substring(0, colonIdx);
            modelName = requestedModel.substring(colonIdx + 1);
        }
        else {
            modelName = requestedModel;
            providerId = null;
        }
        // Provider credentials and network policy are server-owned. Never trust a
        // browser-supplied _provider/baseUrl/apiKey override.
        const provider = configuredProvider(providerId, modelName);
        if (!provider && providerId) {
            return res.status(400).json({ error: { message: `Provider "${providerId}" not found` } });
        }
        if (!provider)
            return res.status(400).json({ error: { message: 'No uniquely configured provider matches this model' } });
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
                if (body[k] !== undefined)
                    extra[k] = body[k];
            }
            if (body.tools && body.tool_choice === undefined)
                extra.tool_choice = 'auto';
            // 始终要求上游在流式末尾返回 usage 块（OpenAI 兼容协议；非 OpenAI provider 忽略该字段也无副作用）
            extra.stream_options = Object.assign({ include_usage: true }, extra.stream_options || {});
            // 普通模式也支持「文件上下文」：把当前项目被选中的资产内容注入 system，
            // 与 agent 模式（buildAssetContext）保持一致，由前端勾选 assetIds 决定注入哪些文件。
            let messages = body.messages;
            if (body.projectId) {
                const query = [...(body.messages || [])].reverse().find(message => message.role === 'user')?.content || '';
                const assetCtx = agent.buildAssetContext(body.projectId, body.assetIds, query);
                const memoryCtx = agent.buildMemoryContext(body.projectId);
                const projectContext = [memoryCtx, assetCtx].filter(Boolean).join('\n\n');
                if (projectContext)
                    messages = [{ role: 'system', content: projectContext }].concat(messages);
            }
            const upstreamBody = adapter.buildRequestBody(modelName, messages, stream, extra);
            const upstreamAbort = new AbortController();
            const onDisconnect = () => upstreamAbort.abort();
            res.once('close', onDisconnect);
            const signal = typeof AbortSignal.any === 'function'
                ? AbortSignal.any([AbortSignal.timeout(180000), upstreamAbort.signal])
                : upstreamAbort.signal;
            const upstream = await ctx.safeFetch(upstreamUrl, {
                method: 'POST',
                headers: adapter.getHeaders(),
                body: JSON.stringify(upstreamBody),
                signal,
            }, allowPrivateProvider(provider));
            if (!upstream.ok) {
                const errText = await readResponseText(upstream, 128_000);
                await usageLedger.recordUsage(ctx.store, usageContext(body, provider, modelName, {
                    timestamp: requestStartedAt, durationMs: Date.now() - requestStartedMs,
                    interactionId: body.interactionId || res.locals?.requestId, mode: 'chat', status: 'error', errorCode: `HTTP_${upstream.status}`,
                    usage: { input: 0, output: 0, total: 0, source: 'estimated' },
                }));
                return res.status(upstream.status).type('application/json').send(redactSecrets(errText));
            }
            if (stream) {
                // SSE with adapter transformation
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');
                res.setHeader('X-Accel-Buffering', 'no');
                const reader = upstream.body.getReader();
                const decoder = new TextDecoder();
                const sse = new SSEDecoder();
                let observedUsage = {};
                let output = '';
                (async () => {
                    let status = 'success';
                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done)
                                break;
                            for (const line of sse.push(decoder.decode(value, { stream: true }))) {
                                const transformed = adapter.transformSSEChunk(line);
                                if (transformed) {
                                    if (transformed.usage)
                                        observedUsage = usageLedger.mergeUsage(observedUsage, transformed.usage);
                                    for (const choice of transformed.choices || []) {
                                        output += choice?.delta?.content || choice?.message?.content || '';
                                    }
                                    res.write(`data: ${JSON.stringify(transformed)}\n\n`);
                                }
                            }
                        }
                        for (const line of sse.flush()) {
                            const transformed = adapter.transformSSEChunk(line);
                            if (!transformed)
                                continue;
                            if (transformed.usage)
                                observedUsage = usageLedger.mergeUsage(observedUsage, transformed.usage);
                            for (const choice of transformed.choices || [])
                                output += choice?.delta?.content || choice?.message?.content || '';
                            res.write(`data: ${JSON.stringify(transformed)}\n\n`);
                        }
                    }
                    catch (e) {
                        status = upstreamAbort.signal.aborted ? 'cancelled' : 'error';
                        console.error('Stream read error:', redactSecrets(e.message));
                    }
                    finally {
                        const normalized = usageLedger.normalizeUsage(observedUsage, messages, output);
                        await usageLedger.recordUsage(ctx.store, usageContext(body, provider, modelName, {
                            timestamp: requestStartedAt, durationMs: Date.now() - requestStartedMs,
                            interactionId: body.interactionId || res.locals?.requestId, mode: 'chat', status,
                            usage: normalized,
                        }));
                        if (!res.writableEnded && !res.destroyed) {
                            res.write('data: [DONE]\n\n');
                            res.end();
                        }
                    }
                })();
            }
            else {
                const data = await readResponseJson(upstream, 20_000_000);
                const transformed = adapter.transformResponse(data);
                const output = transformed?.choices?.[0]?.message?.content || '';
                await usageLedger.recordUsage(ctx.store, usageContext(body, provider, modelName, {
                    timestamp: requestStartedAt, durationMs: Date.now() - requestStartedMs,
                    interactionId: body.interactionId || res.locals?.requestId, mode: 'chat', status: 'success',
                    usage: usageLedger.normalizeUsage(transformed.usage, messages, output),
                }));
                res.json(transformed);
            }
        }
        catch (err) {
            const safeMessage = redactSecrets(err.message);
            console.error('Upstream error:', safeMessage);
            await usageLedger.recordUsage(ctx.store, usageContext(body, provider, modelName, {
                timestamp: requestStartedAt, durationMs: Date.now() - requestStartedMs,
                interactionId: body.interactionId || res.locals?.requestId, mode: 'chat', status: err.name === 'AbortError' ? 'cancelled' : 'error', errorCode: err.name || 'UPSTREAM_ERROR',
                usage: { input: 0, output: 0, total: 0, source: 'estimated' },
            }));
            if (res.headersSent || res.destroyed)
                return;
            res.status(502).json({ error: { message: `Upstream request failed: ${safeMessage}` } });
        }
    });
    // ── Agent chat: inject system + tools, run tool-call loop (streaming) ─
    app.post('/api/agents/:id/chat', (req, res, next) => {
        void (async () => {
            const agents = ctx.store.read(ctx.AGENT_FILE, []);
            const found = agents.find(a => a.id === req.params.id);
            if (!found)
                return res.status(404).json({ error: { message: 'Agent not found: ' + req.params.id } });
            const body = req.body || {};
            const requestedModel = body.model || '';
            const explicitProviderId = String(body.providerId || body.provider || '').trim();
            const colonIdx = requestedModel.indexOf(':');
            let providerId, modelName;
            if (explicitProviderId) {
                providerId = explicitProviderId;
                modelName = colonIdx > 0 && requestedModel.substring(0, colonIdx) === explicitProviderId
                    ? requestedModel.substring(colonIdx + 1)
                    : requestedModel;
            }
            else if (colonIdx > 0) {
                providerId = requestedModel.substring(0, colonIdx);
                modelName = requestedModel.substring(colonIdx + 1);
            }
            else {
                modelName = requestedModel;
                providerId = null;
            }
            const provider = configuredProvider(providerId, modelName);
            if (!provider)
                return res.status(400).json({ error: { message: 'No provider specified' } });
            const legacyCapabilities = ctx.store.read(ctx.SKILL_FILE, []);
            const workflowSkills = extensions.listSkills();
            const skillRefs = found.skillRefs || found.skillIds || [];
            const selectedWorkflowSkills = skillRefs.map(id => workflowSkills.find(s => s.key === id || s.id === id || s.name === id)).filter(s => s && s.enabled);
            // Backward compatibility: old agents kept built-in tool IDs in skillIds.
            const toolIds = new Set([...(found.toolIds || []), ...(found.skillIds || []).filter(id => legacyCapabilities.some(s => s.id === id && !['prompt', 'mcp'].includes(s.type)))]);
            const enabledTools = [...toolIds].map(id => legacyCapabilities.find(s => s.id === id)).filter(s => s && s.enabled && !['prompt', 'mcp'].includes(s.type));
            const workflowRuntime = agent.buildWorkflowTools(selectedWorkflowSkills);
            const stream = body.stream !== false; // 默认 true
            if (!stream)
                return res.status(400).json({ error: { message: 'Only streaming mode is supported for agent chat' } });
            const resumeSource = body.resumeFromRunId
                ? ctx.store.read(ctx.RUN_FILE, []).find(item => item.id === body.resumeFromRunId && item.agentId === found.id)
                : null;
            if (body.resumeFromRunId && (!resumeSource || resumeSource.status !== 'paused' || !resumeSource.checkpoint?.messages)) {
                return res.status(409).json({ error: { message: 'run cannot be resumed from its current state' }, code: 'RUN_NOT_RESUMABLE' });
            }
            const run = resumeSource
                ? { ...resumeSource, status: 'running', finishedAt: null, error: null, pauseReason: null, resumedAt: new Date().toISOString() }
                : await agent.createRun(found, body);
            run.model = modelName;
            run.provider = { id: provider.id, name: provider.name || provider.id, apiType: provider.apiType || 'openai' };
            run.usage ||= { inputTokens: 0, outputTokens: 0, totalTokens: 0, cachedTokens: 0, reasoningTokens: 0, reportedTokens: 0, estimatedTokens: 0 };
            const maxIterations = Math.max(1, Math.min(30, Number(body.maxIterations ?? found.maxIterations ?? process.env.AGENT_MAX_ITERATIONS ?? 12) || 12));
            run.maxIterations = maxIterations;
            if (resumeSource)
                await agent.persistRun(run);
            // 注册取消句柄：前端停止时可真正中断上游 fetch 与 MCP 子进程
            const runAbort = new AbortController();
            ctx.runAborts.set(run.id, runAbort);
            const clearAbort = () => { ctx.runAborts.delete(run.id); };
            const nowIso = () => new Date().toISOString();
            const emit = (type, step) => res.write('data: ' + JSON.stringify({ agentEvent: { type, step } }) + '\n\n');
            // 结构化轨迹：一次用户请求 = 一个 Turn；Turn 内含若干 Step
            const turn = { turn: (run.turns?.length || 0) + 1, startedAt: nowIso(), finishedAt: null, steps: [] };
            run.turns = [...(run.turns || []), turn];
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');
            res.on('close', () => {
                if (!res.writableEnded)
                    runAbort.abort();
                clearAbort();
            });
            // Send the run id before MCP discovery so the UI can cancel a slow or
            // unreachable server while initialization/tools-list is in progress.
            res.write('data: ' + JSON.stringify({ meta: { agent: { id: found.id, name: found.name }, run, mcpWarnings: [] } }) + '\n\n');
            let mcpRuntime;
            try {
                mcpRuntime = await extensions.runtimeMcpTools(found.mcpServerIds || [], { signal: runAbort.signal });
            }
            catch (error) {
                const cancelled = runAbort.signal.aborted || error.name === 'AbortError';
                run.status = cancelled ? 'cancelled' : 'error';
                run.error = cancelled ? 'cancelled by user' : ('MCP discovery failed: ' + error.message);
                turn.finishedAt = nowIso();
                await agent.finishRun(run, { status: run.status, error: run.error, turns: run.turns });
                if (!res.writableEnded) {
                    res.write('data: ' + JSON.stringify({ error: { message: run.error } }) + '\n\n');
                    res.write('data: [DONE]\n\n');
                    res.end();
                }
                clearAbort();
                return;
            }
            const tools = [...agent.buildToolsFor(enabledTools), ...workflowRuntime.definitions, ...mcpRuntime.definitions];
            const mcpWarningText = mcpRuntime.errors.length ? '[Unavailable MCP servers]\n' + mcpRuntime.errors.map(item => `- ${item.name}: ${item.error}`).join('\n') : '';
            const userQuery = [...(body.messages || [])].reverse().find(message => message.role === 'user')?.content || '';
            const assetContext = agent.buildAssetContext(body.projectId, body.assetIds, userQuery);
            const memoryContext = agent.buildMemoryContext(body.projectId);
            const systemParts = [agent.buildAgentSystemText(found, selectedWorkflowSkills), mcpWarningText, memoryContext, assetContext].filter(Boolean);
            const systemText = systemParts.join('\n\n');
            const selectedAssetIds = Array.isArray(body.assetIds) ? new Set(body.assetIds) : null;
            const selectedAssets = body.projectId
                ? ctx.workspaceStore.assets().filter(item => item.projectId === body.projectId && (!selectedAssetIds || selectedAssetIds.has(item.id)))
                : [];
            run.contextManifest = {
                workspaceId: body.workspaceId || null,
                projectId: body.projectId || null,
                conversationId: body.conversationId || null,
                messages: Array.isArray(body.messages) ? body.messages.length : 0,
                systemCharacters: systemText.length,
                assets: selectedAssets.map(item => ({ id: item.id, name: item.name, size: item.size })),
                memories: memoryContext ? ctx.store.read('memories.json', []).filter(item => item.projectId === body.projectId && item.enabled !== false).map(item => ({ id: item.id, title: item.title })) : [],
                skills: selectedWorkflowSkills.map(item => ({ id: item.key || item.id, name: item.name, source: item.source?.kind || 'unknown' })),
                tools: enabledTools.map(item => ({ id: item.id, name: item.name, permissions: agent.skillPermissions(item) })),
                mcpServers: (found.mcpServerIds || []).map(id => ({ id })),
                mcpWarnings: mcpRuntime.errors,
            };
            await agent.persistRun(run);
            if (mcpRuntime.errors.length) {
                res.write('data: ' + JSON.stringify({ meta: { agent: { id: found.id, name: found.name }, run, mcpWarnings: mcpRuntime.errors } }) + '\n\n');
            }
            const toolPolicy = body.toolPolicy === 'safe' ? 'safe' : 'auto';
            let messages = resumeSource
                ? resumeSource.checkpoint.messages.map(message => ({ ...message }))
                : (Array.isArray(body.messages) ? body.messages.map(m => ({ role: m.role, content: m.content })) : []);
            if (!resumeSource && systemText)
                messages = [{ role: 'system', content: systemText }, ...messages];
            // 透传 OpenAI 字段
            const PASS_THROUGH = ['temperature', 'max_tokens', 'top_p', 'stream_options', 'response_format', 'logprobs', 'stop', 'frequency_penalty', 'presence_penalty', 'seed', 'n', 'user', 'parallel_tool_calls'];
            const extra = {};
            for (const k of PASS_THROUGH)
                if (body[k] !== undefined)
                    extra[k] = body[k];
            // 始终要求上游在流式末尾返回 usage 块
            extra.stream_options = Object.assign({ include_usage: true }, extra.stream_options || {});
            extra.parallel_tool_calls = false;
            try {
                const adapter = ctx.createAdapter(provider);
                await adapter.prepare();
                const upstreamUrl = adapter.getEndpoint();
                const adapterHeaders = adapter.getHeaders();
                if (resumeSource?.checkpoint?.pendingApproval) {
                    const pending = resumeSource.checkpoint.pendingApproval;
                    const approval = (run.approvals || []).find(item => item.id === pending.approvalId);
                    const skill = workflowRuntime.calls.get(pending.toolName) || mcpRuntime.calls.get(pending.toolName)?.skill || agent.findSkillForTool(pending.toolName, enabledTools);
                    let result;
                    if (approval?.status === 'approved' && skill)
                        result = await agent.executeSkill(skill, pending.args || {}, runAbort.signal);
                    else
                        result = { ok: false, error: approval?.status === 'rejected' ? 'rejected by user' : 'approval was not granted', approvalId: pending.approvalId };
                    const resultText = typeof result === 'string' ? result : JSON.stringify(result);
                    messages.push({ role: 'tool', tool_call_id: pending.toolCallId, content: resultText });
                    for (const deferred of pending.deferredToolCalls || []) {
                        messages.push({ role: 'tool', tool_call_id: deferred.id, content: JSON.stringify({ ok: false, error: 'deferred across approval boundary; request this tool again if still needed' }) });
                    }
                    const previousStep = (run.turns || []).flatMap(item => item.steps || []).find(item => item.approvalId === pending.approvalId);
                    if (previousStep) {
                        previousStep.status = result?.ok ? 'success' : 'rejected';
                        previousStep.approvalStatus = approval?.status || 'cancelled';
                        previousStep.finishedAt = nowIso();
                        previousStep.result = resultText.slice(0, 500);
                    }
                    run.checkpoint = { messages, savedAt: nowIso(), iteration: resumeSource.checkpoint.iteration || 0 };
                    await agent.persistRun(run);
                    res.write('data: ' + JSON.stringify({ agentEvent: { type: 'approval_resolved', approval } }) + '\n\n');
                    res.write('data: ' + JSON.stringify({ choices: [{ delta: { tool_result: { id: pending.toolCallId, name: pending.toolName, content: resultText } } }] }) + '\n\n');
                }
                let iter = 0;
                while (iter++ < maxIterations) {
                    run.steps = iter;
                    // ── Step: 模型请求（结构化轨迹 + 实时事件）──
                    const modelStep = {
                        sid: 't' + turn.turn + '-s' + iter + '-model',
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
                        upstream = await ctx.safeFetch(upstreamUrl, {
                            method: 'POST',
                            headers: adapterHeaders,
                            body: JSON.stringify(upstreamBody),
                            signal,
                        }, allowPrivateProvider(provider));
                    }
                    catch (fe) {
                        const cancelled = fe.name === 'AbortError';
                        modelStep.status = 'error';
                        modelStep.finishedAt = nowIso();
                        modelStep.error = cancelled ? 'cancelled by user' : redactSecrets(fe.message);
                        emit('step_update', modelStep);
                        run.status = cancelled ? 'cancelled' : 'error';
                        run.error = modelStep.error;
                        await usageLedger.recordUsage(ctx.store, usageContext(body, provider, modelName, {
                            timestamp: modelStep.startedAt, durationMs: Date.parse(modelStep.finishedAt) - Date.parse(modelStep.startedAt),
                            interactionId: run.id, runId: run.id, mode: 'agent', status: run.status, errorCode: cancelled ? 'CANCELLED' : 'NETWORK_ERROR', step: iter,
                            usage: { input: 0, output: 0, total: 0, source: 'estimated' },
                        }));
                        await agent.persistRun(run);
                        if (cancelled)
                            res.write('data: ' + JSON.stringify({ agentEvent: { type: 'cancelled' } }) + '\n\n');
                        else
                            res.write('data: ' + JSON.stringify({ error: { message: 'Upstream request failed: ' + redactSecrets(fe.message) } }) + '\n\n');
                        res.write('data: [DONE]\n\n');
                        res.end();
                        clearAbort();
                        return;
                    }
                    if (!upstream.ok) {
                        const errText = await readResponseText(upstream, 128_000);
                        modelStep.status = 'error';
                        modelStep.finishedAt = nowIso();
                        modelStep.error = 'Upstream HTTP ' + upstream.status;
                        emit('step_update', modelStep);
                        run.status = 'error';
                        run.error = modelStep.error;
                        await usageLedger.recordUsage(ctx.store, usageContext(body, provider, modelName, {
                            timestamp: modelStep.startedAt, durationMs: Date.parse(modelStep.finishedAt) - Date.parse(modelStep.startedAt),
                            interactionId: run.id, runId: run.id, mode: 'agent', status: 'error', errorCode: `HTTP_${upstream.status}`, step: iter,
                            usage: { input: 0, output: 0, total: 0, source: 'estimated' },
                        }));
                        await agent.persistRun(run);
                        res.write('data: ' + JSON.stringify({ error: { message: 'Upstream HTTP ' + upstream.status + ': ' + redactSecrets(errText).substring(0, 500), upstreamStatus: upstream.status } }) + '\n\n');
                        res.write('data: [DONE]\n\n');
                        res.end();
                        clearAbort();
                        return;
                    }
                    if (!upstream.body) {
                        modelStep.status = 'error';
                        modelStep.finishedAt = nowIso();
                        modelStep.error = 'upstream has no body';
                        emit('step_update', modelStep);
                        run.status = 'error';
                        run.error = modelStep.error;
                        await usageLedger.recordUsage(ctx.store, usageContext(body, provider, modelName, {
                            timestamp: modelStep.startedAt, durationMs: Date.parse(modelStep.finishedAt) - Date.parse(modelStep.startedAt),
                            interactionId: run.id, runId: run.id, mode: 'agent', status: 'error', errorCode: 'EMPTY_BODY', step: iter,
                            usage: { input: 0, output: 0, total: 0, source: 'estimated' },
                        }));
                        await agent.persistRun(run);
                        res.write('data: ' + JSON.stringify({ error: { message: 'upstream has no body' } }) + '\n\n');
                        res.write('data: [DONE]\n\n');
                        res.end();
                        clearAbort();
                        return;
                    }
                    const reader = upstream.body.getReader();
                    const decoder = new TextDecoder();
                    const sse = new SSEDecoder();
                    let accContent = '';
                    const toolCalls = {}; // by index
                    let observedUsage = {};
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done)
                            break;
                        for (const line of sse.push(decoder.decode(value, { stream: true }))) {
                            const transformed = adapter.transformSSEChunk(line);
                            if (!transformed)
                                continue;
                            if (transformed.usage)
                                observedUsage = usageLedger.mergeUsage(observedUsage, transformed.usage);
                            res.write('data: ' + JSON.stringify(transformed) + '\n\n');
                            if (transformed.choices) {
                                for (const ch of transformed.choices) {
                                    const delta = ch.delta || {};
                                    if (delta.content)
                                        accContent += delta.content;
                                    if (Array.isArray(delta.tool_calls)) {
                                        for (const tc of delta.tool_calls) {
                                            const i = tc.index || 0;
                                            if (!toolCalls[i])
                                                toolCalls[i] = { id: '', type: 'function', function: { name: '', arguments: '' } };
                                            if (tc.id)
                                                toolCalls[i].id = tc.id;
                                            if (tc.type)
                                                toolCalls[i].type = tc.type;
                                            if (tc.function && tc.function.name)
                                                toolCalls[i].function.name += tc.function.name;
                                            if (tc.function && tc.function.arguments)
                                                toolCalls[i].function.arguments += tc.function.arguments;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    for (const line of sse.flush()) {
                        const transformed = adapter.transformSSEChunk(line);
                        if (!transformed)
                            continue;
                        if (transformed.usage)
                            observedUsage = usageLedger.mergeUsage(observedUsage, transformed.usage);
                        res.write('data: ' + JSON.stringify(transformed) + '\n\n');
                        for (const choice of transformed.choices || []) {
                            const delta = choice.delta || {};
                            if (delta.content)
                                accContent += delta.content;
                            if (Array.isArray(delta.tool_calls)) {
                                for (const tc of delta.tool_calls) {
                                    const i = tc.index || 0;
                                    if (!toolCalls[i])
                                        toolCalls[i] = { id: '', type: 'function', function: { name: '', arguments: '' } };
                                    if (tc.id)
                                        toolCalls[i].id = tc.id;
                                    if (tc.type)
                                        toolCalls[i].type = tc.type;
                                    if (tc.function?.name)
                                        toolCalls[i].function.name += tc.function.name;
                                    if (tc.function?.arguments)
                                        toolCalls[i].function.arguments += tc.function.arguments;
                                }
                            }
                        }
                    }
                    // 模型请求 step 完成
                    modelStep.finishedAt = nowIso();
                    modelStep.durationMs = Date.parse(modelStep.finishedAt) - Date.parse(modelStep.startedAt);
                    modelStep.outputLen = accContent.length;
                    modelStep.status = 'success';
                    const normalized = usageLedger.normalizeUsage(observedUsage, messages, accContent);
                    modelStep.usage = normalized;
                    run.usage.inputTokens += normalized.input;
                    run.usage.outputTokens += normalized.output;
                    run.usage.totalTokens += normalized.total;
                    run.usage.cachedTokens += normalized.cached;
                    run.usage.reasoningTokens += normalized.reasoning;
                    if (normalized.source === 'reported')
                        run.usage.reportedTokens += normalized.total;
                    else
                        run.usage.estimatedTokens += normalized.total;
                    await usageLedger.recordUsage(ctx.store, usageContext(body, provider, modelName, {
                        timestamp: modelStep.startedAt, durationMs: modelStep.durationMs,
                        interactionId: run.id, runId: run.id, mode: 'agent', status: 'success', step: iter,
                        usage: normalized,
                    }));
                    emit('step_update', modelStep);
                    await agent.persistRun(run);
                    const toolCallsArr = Object.values(toolCalls).filter(tc => tc.function && tc.function.name);
                    if (toolCallsArr.length === 0) {
                        run.status = 'completed';
                        turn.finishedAt = nowIso();
                        await agent.finishRun(run, { status: 'completed', steps: iter, toolCalls: run.toolCalls, turns: run.turns });
                        res.write('data: [DONE]\n\n');
                        res.end();
                        clearAbort();
                        return;
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
                        try {
                            args = JSON.parse(tc.function.arguments || '{}');
                        }
                        catch (e) { /* 保持 args 为空对象 */ }
                        const skill = workflowRuntime.calls.get(tc.function.name) || mcpRuntime.calls.get(tc.function.name)?.skill || agent.findSkillForTool(tc.function.name, enabledTools);
                        // ── Step: 工具调用（结构化轨迹 + 实时事件）──
                        const tstep = {
                            sid: 't' + turn.turn + '-s' + iter + '-tool-' + tc.id,
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
                        }
                        else if (!agent.isSkillAllowed(skill, toolPolicy)) {
                            result = { ok: false, error: 'permission denied by safe policy', policy: toolPolicy, permissions: agent.skillPermissions(skill) };
                        }
                        else if (agent.requiresApproval(skill, toolPolicy)) {
                            // Approval is a durable pause boundary. The HTTP stream is closed
                            // after persisting the checkpoint; a later resume request can
                            // continue even when the process restarted in between.
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
                            run.status = 'waiting_approval';
                            run.pauseReason = 'approval required';
                            run.checkpoint = {
                                messages,
                                iteration: iter,
                                savedAt: nowIso(),
                                pendingApproval: {
                                    approvalId,
                                    toolName: tc.function.name,
                                    toolCallId: tc.id,
                                    args,
                                    deferredToolCalls: toolCallsArr.filter(item => item.id !== tc.id).map(item => ({ id: item.id, name: item.function?.name || '' })),
                                },
                            };
                            await agent.persistRun(run);
                            res.write('data: [DONE]\n\n');
                            res.end();
                            clearAbort();
                            return;
                        }
                        else {
                            result = await agent.executeSkill(skill, args, runAbort.signal);
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
                    run.checkpoint = { messages, iteration: iter, savedAt: nowIso() };
                    await agent.persistRun(run);
                }
                run.status = 'paused';
                run.pauseReason = `iteration limit reached (${maxIterations})`;
                turn.finishedAt = nowIso();
                await agent.persistRun(run);
                res.write('data: ' + JSON.stringify({ agentEvent: { type: 'paused', runId: run.id, reason: run.pauseReason } }) + '\n\n');
                res.write('data: [DONE]\n\n');
                res.end();
                clearAbort();
                return;
            }
            catch (err) {
                const cancelled = err.name === 'AbortError';
                run.status = cancelled ? 'cancelled' : 'error';
                run.error = cancelled ? 'cancelled by user' : ('agent error: ' + redactSecrets(err.message));
                turn.finishedAt = nowIso();
                await agent.finishRun(run, { status: run.status, error: run.error, steps: run.steps, toolCalls: run.toolCalls, turns: run.turns });
                res.write('data: ' + JSON.stringify({ error: { message: run.error } }) + '\n\n');
                res.write('data: [DONE]\n\n');
                res.end();
                clearAbort();
                return;
            }
        })().catch(next);
    });
};
//# sourceMappingURL=chat.js.map