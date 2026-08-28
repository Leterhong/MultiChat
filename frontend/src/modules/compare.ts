import { $, $$, esc, state, toast } from '../core/index';

type CompareTarget = { id: string; providerId: string; providerName: string; model: string };
type CompareResult = CompareTarget & {
  status: 'idle' | 'running' | 'success' | 'error';
  text?: string;
  elapsedMs?: number;
  usage?: Record<string, any>;
  error?: string;
};
type CompareRecord = {
  id: string;
  prompt: string;
  createdAt: string;
  projectName: string;
  results: CompareResult[];
};

const HISTORY_KEY = 'multichat_compare_history_v1';

function targets(): CompareTarget[] {
  return (state.providers || []).flatMap((provider: any) => (provider.models || []).map((model: string) => ({
    id: `${provider.id}:${model}`,
    providerId: provider.id,
    providerName: provider.name || provider.id,
    model,
  })));
}

function loadHistory(): CompareRecord[] {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return value
      .filter(record => record && typeof record === 'object' && typeof record.id === 'string' && typeof record.prompt === 'string' && Array.isArray(record.results))
      .map(record => ({
        id: record.id,
        prompt: record.prompt,
        createdAt: typeof record.createdAt === 'string' ? record.createdAt : '',
        projectName: typeof record.projectName === 'string' ? record.projectName : '未选择项目',
        results: record.results.filter((result: any) => result && typeof result.model === 'string' && typeof result.providerId === 'string'),
      }))
      .slice(0, 12);
  } catch {
    return [];
  }
}

function saveHistory(prompt: string, results: CompareResult[]): CompareRecord[] {
  const record: CompareRecord = {
    id: `experiment_${Date.now().toString(36)}`,
    prompt,
    createdAt: new Date().toISOString(),
    projectName: state.selectedProject?.name || '未选择项目',
    results: results.map(result => ({ ...result })),
  };
  const history = [record, ...loadHistory()].slice(0, 12);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); }
  catch { toast('实验已完成，但本地历史无法保存', 'error'); }
  return history;
}

function resultCard(result: CompareResult, index: number) {
  const total = result.usage?.total_tokens ?? result.usage?.total ?? 0;
  const stateLabel = result.status === 'running' ? '运行中' : result.status === 'error' ? '失败' : result.status === 'success' ? '完成' : '等待';
  const body = result.status === 'running'
    ? '<div class="compare-loading"><span></span><span></span><span></span></div>'
    : result.status === 'error'
      ? `<div class="compare-error">${esc(result.error || '请求失败')}</div>`
      : result.status === 'success'
        ? `<div class="compare-answer">${renderMarkdown(result.text || '')}</div>`
        : '<div class="compare-empty">等待开始</div>';
  return `<article class="compare-result" data-compare-result="${index}" data-state="${result.status}">
    <header><div><strong>${esc(result.model)}</strong><span>${esc(result.providerName)}</span></div><span class="compare-state">${stateLabel}</span></header>
    <div class="compare-result-body">${body}</div>
    ${result.status === 'success' ? `<footer><span>${((result.elapsedMs || 0) / 1000).toFixed(1)} 秒</span><span>${Number(total).toLocaleString('zh-CN')} Token</span><div><button type="button" data-compare-copy="${index}">复制</button><button type="button" class="compare-adopt" data-compare-adopt="${index}">采用到对话</button></div></footer>` : ''}
  </article>`;
}

