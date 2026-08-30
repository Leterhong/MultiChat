import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from '../core';
import { SafeMarkdown } from './SafeMarkdown';

export type CompareTarget = { id: string; providerId: string; providerName: string; model: string };
export type CompareResult = CompareTarget & {
  status: 'idle' | 'running' | 'success' | 'error' | 'cancelled';
  text?: string;
  elapsedMs?: number;
  usage?: Record<string, any>;
  error?: string;
};
type CompareRecord = { id: string; prompt: string; createdAt: string; projectName: string; results: CompareResult[] };
type Props = {
  targets: CompareTarget[];
  defaultTargetIds: string[];
  initialPrompt: string;
  projectName: string;
  fileCount: number;
  memoryCount: number;
  execute: (target: CompareTarget, prompt: string, signal?: AbortSignal) => Promise<CompareResult>;
  adopt: (result: CompareResult, prompt: string) => Promise<void>;
};

const HISTORY_KEY = 'multichat_compare_history_v1';

function loadHistory(): CompareRecord[] {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return value
      .filter((record) => record && typeof record.id === 'string' && typeof record.prompt === 'string' && Array.isArray(record.results))
      .map((record) => ({
        id: record.id,
        prompt: record.prompt,
        createdAt: typeof record.createdAt === 'string' ? record.createdAt : '',
        projectName: typeof record.projectName === 'string' ? record.projectName : '未选择项目',
        results: record.results.filter((result: any) => result && typeof result.model === 'string' && typeof result.providerId === 'string'),
      })).slice(0, 12);
  } catch { return []; }
}

function saveHistory(prompt: string, projectName: string, results: CompareResult[]) {
  const record: CompareRecord = { id: `experiment_${Date.now().toString(36)}`, prompt, createdAt: new Date().toISOString(), projectName, results };
  const history = [record, ...loadHistory()].slice(0, 12);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); }
  catch { toast('实验已完成，但本地历史无法保存', 'error'); }
  return history;
}

function ResultCard({ result, prompt, adopt }: { result: CompareResult; prompt: string; adopt: Props['adopt'] }) {
  const total = result.usage?.total_tokens ?? result.usage?.total ?? 0;
  const stateLabel = result.status === 'running' ? '运行中' : result.status === 'error' ? '失败' : result.status === 'cancelled' ? '已停止' : result.status === 'success' ? '完成' : '等待';
  return <article className="compare-result" data-state={result.status}>
    <header><div><strong>{result.model}</strong><span>{result.providerName}</span></div><span className="compare-state">{stateLabel}</span></header>
    <div className="compare-result-body">
      {result.status === 'running' && <div className="compare-loading" aria-label="模型正在运行"><span /><span /><span /></div>}
      {result.status === 'error' && <div className="compare-error">{result.error || '请求失败'}</div>}
      {result.status === 'cancelled' && <div className="compare-cancelled">本次模型请求已停止。</div>}
      {result.status === 'success' && <div className="compare-answer"><SafeMarkdown>{result.text || ''}</SafeMarkdown></div>}
      {result.status === 'idle' && <div className="compare-empty">等待开始</div>}
    </div>
    {result.status === 'success' && <footer><span>{((result.elapsedMs || 0) / 1000).toFixed(1)} 秒</span><span>{Number(total).toLocaleString('zh-CN')} Token</span><div>
      <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(result.text || ''); toast('结果已复制'); } catch { toast('复制失败', 'error'); } }}>复制</button>
      <button type="button" className="compare-adopt" onClick={() => void adopt(result, prompt)}>采用到对话</button>
    </div></footer>}
  </article>;
}

