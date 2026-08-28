import { $, $$, esc, state, toast } from '../core/index';

type CompareTarget = { id: string; providerId: string; providerName: string; model: string };
type CompareResult = CompareTarget & { status: 'idle' | 'running' | 'success' | 'error'; text?: string; elapsedMs?: number; usage?: Record<string, number>; error?: string };

function targets(): CompareTarget[] {
  return (state.providers || []).flatMap((provider: any) => (provider.models || []).map((model: string) => ({
    id: `${provider.id}:${model}`,
    providerId: provider.id,
    providerName: provider.name || provider.id,
    model,
  })));
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
    <header><div><span>${esc(result.providerName)}</span><strong>${esc(result.model)}</strong></div><span class="compare-state">${stateLabel}</span></header>
    <div class="compare-result-body">${body}</div>
    ${result.status === 'success' ? `<footer><span>${((result.elapsedMs || 0) / 1000).toFixed(1)} 秒</span><span>${Number(total).toLocaleString('zh-CN')} Token</span><button type="button" data-compare-copy="${index}">复制结果</button></footer>` : ''}
  </article>`;
}

function renderResults(results: CompareResult[]) {
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
    toast('模型对比至少需要配置两个模型', 'error');
    openSettings('providers');
    return;
  }
  const currentId = state.selectedProvider && state.selectedModel ? `${state.selectedProvider.id}:${state.selectedModel}` : '';
  const defaults = new Set([currentId, ...allTargets.map(item => item.id)].filter(Boolean).slice(0, 2));
  const latestPrompt = [...(state.messages || [])].reverse().find((message: any) => message.role === 'user')?.content || '';
  showModal({
    title: '并行模型对比',
    body: `<div class="compare-lab">
      <div class="compare-intro"><div><span>MODEL LAB</span><p>让 2–4 个模型在完全相同的参数和项目上下文下并行回答。</p></div><span class="compare-context">${state.selectedAssetIds?.size || 0} 文件 · ${(state.memories || []).filter((item: any) => item.enabled !== false).length} 记忆</span></div>
      <fieldset class="compare-targets"><legend>参与模型</legend>${allTargets.map(item => `<label><input type="checkbox" value="${esc(item.id)}" ${defaults.has(item.id) ? 'checked' : ''}/><span><strong>${esc(item.model)}</strong><small>${esc(item.providerName)}</small></span></label>`).join('')}</fieldset>
      <label class="compare-prompt-label" for="comparePrompt">对比任务</label>
      <textarea id="comparePrompt" class="compare-prompt" rows="4" placeholder="输入要交给多个模型的相同任务…">${esc(latestPrompt)}</textarea>
      <div class="compare-actions"><span id="compareSelectionHint">已选择 ${defaults.size} 个模型</span><button class="btn-primary" id="runCompare" type="button">开始并行对比</button></div>
      <div class="compare-results" id="compareResults"></div>
    </div>`,
    onMount: (card: HTMLElement) => {
      card.classList.add('compare-modal-card');
      const checks = Array.from(card.querySelectorAll<HTMLInputElement>('.compare-targets input'));
      const hint = card.querySelector<HTMLElement>('#compareSelectionHint');
      const syncSelection = (changed?: HTMLInputElement) => {
        let selected = checks.filter(item => item.checked);
        if (selected.length > 4 && changed) { changed.checked = false; selected = checks.filter(item => item.checked); toast('一次最多对比 4 个模型', 'error'); }
        if (hint) hint.textContent = `已选择 ${selected.length} 个模型`;
      };
      checks.forEach(check => check.onchange = () => syncSelection(check));
      const runButton = card.querySelector<HTMLButtonElement>('#runCompare');
      if (!runButton) return;
      runButton.onclick = async () => {
        const prompt = (card.querySelector<HTMLTextAreaElement>('#comparePrompt')?.value || '').trim();
        const selectedIds = checks.filter(item => item.checked).map(item => item.value);
        if (!prompt) { toast('请输入对比任务', 'error'); return; }
        if (selectedIds.length < 2) { toast('至少选择两个模型', 'error'); return; }
        const selected = allTargets.filter(item => selectedIds.includes(item.id));
        const results: CompareResult[] = selected.map(item => ({ ...item, status: 'running' }));
        runButton.disabled = true;
        runButton.textContent = '正在对比…';
        renderResults(results);
        await Promise.all(selected.map(async (target, index) => {
          results[index] = await executeTarget(target, prompt);
          renderResults(results);
        }));
        runButton.disabled = false;
        runButton.textContent = '再次对比';
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
