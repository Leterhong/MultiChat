import { $, esc, state } from '../core/index';

/* --------------------------- Render content --------------------------- */
function renderContent() {
  const c = $('#content');
  // 首页空态只显示居中的 hero 输入框；对话态才显示底部 composer，避免首页同时出现两个输入框
  const composerWrap = $('#composerWrap');
  if (composerWrap) composerWrap.style.display = state.messages.length ? '' : 'none';
  if (!state.messages.length) {
    const noModel = !state.selectedProvider || !state.selectedModel;
    const selectedFiles = state.selectedAssetIds?.size || 0;
    const enabledMemories = (state.memories || []).filter(item => item.enabled !== false).length;
    const agent = state.selectedAgent;
    const configuredTools = (agent?.toolIds?.length || 0) + (agent?.mcpServerIds?.length || 0);
    const recentConversations = (state.conversations || []).slice(0, 5);
    const recentMarkup = recentConversations.length
      ? recentConversations.map((conversation: any) => {
        const stamp = conversation.updatedAt || conversation.createdAt;
        const date = stamp ? new Date(stamp) : null;
        const time = date && !Number.isNaN(date.getTime())
          ? date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
          : '最近';
        return `<button type="button" class="recent-work-item" data-open-home-conv="${esc(conversation.id)}"><span>${esc(conversation.title || '未命名对话')}</span><small>${time}</small></button>`;
      }).join('')
      : '<div class="home-empty"><strong>还没有历史工作</strong><span>发起第一项任务后，它会出现在这里。</span></div>';
    c.innerHTML = `
      <div class="home-workbench">
        <header class="home-intro">
          <div class="home-location">${esc(state.selectedWorkspace?.name || '默认工作区')} <span>/</span> ${esc(state.selectedProject?.name || '未选择项目')}</div>
          <h1>今天想完成什么？</h1>
          <p>MultiChat 会把模型、项目文件和可用能力组织在同一次工作中。</p>
        </header>
        <section class="home-composer" id="heroCard" aria-label="发起工作">
          <div class="home-composer-label"><label for="heroInput">任务描述</label><span><i class="status-pulse ${noModel ? 'warn' : ''}"></i>${noModel ? '需要连接模型' : '可以开始'}</span></div>
          <textarea class="hero-input" id="heroInput" placeholder="描述目标、已有信息和你希望得到的结果…" rows="3"></textarea>
          <div class="hero-actions">
            <button class="hero-tag" id="heroModelTag">选择模型</button>
            <button class="hero-tag" id="heroAgents" type="button">${esc(agent?.name || '直接对话')}</button>
            <button class="hero-context-tag" id="heroWorkspace" type="button">${selectedFiles} 个文件 · ${enabledMemories} 条记忆</button>
            <div class="spacer"></div>
            <button class="btn-secondary home-compare" id="heroCompare" type="button">模型实验</button>
            <button class="send-btn" id="heroSendBtn" title="开始" aria-label="开始运行">↑</button>
          </div>
        </section>
        <div class="home-quick" aria-label="常用任务">
          <span>快速开始</span>
          <button type="button" data-quick-prompt="请分析当前项目上下文，先列出关键事实、未知项和建议的下一步。">理解当前项目</button>
          <button type="button" data-quick-prompt="请审查当前方案，指出优先级最高的缺陷、潜在漏洞和可以验证的改进项。">审查问题与风险</button>
          <button type="button" data-quick-prompt="请基于当前上下文制定一份按优先级排序、可直接执行且包含验收标准的实施计划。">制定实施计划</button>
        </div>
        <div class="home-overview">
          <section class="home-section recent-work">
            <div class="home-section-head"><div><h2>继续工作</h2><p>最近打开过的对话</p></div><button type="button" id="heroRuns">查看运行记录</button></div>
            <div class="recent-work-list">${recentMarkup}</div>
          </section>
          <section class="home-section context-overview">
            <div class="home-section-head"><div><h2>本次运行</h2><p>发送前可以随时调整</p></div><button type="button" id="heroInspector">检查上下文</button></div>
            <dl class="context-overview-list">
              <div><dt>模型</dt><dd>${esc(state.selectedProvider?.name || '未连接')} · ${esc(state.selectedModel || '未选择')}</dd></div>
              <div><dt>运行方式</dt><dd>${esc(agent?.name || '直接对话')}</dd></div>
              <div><dt>项目资料</dt><dd>${selectedFiles} 个文件 · ${enabledMemories} 条记忆</dd></div>
              <div><dt>可用能力</dt><dd>${agent ? `${agent.skillRefs?.length || 0} 个 Skills · ${configuredTools} 个工具` : '按需选择运行配置'}</dd></div>
            </dl>
            <div class="home-links" aria-label="能力入口">
              <button id="heroSkills">Skills</button><button id="heroMcp">MCP</button><button id="heroPlugins">插件</button><button id="heroCapabilities">全部能力</button>
            </div>
          </section>
        </div>
      </div>
    `;
    syncModelUI();
    const hi = $('#heroInput'), hb = $('#heroSendBtn');
    autoresize(hi);
    hi.addEventListener('input', () => autoresize(hi));
    hi.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    hb.onclick = send;
    if (!$('#settings')?.classList.contains('open') && !$('#modal')?.classList.contains('open')) hi.focus();
    $('#heroAgents').onclick = () => openSettings('agents');
    $('#heroSkills').onclick = () => openSettings('skills');
    $('#heroMcp').onclick = () => openSettings('mcp');
    $('#heroPlugins').onclick = () => openSettings('plugins');
    $('#heroRuns').onclick = () => openSettings('runs');
    $('#heroCapabilities').onclick = () => openSettings('capabilities');
    $('#heroWorkspace').onclick = () => openSettings('workspace');
    $('#heroCompare').onclick = openCompare;
    document.querySelectorAll<HTMLButtonElement>('[data-open-home-conv]').forEach(button => {
      button.onclick = () => openConversation(button.dataset.openHomeConv);
    });
    document.querySelectorAll<HTMLButtonElement>('[data-quick-prompt]').forEach(button => {
      button.onclick = () => { hi.value = button.dataset.quickPrompt || ''; autoresize(hi); hi.focus(); };
    });
    $('#heroInspector').onclick = openInspector;
  } else {
    c.innerHTML = `<div class="transcript" id="transcript">${state.messages.map(renderMessage).join('')}</div>`;
    if (state.streaming) c.scrollTop = c.scrollHeight; // 仅流式追加时自动贴底；手动重渲染（编辑/重新生成）保留当前滚动位置
  }
}

