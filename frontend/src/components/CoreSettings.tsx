import { FilePenLine, Plus, Search, ShieldCheck, Trash2, Upload, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';

export function GeneralSettings({ params, theme, token, onSaveParams, onTheme, onSaveToken }: any) {
  const [temperature, setTemperature] = useState(Number(params.temperature));
  const [maxTokens, setMaxTokens] = useState(Number(params.max_tokens));
  const [topP, setTopP] = useState(Number(params.top_p));
  const [serverToken, setServerToken] = useState(token);
  return <>
    <h3>偏好设置</h3><p className="lead">模型参数与外观</p>
    <section className="provider-card"><h4>模型参数</h4><div className="pmeta">应用于每次对话请求（OpenAI 兼容）</div>
      <div className="field"><label htmlFor="pTempReact">温度 Temperature：{temperature}</label><input id="pTempReact" type="range" min="0" max="2" step="0.1" value={temperature} onChange={(event) => setTemperature(Number(event.target.value))} /></div>
      <div className="field"><label htmlFor="pMaxReact">最大输出 Token</label><input id="pMaxReact" type="number" min="1" max="128000" value={maxTokens} onChange={(event) => setMaxTokens(Number(event.target.value))} /></div>
      <div className="field"><label htmlFor="pTopReact">Top P：{topP}</label><input id="pTopReact" type="range" min="0" max="1" step="0.05" value={topP} onChange={(event) => setTopP(Number(event.target.value))} /></div>
      <div className="provider-row"><button className="btn-ghost" type="button" onClick={() => { setTemperature(.7); setMaxTokens(2000); setTopP(1); }}>重置</button><button className="btn-primary compact-action" type="button" onClick={() => onSaveParams({ temperature, max_tokens: maxTokens || 2000, top_p: topP })}>保存</button></div>
    </section>
    <section className="provider-card"><h4>外观</h4><div className="field"><label htmlFor="themeReact">主题</label><select id="themeReact" value={theme} onChange={(event) => onTheme(event.target.value)}><option value="light">浅色</option><option value="dark">深色</option><option value="system">跟随系统</option></select></div></section>
    <section className="provider-card"><h4>本地服务访问保护</h4><div className="pmeta">仅在服务启用 MULTICHAT_API_TOKEN（兼容 MC_API_TOKEN）时填写；只保存在当前浏览器。</div><div className="field"><label htmlFor="serverTokenReact">访问令牌</label><input id="serverTokenReact" type="password" value={serverToken} onChange={(event) => setServerToken(event.target.value)} autoComplete="off" placeholder="未启用则留空" /></div><div className="provider-row"><button className="btn-ghost" type="button" onClick={() => { setServerToken(''); onSaveToken(''); }}>清除</button><button className="btn-primary compact-action" type="button" onClick={() => onSaveToken(serverToken.trim())}>保存令牌</button></div></section>
    <section className="provider-card"><h4>关于</h4><div className="pmeta">MultiChat · 本地优先的多模型工作台<br />模型、Skills、MCP 与插件按运行配置组合。</div></section>
  </>;
}

function ProviderCard({ provider, onSave, onDelete, onProbe }: any) {
  const models = provider.models || (provider.model ? [provider.model] : []);
  const local = ['ollama', 'lmstudio', 'mock'].includes((provider.apiType || '').toLowerCase()) || provider.id === 'mock';
  const ready = Boolean(provider.apiKeyMasked || provider.apiKey) || local;
  const [apiKey, setApiKey] = useState('');
  const [modelText, setModelText] = useState(models.join(', '));
  const [allowPrivate, setAllowPrivate] = useState(!!provider.allowPrivate);
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState('');
  const handleProbe = async () => {
    setProbing(true); setProbeResult('');
    try {
      const result = await onProbe(provider);
      const found = Array.isArray(result.models) ? result.models : [];
      if (found.length) {
        if (!modelText.trim()) {
          setModelText(found.join(', '));
          setProbeResult(`✓ 连接成功 · 发现 ${found.length} 个模型，已填入列表，记得保存`);
        } else setProbeResult(`✓ 连接成功 · 服务端返回 ${found.length} 个模型`);
      } else setProbeResult('✓ 连接成功，但服务未返回模型清单；可手动填写');
    } catch (error: any) {
      setProbeResult(`✗ ${error.message || '连接失败'}`);
    } finally { setProbing(false); }
  };
  return <article className="provider-card provider-config-card">
    <div className="provider-card-head"><span className="provider-mark" aria-hidden>{(provider.name || provider.id).trim().slice(0, 1).toUpperCase() || 'M'}</span><div className="provider-identity"><h4>{provider.name || provider.id} <span className="provider-id">{provider.id}</span></h4><div className="pmeta">{provider.apiType || 'openai'} · {models.length ? `${models.length} 个模型` : '手动输入模型'}</div></div><span className={`provider-state ${ready ? local ? 'local' : 'ready' : 'missing'}`}>{ready ? local ? '本地' : '已配置' : '待配置'}</span></div>
    <div className="provider-card-fields"><div className="field"><label htmlFor={`provider-key-r-${provider.id}`}>API 密钥</label><input id={`provider-key-r-${provider.id}`} type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={provider.apiKeyMasked ? `已安全保存 ····${provider.apiKeyPreview || ''}` : local ? '本地提供方可留空' : '输入 API 密钥'} autoComplete="new-password" /></div><div className="field"><label htmlFor={`provider-models-r-${provider.id}`}>模型列表</label><textarea id={`provider-models-r-${provider.id}`} rows={1} value={modelText} onChange={(event) => setModelText(event.target.value)} /></div></div>
    <div className="provider-card-footer"><label className="provider-private"><input type="checkbox" checked={allowPrivate} onChange={(event) => setAllowPrivate(event.target.checked)} /> 允许访问本机 / 内网</label><div className="provider-row"><button className="btn-ghost" type="button" disabled={probing} onClick={() => void handleProbe()}>{probing ? '测试中…' : '测试连接'}</button><button className="btn-ghost danger-ghost" type="button" onClick={() => void onDelete(provider)}>删除</button><button className="btn-primary" type="button" onClick={() => void onSave(provider, { ...(apiKey ? { apiKey } : {}), models: modelText.split(/[,\n]/).map((item) => item.trim()).filter(Boolean), allowPrivate })}>保存</button></div></div>
    {probeResult && <div className="provider-probe-result" role="status">{probeResult}</div>}
  </article>;
}

export function ProviderSettings({ providers: initialProviders, onSave, onDelete, onAddBuiltin, onAddCustom, onProbe }: any) {
  const [providers, setProviders] = useState(initialProviders);
  const modelCount = providers.reduce((sum: number, provider: any) => sum + (provider.models?.length || (provider.model ? 1 : 0)), 0);
  const configuredCount = providers.filter((provider: any) => Boolean(provider.apiKeyMasked || provider.apiKey) || ['ollama', 'lmstudio', 'mock'].includes((provider.apiType || '').toLowerCase())).length;
  return <section className="provider-settings"><div className="settings-page-heading"><div><h3>模型连接</h3><p className="lead">管理提供方凭证和可选模型；所有配置仅保存在本地。</p></div><div className="provider-summary" aria-label="模型配置概览"><span><strong>{providers.length}</strong> 个提供方</span><span><strong>{modelCount}</strong> 个模型</span><span><strong>{configuredCount}</strong> 个可用</span></div></div>
    <div className="provider-grid">{providers.map((provider: any) => <ProviderCard key={provider.id} provider={provider} onSave={onSave} onProbe={onProbe} onDelete={async (item: any) => { if (await onDelete(item)) setProviders((current: any[]) => current.filter((row) => row.id !== item.id)); }} />)}{!providers.length && <div className="provider-empty">还没有添加任何模型，点击下方按钮开始配置。</div>}</div>
    <div className="add-provider provider-add-grid"><button type="button" className="add-tile" onClick={onAddBuiltin}><Plus className="ico" aria-hidden /><span><strong>添加提供方</strong><small>从内置模板快速配置</small></span></button><button type="button" className="add-tile" onClick={onAddCustom}><Plus className="ico" aria-hidden /><span><strong>自定义提供方</strong><small>接入 OpenAI 兼容服务</small></span></button></div>
  </section>;
}

export function SkillSettings({ initialSkills, sourceLabel, onToggle, onEdit, onDiff, onDelete, onImport, onAdd }: any) {
  const [skills, setSkills] = useState(initialSkills);
  const [query, setQuery] = useState(''); const [source, setSource] = useState(''); const [status, setStatus] = useState('');
  const sourceKinds = useMemo(() => [...new Set(skills.map((skill: any) => skill.source?.kind || 'managed'))], [skills]);
  const visible = skills.filter((skill: any) => (!query || [skill.name, skill.id, skill.description, sourceLabel(skill.source)].filter(Boolean).join(' ').toLowerCase().includes(query.toLowerCase())) && (!source || (skill.source?.kind || 'managed') === source) && (!status || (skill.enabled ? 'enabled' : 'disabled') === status));
  return <><h3>Agent Skills</h3><p className="lead">每个 Skill 都是一个以 <code>SKILL.md</code> 为入口的目录，可附带 scripts、references 和 assets；这里的开关控制 MultiChat 是否使用它。</p>
    <div className="resource-toolbar" aria-label="筛选 Skills"><label className="resource-search"><Search size={15} aria-hidden /><input type="search" aria-label="搜索 Skills" placeholder="搜索名称、说明或 ID" value={query} onChange={(event) => setQuery(event.target.value)} /></label><select aria-label="按来源筛选" value={source} onChange={(event) => setSource(event.target.value)}><option value="">全部来源</option>{sourceKinds.map((kind: any) => <option value={kind} key={kind}>{sourceLabel({ kind })}</option>)}</select><select aria-label="按状态筛选" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">全部状态</option><option value="enabled">已启用</option><option value="disabled">已停用</option></select><span className="resource-count">{visible.length} / {skills.length} 个 Skills</span></div>
    <div className="card-grid">{visible.map((skill: any) => { const key = skill.key || skill.id; const editable = ['managed', 'repo'].includes(skill.source?.kind); return <article className="mc-card" key={key} onClick={() => editable && onEdit(skill)}><div className="mc-top"><div className="mc-ico"><FilePenLine size={19} aria-hidden /></div><div className="mc-title-wrap"><div className="mc-title">{skill.name}</div><div className="mc-sub">{skill.id}</div></div></div><div className="mc-desc">{skill.description || '（暂无描述）'}</div><div className="extension-source">{sourceLabel(skill.source)} · {skill.scope || 'project'}</div><div className="extension-command" title={skill.path || ''}>{skill.path || ''}</div><div className="mc-tags"><span className={`mc-tag${skill.enabled ? ' on' : ''}`}>SKILL.md</span><span className="mc-tag">MultiChat {skill.enabled ? '已启用' : '已停用'}</span>{(skill.resources || []).map((resource: string) => <span className="mc-tag" key={resource}>{resource}</span>)}{skill.invalid && <span className="mc-tag danger">格式无效</span>}</div><div className="skill-card-actions"><button type="button" className={`mc-toggle${skill.enabled ? ' on' : ''}`} aria-pressed={!!skill.enabled} onClick={async (event) => { event.stopPropagation(); if (await onToggle(skill)) setSkills((current: any[]) => current.map((row) => (row.key || row.id) === key ? { ...row, enabled: !row.enabled } : row)); }}><span className="mc-switch" aria-hidden /><span>{skill.enabled ? '启用中' : '已停用'}</span></button><div className="mc-actions extension-card-actions">{['repo', 'plugin'].includes(skill.source?.kind) && <button className="mc-act" type="button" title="查看 Git 变更" onClick={(event) => { event.stopPropagation(); void onDiff(skill); }}><ShieldCheck size={15} aria-hidden /></button>}{editable && <button className="mc-act" type="button" title="编辑" onClick={(event) => { event.stopPropagation(); onEdit(skill); }}><FilePenLine size={15} aria-hidden /></button>}{editable && <button className="mc-act danger" type="button" title="删除" onClick={async (event) => { event.stopPropagation(); if (await onDelete(skill)) setSkills((current: any[]) => current.filter((row) => (row.key || row.id) !== key)); }}><Trash2 size={15} aria-hidden /></button>}</div></div></article>; })}
      {!visible.length && <div className="extension-empty">没有符合筛选条件的 Skill。</div>}<button type="button" className="mc-add" onClick={onImport}><Upload size={20} aria-hidden /><span className="plus-t">上传 / 导入 Skill</span><span className="mc-sub">ZIP、SKILL.md 或完整目录</span></button><button type="button" className="mc-add" onClick={onAdd}><Plus size={20} aria-hidden /><span className="plus-t">新建 Skill</span></button></div>
  </>;
}

export function ToolSettings({ initialTools, onToggle }: any) {
  const [tools, setTools] = useState(initialTools);
  return <><h3>内置工具</h3><p className="lead">这些是 MultiChat 自身实现的函数调用能力。停用后不会暴露给模型。</p><div className="card-grid">{tools.map((tool: any) => <article className="mc-card" key={tool.id}><div className="mc-top"><div className="mc-ico"><Wrench size={19} aria-hidden /></div><div className="mc-title-wrap"><div className="mc-title">{tool.name}</div><div className="mc-sub">{tool.id} · {tool.type || 'function'}</div></div></div><div className="mc-desc">{tool.description || ''}</div><div className="mc-tags">{(tool.permissions || []).map((permission: string) => <span className="mc-tag" key={permission}>{permission}</span>)}<span className={`mc-tag${tool.enabled ? ' on' : ''}`}>{tool.enabled ? '已启用' : '已停用'}</span></div><div className="mc-actions extension-card-actions left"><button type="button" className={`mc-toggle${tool.enabled ? ' on' : ''}`} aria-pressed={!!tool.enabled} onClick={async () => { if (await onToggle(tool)) setTools((current: any[]) => current.map((row) => row.id === tool.id ? { ...row, enabled: !row.enabled } : row)); }}><span className="mc-switch" aria-hidden /><span>{tool.enabled ? '启用中' : '已停用'}</span></button></div></article>)}{!tools.length && <div className="extension-empty">没有内置工具。</div>}</div></>;
}
