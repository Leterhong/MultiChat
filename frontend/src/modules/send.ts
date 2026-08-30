import { $, api, serverAuthHeaders, toast, state } from '../core/index';
import { openModelPicker } from './modelPicker';

/* --------------------------- Send (streaming) --------------------------- */
async function send(textOverride?: string) {
  if (state.streaming) { stopStream(); return; }
  const input = state.messages.length ? $('#input') : $('#heroInput');
  const text = (textOverride ?? input?.value ?? '').trim();
  if (!text) return;
  if (!state.selectedProvider || !state.selectedModel) {
    toast(state.providers.length ? '请先选择模型' : '请先添加模型', 'error');
    if (state.providers.length) openModelPicker(); else openSettings('providers');
    return;
  }
  state.messages.push({ role: 'user', content: text });
  state.messages.push({ role: 'assistant', content: '', streaming: true, model: state.selectedModel, providerName: state.selectedProvider.name || state.selectedProvider.id, startTime: performance.now() });
  if (input) input.value = '';
  state.streaming = true; updateSendBtn();
  renderContent();
  if (state.messages.length) { const ci = $('#input'); if (ci) ci.focus(); }
  try { await ensureConversation(); } catch {}
  await streamReply();
  state.streaming = false; updateSendBtn();
}

function updateSendBtn() {
  renderContent();
}
function stopStream() {
  if (state.abortCtrl) { state.abortCtrl.abort(); state.abortCtrl = null; }
  if (state.streaming) {
    const last = state.messages[state.messages.length - 1];
    if (last && last.streaming) last.streaming = false;
    state.streaming = false; updateSendBtn(); renderContent(); saveCurrentMessages();
  }
}
async function ensureConversation() {
  if (state.currentConvId) return;
  const title = state.messages.find(m => m.role === 'user')?.content?.slice(0, 24) || '新对话';
  const r = await api('/api/conversations', { method: 'POST', body: JSON.stringify({ title, workspaceId: state.selectedWorkspace?.id || null, projectId: state.selectedProject?.id || null }) });
  state.currentConvId = r.id;
  $('#topbarTitle').textContent = r.title || '对话';
  const route = `#/chat/${encodeURIComponent(r.id)}`;
  if (location.hash !== route) history.replaceState(null, '', route);
  await loadConversations();
}
async function saveCurrentMessages() {
  if (!state.currentConvId) return;
  try {
    await api('/api/conversations/' + state.currentConvId + '/messages', {
      method: 'POST',
      body: JSON.stringify(state.messages.filter(m => !m.streaming)),
    });
  } catch {}
}
async function streamReply(resumeFromRunId?: string) {
  const provider = state.selectedProvider;
  const model = state.selectedModel;

  // ── 入口校验：避免把空 key / 不可达 baseUrl 一股脑打到上游 ─────────────
  if (!provider) {
    const last = state.messages[state.messages.length - 1];
    if (last) { last.content = '**未选择模型**：请先在「设置 → 模型」中添加并选择模型。\n\n→ [打开 设置 → 模型连接](#/settings/providers)'; last.streaming = false; }
    renderContent(); return;
  }
  const needsKey = provider.id !== 'mock' && !['ollama', 'lmstudio', 'mock'].includes((provider.apiType || '').toLowerCase());
  if (needsKey && !provider.apiKey && !provider.apiKeyMasked) {
    const last = state.messages[state.messages.length - 1];
    if (last) { last.content = `**缺少 API Key**：Provider「${provider.name}」尚未填写 API Key。\n\n→ [打开 设置 → 模型连接填写 Key](#/settings/providers)`; last.streaming = false; }
    renderContent(); return;
  }
  if (!provider.baseUrl) {
    const last = state.messages[state.messages.length - 1];
    if (last) { last.content = `**缺少 API 地址**：Provider「${provider.name}」尚未填写 baseUrl。\n\n→ [打开 设置 → 模型连接补全地址](#/settings/providers)`; last.streaming = false; }
    renderContent(); return;
  }

  const useAgent = !!state.selectedAgent;
  const endpoint = useAgent
    ? `/api/agents/${state.selectedAgent.id}/chat`
    : `/v1/chat/completions`;

  const body: any = {
    model: provider.id + ':' + model,
    providerId: provider.id,
    messages: state.messages.filter(m => !m.streaming || m.role === 'user').map(m => ({ role: m.role, content: m.content })),
    stream: true,
    temperature: state.params.temperature,
    max_tokens: state.params.max_tokens,
    top_p: state.params.top_p,
    workspaceId: state.selectedWorkspace?.id || null,
    projectId: state.selectedProject?.id || null,
    conversationId: state.currentConvId || null,
    interactionId: `${state.currentConvId || 'chat'}_${Date.now().toString(36)}`,
    assetIds: [...state.selectedAssetIds]  // D1：只把用户勾选的文件作为上下文注入
  };
  if (resumeFromRunId) body.resumeFromRunId = resumeFromRunId;
  // Provider credentials stay on the backend. The browser only names the
  // configured provider through the model prefix and never echoes API keys.

  state.abortCtrl = new AbortController();
  let res;
  try {
    res = await fetch(state.apiBase + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...serverAuthHeaders() },
      body: JSON.stringify(body),
      signal: state.abortCtrl.signal
    });
  } catch (e) {
    // 用户点击「停止」会触发 AbortError：同时通知后端真正中断上游与 MCP 子进程
    if (e.name === 'AbortError') {
      if (useAgent && state.currentRunId) {
        fetch(state.apiBase + '/api/runs/' + state.currentRunId + '/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json', ...serverAuthHeaders() } }).catch(() => {});
      }
      const last = state.messages[state.messages.length - 1];
      if (last) { last.streaming = false; last.cancelled = true; if (!last.content) last.content = '（已停止）'; }
      renderContent(); return;
    }
    const last = state.messages[state.messages.length - 1];
    if (last) { last.content = '**网络错误**: ' + e.message; last.streaming = false; }
    renderContent(); return;
  }
  if (!res.ok) {
    let upstreamMsg = '';
    try {
      const j = await res.clone().json();
      upstreamMsg = (typeof j?.error === 'string' ? j.error : j?.error?.message) || j?.message || '';
    } catch {}
    const hint = ({
      400: '请求参数有误（通常是 model 名不识别或 messages 格式不对）',
      401: '上游 API 鉴权失败 — API Key 无效或已过期',
      403: '上游拒绝访问 — 可能原因：API Key 被禁用 / 余额不足 / IP 地区受限',
      404: '上游接口或模型不存在 — 检查 baseUrl 和模型名',
      429: '上游限流 — 请稍后重试或降低请求频率',
      500: '上游服务器内部错误',
      502: 'MultiChat 无法连接上游 — 检查 baseUrl 是否可访问',
      503: '上游服务暂不可用',
    })[res.status] || '';
    const last = state.messages[state.messages.length - 1];
    if (last) {
      last.content = `**请求失败 (HTTP ${res.status})**${hint ? '：' + hint : ''}` +
        (upstreamMsg ? `\n\n> ${upstreamMsg}` : '') +
        (useAgent ? '\n\n排查建议：① 设置 → 运行配置确认提示词与 Skill 关联正确；② 设置 → 模型连接确认 API Key 正确；③ 切换其他模型试一下。'
                   : '\n\n排查建议：① 设置 → 模型 中确认 API Key 正确；② baseUrl 可在浏览器直接访问；③ 切换其他模型试一下。') +
        (res.status === 401 || res.status === 403 ? `\n\n→ [打开 设置 → 模型连接，测试或更换 API Key](#/settings/providers)` : '');
      last.streaming = false;
    }
    renderContent(); return;
  }
  if (!res.body) {
    const last = state.messages[state.messages.length - 1];
    if (last) { last.content = '**错误**: 响应无 body'; last.streaming = false; }
    renderContent(); return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '', acc = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, idx); buffer = buffer.slice(idx + 2);
      const line = chunk.split('\n').find(l => l.startsWith('data:'));
      if (!line) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const j = JSON.parse(data);
        const last = state.messages[state.messages.length - 1];
        if (!last) continue;

        // meta 事件（仅 agent 模式）：显示当前 agent 名称 + 记录 runId（用于取消）
        if (j.meta && j.meta.agent) {
          last.agentTag = j.meta.agent.name;
          last.mcpWarnings = j.meta.mcpWarnings || [];
          if (j.meta.run && j.meta.run.id) state.currentRunId = j.meta.run.id;
          renderContent();
          continue;
        }
        // agentEvent（B1）：结构化执行轨迹，实时累积到 last.trace，展示可见的 Agent 执行过程
        if (j.agentEvent) {
          if (!last.trace) last.trace = [];
          const ev = j.agentEvent;
          if (ev.type === 'cancelled') { last.cancelled = true; }
          else if (ev.type === 'paused') {
            last.resumeRunId = ev.runId;
            last.pauseReason = ev.reason || '已达到本轮执行上限';
            last.streaming = false;
          }
          else if (ev.type === 'approval_required') {
            if (!last.pendingApprovals) last.pendingApprovals = {};
            last.pendingApprovals[ev.approval.id] = ev.approval;
          }
          else if (ev.type === 'approval_resolved') {
            if (!last.pendingApprovals) last.pendingApprovals = {};
            const prev = last.pendingApprovals[ev.approval.id] || {};
            last.pendingApprovals[ev.approval.id] = Object.assign({}, prev, ev.approval);
          }
          else if (ev.step) {
            const i = last.trace.findIndex(s => s.sid === ev.step.sid);
            if (i < 0) last.trace.push(ev.step);
            else last.trace[i] = Object.assign({}, last.trace[i], ev.step);
          }
          renderContent();
          continue;
        }
        // error 事件
        if (j.error) {
          acc += (acc ? '\n\n' : '') + '**[错误]** ' + (j.error.message || '未知错误');
          last.content = acc; last.streaming = false;
          renderContent();
          continue;
        }
        // usage 事件（OpenAI 流式末尾的 token 统计块）
        if (j.usage) {
          last.usage = j.usage;
          if (j.model) last.model = j.model;
          renderContent();
          continue;
        }
        // tool_result 事件（仅 agent 模式）：累积工具结果以便末尾折叠展示
        if (j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.tool_result) {
          const tr = j.choices[0].delta.tool_result;
          if (!last.toolCalls) last.toolCalls = [];
          last.toolCalls.push({ id: tr.id, name: tr.name, content: tr.content });
          renderContent();
          continue;
        }
        // 思考流（reasoning_content，DeepSeek-R1 / Qwen-thinking 等推理模型）：累积到 last.reasoning
        if (j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.reasoning_content) {
          const rc = j.choices[0].delta.reasoning_content;
          if (!last.reasoning) last.reasoning = '';
          last.reasoning += rc;
          renderContent();
          continue;
        }
        // 普通流式 chunk
        const delta = j?.choices?.[0]?.delta?.content ?? j?.choices?.[0]?.message?.content ?? '';
        if (delta) {
          acc += delta;
          last.content = acc;
          renderContent();
        }
      } catch {}
    }
  }
  const last = state.messages[state.messages.length - 1];
  if (last) {
    last.streaming = false;
    // 计算本轮耗时（ms → s），用于统计条
    if (last.startTime) last.elapsedMs = Math.round(performance.now() - last.startTime);
  }
  renderContent();
  saveCurrentMessages();
  if (useAgent) loadRuns().then(() => renderInspector());
}