function renderApprovalCards(m) {
  if (!m || !m.pendingApprovals) return '';
  const list = Object.values(m.pendingApprovals) as any[];
  if (!list.length) return '';
  const cards = list.map(a => {
    const riskCls = a.risk === 'high' ? 'risk-high' : a.risk === 'medium' ? 'risk-med' : 'risk-low';
    const riskText = a.risk === 'high' ? '高危' : a.risk === 'medium' ? '中危' : '低危';
    const resolved = ['approved', 'rejected', 'timed_out', 'cancelled'].includes(a.status);
    const argStr = a.args ? JSON.stringify(a.args) : '';
    const argPreview = argStr.length > 240 ? argStr.slice(0, 240) + '…' : argStr;
    const permTags = (a.permissions || []).map(p => `<span class="ap-perm">${esc(p)}</span>`).join('');
    const trustTag = a.trustLevel ? `<span class="ap-perm ap-trust">${a.trustLevel === 'trusted' ? '已信任' : '未信任'}</span>` : '';
    const statusBar = resolved
      ? `<div class="ap-resolved ${a.status === 'approved' ? 'ok' : 'no'}">${a.status === 'approved' ? '已批准，Agent 继续执行' : a.status === 'rejected' ? '已拒绝' : a.status === 'timed_out' ? '超时自动拒绝' : '已取消'}</div>`
      : `<div class="ap-actions"><button class="ap-btn ap-approve" data-approve="${a.id}">批准执行</button><button class="ap-btn ap-reject" data-reject="${a.id}">拒绝</button></div>`;
    return `<div class="approval-card ${resolved ? 'resolved' : 'pending'} ${a.status === 'approved' ? 'is-approved' : (resolved ? 'is-rejected' : '')}">
      <div class="ap-head"><span class="ap-badge ${riskCls}">需授权 · ${riskText}</span><span class="ap-tool">${esc(a.tool || '')}</span>${trustTag}</div>
      <div class="ap-args"><span class="ap-args-label">参数</span><code>${esc(argPreview || '（无）')}</code></div>
      <div class="ap-perms">${permTags || '<span class="ap-perm">无特殊权限</span>'}</div>
      ${statusBar}
    </div>`;
  }).join('');
  return `<div class="approval-wrap">${cards}</div>`;
}