async function adoptResult(result: CompareResult, prompt: string) {
  if (!result.text) return;
  const provider = (state.providers || []).find((item: any) => item.id === result.providerId);
  if (provider) {
    state.selectedProvider = provider;
    state.selectedModel = result.model;
  }
  state.messages.push({ role: 'user', content: prompt });
  state.messages.push({
    role: 'assistant',
    content: result.text,
    model: result.model,
    providerName: result.providerName,
    usage: result.usage,
    elapsedMs: result.elapsedMs,
    importedFromCompare: true,
  });
  try {
    await ensureConversation();
    await saveCurrentMessages();
  } catch {}
  renderTopbar();
  renderContent();
  renderConvList();
  closeModal();
  window.requestAnimationFrame(() => {
    const content = $('#content');
    if (content) content.scrollTop = content.scrollHeight;
    $('#input')?.focus();
  });
  toast(`已采用 ${result.model} 的结果`);
}

function renderResults(results: CompareResult[], prompt: string) {
  const host = $('#compareResults');
  if (!host) return;
  host.innerHTML = results.map(resultCard).join('');
  $$('[data-compare-copy]', host).forEach((button: HTMLButtonElement) => {
    button.onclick = async () => {
      const result = results[Number(button.dataset.compareCopy)];
      try { await navigator.clipboard.writeText(result?.text || ''); toast('结果已复制'); }
      catch { toast('复制失败', 'error'); }
    };
  });
  $$('[data-compare-adopt]', host).forEach((button: HTMLButtonElement) => {
    button.onclick = () => adoptResult(results[Number(button.dataset.compareAdopt)], prompt);
  });
}

function historyMarkup(history: CompareRecord[]) {
  if (!history.length) return '<div class="compare-history-empty">完成一次实验后，结果会保存在当前设备。</div>';
  return history.map(record => {
    const date = new Date(record.createdAt);
    const stamp = Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const successCount = record.results.filter(result => result.status === 'success').length;
    return `<button type="button" class="compare-history-item" data-compare-history="${esc(record.id)}"><span><strong>${esc(record.prompt)}</strong><small>${esc(record.projectName)} · ${successCount} 个结果</small></span><time>${esc(stamp)}</time></button>`;
  }).join('');
}

function wireHistory(card: HTMLElement, history: CompareRecord[], setResults: typeof renderResults) {
  const host = card.querySelector<HTMLElement>('#compareHistoryList');
  if (!host) return;
  host.innerHTML = historyMarkup(history);
  host.querySelectorAll<HTMLButtonElement>('[data-compare-history]').forEach(button => {
    button.onclick = () => {
      const record = history.find(item => item.id === button.dataset.compareHistory);
      if (!record) return;
      const promptInput = card.querySelector<HTMLTextAreaElement>('#comparePrompt');
      if (promptInput) promptInput.value = record.prompt;
      setResults(record.results, record.prompt);
      card.querySelector<HTMLElement>('#compareResults')?.scrollIntoView({ block: 'nearest' });
    };
  });
}