async function copyMessage(index: number) {
  await navigator.clipboard.writeText(state.messages[index]?.content || '');
  toast('已复制');
}

async function editMessage(index: number) {
  const message = state.messages[index];
  if (!message) return;
  const newText = await showPrompt({ title: '编辑消息', label: '消息内容', value: message.content, multiline: true, rows: 7, required: false, confirmLabel: '保存' });
  if (newText == null) return;
  message.content = newText;
  state.messages = state.messages.slice(0, index + 1);
  renderContent();
  void saveCurrentMessages();
}

async function regenerateMessage(index: number) {
  if (state.streaming) return;
  state.messages = state.messages.slice(0, index);
  state.messages.push({ role: 'assistant', content: '', streaming: true, model: state.selectedModel, providerName: state.selectedProvider?.name || state.selectedProvider?.id, startTime: performance.now() });
  state.streaming = true;
  renderContent();
  await streamReply();
  state.streaming = false;
  renderContent();
}

async function resumeMessage(index: number) {
  if (state.streaming) return;
  const source = state.messages[index];
  if (!source?.resumeRunId) return;
  state.messages.push({ role: 'assistant', content: '', streaming: true, model: state.selectedModel, providerName: state.selectedProvider?.name || state.selectedProvider?.id, startTime: performance.now() });
  state.streaming = true;
  renderContent();
  await streamReply(source.resumeRunId);
  state.streaming = false;
  renderContent();
  await saveCurrentMessages();
}

