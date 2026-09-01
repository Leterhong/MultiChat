import { useMemo, useState } from 'react';
import {
  Activity, Bot, Check, CheckCircle2, ChevronDown, ChevronRight, Circle,
  ClipboardCheck, FileCode2, FolderPlus, Gauge, Layers3, ListChecks,
  LockKeyhole, Plus, SearchCheck, ShieldCheck, TerminalSquare, X,
} from 'lucide-react';
import { state } from '../core';
import { WORK_MODE_LABELS, saveWorkflowSession, type WorkMode, type WorkflowSession } from '../core/workflow';
import { useAppStore, useBusinessStore } from '../store/appStore';
import { fmtTok } from '../utils/format';
import { ModelGlyph } from './BrandMark';
import { setWorkflowRailOpen } from './workflowRailDom';

type RailTab = 'run' | 'plan' | 'activity';

function closeRailDrawer() {
  setWorkflowRailOpen(false, { restoreFocus: true });
}

function updateWorkflow(next: WorkflowSession) {
  state.workflow = saveWorkflowSession(state.workflowScope, next);
}

function RunPanel({ business }: { business: any }) {
  const actions = useAppStore((current) => current.actions);
  const models = business.providers.flatMap((provider: any) => (provider.models || []).map((model: string) => ({
    id: `${provider.id}:${model}`,
    providerId: provider.id,
    providerName: provider.name || provider.id,
    model,
  })));
  const activeModel = models.find((item: any) => item.providerId === business.selectedProvider?.id && item.model === business.selectedModel);
  const selectedFiles = business.selectedAssetIds?.size || 0;
  const enabledMemories = business.memories.filter((memory: any) => memory.enabled !== false).length;
  const selectedAgent = business.selectedAgent;
  const enabledTools = selectedAgent
    ? (selectedAgent.toolIds?.length || 0) + (selectedAgent.mcpServerIds?.length || 0) + (selectedAgent.skillRefs?.length || selectedAgent.skillIds?.length || 0)
    : 0;

  const setMode = (mode: WorkMode) => updateWorkflow({ ...business.workflow, mode });
  const toggleCheck = (key: keyof WorkflowSession['checks']) => updateWorkflow({
    ...business.workflow,
    checks: { ...business.workflow.checks, [key]: !business.workflow.checks[key] },
  });

  return <div className="rail-tab-panel" role="tabpanel" id="workflow-panel-run" aria-labelledby="workflow-tab-run">
    <section className="workflow-block model-block">
      <div className="workflow-block-head"><div><span>主模型</span><strong>{activeModel?.model || '尚未选择'}</strong></div><button type="button" onClick={() => actions.openSettings?.('providers')}>管理连接</button></div>
      {models.length ? <details className="rail-model-switcher">
        <summary>
          <ModelGlyph name={activeModel?.providerName || business.selectedProvider?.name || 'M'} className="rail-current-model-mark" />
          <span><strong>{activeModel?.model || '选择模型'}</strong><small>{activeModel?.providerName || '从已配置模型中选择'}</small></span>
          <ChevronDown size={15} aria-hidden />
        </summary>
        <div className="rail-model-menu">{models.slice(0, 10).map((item: any) => {
          const active = item.id === activeModel?.id;
          return <button type="button" key={item.id} aria-label={`${item.model} · ${item.providerName}`} aria-pressed={active} onClick={(event) => {
            actions.selectModel?.(item.providerId, item.model);
            event.currentTarget.closest('details')?.removeAttribute('open');
          }}><ModelGlyph name={item.providerName} /><span><strong>{item.model}</strong><small>{item.providerName}</small></span>{active && <Check size={14} aria-hidden />}</button>;
        })}</div>
      </details> : <button type="button" className="rail-empty-action" onClick={() => actions.openSettings?.('providers')}><Layers3 size={18} aria-hidden /><span><strong>添加第一个模型</strong><small>配置地址和凭据后开始运行</small></span><ChevronRight size={15} aria-hidden /></button>}
    </section>

    <section className="workflow-block">
      <div className="workflow-block-head"><div><span>工作方式</span><strong>任务模式</strong></div></div>
      <div className="mode-segments" role="radiogroup" aria-label="任务模式">
        {(['execute', 'plan', 'review'] as WorkMode[]).map((mode) => <button type="button" role="radio" aria-checked={business.workflow.mode === mode} className={business.workflow.mode === mode ? 'active' : ''} key={mode} onClick={() => setMode(mode)}>
          {mode === 'execute' ? <TerminalSquare size={14} aria-hidden /> : mode === 'plan' ? <ListChecks size={14} aria-hidden /> : <SearchCheck size={14} aria-hidden />}
          {WORK_MODE_LABELS[mode]}
        </button>)}
      </div>
      <p className="mode-description">{business.workflow.mode === 'plan' ? '先理解上下文并形成计划，不执行有副作用的操作。' : business.workflow.mode === 'review' ? '聚焦缺陷、回归和风险，输出证据与修复建议。' : '在权限边界内持续推进，并完成验证和复查。'}</p>
    </section>

    <section className="workflow-block">
      <div className="workflow-block-head"><div><span>完成定义</span><strong>收尾检查</strong></div></div>
      <div className="verification-list">
        <button type="button" aria-pressed={business.workflow.checks.tests} className={business.workflow.checks.tests ? 'active' : ''} onClick={() => toggleCheck('tests')}><CheckCircle2 size={15} aria-hidden /><span><strong>测试验证</strong><small>执行相关检查并报告结果</small></span><i /></button>
        <button type="button" aria-pressed={business.workflow.checks.review} className={business.workflow.checks.review ? 'active' : ''} onClick={() => toggleCheck('review')}><ClipboardCheck size={15} aria-hidden /><span><strong>改动复查</strong><small>检查边界条件与明显回归</small></span><i /></button>
        <button type="button" aria-pressed={business.workflow.checks.security} className={business.workflow.checks.security ? 'active' : ''} onClick={() => toggleCheck('security')}><ShieldCheck size={15} aria-hidden /><span><strong>安全检查</strong><small>检查输入、权限与凭据风险</small></span><i /></button>
      </div>
    </section>

    <section className="workflow-context-grid" aria-label="当前上下文摘要">
      <button type="button" onClick={() => actions.openSettings?.('workspace')}><FileCode2 size={16} aria-hidden /><span><strong>{selectedFiles}</strong><small>上下文文件</small></span></button>
      <button type="button" onClick={() => actions.openSettings?.('agents')}><Bot size={16} aria-hidden /><span><strong>{enabledTools}</strong><small>已编排能力</small></span></button>
      <button type="button" onClick={() => actions.openSettings?.('workspace')}><Layers3 size={16} aria-hidden /><span><strong>{enabledMemories}</strong><small>项目记忆</small></span></button>
      <button type="button" onClick={() => actions.openSettings?.('general')}><Gauge size={16} aria-hidden /><span><strong>{fmtTok(business.params.max_tokens)}</strong><small>输出 Token</small></span></button>
    </section>

    <button type="button" className="workflow-folder-action" onClick={() => void actions.importProjectFolder?.()}><FolderPlus size={16} aria-hidden /><span><strong>添加项目文件夹</strong><small>建立代码索引并自动加入上下文</small></span><ChevronRight size={15} aria-hidden /></button>
  </div>;
}