function renderMessage(m, i) {
  let md;
  if (m.role === 'assistant') {
    md = renderMarkdown(m.content || '');
  } else {
    md = `<div>${esc(m.content || '').replace(/\n/g, '<br/>')}</div>`;
  }
  const modelTag = m.model ? `<span class="msg-model">${esc(m.model)}</span>` : '';
  const agentTag = m.agentTag ? `<span class="msg-model" style="background:var(--bg-elevated);border:1px solid var(--border-l2);">${esc(m.agentTag)}</span>` : '';
  // 思考（Think）折叠块
  let thinkBlock = '';
  if (m.reasoning) {
    const open = (m.streaming || m.thinkOpen) ? ' open' : '';
    const stateAttr = m.streaming ? 'running' : 'ok';
    const summary = m.streaming ? '' : `<span class="think-summary">${esc((m.reasoning || '').split('\n')[0])}</span>`;
    thinkBlock = `<details class="think-row" data-think="${i}" data-state="${stateAttr}"${open}>
      <summary>
        <svg class="think-ico" viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.5.4.9 1 .9 1.6V16h5.2v-.5c0-.6.4-1.2.9-1.6A6 6 0 0 0 12 3z"/></svg>
        <span>思考</span>
        <span class="think-caret"></span>
        ${summary}
      </summary>
      <div class="think-body">${esc(m.reasoning)}</div>
    </details>`;
  }
  // 工具卡（细线 SVG 图标 + 状态语义色 + 可折叠）
  let toolBlock = '';
  if (Array.isArray(m.toolCalls) && m.toolCalls.length > 0) {
    toolBlock = m.toolCalls.map((tc, k) => {
      const content = tc.content || '';
      const open = tc._open ? ' open' : '';
      const head = content ? (content.split('\n')[0].slice(0, 90) || '返回结果') : '执行完成';
      const body = content.length > 2000 ? content.slice(0, 2000) + '\n...(截断)' : content;
      return `<details class="tool-card" data-tool="${i}-${k}"${open}>
        <summary>
          <svg class="tool-ico" viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2-2 2.5-2.5z"/></svg>
          <span class="tool-name">${esc(tc.name)}</span>
          <span class="tool-sep"></span>
          <span class="tool-summary">${esc(head)}</span>
          <span class="tool-caret"></span>
        </summary>
        <pre class="tool-body">${esc(body)}</pre>
      </details>`;
    }).join('');
  }
  // Approval 审批卡片（C1）：等待用户授权的工具调用，实时渲染批准/拒绝按钮
  const approvalBlock = renderApprovalCards(m);
  const warningBlock = Array.isArray(m.mcpWarnings) && m.mcpWarnings.length
    ? `<div class="mcp-warning"><strong>MCP 连接失败</strong>${m.mcpWarnings.map(item => `<span>${esc(item.name || item.serverId)}：${esc(item.error || '')}</span>`).join('')}</div>`
    : '';
  // 执行轨迹（B1）：Agent 完整的「模型请求 → 工具调用 → 结果」时间线
  let traceBlock = '';
  if (Array.isArray(m.trace) && m.trace.length > 0) {
    const items = m.trace.map(s => {
      const icon = s.kind === 'tool_call'
        ? '<svg class="trace-ico-svg" viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2-2 2.5-2.5z"/></svg>'
        : '<svg class="trace-ico-svg" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>';
      const statusCls = s.status === 'success' ? 'ok' : s.status === 'error' ? 'err' : s.status === 'rejected' ? 'rej' : 'run';
      const dur = s.durationMs != null ? (s.durationMs / 1000).toFixed(1) + 's' : '';
      let label, sub;
      if (s.kind === 'tool_call') {
        const argStr = s.args ? JSON.stringify(s.args).slice(0, 80) : '';
        label = `${esc(s.tool || 'tool')}${argStr ? '(' + esc(argStr) + ')' : ''}`;
        sub = s.result ? esc(String(s.result).split('\n')[0].slice(0, 90)) : (s.error || '');
      } else {
        label = `模型请求 · ${esc(s.model || '')}`;
        sub = `${s.toolCount || 0} 工具 · ${s.messageCount || 0} 上下文` + (s.outputLen != null ? ` · 输出 ${s.outputLen} 字` : '');
      }
      return `<div class="trace-step ${statusCls}">
        ${icon}
        <div class="trace-main"><span class="trace-label">${label}</span>${sub ? `<span class="trace-sub">${esc(sub)}</span>` : ''}</div>
        <span class="trace-status">${s.status === 'success' ? '✓' : s.status === 'rejected' ? '⊘' : s.status === 'error' ? '✕' : '…'}</span>
        ${dur ? `<span class="trace-dur">${dur}</span>` : ''}
      </div>`;
    }).join('');
    traceBlock = `<details class="mc-trace"${m.streaming ? ' open' : ''}>
      <summary><span class="trace-ico">⟜</span><span class="trace-title">执行轨迹</span><span class="trace-count">${m.trace.length} 步</span></summary>
      <div class="trace-body">${items}</div>
    </details>`;
  }
  // 单轮统计：竖线分隔的 tertiary 灰字（无 emoji）
  let statsBlock = '';
  if (m.role === 'assistant' && !m.streaming && (m.usage || m.elapsedMs != null)) {
    const u = m.usage || {};
    const pt = u.prompt_tokens ?? u.input_tokens;
    const ct = u.completion_tokens ?? u.output_tokens;
    const tt = u.total_tokens != null ? u.total_tokens : (pt != null && ct != null ? pt + ct : null);
    const cached = (u.prompt_tokens_details && u.prompt_tokens_details.cached_tokens) || u.cached_tokens || 0;
    const reasoning = (u.completion_tokens_details && u.completion_tokens_details.reasoning_tokens) || u.reasoning_tokens || 0;
    const elapsed = m.elapsedMs != null ? (m.elapsedMs / 1000) : null;
    const speed = (m.elapsedMs && ct) ? (ct / (m.elapsedMs / 1000)) : null;
    const providerName = m.providerName || '';
    const groups = [];
    if (tt != null) {
      let g = `共 <strong>${fmtTok(tt)}</strong> tokens`;
      if (pt != null && ct != null) g += ` <span style="color:var(--label-dimmed)">(输入 ${fmtTok(pt)} / 输出 ${fmtTok(ct)})</span>`;
      if (reasoning > 0) g += ` · 推理 ${fmtTok(reasoning)}`;
      groups.push(g);
    }
    if (cached > 0 && pt) {
      const ratio = ((cached / pt) * 100).toFixed(0);
      groups.push(`缓存命中 <strong class="cached">${fmtTok(cached)}</strong> <span style="color:var(--label-dimmed)">(${ratio}%)</span>`);
    }
    if (elapsed != null) {
      let g = `${elapsed.toFixed(1)}s`;
      if (speed) g += ` · <span class="speed">${speed.toFixed(0)} tok/s</span>`;
      groups.push(g);
    }
    if (m.model) groups.push(`模型 <strong>${esc(m.model)}</strong>`);
    if (providerName) groups.push(`渠道 <strong>${esc(providerName)}</strong>`);
    if (groups.length) {
      const full = groups.join('  |  ');
      const html = groups.map(g => `<span>${g}</span>`).join('<span class="sep">|</span>');
      statsBlock = `<div class="msg-stats" title="${esc(full)}">${html}</div>`;
    }
  }
  return `
    <div class="msg ${m.role}" data-idx="${i}" aria-label="${m.role === 'user' ? '你的消息' : 'MultiChat 回复'}">
      <div class="msg-avatar" aria-hidden="true">${m.role === 'assistant' ? 'M' : '你'}</div>
      <div class="msg-body">
        <div class="msg-role">${m.role === 'assistant' ? 'MultiChat' : '你'}${m.role === 'assistant' ? agentTag + modelTag : ''}${m.streaming ? '<span class="busy-label">处理中</span>' : ''}</div>
        ${thinkBlock}
        <div class="msg-content">${warningBlock}${md}${toolBlock}${approvalBlock}${traceBlock}</div>
        ${statsBlock}
        <div class="msg-actions">
          ${m.role === 'assistant' && !m.streaming ? `<button class="msg-action" data-copy="${i}">复制</button><button class="msg-action" data-regen="${i}">重新生成</button>` : ''}
          ${m.role === 'user' ? `<button class="msg-action" data-edit="${i}">编辑</button>` : ''}
        </div>
      </div>
    </div>`;
}

function autoresize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(240, el.scrollHeight) + 'px';
}


export { renderContent,renderApprovalCards,renderMessage,autoresize };