async function executeTarget(target: CompareTarget, prompt: string): Promise<CompareResult> {
  const started = performance.now();
  try {
    const response = await fetch(state.apiBase + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: target.id,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        temperature: state.params.temperature,
        max_tokens: state.params.max_tokens,
        top_p: state.params.top_p,
        workspaceId: state.selectedWorkspace?.id || null,
        projectId: state.selectedProject?.id || null,
        assetIds: [...state.selectedAssetIds],
        interactionId: `compare_${Date.now().toString(36)}_${target.providerId}`,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      const message = typeof payload?.error === 'string' ? payload.error : payload?.error?.message;
      throw new Error(message || `HTTP ${response.status}`);
    }
    return {
      ...target,
      status: 'success',
      text: payload?.choices?.[0]?.message?.content || '',
      usage: payload?.usage || {},
      elapsedMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    return { ...target, status: 'error', error: error instanceof Error ? error.message : String(error), elapsedMs: Math.round(performance.now() - started) };
  }
}

function openCompare() {
  const allTargets = targets();
  if (allTargets.length < 2) {
    toast('模型实验至少需要配置两个模型', 'error');
    openSettings('providers');
    return;
  }
  const currentId = state.selectedProvider && state.selectedModel ? `${state.selectedProvider.id}:${state.selectedModel}` : '';
  const defaults = new Set([currentId, ...allTargets.map(item => item.id)].filter(Boolean).slice(0, 2));
  const latestPrompt = [...(state.messages || [])].reverse().find((message: any) => message.role === 'user')?.content || '';
  let history = loadHistory();
  showModal({
    title: '模型实验',
    body: `<div class="compare-lab">
      <div class="compare-intro"><div><p>同一任务、同一上下文，并行观察不同模型的答案。</p></div><span class="compare-context">${state.selectedAssetIds?.size || 0} 个文件 · ${(state.memories || []).filter((item: any) => item.enabled !== false).length} 条记忆</span></div>
      <div class="compare-config">
        <fieldset class="compare-targets"><legend>参与模型</legend>${allTargets.map(item => `<label><input type="checkbox" value="${esc(item.id)}" ${defaults.has(item.id) ? 'checked' : ''}/><span><strong>${esc(item.model)}</strong><small>${esc(item.providerName)}</small></span></label>`).join('')}</fieldset>
        <label class="compare-prompt-label" for="comparePrompt">实验任务</label>
        <textarea id="comparePrompt" class="compare-prompt" rows="3" placeholder="输入要交给多个模型的相同任务…">${esc(latestPrompt)}</textarea>
        <div class="compare-actions"><span id="compareSelectionHint">已选择 ${defaults.size} 个模型</span><button class="btn-primary" id="runCompare" type="button">开始实验</button></div>
      </div>
      <div class="compare-results" id="compareResults"></div>
      <details class="compare-history" ${history.length ? '' : 'open'}><summary><span>历史实验</span><small>${history.length} 条，保存在当前设备</small></summary><div id="compareHistoryList"></div></details>
    </div>`,
    onMount: (card: HTMLElement) => {
      card.classList.add('compare-modal-card');
      const checks = Array.from(card.querySelectorAll<HTMLInputElement>('.compare-targets input'));
      const hint = card.querySelector<HTMLElement>('#compareSelectionHint');
      const showResults = (results: CompareResult[], prompt: string) => renderResults(results, prompt);
      wireHistory(card, history, showResults);
      const syncSelection = (changed?: HTMLInputElement) => {
        let selected = checks.filter(item => item.checked);
        if (selected.length > 4 && changed) { changed.checked = false; selected = checks.filter(item => item.checked); toast('一次最多实验 4 个模型', 'error'); }
        if (hint) hint.textContent = `已选择 ${selected.length} 个模型`;
      };
      checks.forEach(check => check.onchange = () => syncSelection(check));
      const runButton = card.querySelector<HTMLButtonElement>('#runCompare');
      if (!runButton) return;
      runButton.onclick = async () => {
        const prompt = (card.querySelector<HTMLTextAreaElement>('#comparePrompt')?.value || '').trim();
        const selectedIds = checks.filter(item => item.checked).map(item => item.value);
        if (!prompt) { toast('请输入实验任务', 'error'); return; }
        if (selectedIds.length < 2) { toast('至少选择两个模型', 'error'); return; }
        const selected = allTargets.filter(item => selectedIds.includes(item.id));
        const results: CompareResult[] = selected.map(item => ({ ...item, status: 'running' }));
        runButton.disabled = true;
        runButton.textContent = '实验进行中…';
        renderResults(results, prompt);
        await Promise.all(selected.map(async (target, index) => {
          results[index] = await executeTarget(target, prompt);
          renderResults(results, prompt);
        }));
        history = saveHistory(prompt, results);
        wireHistory(card, history, showResults);
        runButton.disabled = false;
        runButton.textContent = '再次实验';
      };
    },
  });
}

function setupCompare() {
  const button = $('#compareBtn');
  if (button) button.onclick = openCompare;
  $$('[data-open-compare]').forEach((item: HTMLButtonElement) => item.onclick = openCompare);
}

export { openCompare, setupCompare };
