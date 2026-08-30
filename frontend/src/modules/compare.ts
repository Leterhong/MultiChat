import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { CompareLab, type CompareResult, type CompareTarget } from '../components/CompareLab';
import { $, $$, serverAuthHeaders, state, toast } from '../core/index';

function targets(): CompareTarget[] {
  return (state.providers || []).flatMap((provider: any) => (provider.models || []).map((model: string) => ({
    id: `${provider.id}:${model}`,
    providerId: provider.id,
    providerName: provider.name || provider.id,
    model,
  })));
}

async function executeTarget(target: CompareTarget, prompt: string, signal?: AbortSignal): Promise<CompareResult> {
  const started = performance.now();
  try {
    const response = await fetch(state.apiBase + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...serverAuthHeaders() },
      signal,
      body: JSON.stringify({
        providerId: target.providerId,
        model: target.model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        temperature: state.params.temperature,
        max_tokens: state.params.max_tokens,
        top_p: state.params.top_p,
        workspaceId: state.selectedWorkspace?.id || null,
        projectId: state.selectedProject?.id || null,
        assetIds: [...state.selectedAssetIds],
        interactionId: `compare_${crypto.randomUUID()}`,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      const message = typeof payload?.error === 'string' ? payload.error : payload?.error?.message;
      throw new Error(message || `HTTP ${response.status}`);
    }
    return { ...target, status: 'success', text: payload?.choices?.[0]?.message?.content || '', usage: payload?.usage || {}, elapsedMs: Math.round(performance.now() - started) };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return { ...target, status: 'cancelled', elapsedMs: Math.round(performance.now() - started) };
    return { ...target, status: 'error', error: error instanceof Error ? error.message : String(error), elapsedMs: Math.round(performance.now() - started) };
  }
}

async function adoptResult(result: CompareResult, prompt: string) {
  if (!result.text) return;
  const provider = (state.providers || []).find((item: any) => item.id === result.providerId);
  if (provider) {
    state.selectedProvider = provider;
    state.selectedModel = result.model;
  }
  state.messages = [...state.messages,
    { role: 'user', content: prompt },
    { role: 'assistant', content: result.text, model: result.model, providerName: result.providerName, usage: result.usage, elapsedMs: result.elapsedMs, importedFromCompare: true },
  ];
  try { await ensureConversation(); await saveCurrentMessages(); } catch {}
  compareReturnHash = state.currentConvId ? `#/chat/${encodeURIComponent(state.currentConvId)}` : '#/new';
  renderTopbar(); renderContent(); renderConvList(); closeModal();
  window.requestAnimationFrame(() => $('#input')?.focus());
  toast(`已采用 ${result.model} 的结果`);
}

let compareReturnHash = '';
let compareRoot: Root | null = null;

function openCompare() {
  const allTargets = targets();
  if (allTargets.length < 2) {
    toast('模型实验至少需要配置两个模型', 'error');
    openSettings('providers');
    return;
  }
  if ($('#modal')?.classList.contains('open') && $('#modalCard')?.classList.contains('compare-modal-card')) return;

  // The experiment is a top-level workspace surface, not a settings sub-dialog.
  // Closing settings first prevents two aria-modal regions from being exposed at once.
  if ($('#settings')?.classList.contains('open')) closeSettings();

  if (location.hash !== '#/compare') {
    compareReturnHash = location.hash || (state.currentConvId ? `#/chat/${encodeURIComponent(state.currentConvId)}` : '#/new');
    history.pushState(null, '', '#/compare');
  } else if (!compareReturnHash) {
    compareReturnHash = state.currentConvId ? `#/chat/${encodeURIComponent(state.currentConvId)}` : '#/new';
  }

  const currentId = state.selectedProvider && state.selectedModel ? `${state.selectedProvider.id}:${state.selectedModel}` : '';
  const defaults = [currentId, ...allTargets.map((item) => item.id)].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).slice(0, 2);
  const latestPrompt = [...(state.messages || [])].reverse().find((message: any) => message.role === 'user')?.content || '';
  showModal({
    title: '模型实验',
    body: '<div id="compareReactRoot"></div>',
    onMount: (card: HTMLElement) => {
      card.classList.add('compare-modal-card');
      const host = card.querySelector<HTMLElement>('#compareReactRoot');
      if (!host) return;
      compareRoot = createRoot(host);
      compareRoot.render(createElement(CompareLab, {
        targets: allTargets,
        defaultTargetIds: defaults,
        initialPrompt: latestPrompt,
        projectName: state.selectedProject?.name || '未选择项目',
        fileCount: state.selectedAssetIds?.size || 0,
        memoryCount: (state.memories || []).filter((item: any) => item.enabled !== false).length,
        execute: executeTarget,
        adopt: adoptResult,
      }));
    },
    onClose: () => {
      compareRoot?.unmount();
      compareRoot = null;
      if (location.hash === '#/compare') history.replaceState(null, '', compareReturnHash || '#/new');
      compareReturnHash = '';
    },
  });
}

function setupCompare() {
  const button = $('#compareBtn');
  if (button) button.onclick = openCompare;
  $$('[data-open-compare]').forEach((item: HTMLButtonElement) => item.onclick = openCompare);
}

export { openCompare, setupCompare };
