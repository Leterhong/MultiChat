import { Activity, Bot, Boxes, Check, ChevronRight, Gauge, Layers3, LockKeyhole, SquareStack } from 'lucide-react';
import { useAppStore, useBusinessStore } from '../store/appStore';
import { fmtTok } from '../utils/format';
import { ModelGlyph } from './BrandMark';

export function WorkspaceRail() {
  const business = useBusinessStore((current) => current);
  const actions = useAppStore((current) => current.actions);
  const models = business.providers.flatMap((provider: any) => (provider.models || []).map((model: string) => ({
    id: `${provider.id}:${model}`,
    providerId: provider.id,
    providerName: provider.name || provider.id,
    model,
  })));
  const assistantMessages = business.messages.filter((message: any) => message.role === 'assistant' && !message.streaming);
  const totalTokens = assistantMessages.reduce((sum: number, message: any) => {
    const usage = message.usage || {};
    return sum + Number(usage.total_tokens ?? usage.total ?? 0);
  }, 0);
  const timedMessages = assistantMessages.filter((message: any) => Number.isFinite(message.elapsedMs));
  const averageSeconds = timedMessages.length
    ? timedMessages.reduce((sum: number, message: any) => sum + Number(message.elapsedMs), 0) / timedMessages.length / 1000
    : 0;
  const selectedFiles = business.selectedAssetIds?.size || 0;
  const enabledMemories = business.memories.filter((memory: any) => memory.enabled !== false).length;

  return <aside className="workspace-rail" aria-label="运行控制台">
    <div className="rail-workbench-head"><div><span className="status-pulse" /><strong>运行控制台</strong></div><small>设置会应用到下一次发送</small></div>
    <section className="rail-panel rail-models">
      <header className="rail-panel-head"><div><span className="rail-kicker">当前运行</span><h2>选择主模型</h2></div><button type="button" onClick={() => actions.openSettings?.('providers')}>管理</button></header>
      <div className="rail-model-list">
        {models.length ? models.slice(0, 6).map((item) => {
          const active = business.selectedProvider?.id === item.providerId && business.selectedModel === item.model;
          return <button type="button" className={`rail-model-row${active ? ' active' : ''}`} key={item.id} aria-label={`${item.model} · ${item.providerName}`} aria-pressed={active} onClick={() => actions.selectModel?.(item.providerId, item.model)}>
            <ModelGlyph name={item.providerName} className="rail-model-mark" />
            <span className="rail-model-copy"><strong>{item.model}</strong><small>{item.providerName}</small></span>
            <span className="rail-model-state" aria-hidden="true">{active && <Check size={11} strokeWidth={2.6} />}</span>
          </button>;
        }) : <button type="button" className="rail-empty-action" onClick={() => actions.openSettings?.('providers')}><Layers3 size={18} aria-hidden /><span><strong>还没有模型</strong><small>添加连接后即可开始</small></span><ChevronRight size={15} aria-hidden /></button>}
      </div>
      {models.length > 6 && <button type="button" className="rail-more" onClick={() => actions.openModelPicker?.()}>查看全部 {models.length} 个模型</button>}
      <button type="button" className="rail-compare" disabled={models.length < 2} title={models.length < 2 ? '至少添加两个模型后可用' : '用相同上下文并行比较模型'} onClick={() => actions.openCompare?.()}><SquareStack size={16} aria-hidden /><span>并行模型实验</span><small>{models.length < 2 ? '需要 2 个模型' : `已就绪 ${models.length} 个`}</small></button>
    </section>

    <section className="rail-panel">
      <header className="rail-panel-head"><div><span className="rail-kicker">组合方式</span><h2>运行配置</h2></div></header>
      <div className="rail-config-list">
        <button type="button" onClick={() => actions.openSettings?.('agents')}><Bot size={16} aria-hidden /><span><small>运行配置</small><strong>{business.selectedAgent?.name || '直接对话'}</strong></span><ChevronRight size={15} aria-hidden /></button>
        <button type="button" onClick={() => actions.openSettings?.('workspace')}><Boxes size={16} aria-hidden /><span><small>项目上下文</small><strong>{selectedFiles} 文件 · {enabledMemories} 记忆</strong></span><ChevronRight size={15} aria-hidden /></button>
        <button type="button" onClick={() => actions.openSettings?.('general')}><Gauge size={16} aria-hidden /><span><small>生成参数</small><strong>温度 {business.params.temperature} · {fmtTok(business.params.max_tokens)} Token</strong></span><ChevronRight size={15} aria-hidden /></button>
      </div>
    </section>

    <section className="rail-panel">
      <header className="rail-panel-head"><div><span className="rail-kicker">当前会话</span><h2>响应统计</h2></div><Activity size={17} aria-hidden /></header>
      <dl className="rail-stats">
        <div><dt>完成回复</dt><dd>{assistantMessages.length}</dd></div>
        <div><dt>累计 Token</dt><dd>{fmtTok(totalTokens)}</dd></div>
        <div><dt>平均耗时</dt><dd>{averageSeconds ? `${averageSeconds.toFixed(1)}s` : '—'}</dd></div>
      </dl>
    </section>

    <section className="rail-privacy"><LockKeyhole size={16} aria-hidden /><div><strong>本地优先</strong><span>配置与工作数据保存在当前设备</span></div></section>
  </aside>;
}
