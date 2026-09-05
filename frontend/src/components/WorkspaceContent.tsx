import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowUp,
  Bot,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Clock3,
  FileCode2,
  FileText,
  FolderOpen,
  FolderPlus,
  Gauge,
  Layers3,
  ListChecks,
  ListTree,
  Play,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Wrench,
} from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';
import { state } from '../core';
import { WORK_MODE_LABELS } from '../core/workflow';
import { useAppStore, useBusinessStore } from '../store/appStore';
import { fmtTok } from '../utils/format';
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

function shortDate(value: unknown) {
  const time = Date.parse(String(value || ''));
  if (!Number.isFinite(time)) return '';
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(time);
}

function runStatus(status: string) {
  if (status === 'completed') return '已完成';
  if (status === 'error') return '失败';
  if (status === 'cancelled') return '已取消';
  return '运行中';
}

function HomeWorkspace() {
  const business = useBusinessStore((current) => current) as any;
  const [prompt, setPrompt] = useState('');
  const ready = useAppStore((current) => current.ready);
  const actions = useAppStore((current) => current.actions);
  const inputRef = useAutosize(prompt);
  const noModel = !business.selectedProvider || !business.selectedModel;
  const selectedFiles = business.selectedAssetIds?.size || 0;
  const projectFiles = business.assets?.length || 0;
  const project = business.selectedProject;
  const hasProject = Boolean(project && project.id !== 'pr_inbox' && project.name !== '收件箱');
  const projectName = hasProject ? project.name : '还没有打开项目';
  const models = business.providers.flatMap((provider: any) =>
    (provider.models || []).map((model: string) => ({ provider, model }))
  );
  const recentConversations = business.conversations.slice(0, 4);
  const recentRuns = business.runs.slice(0, 4);
  const enabledCapabilities =
    business.skills.filter((item: any) => item.enabled !== false).length +
    business.tools.filter((item: any) => item.enabled !== false).length +
    business.mcpServers.filter((item: any) => item.enabled !== false).length +
    business.plugins.filter((item: any) => item.enabled !== false).length;
  const runTokens = business.runs.reduce((sum: number, run: any) => sum + Number(run.usage?.totalTokens || 0), 0);
  const completedRuns = business.runs.filter((run: any) => run.status === 'completed').length;

  useEffect(() => {
    if (ready && !document.querySelector('.settings.open, .modal.open')) inputRef.current?.focus();
  }, [ready, inputRef]);

  const submit = () => {
    const value = prompt.trim();
    if (!value || !actions.send) return;
    if (noModel) {
      void actions.send(value);
      return;
    }
    setPrompt('');
    void actions.send(value);
  };

  return (
    <div className="home-workbench dashboard-home">
      <section className="dashboard-hero" id="heroCard" aria-label="发起工作">
        <div className="dashboard-hero-heading">
          <div className="home-eyebrow">
            <BrandMark size={20} />
            <span>MultiChat Workspace</span>
            <i className="status-pulse" />
            <span>本机就绪</span>
          </div>
          <h1>今天想推进什么？</h1>
          <p>对话、项目上下文、智能体工具与运行证据，会在同一个本地工作流里持续衔接。</p>
        </div>
        <div className="dashboard-composer-shell">
          <div className="home-composer-label">
            <label htmlFor="heroInput">告诉 MultiChat 你的目标</label>
            <div className="home-task-status">
              <button type="button" onClick={() => openWorkflowRail('run')}>
                {business.workflow.mode === 'execute' ? (
                  <TerminalSquare size={13} aria-hidden />
                ) : business.workflow.mode === 'plan' ? (
                  <ListChecks size={13} aria-hidden />
                ) : (
                  <SearchCheck size={13} aria-hidden />
                )}
                {WORK_MODE_LABELS[business.workflow.mode]}
              </button>
              {noModel ? (
                <button
                  type="button"
                  className="model-cta"
                  title="添加一个模型连接"
                  onClick={() => actions.openSettings?.('providers')}
                >
                  <i className="status-pulse warn" />
                  连接模型
                </button>
              ) : (
                <span>
                  <i className="status-pulse" />
                  {business.selectedModel}
                </span>
              )}
            </div>
          </div>
          <textarea
            ref={inputRef}
            className="hero-input"
            id="heroInput"
            placeholder="描述目标、相关文件和你希望得到的结果…"
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
            <button
              className="hero-tag"
              id="heroModelTag"
              type="button"
              aria-label={`模型：${business.selectedModel || '选择模型'}`}
              onClick={() => actions.openModelPicker?.()}
            >
              <Layers3 size={14} aria-hidden />
              {business.selectedModel || '选择模型'}
            </button>
            <button className="hero-workflow-tag" type="button" onClick={() => openWorkflowRail('plan')}>
              <CheckCircle2 size={14} aria-hidden />
              {business.workflow.steps.length
                ? `${business.workflow.steps.filter((step: any) => step.done).length}/${business.workflow.steps.length} 步`
                : '添加计划'}
            </button>
            <button
              className="hero-folder"
              type="button"
              onClick={() => document.getElementById('workspacePicker')?.click()}
            >
              <FolderPlus size={14} aria-hidden />
              {hasProject ? projectName : '选择项目文件夹'}
            </button>
            <button
              className="hero-context-tag"
              id="heroWorkspace"
              type="button"
              onClick={() => actions.openInspector?.()}
            >
              {selectedFiles} / {projectFiles} 文件已选择
            </button>
            <div className="spacer" />
            <button
              className={`send-btn${business.streaming ? ' stop' : ''}`}
              id="heroSendBtn"
              type="button"
              disabled={!ready}
              title="开始"
              aria-label="开始运行"
              onClick={submit}
            >
              <ArrowUp size={18} aria-hidden />
            </button>
          </div>
        </div>
        <div className="home-quick" aria-label="常用任务">
          <span>快速开始</span>
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
      </section>

      <section className="dashboard-metrics" aria-label="工作台概览">
        <article>
          <Layers3 size={16} aria-hidden />
          <span>
            <strong>{models.length}</strong>
            <small>可用模型</small>
          </span>
        </article>
        <article>
          <FileCode2 size={16} aria-hidden />
          <span>
            <strong>{projectFiles}</strong>
            <small>项目文件</small>
          </span>
        </article>
        <article>
          <ShieldCheck size={16} aria-hidden />
          <span>
            <strong>{enabledCapabilities}</strong>
            <small>启用能力</small>
          </span>
        </article>
        <article>
          <Gauge size={16} aria-hidden />
          <span>
            <strong>{fmtTok(runTokens)}</strong>
            <small>近期 Token</small>
          </span>
        </article>
      </section>

      <div className="dashboard-grid">
        <section className="dashboard-card dashboard-recent">
          <header>
            <div>
              <span className="dashboard-kicker">继续工作</span>
              <h2>最近对话</h2>
            </div>
            <button type="button" onClick={() => void actions.newConversation?.()}>
              <span>新建</span>
              <ArrowUp size={14} aria-hidden />
            </button>
          </header>
          {recentConversations.length ? (
            <div className="dashboard-list">
              {recentConversations.map((conversation: any) => (
                <button
                  type="button"
                  key={conversation.id}
                  onClick={() => void actions.openConversation?.(conversation.id)}
                >
                  <span className="dashboard-list-icon">
                    <CircleDot size={15} aria-hidden />
                  </span>
                  <span>
                    <strong>{conversation.title || '新对话'}</strong>
                    <small>{shortDate(conversation.updatedAt || conversation.createdAt) || '本机对话'}</small>
                  </span>
                  <ChevronRight size={15} aria-hidden />
                </button>
              ))}
            </div>
          ) : (
            <div className="dashboard-empty">
              <Sparkles size={20} aria-hidden />
              <strong>从第一个问题开始</strong>
              <span>会话会自动保存在当前设备。</span>
            </div>
          )}
        </section>

        <section className="dashboard-card dashboard-context">
          <header>
            <div>
              <span className="dashboard-kicker">项目上下文</span>
              <h2>{hasProject ? projectName : '打开一个项目'}</h2>
            </div>
            <FolderOpen size={18} aria-hidden />
          </header>
          <p>
            {hasProject
              ? '已建立文件上下文，可在发送前精确选择要提供给模型的内容。'
              : '添加本地文件夹后，可围绕真实代码、文档和项目记忆工作。'}
          </p>
          <dl>
            <div>
              <dt>文件</dt>
              <dd>{projectFiles}</dd>
            </div>
            <div>
              <dt>已选择</dt>
              <dd>{selectedFiles}</dd>
            </div>
            <div>
              <dt>记忆</dt>
              <dd>{business.memories.filter((item: any) => item.enabled !== false).length}</dd>
            </div>
          </dl>
          <button
            className="dashboard-primary-action"
            type="button"
            onClick={() => void actions.importProjectFolder?.()}
          >
            <FolderPlus size={15} aria-hidden />
            {hasProject ? '添加项目文件夹' : '选择项目文件夹'}
          </button>
        </section>

        <section className="dashboard-card dashboard-runs">
          <header>
            <div>
              <span className="dashboard-kicker">运行证据</span>
              <h2>最近运行</h2>
            </div>
            <button type="button" onClick={() => actions.openSettings?.('runs')}>
              查看全部
            </button>
          </header>
          {recentRuns.length ? (
            <div className="run-mini-list">
              {recentRuns.map((run: any) => (
                <button type="button" key={run.id} onClick={() => actions.openSettings?.('runs')}>
                  <i className={`run-state ${run.status || 'running'}`} />
                  <span>
                    <strong>{run.agentName || run.agentId || '直接对话'}</strong>
                    <small>
                      {run.model || '未指定模型'} · {fmtTok(run.usage?.totalTokens || 0)} tokens
                    </small>
                  </span>
                  <em>{runStatus(run.status)}</em>
                </button>
              ))}
            </div>
          ) : (
            <div className="dashboard-empty compact">
              <Activity size={20} aria-hidden />
              <strong>还没有运行记录</strong>
              <span>模型请求、工具调用与审批结果会出现在这里。</span>
            </div>
          )}
        </section>

        <section className="dashboard-card dashboard-model">
          <header>
            <div>
              <span className="dashboard-kicker">当前配置</span>
              <h2>主模型</h2>
            </div>
            <button type="button" onClick={() => actions.openModelPicker?.()}>
              切换
            </button>
          </header>
          {business.selectedModel ? (
            <button className="dashboard-model-current" type="button" onClick={() => actions.openModelPicker?.()}>
              <ModelGlyph name={business.selectedProvider?.name || business.selectedModel} />
              <span>
                <strong>{business.selectedModel}</strong>
                <small>{business.selectedProvider?.name || '模型提供方'}</small>
              </span>
              <span className="status-pulse" />
            </button>
          ) : (
            <button className="dashboard-model-empty" type="button" onClick={() => actions.openSettings?.('providers')}>
              <Layers3 size={18} aria-hidden />
              <span>
                <strong>连接模型</strong>
                <small>添加 API 地址与凭据</small>
              </span>
            </button>
          )}
          <div className="dashboard-model-stats">
            <span>
              <strong>{completedRuns}</strong>
              <small>已完成运行</small>
            </span>
            <span>
              <strong>{business.agents.length}</strong>
              <small>智能体配置</small>
            </span>
          </div>
        </section>

        <section className="dashboard-card dashboard-actions">
          <header>
            <div>
              <span className="dashboard-kicker">快捷操作</span>
              <h2>组织下一步</h2>
            </div>
            <Play size={17} aria-hidden />
          </header>
          <div className="quick-action-grid">
            <button type="button" onClick={() => openWorkflowRail('plan')}>
              <ListChecks size={16} aria-hidden />
              <span>
                <strong>制定计划</strong>
                <small>拆成可验证步骤</small>
              </span>
            </button>
            <button type="button" onClick={() => actions.openInspector?.()}>
              <SearchCheck size={16} aria-hidden />
              <span>
                <strong>检查上下文</strong>
                <small>确认模型将收到什么</small>
              </span>
            </button>
            <button type="button" onClick={() => actions.openSettings?.('agents')}>
              <Bot size={16} aria-hidden />
              <span>
                <strong>编排智能体</strong>
                <small>组合工具与能力</small>
              </span>
            </button>
            <button type="button" onClick={() => openWorkflowRail('activity')}>
              <Clock3 size={16} aria-hidden />
              <span>
                <strong>查看活动</strong>
                <small>跟踪当前运行证据</small>
              </span>
            </button>
          </div>
        </section>
      </div>
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
              <Wrench className="tool-ico" aria-hidden />
              <span className="tool-name">{tool.name}</span>
              <span className="tool-sep" />
              <span className="tool-summary">{head}</span>
              <span className="tool-caret" />
            </summary>
            <pre className="tool-body">{body}</pre>
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
          {message.role === 'assistant' ? 'MultiChat' : '你'}
          {message.role === 'assistant' && message.agentTag && <span className="msg-model">{message.agentTag}</span>}
          {message.role === 'assistant' && message.model && <span className="msg-model">{message.model}</span>}
          {message.streaming && <span className="busy-label">处理中</span>}
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
                复制
              </button>
              <button className="msg-action" type="button" onClick={() => void actions.regenerateMessage?.(index)}>
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
    <>
      <Virtuoso
        className="transcript transcript-virtual"
        data={messages}
        followOutput={streaming ? 'auto' : false}
        increaseViewportBy={{ top: 500, bottom: 800 }}
        components={{ Footer: () => <div className="transcript-footer" aria-hidden="true" /> }}
        itemContent={(index, message) => <MessageView index={index} message={message} />}
      />
      <div className="sr-only" aria-live="polite" aria-atomic="false">
        {announcement}
      </div>
    </>
  );
}

export function WorkspaceContent() {
  const hasMessages = useBusinessStore((current) => current.messages.length > 0);
  return hasMessages ? <ConversationWorkspace /> : <HomeWorkspace />;
}

export function ConversationComposer() {
  useBusinessStore((current) => current);
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
    if (state.streaming) {
      actions.stop?.();
      return;
    }
    const value = text.trim();
    if (!value || !actions.send) return;
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
    <div className="composer-wrap" id="composerWrap">
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
          placeholder="描述下一步工作…"
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
            className="composer-tool composer-mode"
            type="button"
            title="切换任务模式"
            onClick={() => openWorkflowRail('run')}
          >
            {state.workflow.mode === 'execute' ? (
              <TerminalSquare size={15} aria-hidden />
            ) : state.workflow.mode === 'plan' ? (
              <ListChecks size={15} aria-hidden />
            ) : (
              <SearchCheck size={15} aria-hidden />
            )}
            <span className="composer-tool-label">{WORK_MODE_LABELS[state.workflow.mode]}</span>
          </button>
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
