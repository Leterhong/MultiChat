import { $, $$, esc, api, toast, state, DEFAULT_PARAMS, loadSelectedAgent, saveSelectedAgent, saveParams } from '../core/index.js';

/* --------------------------- Send (streaming) --------------------------- */
$('#input').addEventListener('input', (e) => autoresize(e.target));
$('#input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
$('#sendBtn').onclick = send;

async function send() {
  if (state.streaming) { stopStream(); return; }
  const input = state.messages.length ? $('#input') : $('#heroInput');
  const text = (input?.value || '').trim();
  if (!text) return;
  if (!state.selectedProvider || !state.selectedModel) {
    toast('请先在右上角选择模型', 'error'); openSettings('providers'); return;
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
  const btn = state.messages.length ? $('#sendBtn') : $('#heroSendBtn');
  if (!btn) return;
  if (state.streaming) { btn.classList.add('stop'); btn.textContent = '■'; btn.title = '停止'; }
  else { btn.classList.remove('stop'); btn.textContent = '↑'; btn.title = '发送'; }
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
  await loadConversations();
}
async function saveCurrentMessages() {
  if (!state.currentConvId) return;
  try { await api('/api/conversations/' + state.currentConvId, { method: 'PUT', body: JSON.stringify({ messages: state.messages.filter(m => !m.streaming) }) }); } catch {}
}
async function streamReply() {
  const provider = state.selectedProvider;
  const model = state.selectedModel;

  // ── 入口校验：避免把空 key / 不可达 baseUrl 一股脑打到上游 ─────────────
  if (!provider) {
    const last = state.messages[state.messages.length - 1];
    if (last) { last.content = '**未选择模型**：请先在「设置 → 模型」中添加并选择模型。'; last.streaming = false; }
    renderContent(); return;
  }
  const needsKey = !['ollama', 'lmstudio'].includes((provider.apiType || '').toLowerCase());
  if (needsKey && !provider.apiKey) {
    const last = state.messages[state.messages.length - 1];
    if (last) { last.content = `**缺少 API Key**：Provider「${provider.name}」尚未填写 API Key。请到「设置 → 模型」中编辑。`; last.streaming = false; }
    renderContent(); return;
  }
  if (!provider.baseUrl) {
    const last = state.messages[state.messages.length - 1];
    if (last) { last.content = `**缺少 API 地址**：Provider「${provider.name}」尚未填写 baseUrl。请到「设置 → 模型」中编辑。`; last.streaming = false; }
    renderContent(); return;
  }

  const useAgent = !!state.selectedAgent;
  const endpoint = useAgent
    ? `/api/agents/${state.selectedAgent.id}/chat`
    : `/v1/chat/completions`;

  const body = {
    model: provider.id + ':' + model,
    messages: state.messages.filter(m => !m.streaming || m.role === 'user').map(m => ({ role: m.role, content: m.content })),
    stream: true,
    temperature: state.params.temperature,
    max_tokens: state.params.max_tokens,
    top_p: state.params.top_p,
    workspaceId: state.selectedWorkspace?.id || null,
    projectId: state.selectedProject?.id || null,
    assetIds: [...state.selectedAssetIds]  // D1：只把用户勾选的文件作为上下文注入
  };
  // Forward the full provider object (so the backend proxies even without a stored record)
  body._provider = {
    id: provider.id, name: provider.name, apiType: provider.apiType || 'openai',
    baseUrl: provider.baseUrl, apiKey: provider.apiKey
  };

  state.abortCtrl = new AbortController();
  let res;
  try {
    res = await fetch(state.apiBase + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: state.abortCtrl.signal
    });
  } catch (e) {
    // 用户点击「停止」会触发 AbortError：同时通知后端真正中断上游与 MCP 子进程
    if (e.name === 'AbortError') {
      if (useAgent && state.currentRunId) {
        fetch(state.apiBase + '/api/runs/' + state.currentRunId + '/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' } }).catch(() => {});
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
      upstreamMsg = j?.error?.message || j?.message || '';
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
        (useAgent ? '\n\n排查建议：① 设置 → 智能体 确认 system prompt 与 skill 关联正确；② 设置 → 模型 确认 API Key 正确；③ 切换其他模型试一下。'
                   : '\n\n排查建议：① 设置 → 模型 中确认 API Key 正确；② baseUrl 可在浏览器直接访问；③ 切换其他模型试一下。');
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
          if (j.meta.run && j.meta.run.id) state.currentRunId = j.meta.run.id;
          renderContent();
          continue;
        }
        // agentEvent（B1）：结构化执行轨迹，实时累积到 last.trace，展示可见的 Agent 执行过程
        if (j.agentEvent) {
          if (!last.trace) last.trace = [];
          const ev = j.agentEvent;
          if (ev.type === 'cancelled') { last.cancelled = true; }
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
  if (useAgent) loadRuns();
  $$('[data-copy]').forEach(b => b.onclick = () => {
    const i = +b.dataset.copy; navigator.clipboard.writeText(state.messages[i]?.content || ''); toast('已复制');
  });
  $$('[data-edit]').forEach(b => b.onclick = () => {
    const i = +b.dataset.edit;
    const newText = prompt('编辑消息', state.messages[i].content);
    if (newText != null) { state.messages[i].content = newText; state.messages = state.messages.slice(0, i+1); renderContent(); }
  });
  $$('[data-regen]').forEach(b => b.onclick = () => {
    if (state.streaming) return;
    const i = +b.dataset.regen;
    state.messages = state.messages.slice(0, i); // 丢弃该助手消息及其后内容，基于前文重答
    renderContent();
    streamReply();
  });
}

/* code-block copy + 折叠状态持久化（事件委托， survives re-render） */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.code-copy');
  if (!btn) return;
  const code = btn.parentElement.querySelector('pre code');
  if (!code) return;
  navigator.clipboard.writeText(code.textContent).then(() => {
    btn.textContent = '已复制';
    setTimeout(() => { btn.textContent = '复制'; }, 1500);
  }).catch(() => toast('复制失败', 'error'));
});