function PlanPanel({ business }: { business: any }) {
  const [draft, setDraft] = useState('');
  const steps = business.workflow.steps || [];
  const completed = steps.filter((step: any) => step.done).length;
  const progress = steps.length ? Math.round((completed / steps.length) * 100) : 0;
  const commit = (patch: Partial<WorkflowSession>) => updateWorkflow({ ...business.workflow, ...patch });
  const addStep = () => {
    const text = draft.trim();
    if (!text) return;
    commit({ steps: [...steps, { id: `step_${Date.now().toString(36)}`, text, done: false }] });
    setDraft('');
  };
  return <div className="rail-tab-panel" role="tabpanel" id="workflow-panel-plan" aria-labelledby="workflow-tab-plan">
    <section className="workflow-block plan-block">
      <div className="plan-progress-head"><div><span>任务计划</span><strong>{steps.length ? `${completed} / ${steps.length} 已完成` : '还没有步骤'}</strong></div><b>{progress}%</b></div>
      <div className="plan-progress-track" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
      <div className="plan-step-list">
        {steps.map((step: any, index: number) => <div className={`plan-step${step.done ? ' done' : ''}`} key={step.id}>
          <button type="button" className="plan-step-toggle" aria-label={`${step.done ? '标记为未完成' : '标记为已完成'}：${step.text}`} onClick={() => commit({ steps: steps.map((item: any) => item.id === step.id ? { ...item, done: !item.done } : item) })}>{step.done ? <CheckCircle2 size={17} aria-hidden /> : <Circle size={17} aria-hidden />}</button>
          <span><small>步骤 {index + 1}</small><strong>{step.text}</strong></span>
          <button type="button" className="plan-step-remove" aria-label={`删除步骤：${step.text}`} onClick={() => commit({ steps: steps.filter((item: any) => item.id !== step.id) })}><X size={14} aria-hidden /></button>
        </div>)}
        {!steps.length && <div className="plan-empty"><ListChecks size={23} aria-hidden /><strong>把复杂任务拆成可验证步骤</strong><span>计划会随当前项目或对话保存，并自动提供给模型。</span></div>}
      </div>
      <div className="plan-add"><input value={draft} maxLength={240} placeholder="添加一个可完成的步骤" aria-label="新任务步骤" onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addStep(); } }} /><button type="button" aria-label="添加步骤" disabled={!draft.trim()} onClick={addStep}><Plus size={16} aria-hidden /></button></div>
    </section>

    <section className="workflow-block acceptance-block">
      <div className="workflow-block-head"><div><span>完成定义</span><strong>验收标准</strong></div><small>{business.workflow.acceptance.length} / 2400</small></div>
      <textarea value={business.workflow.acceptance} maxLength={2400} rows={7} placeholder={'每行一条，例如：\n关键交互可正常使用\n测试与构建通过\n浅色、深色主题无溢出'} aria-label="验收标准" onChange={(event) => commit({ acceptance: event.target.value })} />
      <p>发送任务时会作为隐藏工作协议提供给模型，不会混入你的消息正文。</p>
    </section>
  </div>;
}