function CompareSummary({ results }: { results: CompareResult[] }) {
  const successful = results.filter((result) => result.status === 'success');
  if (!successful.length) return null;
  const fastest = [...successful].sort((left, right) => Number(left.elapsedMs || Infinity) - Number(right.elapsedMs || Infinity))[0];
  const metered = successful.filter((result) => Number(result.usage?.total_tokens ?? result.usage?.total ?? 0) > 0);
  const leanest = [...metered].sort((left, right) => Number(left.usage?.total_tokens ?? left.usage?.total) - Number(right.usage?.total_tokens ?? right.usage?.total))[0];
  return <section className="compare-summary" aria-label="实验摘要">
    <header><div><span>实验摘要</span><strong>只比较可验证指标</strong></div><small>{successful.length} / {results.length} 个模型完成</small></header>
    <dl>
      <div><dt>最快响应</dt><dd>{fastest.model}<small>{((fastest.elapsedMs || 0) / 1000).toFixed(1)} 秒</small></dd></div>
      <div><dt>最低消耗</dt><dd>{leanest?.model || '暂无数据'}<small>{leanest ? `${Number(leanest.usage?.total_tokens ?? leanest.usage?.total).toLocaleString('zh-CN')} Token` : '上游未返回用量'}</small></dd></div>
      <div><dt>上下文口径</dt><dd>完全一致<small>同一任务、参数和项目资料</small></dd></div>
    </dl>
  </section>;
}

export function CompareLab({ targets, defaultTargetIds, initialPrompt, projectName, fileCount, memoryCount, execute, adopt }: Props) {
  const [selectedIds, setSelectedIds] = useState(() => new Set(defaultTargetIds));
  const [prompt, setPrompt] = useState(initialPrompt);
  const [results, setResults] = useState<CompareResult[]>([]);
  const [history, setHistory] = useState(loadHistory);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const selected = useMemo(() => targets.filter((target) => selectedIds.has(target.id)), [targets, selectedIds]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const toggleTarget = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) {
      if (next.size >= 4) { toast('一次最多实验 4 个模型', 'error'); return; }
      next.add(id);
    } else next.delete(id);
    setSelectedIds(next);
  };
  const run = async () => {
    if (running) {
      abortRef.current?.abort();
      return;
    }
    const task = prompt.trim();
    if (!task) { toast('请输入实验任务', 'error'); return; }
    if (selected.length < 2) { toast('至少选择两个模型', 'error'); return; }
    setRunning(true);
    setResults(selected.map((target) => ({ ...target, status: 'running' })));
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const completed = await Promise.all(selected.map(async (target) => {
        const result = await execute(target, task, controller.signal);
        setResults((current) => current.map((item) => item.id === target.id ? result : item));
        return result;
      }));
      if (completed.some((result) => result.status === 'success')) setHistory(saveHistory(task, projectName, completed));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setRunning(false);
    }
  };

  return <div className="compare-lab">
    <div className="compare-intro"><div><p>同一任务、同一上下文，并行观察不同模型的答案。</p></div><span className="compare-context">{fileCount} 个文件 · {memoryCount} 条记忆</span></div>
    <div className="compare-config">
      <fieldset className="compare-targets"><legend>参与模型</legend>{targets.map((target) => <label key={target.id}>
        <input type="checkbox" checked={selectedIds.has(target.id)} disabled={running} onChange={(event) => toggleTarget(target.id, event.target.checked)} />
        <span><strong>{target.model}</strong><small>{target.providerName}</small></span>
      </label>)}</fieldset>
      <label className="compare-prompt-label" htmlFor="comparePrompt">实验任务</label>
      <textarea id="comparePrompt" className="compare-prompt" rows={3} placeholder="输入要交给多个模型的相同任务…" value={prompt} onChange={(event) => setPrompt(event.target.value)} />
      <div className="compare-actions"><span>已选择 {selected.length} 个模型</span><button className={`btn-primary${running ? ' is-stopping' : ''}`} type="button" disabled={!running && selected.length < 2} onClick={() => void run()}>{running ? '停止实验' : results.length ? '再次实验' : '开始实验'}</button></div>
    </div>
    <div className="compare-results">{results.map((result) => <ResultCard key={result.id} result={result} prompt={prompt.trim()} adopt={adopt} />)}</div>
    <CompareSummary results={results} />
    <details className="compare-history" open={!history.length}><summary><span>历史实验</span><small>{history.length} 条，保存在当前设备</small></summary><div>
      {history.length ? history.map((record) => {
        const date = new Date(record.createdAt);
        const stamp = Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const successCount = record.results.filter((result) => result.status === 'success').length;
        return <button type="button" className="compare-history-item" key={record.id} onClick={() => { setPrompt(record.prompt); setResults(record.results); }}><span><strong>{record.prompt}</strong><small>{record.projectName} · {successCount} 个结果</small></span><time>{stamp}</time></button>;
      }) : <div className="compare-history-empty">完成一次实验后，结果会保存在当前设备。</div>}
    </div></details>
  </div>;
}
