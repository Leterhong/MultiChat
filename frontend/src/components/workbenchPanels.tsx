// 命令面板 / Inspector 的 React 渲染层。刻意保留全部原有 class 与
// data-command / data-inspector-settings 属性，setupWorkbench() 的键盘导航
// 与 CSS 仍依赖这些选择器。

export type CommandItem = {
  id: string;
  label: string;
  description: string;
  group: string;
  shortcut?: string;
};

export type CommandListProps = {
  items: CommandItem[];
  onRun: (id: string) => void;
};

export function CommandList({ items, onRun }: CommandListProps) {
  if (!items.length) return <div className="command-empty">没有匹配的操作</div>;
  return (
    <>
      {items.map((item) => (
        <button
          key={item.id}
          className="command-item"
          type="button"
          data-command={item.id}
          onClick={() => onRun(item.id)}
        >
          <span className="command-item-group">{item.group}</span>
          <span className="command-item-copy">
            <strong>{item.label}</strong>
            <small>{item.description}</small>
          </span>
          {item.shortcut ? <kbd>{item.shortcut}</kbd> : <span className="command-arrow" aria-hidden="true">›</span>}
        </button>
      ))}
    </>
  );
}

export type InspectorCheck = { label: string; ok: boolean; detail: string; tab: string };

export type InspectorRun = {
  statusClass: string;
  statusLabel: string;
  name: string;
  steps: number | string;
  toolCalls: number | string;
  tokens: string;
};

export type InspectorView = {
  ready: boolean;
  readiness: number;
  selectedModel: string;
  agentName: string;
  projectName: string;
  selectedFiles: number;
  enabledMemories: number;
  skills: number;
  tools: number;
  mcp: number;
  estimatedLabel: string;
  budgetWidth: number;
  agentNote: string;
  checks: InspectorCheck[];
  latest: InspectorRun | null;
};

export type InspectorBodyProps = {
  view: InspectorView;
  onSettings: (tab: string) => void;
};

export function InspectorBody({ view, onSettings }: InspectorBodyProps) {
  return (
    <>
      <section className={`inspector-status ${view.ready ? 'ready' : 'needs-attention'}`}>
        <div className="inspector-score"><strong>{view.readiness}</strong><span>%</span></div>
        <div>
          <strong>{view.ready ? '可以开始运行' : '需要完成配置'}</strong>
          <span>{view.ready ? '必要条件已经就绪' : '补齐下面的配置项后再运行'}</span>
        </div>
      </section>

      <section className="inspector-section">
        <div className="inspector-section-head">
          <strong>会话配置</strong>
          <button type="button" data-inspector-settings="agents" onClick={() => onSettings('agents')}>编辑</button>
        </div>
        <dl className="inspector-facts">
          <div><dt>模型</dt><dd>{view.selectedModel}</dd></div>
          <div><dt>运行配置</dt><dd>{view.agentName}</dd></div>
          <div><dt>项目</dt><dd>{view.projectName}</dd></div>
        </dl>
      </section>

      <section className="inspector-section">
        <div className="inspector-section-head">
          <strong>上下文装配</strong>
          <button type="button" data-inspector-settings="workspace" onClick={() => onSettings('workspace')}>管理</button>
        </div>
        <div className="inspector-metrics">
          <div><strong>{view.selectedFiles}</strong><span>文件</span></div>
          <div><strong>{view.enabledMemories}</strong><span>记忆</span></div>
          <div><strong>{view.skills}</strong><span>Skills</span></div>
          <div><strong>{view.tools + view.mcp}</strong><span>工具</span></div>
        </div>
        <div className="context-budget">
          <div><span>文件上下文估算</span><strong>{view.estimatedLabel} Token</strong></div>
          <div className="context-budget-track"><span style={{ width: `${view.budgetWidth}%` }} /></div>
          <small>仅估算已选文件；模型系统提示和对话历史未计入。</small>
        </div>
        <p className="inspector-note">{view.agentNote}</p>
      </section>

      <section className="inspector-section">
        <div className="inspector-section-head">
          <strong>运行前检查</strong>
          <button type="button" data-inspector-settings="capabilities" onClick={() => onSettings('capabilities')}>能力清单</button>
        </div>
        <div className="inspector-checks">
          {view.checks.map((item) => (
            <button
              key={item.label}
              type="button"
              data-inspector-settings={item.tab}
              className={`inspector-check ${item.ok ? 'ok' : 'warn'}`}
              onClick={() => onSettings(item.tab)}
            >
              <span aria-hidden="true">{item.ok ? '✓' : '!'}</span>
              <div><strong>{item.label}</strong><small>{item.detail}</small></div>
            </button>
          ))}
        </div>
      </section>

      <section className="inspector-section">
        <div className="inspector-section-head">
          <strong>最近运行</strong>
          <button type="button" data-inspector-settings="runs" onClick={() => onSettings('runs')}>查看日志</button>
        </div>
        {view.latest ? (
          <div className="inspector-run">
            <div>
              <span className={`run-state ${view.latest.statusClass}`}>{view.latest.statusLabel}</span>
              <strong>{view.latest.name}</strong>
            </div>
            <dl>
              <div><dt>步骤</dt><dd>{view.latest.steps}</dd></div>
              <div><dt>工具调用</dt><dd>{view.latest.toolCalls}</dd></div>
              <div><dt>Token</dt><dd>{view.latest.tokens}</dd></div>
            </dl>
          </div>
        ) : (
          <div className="inspector-empty">完成一次运行后，这里会显示步骤、工具调用和 Token。</div>
        )}
      </section>
    </>
  );
}
