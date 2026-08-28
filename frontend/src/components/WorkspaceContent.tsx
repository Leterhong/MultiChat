import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Brain, ChevronDown, FileText, ListTree, Wrench } from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';
import { state } from '../core';
import { refreshAppView, useAppStore } from '../store/appStore';
import { fmtTok } from '../utils/format';
import { SafeMarkdown } from './SafeMarkdown';

const quickPrompts = [
  ['理解当前项目', '请分析当前项目上下文，先列出关键事实、未知项和建议的下一步。'],
  ['审查问题与风险', '请审查当前方案，指出优先级最高的缺陷、潜在漏洞和可以验证的改进项。'],
  ['制定实施计划', '请基于当前上下文制定一份按优先级排序、可直接执行且包含验收标准的实施计划。'],
];

function useAutosize(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(240, element.scrollHeight)}px`;
  }, [value]);
  return ref;
}

function HomeWorkspace() {
  const [prompt, setPrompt] = useState('');
  const ready = useAppStore((current) => current.ready);
  const actions = useAppStore((current) => current.actions);
  const inputRef = useAutosize(prompt);
  const noModel = !state.selectedProvider || !state.selectedModel;
  const selectedFiles = state.selectedAssetIds?.size || 0;
  const enabledMemories = (state.memories || []).filter((item: any) => item.enabled !== false).length;
  const agent = state.selectedAgent;
  const configuredTools = (agent?.toolIds?.length || 0) + (agent?.mcpServerIds?.length || 0);
  const recentConversations = (state.conversations || []).slice(0, 5);

  useEffect(() => {
    if (ready && !document.querySelector('.settings.open, .modal.open')) inputRef.current?.focus();
  }, [ready, inputRef]);

  const submit = () => {
    const value = prompt.trim();
    if (!value || !actions.send) return;
    setPrompt('');
    void actions.send(value);
  };

  return <div className="home-workbench">
    <header className="home-intro">
      <div className="home-location">{state.selectedWorkspace?.name || '默认工作区'} <span>/</span> {state.selectedProject?.name || '未选择项目'}</div>
      <h1>今天想完成什么？</h1>
      <p>把目标、项目资料和能力组合成一次可以追踪的工作。</p>
    </header>
    <section className="home-composer" id="heroCard" aria-label="发起工作">
      <div className="home-composer-label"><label htmlFor="heroInput">任务描述</label><span><i className={`status-pulse${noModel ? ' warn' : ''}`} />{noModel ? '需要连接模型' : '可以开始'}</span></div>
      <textarea
        ref={inputRef}
        className="hero-input"
        id="heroInput"
        placeholder="描述目标、已有信息和你希望得到的结果…"
        rows={3}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <div className="hero-actions">
        <button className="hero-tag" id="heroModelTag" type="button" onClick={() => actions.openSettings?.('providers')}>{state.selectedModel || '选择模型'}</button>
        <button className="hero-tag" id="heroAgents" type="button" onClick={() => actions.openSettings?.('agents')}>{agent?.name || '直接对话'}</button>
        <button className="hero-context-tag" id="heroWorkspace" type="button" onClick={() => actions.openSettings?.('workspace')}>{selectedFiles} 个文件 · {enabledMemories} 条记忆</button>
        <div className="spacer" />
        <button className="btn-secondary home-compare" id="heroCompare" type="button" onClick={() => actions.openCompare?.()}>模型实验</button>
        <button className={`send-btn${state.streaming ? ' stop' : ''}`} id="heroSendBtn" type="button" disabled={!ready} title="开始" aria-label="开始运行" onClick={submit}>↑</button>
      </div>
    </section>
    <div className="home-quick" aria-label="常用任务">
      <span>快速开始</span>
      {quickPrompts.map(([label, value]) => <button type="button" key={label} onClick={() => {
        setPrompt(value);
        requestAnimationFrame(() => inputRef.current?.focus());
      }}>{label}</button>)}
    </div>
    <div className="home-overview">
      <section className="home-section recent-work">
        <div className="home-section-head"><div><h2>继续工作</h2><p>最近打开过的对话</p></div><button type="button" onClick={() => actions.openSettings?.('runs')}>查看运行记录</button></div>
        <div className="recent-work-list">
          {recentConversations.length ? recentConversations.map((conversation: any) => {
            const date = new Date(conversation.updatedAt || conversation.createdAt || 0);
            const time = Number.isNaN(date.getTime()) ? '最近' : date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
            return <button type="button" className="recent-work-item" key={conversation.id} onClick={() => actions.openConversation?.(conversation.id)}><span>{conversation.title || '未命名对话'}</span><small>{time}</small></button>;
          }) : <div className="home-empty"><strong>还没有历史工作</strong><span>发起第一项任务后，它会出现在这里。</span></div>}
        </div>
      </section>
      <section className="home-section context-overview">
        <div className="home-section-head"><div><h2>本次运行</h2><p>发送前可以随时调整</p></div><button type="button" onClick={() => actions.openInspector?.()}>检查上下文</button></div>
        <dl className="context-overview-list">
          <div><dt>模型</dt><dd>{state.selectedProvider?.name || '未连接'} · {state.selectedModel || '未选择'}</dd></div>
          <div><dt>运行方式</dt><dd>{agent?.name || '直接对话'}</dd></div>
          <div><dt>项目资料</dt><dd>{selectedFiles} 个文件 · {enabledMemories} 条记忆</dd></div>
          <div><dt>可用能力</dt><dd>{agent ? `${agent.skillRefs?.length || 0} 个 Skills · ${configuredTools} 个工具` : '按需选择运行配置'}</dd></div>
        </dl>
        <div className="home-links" aria-label="能力入口">
          <button type="button" onClick={() => actions.openSettings?.('skills')}>Skills</button>
          <button type="button" onClick={() => actions.openSettings?.('mcp')}>MCP</button>
          <button type="button" onClick={() => actions.openSettings?.('plugins')}>插件</button>
          <button type="button" onClick={() => actions.openSettings?.('capabilities')}>全部能力</button>
        </div>
      </section>
    </div>
  </div>;
}

function ThinkingPanel({ message }: { message: any }) {
  if (!message.reasoning) return null;
  return <details className="think-row" data-state={message.streaming ? 'running' : 'ok'} open={message.streaming || message.thinkOpen}
    onToggle={(event) => { message.thinkOpen = event.currentTarget.open; }}>
    <summary><Brain className="think-ico" aria-hidden /><span>思考</span><span className="think-caret" />{!message.streaming && <span className="think-summary">{String(message.reasoning).split('\n')[0]}</span>}</summary>
    <div className="think-body">{message.reasoning}</div>
  </details>;
}

function ToolPanels({ message }: { message: any }) {
  if (!Array.isArray(message.toolCalls)) return null;
  return <>{message.toolCalls.map((tool: any, index: number) => {
    const content = String(tool.content || '');
    const head = content ? content.split('\n')[0].slice(0, 90) || '返回结果' : '执行完成';
    const body = content.length > 2000 ? `${content.slice(0, 2000)}\n…（已截断）` : content;
    return <details className="tool-card" key={tool.id || `${tool.name}-${index}`} open={tool._open}
      onToggle={(event) => { tool._open = event.currentTarget.open; }}>
      <summary><Wrench className="tool-ico" aria-hidden /><span className="tool-name">{tool.name}</span><span className="tool-sep" /><span className="tool-summary">{head}</span><span className="tool-caret" /></summary>
      <pre className="tool-body">{body}</pre>
    </details>;
  })}</>;
}

function ApprovalPanels({ message }: { message: any }) {
  const actions = useAppStore((current) => current.actions);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const approvals = Object.values(message.pendingApprovals || {}) as any[];
  if (!approvals.length) return null;
  return <div className="approval-wrap">{approvals.map((approval) => {
    const resolved = ['approved', 'rejected', 'timed_out', 'cancelled'].includes(approval.status);
    const riskClass = approval.risk === 'high' ? 'risk-high' : approval.risk === 'medium' ? 'risk-med' : 'risk-low';
    const riskText = approval.risk === 'high' ? '高危' : approval.risk === 'medium' ? '中危' : '低危';
    const args = JSON.stringify(approval.args || {});
    const preview = args.length > 240 ? `${args.slice(0, 240)}…` : args;
    const resolve = async (action: 'approve' | 'reject') => {
      if (!actions.resolveApproval) return;
      setWorkingId(approval.id);
      try { await actions.resolveApproval(approval.id, action); } finally { setWorkingId(null); }
    };
    return <section className={`approval-card ${resolved ? 'resolved' : 'pending'} ${approval.status === 'approved' ? 'is-approved' : resolved ? 'is-rejected' : ''}`} key={approval.id} aria-label={`${approval.tool || '工具'}授权`}>
      <div className="ap-head"><span className={`ap-badge ${riskClass}`}>需授权 · {riskText}</span><span className="ap-tool">{approval.tool || ''}</span>{approval.trustLevel && <span className="ap-perm ap-trust">{approval.trustLevel === 'trusted' ? '已信任' : '未信任'}</span>}</div>
      <div className="ap-args"><span className="ap-args-label">参数</span><code>{preview || '（无）'}</code></div>
      <div className="ap-perms">{approval.permissions?.length ? approval.permissions.map((permission: string) => <span className="ap-perm" key={permission}>{permission}</span>) : <span className="ap-perm">无特殊权限</span>}</div>
      {resolved ? <div className={`ap-resolved ${approval.status === 'approved' ? 'ok' : 'no'}`}>{approval.status === 'approved' ? '已批准，Agent 继续执行' : approval.status === 'rejected' ? '已拒绝' : approval.status === 'timed_out' ? '超时自动拒绝' : '已取消'}</div>
        : <div className="ap-actions"><button className="ap-btn ap-approve" type="button" disabled={workingId === approval.id} onClick={() => void resolve('approve')}>{workingId === approval.id ? '处理中…' : '批准执行'}</button><button className="ap-btn ap-reject" type="button" disabled={workingId === approval.id} onClick={() => void resolve('reject')}>拒绝</button></div>}
    </section>;
  })}</div>;
}

function TracePanel({ message }: { message: any }) {
  if (!Array.isArray(message.trace) || !message.trace.length) return null;
  return <details className="mc-trace" open={message.streaming}>
    <summary><ListTree className="trace-ico-svg" aria-hidden /><span className="trace-title">执行轨迹</span><span className="trace-count">{message.trace.length} 步</span></summary>
    <div className="trace-body">{message.trace.map((step: any, index: number) => {
      const statusClass = step.status === 'success' ? 'ok' : step.status === 'error' ? 'err' : step.status === 'rejected' ? 'rej' : 'run';
      const duration = step.durationMs != null ? `${(step.durationMs / 1000).toFixed(1)}s` : '';
      const args = step.args ? JSON.stringify(step.args).slice(0, 80) : '';
      const label = step.kind === 'tool_call' ? `${step.tool || 'tool'}${args ? `(${args})` : ''}` : `模型请求 · ${step.model || ''}`;
      const sub = step.kind === 'tool_call' ? (step.result ? String(step.result).split('\n')[0].slice(0, 90) : step.error || '') : `${step.toolCount || 0} 工具 · ${step.messageCount || 0} 上下文${step.outputLen != null ? ` · 输出 ${step.outputLen} 字` : ''}`;
      return <div className={`trace-step ${statusClass}`} key={step.sid || index} tabIndex={0}>
        {step.kind === 'tool_call' ? <Wrench className="trace-ico-svg" aria-hidden /> : <ListTree className="trace-ico-svg" aria-hidden />}
        <div className="trace-main"><span className="trace-label">{label}</span>{sub && <span className="trace-sub">{sub}</span>}</div>
        <span className="trace-status" aria-label={step.status}>{step.status === 'success' ? '✓' : step.status === 'rejected' ? '⊘' : step.status === 'error' ? '✕' : '…'}</span>
        {duration && <span className="trace-dur">{duration}</span>}
      </div>;
    })}</div>
  </details>;
}

function MessageStats({ message }: { message: any }) {
  if (message.role !== 'assistant' || message.streaming || (!message.usage && message.elapsedMs == null)) return null;
  const usage = message.usage || {};
  const promptTokens = usage.prompt_tokens ?? usage.input_tokens;
  const completionTokens = usage.completion_tokens ?? usage.output_tokens;
  const totalTokens = usage.total_tokens ?? (promptTokens != null && completionTokens != null ? promptTokens + completionTokens : null);
  const cached = usage.prompt_tokens_details?.cached_tokens || usage.cached_tokens || 0;
  const reasoning = usage.completion_tokens_details?.reasoning_tokens || usage.reasoning_tokens || 0;
  const elapsed = message.elapsedMs != null ? message.elapsedMs / 1000 : null;
  const speed = message.elapsedMs && completionTokens ? completionTokens / (message.elapsedMs / 1000) : null;
  return <div className="msg-stats">
    {totalTokens != null && <span>共 <strong>{fmtTok(totalTokens)}</strong> tokens{promptTokens != null && completionTokens != null && <>（输入 {fmtTok(promptTokens)} / 输出 {fmtTok(completionTokens)}）</>}{reasoning > 0 && <> · 推理 {fmtTok(reasoning)}</>}</span>}
    {cached > 0 && <><span className="sep">|</span><span>缓存命中 <strong className="cached">{fmtTok(cached)}</strong></span></>}
    {elapsed != null && <><span className="sep">|</span><span>{elapsed.toFixed(1)}s{speed && <> · <span className="speed">{speed.toFixed(0)} tok/s</span></>}</span></>}
    {message.model && <><span className="sep">|</span><span>模型 <strong>{message.model}</strong></span></>}
    {message.providerName && <><span className="sep">|</span><span>渠道 <strong>{message.providerName}</strong></span></>}
  </div>;
}

function MessageView({ message, index }: { message: any; index: number }) {
  const actions = useAppStore((current) => current.actions);
  return <article className={`msg ${message.role}${message.streaming ? ' streaming' : ''}`} aria-label={message.role === 'user' ? '你的消息' : 'MultiChat 回复'}>
    <div className="msg-avatar" aria-hidden="true">{message.role === 'assistant' ? 'M' : '你'}</div>
    <div className="msg-body">
      <div className="msg-role">{message.role === 'assistant' ? 'MultiChat' : '你'}{message.role === 'assistant' && message.agentTag && <span className="msg-model">{message.agentTag}</span>}{message.role === 'assistant' && message.model && <span className="msg-model">{message.model}</span>}{message.streaming && <span className="busy-label">处理中</span>}</div>
      <ThinkingPanel message={message} />
      <div className={`msg-content${message.role === 'user' ? ' user-plain-text' : ''}`}>
        {message.mcpWarnings?.length > 0 && <div className="mcp-warning"><strong>MCP 连接失败</strong>{message.mcpWarnings.map((item: any) => <span key={item.serverId || item.name}>{item.name || item.serverId}：{item.error || ''}</span>)}</div>}
        {message.role === 'assistant' ? <SafeMarkdown>{message.content || ''}</SafeMarkdown> : message.content}
        <ToolPanels message={message} />
        <ApprovalPanels message={message} />
        <TracePanel message={message} />
      </div>
      <MessageStats message={message} />
      {message.resumeRunId && <div className="run-paused"><span>{message.pauseReason || '运行已暂停，可以从检查点继续。'}</span><button className="msg-action" type="button" onClick={() => void actions.resumeMessage?.(index)}>继续运行</button></div>}
      <div className="msg-actions">
        {message.role === 'assistant' && !message.streaming && <><button className="msg-action" type="button" onClick={() => void actions.copyMessage?.(index)}>复制</button><button className="msg-action" type="button" onClick={() => void actions.regenerateMessage?.(index)}>重新生成</button></>}
        {message.role === 'user' && <button className="msg-action" type="button" onClick={() => actions.editMessage?.(index)}>编辑</button>}
      </div>
    </div>
  </article>;
}

function ConversationWorkspace() {
  const revision = useAppStore((current) => current.revision);
  const messages = useMemo(() => [...state.messages], [revision]);
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    if (!state.streaming) return;
    const timer = window.setTimeout(() => {
      const last = state.messages.at(-1);
      if (last?.role === 'assistant') setAnnouncement(String(last.content || '').slice(-240));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [revision]);
  return <>
    <Virtuoso
      className="transcript transcript-virtual"
      data={messages}
      followOutput={state.streaming ? 'auto' : false}
      increaseViewportBy={{ top: 500, bottom: 800 }}
      components={{ Footer: () => <div className="transcript-footer" aria-hidden="true" /> }}
      itemContent={(index, message) => <MessageView index={index} message={message} />}
    />
    <div className="sr-only" aria-live="polite" aria-atomic="false">{announcement}</div>
  </>;
}

export function WorkspaceContent() {
  useAppStore((current) => current.revision);
  return state.messages.length ? <ConversationWorkspace /> : <HomeWorkspace />;
}

export function ConversationComposer() {
  useAppStore((current) => current.revision);
  const ready = useAppStore((current) => current.ready);
  const actions = useAppStore((current) => current.actions);
  const [text, setText] = useState('');
  const [filesOpen, setFilesOpen] = useState(true);
  const inputRef = useAutosize(text);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const sync = () => {
      const keyboardOffset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      document.documentElement.style.setProperty('--mc-keyboard-offset', `${keyboardOffset}px`);
    };
    sync();
    viewport.addEventListener('resize', sync);
    viewport.addEventListener('scroll', sync);
    return () => {
      viewport.removeEventListener('resize', sync);
      viewport.removeEventListener('scroll', sync);
      document.documentElement.style.removeProperty('--mc-keyboard-offset');
    };
  }, []);
  if (!state.messages.length) return null;
  const submit = () => {
    if (state.streaming) { actions.stop?.(); return; }
    const value = text.trim();
    if (!value || !actions.send) return;
    setText('');
    void actions.send(value).finally(() => inputRef.current?.focus());
  };
  const selectFile = (id: string, checked: boolean) => {
    if (checked) state.selectedAssetIds.add(id); else state.selectedAssetIds.delete(id);
    refreshAppView();
    actions.refreshFileContext?.();
  };
  return <div className="composer-wrap" id="composerWrap">
    <div className="composer">
      {state.assets.length > 0 && <div className="file-ctx" id="fileCtx">
        <button className="file-ctx-head" id="fileCtxHead" type="button" aria-expanded={filesOpen} onClick={() => setFilesOpen((value) => !value)}><span className="fc-title">上下文</span><span className="fc-count">{state.selectedAssetIds.size} / {state.assets.length} 已选择</span><span className="spacer" /><ChevronDown className={filesOpen ? '' : 'is-collapsed'} size={15} aria-hidden /></button>
        {filesOpen && <div className="file-ctx-body" id="fileCtxBody">{state.assets.map((asset: any) => <label className="fc-item" key={asset.id}>
          <input type="checkbox" className="fc-check" checked={state.selectedAssetIds.has(asset.id)} onChange={(event) => selectFile(asset.id, event.target.checked)} />
          <span className="fc-name" title={asset.name}>{asset.name}</span><span className="fc-meta">{String(asset.mimeType || '').split('/').pop()}</span>
        </label>)}<div className="fc-actions"><button className="btn-ghost" type="button" onClick={() => { state.assets.forEach((asset: any) => state.selectedAssetIds.add(asset.id)); refreshAppView(); actions.refreshFileContext?.(); }}>全选</button><button className="btn-ghost" type="button" onClick={() => { state.selectedAssetIds.clear(); refreshAppView(); actions.refreshFileContext?.(); }}>清空</button></div></div>}
      </div>}
      <textarea ref={inputRef} className="composer-input" id="input" rows={1} placeholder="描述下一步工作…" autoComplete="off" value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); }
      }} />
      <div className="composer-actions">
        <button className="composer-tool" id="composerFileBtn" type="button" title="管理上下文文件" onClick={() => actions.openSettings?.('workspace')}><FileText size={15} aria-hidden /><span className="composer-tool-label">{state.selectedAssetIds.size ? `文件 ${state.selectedAssetIds.size}` : '文件'}</span></button>
        <button className="hero-tag" id="composerModelTag" type="button" title="选择模型" onClick={() => actions.openSettings?.('providers')}>{state.selectedModel || '选择模型'}</button>
        <span className="ctx-hint">Shift+Enter 换行</span><div className="spacer" />
        <button className={`send-btn${state.streaming ? ' stop' : ''}`} id="sendBtn" type="button" disabled={!ready} title={state.streaming ? '停止' : '发送'} aria-label={state.streaming ? '停止生成' : '发送消息'} onClick={submit}><span aria-hidden>{state.streaming ? '■' : '↑'}</span></button>
      </div>
    </div>
    <div className="composer-hint">Enter 发送 · 配置和数据保存在当前设备</div>
  </div>;
}
