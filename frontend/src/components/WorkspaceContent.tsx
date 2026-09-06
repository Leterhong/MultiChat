import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Brain,
  CheckCircle2,
  ChevronDown,
  Copy,
  FileText,
  FolderOpen,
  FolderPlus,
  Layers3,
  ListTree,
  Plus,
  RefreshCw,
  Wrench,
} from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';
import { state } from '../core';
import { useAppStore, useBusinessStore } from '../store/appStore';
import { fmtTok, formatRecentTime } from '../utils/format';
import { BrandMark } from './BrandMark';
import { ModelGlyph } from './BrandMark';
import { SafeMarkdown } from './SafeMarkdown';
import { openWorkflowRail } from './workflowRailDom';

const quickPrompts = [
  ['梳理代码结构', '请读取当前项目上下文，说明核心模块、关键数据流、未知项和建议的下一步。'],
  ['定位并修复问题', '请基于当前项目定位最可能的根因，实施最小修复，并完成相关验证。'],
  ['审查本次改动', '请审查当前改动，按严重程度列出缺陷、回归风险、安全问题和验证证据。'],
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
  const business = useBusinessStore((current) => current) as any;
  const ready = useAppStore((current) => current.ready);
  const actions = useAppStore((current) => current.actions);
  const taskMode = useAppStore((current) => current.taskMode);
  const setTaskMode = useAppStore((current) => current.setTaskMode);
  const [prompt, setPrompt] = useState('');
  const inputRef = useAutosize(prompt);
  const selectedFiles = business.selectedAssetIds?.size || 0;
  const projectFiles = business.assets?.length || 0;
  const memories = business.memories?.filter((item: any) => item.enabled !== false).length || 0;
  const hasProject = Boolean(
    business.selectedProject && business.selectedProject.id !== 'pr_inbox' && business.selectedProject.name !== '收件箱'
  );
  const recentTasks = (business.conversations || []).slice(0, 5);
  const workspaceName = business.selectedWorkspace?.name || '本机工作区';
  const projectName = hasProject ? business.selectedProject.name : '临时任务';

  useEffect(() => {
    if (ready && !document.querySelector('.settings.open, .modal.open')) inputRef.current?.focus();
  }, [ready, inputRef]);

  const submit = () => {
    const value = prompt.trim();
    if (!value) return;
    if (taskMode === 'compare') {
      localStorage.setItem('multichat_compare_draft', value);
      actions.openCompare?.();
      return;
    }
    if (taskMode === 'agent' && !business.selectedAgent) {
      document.getElementById('agentPicker')?.click();
      return;
    }
    if (!actions.send) return;
    if (!business.selectedProvider || !business.selectedModel) {
      void actions.send(value);
      return;
    }
    setPrompt('');
    void actions.send(value);
  };

  return (
    <div className="home-workbench workspace-home">
      <section className="home-task-entry" aria-labelledby="homeTaskTitle">
        <header className="home-heading">
          <div className="home-workspace-context">
            <span className="home-page-label">新任务</span>
            <span className="home-context-divider" aria-hidden />
            <button type="button" onClick={() => actions.openSettings?.('workspace')}>
              <FolderOpen size={13} aria-hidden />
              {workspaceName} / {projectName}
            </button>
          </div>
          <h1 id="homeTaskTitle">今天想完成什么？</h1>
          <p>从一个清晰目标开始。选择工作方式，接入项目上下文，然后交给 MultiChat。</p>
        </header>

        <div className="home-main-grid">
          <div className="home-compose-column">
            <div className="universal-composer" id="heroCard">
              <div className="home-mode-row">
                <div className="task-mode-switch" role="group" aria-label="任务模式">
                  {(['chat', 'agent', 'compare'] as const).map((mode) => (
                    <button
                      className={taskMode === mode ? 'active' : ''}
                      type="button"
                      aria-pressed={taskMode === mode}
                      key={mode}
                      onClick={() => setTaskMode(mode)}
                    >
                      {mode === 'chat' ? '对话' : mode === 'agent' ? 'Agent' : '模型对比'}
                    </button>
                  ))}
                </div>
                <span className="home-mode-description">
                  {taskMode === 'chat'
                    ? '使用当前模型直接交流'
                    : taskMode === 'agent'
                      ? '调用工具与能力完成任务'
                      : '并行验证多个模型的答案'}
                </span>
              </div>
              <textarea
                ref={inputRef}
                className="hero-input"
                id="heroInput"
                aria-label="告诉 MultiChat 你的目标"
                placeholder="描述你想完成的任务…"
                rows={4}
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
                <button type="button" title="添加项目文件夹" onClick={() => void actions.importProjectFolder?.()}>
                  <Plus size={15} aria-hidden />
                  <span>项目文件</span>
                </button>
                <button type="button" title="查看本轮上下文" onClick={() => openWorkflowRail('context')}>
                  <Layers3 size={15} aria-hidden />
                  <span>上下文{selectedFiles ? ` ${selectedFiles}` : ''}</span>
                </button>
                <span className="composer-context-summary">
                  {hasProject ? `${projectFiles} 文件 · ${memories} 记忆` : '尚未添加项目'}
                </span>
                <div className="spacer" />
                <button
                  className="hero-model"
                  id="heroModelTag"
                  type="button"
                  aria-label={`模型：${business.selectedModel || '选择模型'}`}
                  onClick={() => actions.openModelPicker?.()}
                >
                  <ModelGlyph name={business.selectedProvider?.name || business.selectedModel || 'M'} />
                  <span>{business.selectedModel || '选择模型'}</span>
                  <ChevronDown size={13} aria-hidden />
                </button>
                <button
                  className={`send-btn${business.streaming ? ' stop' : ''}`}
                  id="heroSendBtn"
                  type="button"
                  disabled={!ready || !prompt.trim()}
                  title="开始"
                  aria-label="开始任务"
                  onClick={submit}
                >
                  <ArrowUp size={17} aria-hidden />
                </button>
              </div>
            </div>

            <div className="home-quick" aria-label="建议任务">
              <span>快速开始</span>
              <div>
                {quickPrompts.map(([label, value]) => (
                  <button
                    type="button"
                    key={label}
                    onClick={() => {
                      setPrompt(value);
                      requestAnimationFrame(() => inputRef.current?.focus());
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="home-footnote">Enter 开始 · Shift Enter 换行 · 数据默认保存在当前设备</div>
          </div>

          <section className="home-recent" aria-labelledby="homeRecentTitle">
            <header>
              <div>
                <h2 id="homeRecentTitle">最近任务</h2>
                <p>继续上次没有完成的工作</p>
              </div>
              <span>本机保存</span>
            </header>
            <div className="home-recent-list">
              {recentTasks.map((conversation: any) => (
                <button
                  type="button"
                  key={conversation.id}
                  onClick={() => void actions.openConversation?.(conversation.id)}
                >
                  <span className="home-recent-mark" aria-hidden>
                    {conversation.compareMode ? 'C' : conversation.agentId ? 'A' : 'T'}
                  </span>
                  <span className="home-recent-copy">
                    <span className="home-recent-title">{conversation.title || '新任务'}</span>
                    <span className="home-recent-meta">
                      {formatRecentTime(conversation.updatedAt || conversation.createdAt)} ·{' '}
                      {conversation.compareMode ? '模型对比' : conversation.agentId ? 'Agent' : '对话'}
                    </span>
                  </span>
                  <span className="home-recent-arrow" aria-hidden>
                    →
                  </span>
                </button>
              ))}
              {!recentTasks.length && (
                <div className="home-recent-empty">
                  <span>还没有最近任务</span>
                  <small>第一项工作会出现在这里。</small>
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function ThinkingPanel({ message }: { message: any }) {
  if (!message.reasoning) return null;
  return (
    <details
      className="think-row"
      data-state={message.streaming ? 'running' : 'ok'}
      open={message.streaming || message.thinkOpen}
      onToggle={(event) => {
        message.thinkOpen = event.currentTarget.open;
      }}
    >
      <summary>
        <Brain className="think-ico" aria-hidden />
        <span>思考</span>
        <span className="think-caret" />
        {!message.streaming && <span className="think-summary">{String(message.reasoning).split('\n')[0]}</span>}
      </summary>
      <div className="think-body">{message.reasoning}</div>
    </details>
  );
}

function ToolPanels({ message }: { message: any }) {
  if (!Array.isArray(message.toolCalls)) return null;
  return (
    <>
      {message.toolCalls.map((tool: any, index: number) => {
        const content = String(tool.content || '');
        const head = content ? content.split('\n')[0].slice(0, 90) || '返回结果' : '执行完成';
        const body = content.length > 2000 ? `${content.slice(0, 2000)}\n…（已截断）` : content;
        return (
          <details
            className="tool-card"
            key={tool.id || `${tool.name}-${index}`}
            open={tool._open}
            onToggle={(event) => {
              tool._open = event.currentTarget.open;
            }}
          >
            <summary>
              <span className="execution-status completed">
                <CheckCircle2 size={14} aria-hidden />
              </span>
              <span className="tool-name">{tool.name}</span>
              <span className="tool-summary">{head}</span>
              <span className="execution-meta">已完成</span>
              <span className="tool-caret" />
            </summary>
            <div className="execution-detail">
              <span>输出</span>
              <pre className="tool-body">{body || '工具执行完成，未返回文本内容。'}</pre>
            </div>
          </details>
        );
      })}
    </>
  );
}

function ApprovalPanels({ message }: { message: any }) {
  const actions = useAppStore((current) => current.actions);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const approvals = Object.values(message.pendingApprovals || {}) as any[];
  if (!approvals.length) return null;
  return (
    <div className="approval-wrap">
      {approvals.map((approval) => {
        const resolved = ['approved', 'rejected', 'timed_out', 'cancelled'].includes(approval.status);
        const riskClass = approval.risk === 'high' ? 'risk-high' : approval.risk === 'medium' ? 'risk-med' : 'risk-low';
        const riskText = approval.risk === 'high' ? '高危' : approval.risk === 'medium' ? '中危' : '低危';
        const args = JSON.stringify(approval.args || {});
        const preview = args.length > 240 ? `${args.slice(0, 240)}…` : args;
        const resolve = async (action: 'approve' | 'reject') => {
          if (!actions.resolveApproval) return;
          setWorkingId(approval.id);
          try {
            await actions.resolveApproval(approval.id, action);
          } finally {
            setWorkingId(null);
          }
        };
        return (
          <section
            className={`approval-card ${resolved ? 'resolved' : 'pending'} ${approval.status === 'approved' ? 'is-approved' : resolved ? 'is-rejected' : ''}`}
            key={approval.id}
            aria-label={`${approval.tool || '工具'}授权`}
          >
            <div className="ap-head">
              <span className={`ap-badge ${riskClass}`}>需授权 · {riskText}</span>
              <span className="ap-tool">{approval.tool || ''}</span>
              {approval.trustLevel && (
                <span className="ap-perm ap-trust">{approval.trustLevel === 'trusted' ? '已信任' : '未信任'}</span>
              )}
            </div>
            <div className="ap-args">
              <span className="ap-args-label">参数</span>
              <code>{preview || '（无）'}</code>
            </div>
            <div className="ap-perms">
              {approval.permissions?.length ? (
                approval.permissions.map((permission: string) => (
                  <span className="ap-perm" key={permission}>
                    {permission}
                  </span>
                ))
              ) : (
                <span className="ap-perm">无特殊权限</span>
              )}
            </div>
            {resolved ? (
              <div className={`ap-resolved ${approval.status === 'approved' ? 'ok' : 'no'}`}>
                {approval.status === 'approved'
                  ? '已批准，Agent 继续执行'
                  : approval.status === 'rejected'
                    ? '已拒绝'
                    : approval.status === 'timed_out'
                      ? '超时自动拒绝'
                      : '已取消'}
              </div>
            ) : (
              <div className="ap-actions">
                <button
                  className="ap-btn ap-approve"
                  type="button"
                  disabled={workingId === approval.id}
                  onClick={() => void resolve('approve')}
                >
                  {workingId === approval.id ? '处理中…' : '批准执行'}
                </button>
                <button
                  className="ap-btn ap-reject"
                  type="button"
                  disabled={workingId === approval.id}
                  onClick={() => void resolve('reject')}
                >
                  拒绝
                </button>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function TracePanel({ message }: { message: any }) {
  if (!Array.isArray(message.trace) || !message.trace.length) return null;
  return (
    <details className="mc-trace" open={message.streaming}>
      <summary>
        <ListTree className="trace-ico-svg" aria-hidden />
        <span className="trace-title">执行轨迹</span>
        <span className="trace-count">{message.trace.length} 步</span>
      </summary>
      <div className="trace-body">
        {message.trace.map((step: any, index: number) => {
          const statusClass =
            step.status === 'success'
              ? 'ok'
              : step.status === 'error'
                ? 'err'
                : step.status === 'rejected'
                  ? 'rej'
                  : 'run';
          const duration = step.durationMs != null ? `${(step.durationMs / 1000).toFixed(1)}s` : '';
          const args = step.args ? JSON.stringify(step.args).slice(0, 80) : '';
          const label =
            step.kind === 'tool_call'
              ? `${step.tool || 'tool'}${args ? `(${args})` : ''}`
              : `模型请求 · ${step.model || ''}`;
          const sub =
            step.kind === 'tool_call'
              ? step.result
                ? String(step.result).split('\n')[0].slice(0, 90)
                : step.error || ''
              : `${step.toolCount || 0} 工具 · ${step.messageCount || 0} 上下文${step.outputLen != null ? ` · 输出 ${step.outputLen} 字` : ''}`;
          return (
            <div className={`trace-step ${statusClass}`} key={step.sid || index} tabIndex={0}>
              {step.kind === 'tool_call' ? (
                <Wrench className="trace-ico-svg" aria-hidden />
              ) : (
                <ListTree className="trace-ico-svg" aria-hidden />
              )}
              <div className="trace-main">
                <span className="trace-label">{label}</span>
                {sub && <span className="trace-sub">{sub}</span>}
              </div>
              <span className="trace-status" aria-label={step.status}>
                {step.status === 'success'
                  ? '✓'
                  : step.status === 'rejected'
                    ? '⊘'
                    : step.status === 'error'
                      ? '✕'
                      : '…'}
              </span>
              {duration && <span className="trace-dur">{duration}</span>}
            </div>
          );
        })}
      </div>
    </details>
  );
}

function MessageStats({ message }: { message: any }) {
  if (message.role !== 'assistant' || message.streaming || (!message.usage && message.elapsedMs == null)) return null;
  const usage = message.usage || {};
  const promptTokens = usage.prompt_tokens ?? usage.input_tokens;
  const completionTokens = usage.completion_tokens ?? usage.output_tokens;
  const totalTokens =
    usage.total_tokens ?? (promptTokens != null && completionTokens != null ? promptTokens + completionTokens : null);
  const cached = usage.prompt_tokens_details?.cached_tokens || usage.cached_tokens || 0;
  const reasoning = usage.completion_tokens_details?.reasoning_tokens || usage.reasoning_tokens || 0;
  const elapsed = message.elapsedMs != null ? message.elapsedMs / 1000 : null;
  const speed = message.elapsedMs && completionTokens ? completionTokens / (message.elapsedMs / 1000) : null;
  return (
    <div className="msg-stats">
      {totalTokens != null && (
        <span>
          共 <strong>{fmtTok(totalTokens)}</strong> tokens
          {promptTokens != null && completionTokens != null && (
            <>
              （输入 {fmtTok(promptTokens)} / 输出 {fmtTok(completionTokens)}）
            </>
          )}
          {reasoning > 0 && <> · 推理 {fmtTok(reasoning)}</>}
        </span>
      )}
      {cached > 0 && (
        <>
          <span className="sep">|</span>
          <span>
            缓存命中 <strong className="cached">{fmtTok(cached)}</strong>
          </span>
        </>
      )}
      {elapsed != null && (
        <>
          <span className="sep">|</span>
          <span>
            {elapsed.toFixed(1)}s
            {speed && (
              <>
                {' '}
                · <span className="speed">{speed.toFixed(0)} tok/s</span>
              </>
            )}
          </span>
        </>
      )}
      {message.model && (
        <>
          <span className="sep">|</span>
          <span>
            模型 <strong>{message.model}</strong>
          </span>
        </>
      )}
      {message.providerName && (
        <>
          <span className="sep">|</span>
          <span>
            渠道 <strong>{message.providerName}</strong>
          </span>
        </>
      )}
    </div>
  );
}

function MessageView({ message, index }: { message: any; index: number }) {
  const actions = useAppStore((current) => current.actions);
  const usage = message.usage || {};
  const totalTokens = usage.total_tokens ?? usage.total ?? usage.totalTokens;
  const elapsed = message.elapsedMs != null ? `${(message.elapsedMs / 1000).toFixed(1)}s` : '';
  return (
    <article
      className={`msg ${message.role}${message.streaming ? ' streaming' : ''}`}
      aria-label={message.role === 'user' ? '你的消息' : 'MultiChat 回复'}
    >
      {message.role === 'assistant' ? (
        <BrandMark className="msg-avatar" size={32} />
      ) : (
        <div className="msg-avatar" aria-hidden="true">
          你
        </div>
      )}
      <div className="msg-body">
        <div className="msg-role">
          <span className="message-identity">
            {message.role === 'assistant' && <i className="model-status-dot" />}
            {message.role === 'assistant' ? message.model || 'MultiChat' : '你'}
          </span>
          {message.role === 'assistant' && message.agentTag && <span className="msg-model">{message.agentTag}</span>}
          {message.role === 'assistant' && !message.streaming && (
            <span className="message-hover-meta">
              {[message.providerName, elapsed, totalTokens != null ? `${fmtTok(totalTokens)} tokens` : '']
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
          {message.streaming && <span className="busy-label">正在生成</span>}
        </div>
        <ThinkingPanel message={message} />
        <div className={`msg-content${message.role === 'user' ? ' user-plain-text' : ''}`}>
          {message.mcpWarnings?.length > 0 && (
            <div className="mcp-warning">
              <strong>MCP 连接失败</strong>
              {message.mcpWarnings.map((item: any) => (
                <span key={item.serverId || item.name}>
                  {item.name || item.serverId}：{item.error || ''}
                </span>
              ))}
            </div>
          )}
          {message.role === 'assistant' ? <SafeMarkdown>{message.content || ''}</SafeMarkdown> : message.content}
          <ToolPanels message={message} />
          <ApprovalPanels message={message} />
          <TracePanel message={message} />
        </div>
        <MessageStats message={message} />
        {message.resumeRunId && (
          <div className="run-paused">
            <span>{message.pauseReason || '运行已暂停，可以从检查点继续。'}</span>
            <button className="msg-action" type="button" onClick={() => void actions.resumeMessage?.(index)}>
              继续运行
            </button>
          </div>
        )}
        <div className="msg-actions">
          {message.role === 'assistant' && !message.streaming && (
            <>
              <button className="msg-action" type="button" onClick={() => void actions.copyMessage?.(index)}>
                <Copy size={13} aria-hidden />
                复制
              </button>
              <button className="msg-action" type="button" onClick={() => void actions.regenerateMessage?.(index)}>
                <RefreshCw size={13} aria-hidden />
                重新生成
              </button>
            </>
          )}
          {message.role === 'user' && (
            <button className="msg-action" type="button" onClick={() => actions.editMessage?.(index)}>
              编辑
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function ConversationWorkspace() {
  const messages = useBusinessStore((current) => current.messages);
  const streaming = useBusinessStore((current) => current.streaming);
  const selectedProject = useBusinessStore((current) => current.selectedProject) as any;
  const currentConvId = useBusinessStore((current) => current.currentConvId);
  const conversations = useBusinessStore((current) => current.conversations) as any[];
  const currentConversation = conversations.find((conversation) => conversation.id === currentConvId);
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    if (!streaming) return;
    const timer = window.setTimeout(() => {
      const last = state.messages.at(-1);
      if (last?.role === 'assistant') setAnnouncement(String(last.content || '').slice(-240));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [messages, streaming]);
  return (
    <div className={`chat-workspace${messages.length ? '' : ' is-empty'}`}>
      <section className="conversation-canvas" aria-label="当前对话">
        <header className="task-header">
          <span>{selectedProject?.id === 'pr_inbox' ? '临时任务' : selectedProject?.name || '无项目上下文'}</span>
          <span className={streaming ? 'running' : ''}>
            <i aria-hidden />
            {streaming ? '运行中' : messages.length ? '已保存' : '准备就绪'}
          </span>
        </header>
        {messages.length ? (
          <Virtuoso
            className="transcript transcript-virtual"
            data={messages}
            followOutput={streaming ? 'auto' : false}
            increaseViewportBy={{ top: 500, bottom: 800 }}
            components={{ Footer: () => <div className="transcript-footer" aria-hidden="true" /> }}
            itemContent={(index, message) => <MessageView index={index} message={message} />}
          />
        ) : (
          <div className="empty-task-shell">
            <div className="empty-task-heading">
              <span>准备开始</span>
              <h1>{currentConversation?.title || '开始一个新任务'}</h1>
              <p>告诉 MultiChat 你要完成什么，也可以先添加项目文件作为上下文。</p>
            </div>
            <ConversationComposer variant="start" />
          </div>
        )}
        {messages.length > 0 && <ConversationComposer />}
        <div className="sr-only" aria-live="polite" aria-atomic="false">
          {announcement}
        </div>
      </section>
    </div>
  );
}

export function WorkspaceContent() {
  const workspaceView = useAppStore((current) => current.workspaceView);
  return workspaceView === 'chat' ? <ConversationWorkspace /> : <HomeWorkspace />;
}

export function ConversationComposer({ variant = 'dock' }: { variant?: 'dock' | 'start' } = {}) {
  useBusinessStore((current) => current);
  const ready = useAppStore((current) => current.ready);
  const actions = useAppStore((current) => current.actions);
  const taskMode = useAppStore((current) => current.taskMode);
  const setTaskMode = useAppStore((current) => current.setTaskMode);
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
  const submit = () => {
    if (state.streaming) {
      actions.stop?.();
      return;
    }
    const value = text.trim();
    if (!value) return;
    if (taskMode === 'compare') {
      localStorage.setItem('multichat_compare_draft', value);
      actions.openCompare?.();
      return;
    }
    if (taskMode === 'agent' && !state.selectedAgent) {
      document.getElementById('agentPicker')?.click();
      return;
    }
    if (!actions.send) return;
    if (!state.selectedProvider || !state.selectedModel) {
      void actions.send(value);
      return;
    }
    setText('');
    void actions.send(value).finally(() => inputRef.current?.focus());
  };
  const selectFile = (id: string, checked: boolean) => {
    const selected = new Set(state.selectedAssetIds);
    if (checked) selected.add(id);
    else selected.delete(id);
    state.selectedAssetIds = selected;
    actions.refreshFileContext?.();
  };
  return (
    <div className={`composer-wrap${variant === 'start' ? ' composer-start' : ''}`} id="composerWrap">
      <div className="composer">
        {state.assets.length > 0 && (
          <div className="file-ctx" id="fileCtx">
            <button
              className="file-ctx-head"
              id="fileCtxHead"
              type="button"
              aria-expanded={filesOpen}
              onClick={() => setFilesOpen((value) => !value)}
            >
              <span className="fc-title">上下文</span>
              <span className="fc-count">
                {state.selectedAssetIds.size} / {state.assets.length} 已选择
              </span>
              <span className="spacer" />
              <ChevronDown className={filesOpen ? '' : 'is-collapsed'} size={15} aria-hidden />
            </button>
            {filesOpen && (
              <div className="file-ctx-body" id="fileCtxBody">
                {state.assets.map((asset: any) => (
                  <label className="fc-item" key={asset.id}>
                    <input
                      type="checkbox"
                      className="fc-check"
                      checked={state.selectedAssetIds.has(asset.id)}
                      onChange={(event) => selectFile(asset.id, event.target.checked)}
                    />
                    <span className="fc-name" title={asset.name}>
                      {asset.name}
                    </span>
                    <span className="fc-meta">
                      {String(asset.mimeType || '')
                        .split('/')
                        .pop()}
                    </span>
                  </label>
                ))}
                <div className="fc-actions">
                  <button
                    className="btn-ghost"
                    type="button"
                    onClick={() => {
                      state.selectedAssetIds = new Set(state.assets.map((asset: any) => asset.id));
                      actions.refreshFileContext?.();
                    }}
                  >
                    全选
                  </button>
                  <button
                    className="btn-ghost"
                    type="button"
                    onClick={() => {
                      state.selectedAssetIds = new Set();
                      actions.refreshFileContext?.();
                    }}
                  >
                    清空
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        <textarea
          ref={inputRef}
          className="composer-input"
          id="input"
          rows={1}
          placeholder={variant === 'start' ? '描述你想完成的任务…' : '描述下一步工作…'}
          autoComplete="off"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <div className="composer-actions">
          <button
            className="composer-tool"
            id="composerFolderBtn"
            type="button"
            title="添加项目文件夹"
            onClick={() => void actions.importProjectFolder?.()}
          >
            <FolderPlus size={15} aria-hidden />
            <span className="composer-tool-label">文件夹</span>
          </button>
          <button
            className="composer-tool"
            id="composerFileBtn"
            type="button"
            title="管理上下文文件"
            onClick={() => actions.openSettings?.('workspace')}
          >
            <FileText size={15} aria-hidden />
            <span className="composer-tool-label">
              {state.selectedAssetIds.size ? `上下文 ${state.selectedAssetIds.size}` : '上下文'}
            </span>
          </button>
          <button
            className="hero-tag"
            id="composerModelTag"
            type="button"
            title="选择模型"
            onClick={() => actions.openModelPicker?.()}
          >
            {state.selectedModel || '选择模型'}
          </button>
          <div className="task-mode-switch compact" role="group" aria-label="任务模式">
            {(['chat', 'agent', 'compare'] as const).map((mode) => (
              <button
                className={taskMode === mode ? 'active' : ''}
                type="button"
                aria-pressed={taskMode === mode}
                key={mode}
                onClick={() => setTaskMode(mode)}
              >
                {mode === 'chat' ? '对话' : mode === 'agent' ? '智能体' : '对比'}
              </button>
            ))}
          </div>
          <span className="ctx-hint">Shift+Enter 换行</span>
          <div className="spacer" />
          <button
            className={`send-btn${state.streaming ? ' stop' : ''}`}
            id="sendBtn"
            type="button"
            disabled={!ready}
            title={state.streaming ? '停止' : '发送'}
            aria-label={state.streaming ? '停止生成' : '发送消息'}
            onClick={submit}
          >
            <span aria-hidden>{state.streaming ? '■' : '↑'}</span>
          </button>
        </div>
      </div>
      <div className="composer-hint">Enter 发送 · 配置和数据保存在当前设备</div>
    </div>
  );
}