async function resolveApproval(approvalId: string, action: 'approve' | 'reject') {
  const runId = state.currentRunId;
  if (!runId) { toast('无法定位运行任务', 'error'); return; }
  const response = await fetch(state.apiBase + '/api/runs/' + runId + '/approval/' + approvalId, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...serverAuthHeaders() },
    body: JSON.stringify({ action })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    toast('审批失败：' + (payload?.error?.message || payload?.error || '未知错误'), 'error');
    throw new Error(payload?.error?.message || payload?.error || '审批失败');
  }
  const message = state.messages.find(m => m.pendingApprovals && m.pendingApprovals[approvalId]);
  const messageIndex = message ? state.messages.indexOf(message) : -1;
  if (message) {
    const status = action === 'approve' ? 'approved' : 'rejected';
    message.pendingApprovals[approvalId] = { ...message.pendingApprovals[approvalId], status, resolvedAt: new Date().toISOString() };
    renderContent();
  }
  toast(action === 'approve' ? '已批准，Agent 继续执行' : '已拒绝');
  if (payload.resumable && message && messageIndex >= 0) {
    message.resumeRunId = runId;
    message.pauseReason = action === 'approve' ? '授权已记录，正在从检查点继续。' : '拒绝已记录，正在让 Agent 收束本轮。';
    await resumeMessage(messageIndex);
  }
}


export { copyMessage, editMessage, ensureConversation, regenerateMessage, resolveApproval, resumeMessage, saveCurrentMessages, send, stopStream, streamReply, updateSendBtn };
