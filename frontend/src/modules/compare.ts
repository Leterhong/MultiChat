import { type CompareResult, type CompareTarget } from '../components/CompareLab';
import { $$, serverAuthHeaders, state, toast } from '../core/index';

function compareTargets(): CompareTarget[] {
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
  renderTopbar(); renderContent(); renderConvList();
  toast(`已采用 ${result.model} 的结果`);
}

function openCompare() {
  openSettings('experiment');
}

function setupCompare() {
  $$('[data-open-compare]').forEach((item: HTMLButtonElement) => item.onclick = openCompare);
}

export { adoptResult, compareTargets, executeTarget, openCompare, setupCompare };