function ActivityPanel({ business }: { business: any }) {
  const assistantMessages = business.messages.filter((message: any) => message.role === 'assistant');
  const completedMessages = assistantMessages.filter((message: any) => !message.streaming);
  const totalTokens = completedMessages.reduce((sum: number, message: any) => sum + Number(message.usage?.total_tokens ?? message.usage?.total ?? 0), 0);
  const timed = completedMessages.filter((message: any) => Number.isFinite(message.elapsedMs));
  const averageSeconds = timed.length ? timed.reduce((sum: number, message: any) => sum + Number(message.elapsedMs), 0) / timed.length / 1000 : 0;
  const latest = [...assistantMessages].reverse().find((message: any) => message.trace?.length || message.pendingApprovals);
  const trace = latest?.trace || [];
  const approvals = Object.values(latest?.pendingApprovals || {}) as any[];
  const events = useMemo(() => [
    ...approvals.map((approval) => ({ id: approval.id, type: 'approval', title: approval.tool || '工具授权', detail: approval.status === 'approved' ? '已批准' : approval.status === 'rejected' ? '已拒绝' : '等待授权', status: approval.status })),
    ...trace.slice(-8).reverse().map((step: any) => ({ id: step.sid, type: step.kind, title: step.kind === 'tool_call' ? step.tool || '工具调用' : step.model || '模型请求', detail: step.status === 'success' ? '执行成功' : step.status === 'error' ? step.error || '执行失败' : step.status === 'rejected' ? '已拒绝' : '运行中', status: step.status })),
  ].slice(0, 8), [latest]);

  return <div className="rail-tab-panel" role="tabpanel" id="workflow-panel-activity" aria-labelledby="workflow-tab-activity">
    <section className="activity-summary" aria-label="当前会话统计">
      <div><span>完成回复</span><strong>{completedMessages.length}</strong></div>
      <div><span>累计 Token</span><strong>{fmtTok(totalTokens)}</strong></div>
      <div><span>平均耗时</span><strong>{averageSeconds ? `${averageSeconds.toFixed(1)}s` : '—'}</strong></div>
    </section>
    <section className="workflow-block activity-block">
      <div className="workflow-block-head"><div><span>当前会话</span><strong>执行活动</strong></div><Activity size={16} aria-hidden /></div>
      {events.length ? <div className="activity-list">{events.map((event) => <div className="activity-item" key={event.id}>
        <span className={`activity-status ${event.status === 'success' || event.status === 'approved' ? 'ok' : event.status === 'error' || event.status === 'rejected' ? 'error' : 'running'}`} />
        <div><strong>{event.title}</strong><small>{event.detail}</small></div>
        <span>{event.type === 'approval' ? '授权' : event.type === 'tool_call' ? '工具' : '模型'}</span>
      </div>)}</div> : <div className="activity-empty"><Activity size={24} aria-hidden /><strong>运行后会在这里留下证据</strong><span>模型请求、工具调用、权限审批和失败状态都会汇总显示。</span></div>}
    </section>
    <section className="rail-local-note"><LockKeyhole size={16} aria-hidden /><div><strong>权限边界已启用</strong><span>高风险工具会先请求授权；计划和验收标准保存在当前设备。</span></div></section>
  </div>;
}

