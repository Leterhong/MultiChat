import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Download, Edit3, Plus, RefreshCw, Search, Trash2, Upload } from 'lucide-react';
import { useBusinessStore } from '../store/appStore';

export function compactNumber(value: unknown) {
  const number = Number(value || 0);
  if (number >= 1_000_000_000) return `${(number / 1_000_000_000).toFixed(number >= 10_000_000_000 ? 0 : 1)}B`;
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(number >= 10_000_000 ? 0 : 1)}M`;
  if (number >= 1_000) return `${(number / 1_000).toFixed(number >= 10_000 ? 0 : 1)}K`;
  return number.toLocaleString('zh-CN');
}

type WorkspaceProps = {
  onWorkspaceChange: (id: string) => Promise<void>;
  onProjectChange: (id: string) => Promise<void>;
  onSaveDefaults: (agentId: string | null, providerId: string | null, model: string | null) => Promise<void>;
  onNewWorkspace: () => void;
  onNewProject: () => void;
  onImportUrl: () => void;
  onUploadFile: (file: File) => Promise<void>;
  onDeleteAsset: (id: string) => Promise<void>;
  onSearch: (query: string) => Promise<any[]>;
  onAddMemory: () => void;
  onEditMemory: (id: string) => void;
  onToggleMemory: (item: any) => Promise<void>;
  onDeleteMemory: (id: string) => Promise<void>;
  onCreateSnapshot: () => Promise<void>;
  onRestoreSnapshot: (id: string) => Promise<void>;
  onDeleteSnapshot: (id: string) => Promise<void>;
};

export function WorkspaceSettings(props: WorkspaceProps) {
  const workspaces = useBusinessStore((current) => current.workspaces);
  const projects = useBusinessStore((current) => current.projects);
  const agents = useBusinessStore((current) => current.agents);
  const providers = useBusinessStore((current) => current.providers);
  const assets = useBusinessStore((current) => current.assets);
  const memories = useBusinessStore((current) => current.memories);
  const snapshots = useBusinessStore((current) => current.snapshots);
  const workspace = useBusinessStore((current) => current.selectedWorkspace);
  const project = useBusinessStore((current) => current.selectedProject);
  const fileRef = useRef<HTMLInputElement>(null);
  const [defaultAgent, setDefaultAgent] = useState(project?.defaultAgentId || '');
  const [defaultModel, setDefaultModel] = useState(project?.defaultProviderId && project?.defaultModel ? `${project.defaultProviderId}:${project.defaultModel}` : '');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    setDefaultAgent(project?.defaultAgentId || '');
    setDefaultModel(project?.defaultProviderId && project?.defaultModel ? `${project.defaultProviderId}:${project.defaultModel}` : '');
    setResults([]);
    setSearched(false);
    setSearchError('');
  }, [project?.id, project?.defaultAgentId, project?.defaultProviderId, project?.defaultModel]);

  const models = providers.flatMap((provider: any) => (provider.models || []).map((model: string) => ({
    value: `${provider.id}:${model}`,
    label: `${provider.name || provider.id} · ${model}`,
  })));

  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim() || !project) return;
    setSearching(true); setSearchError('');
    try { setResults(await props.onSearch(query.trim())); }
    catch (error: any) { setResults([]); setSearchError(error.message); }
    finally { setSearching(false); setSearched(true); }
  };

  const saveDefaults = async () => {
    const [providerId, ...rest] = defaultModel.split(':');
    await props.onSaveDefaults(defaultAgent || null, providerId || null, rest.join(':') || null);
  };

  return <>
    <h3>工作区</h3><p className="lead">按工作区和项目组织会话、文件与运行上下文。文件内容只保存在本地数据目录。</p>
    <section className="provider-card">
      <h4>当前空间</h4>
      <div className="field"><label htmlFor="workspaceSelectReact">工作区</label><select id="workspaceSelectReact" value={workspace?.id || ''} onChange={(event) => void props.onWorkspaceChange(event.target.value)}>{workspaces.map((item: any) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div>
      <div className="field"><label htmlFor="projectSelectReact">项目</label><select id="projectSelectReact" value={project?.id || ''} onChange={(event) => void props.onProjectChange(event.target.value)}>{projects.map((item: any) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div>
      <div className="field"><label htmlFor="projectAgentReact">项目默认运行配置</label><select id="projectAgentReact" value={defaultAgent} onChange={(event) => setDefaultAgent(event.target.value)}><option value="">（继承全局）</option>{agents.map((item: any) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div>
      <div className="field"><label htmlFor="projectModelReact">项目默认模型</label><select id="projectModelReact" value={defaultModel} onChange={(event) => setDefaultModel(event.target.value)}><option value="">（继承全局）</option>{models.map((item: any) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></div>
      <div className="provider-row"><button className="btn-primary compact-action" type="button" onClick={() => void saveDefaults()}>保存项目默认</button></div>
      <div className="provider-row"><button className="btn-ghost" type="button" onClick={props.onNewWorkspace}>新建工作区</button><button className="btn-ghost" type="button" onClick={props.onNewProject}>新建项目</button></div>
    </section>
    <section className="provider-card">
      <h4>项目文件</h4><div className="pmeta">支持本地文本文件和 URL 文本资源；对话时会按相关性截取并附带文件/行号来源。</div>
      <div className="provider-row workspace-file-actions"><button className="btn-ghost" type="button" onClick={() => fileRef.current?.click()}><Upload size={15} aria-hidden /> 上传本地文件</button><button className="btn-ghost" type="button" onClick={props.onImportUrl}>从 URL 添加</button><input ref={fileRef} type="file" accept=".txt,.md,.json,.csv,.js,.ts,.py,.html,.css,.yaml,.yml" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void props.onUploadFile(file); event.target.value = ''; }} /></div>
      <div className="run-list workspace-resource-list">{assets.map((asset: any) => <div className="run-row" key={asset.id}><span className="run-dot completed" /><div className="run-main"><div className="run-title">{asset.name}</div><div className="run-meta">{asset.mimeType} · {asset.size} bytes · {asset.source}</div></div><button className="mc-act danger" type="button" title="删除" aria-label={`删除文件 ${asset.name}`} onClick={() => void props.onDeleteAsset(asset.id)}><Trash2 size={15} aria-hidden /></button></div>)}{!assets.length && <div className="control-empty">当前项目还没有文件。</div>}</div>
      <form className="knowledge-search" onSubmit={search}><label className="resource-search"><Search size={15} aria-hidden /><input aria-label="搜索项目知识" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目知识，例如：认证流程在哪里实现？" /></label><button className="btn-ghost" disabled={searching}>{searching ? '检索中…' : '搜索知识'}</button></form>
      <div className="knowledge-results" aria-live="polite">{searchError && <div className="auth-error">{searchError}</div>}{results.map((item: any, index) => <article className="knowledge-hit" key={`${item.id || item.name}-${index}`}><strong>{item.name} <span>L{item.lineStart}–L{item.lineEnd}</span></strong><p>{String(item.snippet || '').slice(0, 500)}</p></article>)}{searched && !searching && !searchError && results.length === 0 && <div className="control-empty">没有找到相关片段。</div>}</div>
    </section>
    <section className="provider-card">
      <div className="control-card-head"><div><h4>项目记忆</h4><div className="pmeta">由你明确维护的事实和偏好；可逐条停用，不会从聊天中偷偷学习。</div></div><button className="btn-ghost" type="button" onClick={props.onAddMemory}>新增记忆</button></div>
      <div className="memory-list">{memories.map((item: any) => <article className={`memory-item${item.enabled === false ? ' disabled' : ''}`} key={item.id}><button className="memory-toggle" type="button" aria-pressed={item.enabled !== false} onClick={() => void props.onToggleMemory(item)}><i />{item.enabled !== false ? '已启用' : '已停用'}</button><div><strong>{item.title}</strong><p>{item.content}</p></div><div className="memory-actions"><button className="mc-act" type="button" onClick={() => props.onEditMemory(item.id)}>编辑</button><button className="mc-act danger" type="button" onClick={() => void props.onDeleteMemory(item.id)}>删除</button></div></article>)}{!memories.length && <div className="control-empty">还没有项目记忆。只保存值得长期复用的事实和偏好。</div>}</div>
    </section>
    <section className="provider-card">
      <div className="control-card-head"><div><h4>项目时光机</h4><div className="pmeta">保存项目设置、知识文件、记忆、默认运行配置和当前 Git 状态；恢复前会自动再备份一次。</div></div><button className="btn-primary compact-action" type="button" onClick={() => void props.onCreateSnapshot()}>创建快照</button></div>
      <div className="snapshot-list">{snapshots.map((item: any) => <article className="snapshot-item" key={item.id}><span className="snapshot-mark">{item.git?.commit || 'LOCAL'}</span><div><strong>{item.title}</strong><p>{new Date(item.createdAt).toLocaleString('zh-CN')} · {item.assets} 文件 · {item.memories} 记忆 · {compactNumber(item.size)}B{item.git?.branch ? ` · ${item.git.branch}${item.git.dirty ? '（有改动）' : ''}` : ''}</p></div><div className="memory-actions"><button className="mc-act" type="button" onClick={() => void props.onRestoreSnapshot(item.id)}>恢复</button><button className="mc-act danger" type="button" onClick={() => void props.onDeleteSnapshot(item.id)}>删除</button></div></article>)}{!snapshots.length && <div className="control-empty">尚未创建项目快照。</div>}</div>
    </section>
  </>;
}

type AgentProps = {
  onEdit: (id: string | null) => void;
  onExport: (agent: any) => void;
  onDelete: (agent: any) => Promise<void>;
  onImport: (file: File) => Promise<void>;
};

export function AgentSettings({ onEdit, onExport, onDelete, onImport }: AgentProps) {
  const agents = useBusinessStore((current) => current.agents);
  const selectedAgent = useBusinessStore((current) => current.selectedAgent);
  const fileRef = useRef<HTMLInputElement>(null);
  return <>
    <div className="settings-page-heading"><div><h3>运行配置</h3><p className="lead">把系统提示词、Skills、内置工具和 MCP 服务保存为可复用配置。只有当前配置选中的能力才会进入一次运行。</p></div><div className="extension-heading-actions"><button className="btn-ghost" type="button" onClick={() => fileRef.current?.click()}><Upload size={15} aria-hidden /> 导入配置</button><button className="btn-primary compact-action" type="button" onClick={() => onEdit(null)}><Plus size={15} aria-hidden /> 新建配置</button><input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void onImport(file); event.target.value = ''; }} /></div></div>
    <div className="card-grid">{agents.map((agent: any) => { const skillIds = agent.skillRefs || agent.skillIds || []; const toolIds = agent.toolIds || []; const mcpIds = agent.mcpServerIds || []; return <article className="mc-card" key={agent.id} onClick={() => onEdit(agent.id)}><div className="mc-top"><div className="mc-ico"><Bot size={19} aria-hidden /></div><div className="mc-title-wrap"><div className="mc-title">{agent.name}</div><div className="mc-sub">{agent.id}</div></div>{selectedAgent?.id === agent.id && <span className="mc-tag on">使用中</span>}</div><div className="mc-desc">{agent.description || '（暂无描述）'}</div><div className="mc-tags"><span className="mc-tag">{skillIds.length} 个技能</span><span className="mc-tag">{toolIds.length} 个内置工具</span><span className="mc-tag">{mcpIds.length} 个 MCP</span>{skillIds.slice(0, 3).map((id: string) => <span className="mc-tag" key={id}>{id}</span>)}{skillIds.length > 3 && <span className="mc-tag">+{skillIds.length - 3}</span>}</div><div className="mc-actions extension-card-actions"><button className="mc-act" type="button" title="导出" aria-label={`导出 ${agent.name}`} onClick={(event) => { event.stopPropagation(); onExport(agent); }}><Download size={15} aria-hidden /></button><button className="mc-act" type="button" title="编辑" aria-label={`编辑 ${agent.name}`} onClick={(event) => { event.stopPropagation(); onEdit(agent.id); }}><Edit3 size={15} aria-hidden /></button><button className="mc-act danger" type="button" title="删除" aria-label={`删除 ${agent.name}`} onClick={(event) => { event.stopPropagation(); void onDelete(agent); }}><Trash2 size={15} aria-hidden /></button></div></article>; })}{!agents.length && <div className="extension-empty">还没有运行配置。</div>}</div>
  </>;
}

const typeLabel: Record<string, string> = { plugin: '插件', skill: 'Skill', mcp: 'MCP', tool: '内置工具' };
const riskLabel: Record<string, string> = { high: '高风险', medium: '中风险', low: '低风险' };

export function CapabilitySettings({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const data = useBusinessStore((current) => current.capabilities);
  const [query, setQuery] = useState(''); const [type, setType] = useState(''); const [risk, setRisk] = useState('');
  const visible = useMemo(() => (data?.items || []).filter((item: any) => {
    const searchable = [item.name, item.id, item.source, item.scope, ...(item.permissions || [])].join(' ').toLowerCase();
    return (!query || searchable.includes(query.toLowerCase())) && (!type || item.type === type) && (!risk || item.risk === risk);
  }), [data, query, type, risk]);
  if (!data) return <><h3>能力审计</h3><p className="lead">正在生成能力护照…</p><div className="usage-loading" role="status" aria-label="正在加载" /></>;
  return <section className="passport-page"><div className="settings-page-heading"><div><div className="usage-kicker">能力治理</div><h3>能力审计</h3><p className="lead">统一查看每项能力的来源、版本、权限、信任边界和结构完整性。</p></div><button className="btn-ghost" type="button" onClick={() => void onRefresh()}><RefreshCw size={15} aria-hidden /> 重新扫描</button></div>
    <div className="passport-summary"><span><strong>{data.summary.total}</strong> 项能力</span><span><strong>{data.summary.enabled}</strong> 项启用</span><span className={data.summary.highRisk ? 'warn' : ''}><strong>{data.summary.highRisk}</strong> 项高风险</span><span className={data.summary.issues ? 'warn' : ''}><strong>{data.summary.issues}</strong> 个待处理问题</span></div>
    <div className="resource-toolbar passport-toolbar"><label className="resource-search"><Search size={15} aria-hidden /><input type="search" aria-label="搜索能力" placeholder="搜索能力、来源或权限" value={query} onChange={(event) => setQuery(event.target.value)} /></label><select aria-label="按类型筛选" value={type} onChange={(event) => setType(event.target.value)}><option value="">全部类型</option>{Object.entries(typeLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><select aria-label="按风险筛选" value={risk} onChange={(event) => setRisk(event.target.value)}><option value="">全部风险</option><option value="high">高风险</option><option value="medium">中风险</option><option value="low">低风险</option></select><span className="resource-count">{visible.length} / {data.items.length} 项</span></div>
    <div className="passport-grid">{visible.map((item: any) => <article className="passport-card" key={`${item.type}:${item.id}`}><div className="passport-head"><span className={`passport-type ${item.type}`}>{typeLabel[item.type] || item.type}</span><span className={`passport-risk ${item.risk}`}>{riskLabel[item.risk] || item.risk}</span></div><h4>{item.name}</h4><code>{item.id}</code><p>{item.description || '暂无说明'}</p><dl><div><dt>来源</dt><dd>{item.source} · {item.scope || 'project'}</dd></div><div><dt>版本 / 完整性</dt><dd>{item.version || '未声明'} · {item.integrity || 'unknown'}</dd></div><div><dt>信任</dt><dd>{item.trust || 'unknown'}</dd></div></dl><div className="passport-perms">{(item.permissions || []).map((permission: string) => <span key={permission}>{permission}</span>)}{!item.permissions?.length && <span className="none">无特殊权限</span>}</div>{item.issues?.length ? <div className="passport-issues">{item.issues.map((issue: string) => <span key={issue}>{issue}</span>)}</div> : <div className="passport-clean">结构检查通过</div>}</article>)}</div>{!visible.length && <div className="extension-empty">没有符合筛选条件的能力。</div>}
  </section>;
}

const palette = ['#6158e8', '#16aabd', '#9b77f2', '#ef9f52', '#46a575', '#d65f7a'];

function UsageTrend({ rows = [] }: { rows: any[] }) {
  const width = 760, height = 226, left = 38, top = 18, bottom = 30;
  const plotW = width - left - 12, plotH = height - top - bottom;
  const max = Math.max(1, ...rows.map((item) => Number(item.totalTokens || 0)));
  const step = plotW / Math.max(1, rows.length);
  const points = rows.map((item, index) => `${left + index * step + step / 2},${top + plotH - plotH * Number(item.totalTokens || 0) / max}`).join(' ');
  return <svg className="usage-trend" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="每日 Token 用量趋势"><g className="usage-grid">{[0, .5, 1].map((ratio) => <g key={ratio}><line x1={left} x2={width - 12} y1={top + plotH * (1 - ratio)} y2={top + plotH * (1 - ratio)} /><text x="0" y={top + plotH * (1 - ratio) + 4}>{compactNumber(max * ratio)}</text></g>)}</g>{rows.map((item, index) => { const x = left + index * step + Math.max(1, step * .16); const barW = Math.max(2, step * .68); const inputH = plotH * Number(item.inputTokens || 0) / max; const outputH = plotH * Number(item.outputTokens || 0) / max; const yBase = top + plotH; return <g key={item.date}><title>{item.date} · {compactNumber(item.totalTokens)} tokens</title><rect className="usage-bar-input" x={x} y={yBase - inputH} width={barW} height={inputH} rx="2" /><rect className="usage-bar-output" x={x} y={yBase - inputH - outputH} width={barW} height={outputH} rx="2" /></g>; })}{points && <polyline className="usage-line" points={points} />}<text className="usage-date" x={left} y={height - 5}>{rows[0]?.date?.slice(5) || ''}</text><text className="usage-date" x={width - 12} y={height - 5} textAnchor="end">{rows[rows.length - 1]?.date?.slice(5) || ''}</text></svg>;
}

export function UsageSettings({ onRange, onExport }: { onRange: (range: string) => Promise<void>; onExport: (usage: any, range: string) => void }) {
  const usage = useBusinessStore((current) => current.usage);
  const loading = useBusinessStore((current) => current.usageLoading);
  const range = useBusinessStore((current) => current.usageRange);
  if (loading && !usage) return <><h3>用量中心</h3><p className="lead">正在汇总本地运行记录…</p><div className="usage-loading" role="status" aria-label="正在加载" /></>;
  const totals = usage?.totals || {}; const daily = usage?.daily || []; const today = daily[daily.length - 1] || {}; const models = usage?.models || []; const providers = usage?.providers || [];
  let angle = 0; const stops = models.slice(0, 6).map((model: any, index: number) => { const start = angle; angle += Number(model.share || 0) * 360; return `${palette[index % palette.length]} ${start}deg ${angle}deg`; }).join(',');
  return <section className="usage-page"><div className="settings-page-heading usage-heading"><div><div className="usage-kicker">本地用量统计</div><h3>每日 Token 用量</h3><p className="lead">按本机请求汇总；上游未返回 usage 时会明确标记为估算，不读取任何提示词正文。</p></div><div className="usage-heading-actions"><div className="usage-ranges">{[['7', '近 7 天'], ['30', '近 30 天'], ['all', '全部']].map(([value, label]) => <button className={`usage-range${range === value ? ' active' : ''}`} type="button" key={value} onClick={() => void onRange(value)}>{label}</button>)}</div><button className="btn-ghost" type="button" onClick={() => onExport(usage, range)}><Download size={15} aria-hidden /> 导出 CSV</button></div></div>
    <div className="usage-metrics"><article className="usage-metric primary"><span>Token 总量</span><strong>{compactNumber(totals.totalTokens)}</strong><small>输入 {compactNumber(totals.inputTokens)} · 输出 {compactNumber(totals.outputTokens)}</small></article><article className="usage-metric"><span>今日用量</span><strong>{compactNumber(today.totalTokens)}</strong><small>{today.requests || 0} 次模型请求</small></article><article className="usage-metric"><span>有效交互</span><strong>{compactNumber(totals.messages)}</strong><small>{totals.requests || 0} 次模型调用</small></article><article className="usage-metric"><span>活跃天数</span><strong>{totals.activeDays || 0}</strong><small>连续 {totals.currentStreak || 0} 天 · 最长 {totals.longestStreak || 0} 天</small></article></div>
    <div className="usage-insights"><span><i className="success" />成功率 <strong>{((totals.successRate ?? 1) * 100).toFixed(1)}%</strong></span><span>日均 <strong>{compactNumber(totals.averagePerActiveDay)}</strong></span><span>峰值时段 <strong>{String(totals.peakHour || 0).padStart(2, '0')}:00–{String(((totals.peakHour || 0) + 1) % 24).padStart(2, '0')}:00</strong></span><span>真实上报 <strong>{((totals.reportedShare || 0) * 100).toFixed(0)}%</strong></span>{totals.estimatedTokens ? <span className="estimate-note">约 {compactNumber(totals.estimatedTokens)} Token 为本地估算</span> : null}</div>
    <div className="usage-layout"><article className="usage-panel usage-wide"><div className="usage-panel-head"><div><h4>按天趋势</h4><p>深色为输入，浅色为输出；悬停柱形查看当天明细。</p></div><div className="usage-legend"><span className="input" />输入 <span className="output" />输出</div></div><UsageTrend rows={daily} /></article><article className="usage-panel"><div className="usage-panel-head"><div><h4>模型用量</h4><p>选定周期内的 Token 占比</p></div></div><div className="usage-model-wrap"><div className="usage-donut" style={{ background: `conic-gradient(${stops || 'var(--mc-line) 0 360deg'})` }}><div><strong>{models.length}</strong><span>模型</span></div></div><div className="usage-model-list">{models.slice(0, 6).map((model: any, index: number) => <div key={model.name}><i style={{ background: palette[index % palette.length] }} /><span title={model.name}>{model.name}</span><strong>{(Number(model.share || 0) * 100).toFixed(1)}%</strong><small>{compactNumber(model.totalTokens)}</small></div>)}{!models.length && <p className="usage-empty">还没有用量记录</p>}</div></div></article><article className="usage-panel usage-wide"><div className="usage-panel-head"><div><h4>活跃热力图</h4><p>最近 26 周的本地模型调用</p></div><span>{usage?.heatmap?.filter((item: any) => item.totalTokens > 0).length || 0} 个活跃日</span></div><div className="usage-heatmap" role="img" aria-label="最近 26 周活跃情况">{(usage?.heatmap || []).map((item: any) => { const level = item.totalTokens === 0 ? 0 : item.totalTokens < 1000 ? 1 : item.totalTokens < 10000 ? 2 : item.totalTokens < 100000 ? 3 : 4; return <i data-level={level} key={item.date}><span>{item.date} · {compactNumber(item.totalTokens)} tokens</span></i>; })}</div></article><article className="usage-panel"><div className="usage-panel-head"><div><h4>提供方健康</h4><p>请求、用量与错误率</p></div></div><div className="usage-provider-list">{providers.map((provider: any) => <div key={provider.id || provider.name}><span><i />{provider.name}</span><strong>{compactNumber(provider.totalTokens)}</strong><small>{provider.requests} 次 · {provider.requests ? (provider.errors / provider.requests * 100).toFixed(0) : 0}% 错误</small></div>)}{!providers.length && <p className="usage-empty">还没有提供方记录</p>}</div></article></div>
  </section>;
}

export function RunsSettings({ onRefresh, onOpen }: { onRefresh: () => Promise<void>; onOpen: (id: string) => void }) {
  const runs = useBusinessStore((current) => current.runs || []);
  const completed = runs.filter((run: any) => run.status === 'completed').length;
  const totalTokens = runs.reduce((sum: number, run: any) => sum + Number(run.usage?.totalTokens || 0), 0);
  const statusText = (status: string) => status === 'completed' ? '已完成' : status === 'error' ? '失败' : status === 'cancelled' ? '已取消' : '进行中';
  return <><div className="settings-page-heading"><div><div className="usage-kicker">运行记录</div><h3>执行与复盘</h3><p className="lead">复盘模型请求、工具权限、上下文来源、耗时与 Token；点击记录查看完整上下文。</p></div><button className="btn-ghost" type="button" onClick={() => void onRefresh()}><RefreshCw size={15} aria-hidden /> 刷新</button></div><div className="passport-summary"><span><strong>{runs.length}</strong> 条记录</span><span><strong>{completed}</strong> 次完成</span><span><strong>{compactNumber(totalTokens)}</strong> tokens</span><span className={runs.length - completed ? 'warn' : ''}><strong>{runs.length - completed}</strong> 次未完成</span></div><div className="run-list">{runs.map((run: any) => <button className="run-row run-row-button" type="button" key={run.id} onClick={() => onOpen(run.id)}><span className={`run-dot ${run.status || ''}`} /><div className="run-main"><div className="run-title">{run.agentName || run.agentId || '智能体运行'} <span>{run.provider?.name || ''}</span></div><div className="run-meta">{run.model || '未指定模型'} · {run.steps || 0} 步 · {run.toolCalls || 0} 次工具 · {compactNumber(run.usage?.totalTokens || 0)} tokens · {run.finishedAt ? `${((Date.parse(run.finishedAt) - Date.parse(run.startedAt)) / 1000).toFixed(1)}s` : '运行中'}</div></div><span className="run-status">{statusText(run.status)}</span><span className="run-open">›</span></button>)}{!runs.length && <div className="control-empty">还没有 Agent 运行记录。</div>}</div></>;
}