/* Approval 审批卡片：批准 / 拒绝（事件委托，survives re-render） */
document.addEventListener('click', (e) => {
  const apBtn = e.target.closest('[data-approve],[data-reject]');
  if (!apBtn) return;
  const approvalId = apBtn.getAttribute('data-approve') || apBtn.getAttribute('data-reject');
  if (!approvalId) return;
  const action = apBtn.hasAttribute('data-approve') ? 'approve' : 'reject';
  const runId = state.currentRunId;
  if (!runId) { toast('无法定位运行任务', 'error'); return; }
  apBtn.disabled = true;
  apBtn.textContent = action === 'approve' ? '批准中…' : '拒绝中…';
  fetch(state.apiBase + '/api/runs/' + runId + '/approval/' + approvalId, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action })
  }).then(r => r.json().then(j => ({ ok: r.ok, j }))).then(({ ok, j }) => {
    if (!ok) { toast('审批失败：' + (j?.error?.message || j?.error || '未知错误'), 'error'); apBtn.disabled = false; apBtn.textContent = action === 'approve' ? '批准执行' : '拒绝'; return; }
    // 本地即时反馈：更新该消息的 pendingApprovals 状态，卡片将变为已批准/已拒绝（后端也会回推 approval_resolved 事件）
    const last = state.messages.find(m => m.pendingApprovals && m.pendingApprovals[approvalId]);
    if (last) {
      const status = action === 'approve' ? 'approved' : 'rejected';
      last.pendingApprovals[approvalId] = Object.assign({}, last.pendingApprovals[approvalId], { status, resolvedAt: new Date().toISOString() });
      renderContent();
    }
    toast(action === 'approve' ? '已批准，Agent 继续执行' : '已拒绝');
  }).catch(() => { toast('网络错误', 'error'); apBtn.disabled = false; apBtn.textContent = action === 'approve' ? '批准执行' : '拒绝'; });
});

/* 折叠披露（思考 / 工具卡）的 open 状态写回消息对象，避免重渲染后丢失用户的展开/收起选择 */
document.addEventListener('toggle', (e) => {
  const d = e.target;
  if (!d || !d.getAttribute) return;
  const ti = d.getAttribute('data-think');
  if (ti != null) { const m = state.messages[+ti]; if (m) m.thinkOpen = d.open; return; }
  const tt = d.getAttribute('data-tool');
  if (tt != null) { const [ci, ki] = tt.split('-').map(Number); const m = state.messages[ci]; if (m && m.toolCalls && m.toolCalls[ki]) m.toolCalls[ki]._open = d.open; }
}, true);


export { send,updateSendBtn,stopStream,ensureConversation,saveCurrentMessages,streamReply };