export function WorkspaceRail() {
  const business = useBusinessStore((current) => current);
  const [tab, setTab] = useState<RailTab>('run');
  const tabs: Array<{ id: RailTab; label: string; icon: typeof Activity }> = [
    { id: 'run', label: '运行', icon: TerminalSquare },
    { id: 'plan', label: '计划', icon: ListChecks },
    { id: 'activity', label: '活动', icon: Activity },
  ];
  return <>
    <aside className="workspace-rail" id="workflowRail" aria-label="开发工作台" tabIndex={-1}>
      <header className="workflow-rail-head">
        <div><span className="status-pulse" /><span><strong>开发工作台</strong><small>{WORK_MODE_LABELS[business.workflow.mode]}模式 · {business.selectedProject?.id === 'pr_inbox' ? '临时对话' : business.selectedProject?.name || '未打开项目'}</small></span></div>
        <button type="button" className="workflow-rail-close" aria-label="关闭开发工作台" onClick={closeRailDrawer}><X size={16} aria-hidden /></button>
      </header>
      <nav className="workflow-tabs" aria-label="开发工作台分区" role="tablist">
        {tabs.map(({ id, label, icon: Icon }) => <button type="button" role="tab" id={`workflow-tab-${id}`} data-workflow-tab={id} aria-selected={tab === id} aria-controls={`workflow-panel-${id}`} className={tab === id ? 'active' : ''} key={id} onClick={() => setTab(id)}><Icon size={14} aria-hidden />{label}</button>)}
      </nav>
      <div className="workflow-rail-body">
        {tab === 'run' ? <RunPanel business={business} /> : tab === 'plan' ? <PlanPanel business={business} /> : <ActivityPanel business={business} />}
      </div>
    </aside>
    <button type="button" className="workflow-rail-scrim" tabIndex={-1} aria-hidden="true" onClick={closeRailDrawer} />
  </>;
}
