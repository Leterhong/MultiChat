import { ChevronDown, FilePenLine, Plus, Search, ShieldCheck, Trash2, Upload, Wrench } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ResourceActions, ResourceFacts, ResourceList, ResourceTags, type ResourceItem } from './ResourceList';

export function GeneralSettings({ params, theme, token, onSaveParams, onTheme, onSaveToken, skin, density, onSkin, onDensity }: any) {
  const [temperature, setTemperature] = useState(Number(params.temperature));
  const [maxTokens, setMaxTokens] = useState(Number(params.max_tokens));
  const [topP, setTopP] = useState(Number(params.top_p));
  const [serverToken, setServerToken] = useState(token);
  const [themeValue, setThemeValue] = useState(theme);
  const [skinValue, setSkinValue] = useState(skin || 'blue');
  const [densityValue, setDensityValue] = useState(density || 'comfortable');
  useEffect(() => {
    const syncTheme = (event: Event) => {
      const preference = (event as CustomEvent).detail?.preference;
      if (preference) setThemeValue(preference);
    };
    const syncAppearance = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.skin) setSkinValue(detail.skin);
      if (detail?.density) setDensityValue(detail.density);
    };
    window.addEventListener('multichat:themechange', syncTheme);
    window.addEventListener('multichat:appearancechange', syncAppearance);
    return () => {
      window.removeEventListener('multichat:themechange', syncTheme);
      window.removeEventListener('multichat:appearancechange', syncAppearance);
    };
  }, []);
  return <>
    <h3>偏好设置</h3><p className="lead">模型参数与外观</p>
    <section className="provider-card"><h4>模型参数</h4><div className="pmeta">应用于每次对话请求（OpenAI 兼容）</div>
      <div className="field"><label htmlFor="pTempReact">温度 Temperature：{temperature}</label><input id="pTempReact" type="range" min="0" max="2" step="0.1" value={temperature} onChange={(event) => setTemperature(Number(event.target.value))} /></div>
      <div className="field"><label htmlFor="pMaxReact">最大输出 Token</label><input id="pMaxReact" type="number" min="1" max="128000" value={maxTokens} onChange={(event) => setMaxTokens(Number(event.target.value))} /></div>
      <div className="field"><label htmlFor="pTopReact">Top P：{topP}</label><input id="pTopReact" type="range" min="0" max="1" step="0.05" value={topP} onChange={(event) => setTopP(Number(event.target.value))} /></div>
      <div className="provider-row"><button className="btn-ghost" type="button" onClick={() => { setTemperature(.7); setMaxTokens(2000); setTopP(1); }}>重置</button><button className="btn-primary compact-action" type="button" onClick={() => onSaveParams({ temperature, max_tokens: maxTokens || 2000, top_p: topP })}>保存</button></div>
    </section>
    <section className="provider-card"><h4>外观</h4>
      <div className="field"><label htmlFor="themeReact">主题</label><select id="themeReact" value={themeValue} onChange={(event) => { setThemeValue(event.target.value); onTheme(event.target.value); }}><option value="light">浅色</option><option value="dark">深色</option><option value="system">跟随系统</option></select></div>
      <div className="field"><label htmlFor="skinReact">强调色</label><select id="skinReact" value={skinValue} onChange={(event) => { setSkinValue(event.target.value); onSkin(event.target.value); }}><option value="blue">工作台蓝</option><option value="graphite">石墨灰</option><option value="teal">青绿</option></select></div>
      <div className="field"><label htmlFor="densityReact">界面密度</label><select id="densityReact" value={densityValue} onChange={(event) => { setDensityValue(event.target.value); onDensity(event.target.value); }}><option value="comfortable">标准</option><option value="compact">紧凑</option></select></div>
    </section>
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
    <div className="provider-card-head"><span className="provider-mark" aria-hidden>{(provider.name || provider.id).trim().slice(0, 1).toUpperCase() || 'M'}</span><div className="provider-identity"><h4>{provider.name || provider.id} <span className="provider-id">{provider.id}</span></h4><div className="pmeta">{provider.apiType || 'openai'} · {models.length ? `${models.length} 个模型` : '手动输入模型'}{(provider.capabilities?.vision || provider.capabilities?.reasoning) && <span className="provider-caps">{provider.capabilities.vision ? '视觉' : ''}{provider.capabilities.vision && provider.capabilities.reasoning ? ' · ' : ''}{provider.capabilities.reasoning ? '推理' : ''}</span>}</div></div><span className={`provider-state ${ready ? local ? 'local' : 'ready' : 'missing'}`}>{ready ? local ? '本地' : '已配置' : '待配置'}</span></div>
    <div className="provider-card-fields"><div className="field"><label htmlFor={`provider-key-r-${provider.id}`}>API 密钥</label><input id={`provider-key-r-${provider.id}`} type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={provider.apiKeyMasked ? `已安全保存 ····${provider.apiKeyPreview || ''}` : local ? '本地提供方可留空' : '输入 API 密钥'} autoComplete="new-password" /></div><div className="field"><label htmlFor={`provider-models-r-${provider.id}`}>模型列表</label><textarea id={`provider-models-r-${provider.id}`} rows={1} value={modelText} onChange={(event) => setModelText(event.target.value)} /></div></div>
    <div className="provider-card-footer"><label className="provider-private"><input type="checkbox" checked={allowPrivate} onChange={(event) => setAllowPrivate(event.target.checked)} /> 允许访问本机 / 内网</label><div className="provider-row"><button className="btn-ghost" type="button" disabled={probing} onClick={() => void handleProbe()}>{probing ? '测试中…' : '测试连接'}</button><button className="btn-ghost danger-ghost" type="button" onClick={() => void onDelete(provider)}>删除</button><button className="btn-primary" type="button" onClick={() => void onSave(provider, { ...(apiKey ? { apiKey } : {}), models: modelText.split(/[,\n]/).map((item) => item.trim()).filter(Boolean), allowPrivate })}>保存</button></div></div>
    {probeResult && <div className="provider-probe-result" role="status">{probeResult}</div>}
  </article>;
}

export function ProviderSettings({ providers: initialProviders, onSave, onDelete, onAddBuiltin, onAddCustom, onProbe }: any) {
  const [providers, setProviders] = useState(initialProviders);
  const modelCount = providers.reduce((sum: number, provider: any) => sum + (provider.models?.length || (provider.model ? 1 : 0)), 0);
  const configuredCount = providers.filter((provider: any) => Boolean(provider.apiKeyMasked || provider.apiKey) || provider.id === 'mock' || ['ollama', 'lmstudio', 'mock'].includes((provider.apiType || '').toLowerCase())).length;
  return <section className="provider-settings"><div className="settings-page-heading"><div><h3>模型连接</h3><p className="lead">管理提供方凭证和可选模型；所有配置仅保存在本地。</p></div><div className="provider-summary" aria-label="模型配置概览"><span><strong>{providers.length}</strong> 个提供方</span><span><strong>{modelCount}</strong> 个模型</span><span><strong>{configuredCount}</strong> 个可用</span></div></div>
    <div className="provider-grid">{providers.map((provider: any) => <ProviderCard key={provider.id} provider={provider} onSave={onSave} onProbe={onProbe} onDelete={async (item: any) => { if (await onDelete(item)) setProviders((current: any[]) => current.filter((row) => row.id !== item.id)); }} />)}{!providers.length && <div className="provider-empty">还没有添加任何模型，点击下方按钮开始配置。</div>}</div>
    <div className="add-provider provider-add-grid"><button type="button" className="add-tile" onClick={onAddBuiltin}><Plus className="ico" aria-hidden /><span><strong>添加提供方</strong><small>从内置模板快速配置</small></span></button><button type="button" className="add-tile" onClick={onAddCustom}><Plus className="ico" aria-hidden /><span><strong>自定义提供方</strong><small>接入 OpenAI 兼容服务</small></span></button></div>
  </section>;
}

export function SkillSettings({ initialSkills, sourceLabel, onToggle, onEdit, onDiff, onDelete, onImport, onAdd }: any) {
  const [skills, setSkills] = useState(initialSkills);
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const sourceKinds = useMemo(
    () => [...new Set(skills.map((skill: any) => skill.source?.kind || 'managed'))],
    [skills],
  );
  const visible = skills.filter((skill: any) =>
    (!query || [skill.name, skill.id, skill.description, sourceLabel(skill.source)].filter(Boolean).join(' ').toLowerCase().includes(query.toLowerCase()))
    && (!source || (skill.source?.kind || 'managed') === source)
    && (!status || (skill.enabled ? 'enabled' : 'disabled') === status));
  const tabs = [
    { value: '', label: '全部' },
    { value: 'enabled', label: '已启用' },
    { value: 'disabled', label: '已停用' },
  ];

  return (
    <section className="skill-settings">
      <div className="settings-page-heading skill-page-heading">
        <div>
          <h3>Agent Skills</h3>
          <p className="lead">每个 Skill 都是一个以 <code>SKILL.md</code> 为入口的目录，可附带 scripts、references 和 assets；这里的开关控制 MultiChat 是否使用它。</p>
        </div>
        <div className="skill-heading-actions">
          <button type="button" className="btn-primary compact-action" onClick={onImport}>
            <Upload size={15} aria-hidden /> 上传 / 导入
          </button>
          <button type="button" className="btn-ghost compact-action" onClick={onAdd}>
            <Plus size={15} aria-hidden /> 新建 Skill
          </button>
        </div>
      </div>

      <div className="skill-tabs" role="group" aria-label="按状态筛选 Skills">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.value}
            className={`skill-tab${status === tab.value ? ' active' : ''}`}
            aria-pressed={status === tab.value}
            onClick={() => setStatus(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="resource-toolbar skill-toolbar" aria-label="筛选 Skills">
        <label className="resource-search">
          <Search size={15} aria-hidden />
          <input type="search" aria-label="搜索 Skills" placeholder="搜索名称、说明或 ID" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <select aria-label="按来源筛选" value={source} onChange={(event) => setSource(event.target.value)}>
          <option value="">全部来源</option>
          {sourceKinds.map((kind: any) => <option value={kind} key={kind}>{sourceLabel({ kind })}</option>)}
        </select>
        <span className="resource-count">{visible.length} / {skills.length} 个 Skills</span>
      </div>

      <div className="skill-list">
        {visible.map((skill: any, index: number) => {
          const key = skill.key || skill.id;
          const editable = ['managed', 'repo'].includes(skill.source?.kind);
          const open = expanded === key;
          const detailId = `skill-detail-${index}`;
          return (
            <article className={`skill-row${open ? ' is-open' : ''}`} key={key}>
              <div className="skill-row-main">
                <span className="skill-row-ico" aria-hidden><FilePenLine size={18} /></span>
                <div className="skill-row-copy">
                  <div className="skill-row-title">
                    <strong>{skill.name}</strong>
                    <span className="skill-row-badge">{sourceLabel(skill.source)}</span>
                    {skill.invalid && <span className="skill-row-badge danger">格式无效</span>}
                  </div>
                  <p className="skill-row-desc">{skill.description || '（暂无描述）'}</p>
                  <span className="skill-row-id">{skill.id}</span>
                </div>
                <div className="skill-row-actions">
                  <button
                    type="button"
                    className={`mc-toggle${skill.enabled ? ' on' : ''}`}
                    aria-pressed={!!skill.enabled}
                    aria-label={`${skill.name}：${skill.enabled ? '已启用，点击停用' : '已停用，点击启用'}`}
                    onClick={async () => {
                      if (await onToggle(skill)) setSkills((current: any[]) => current.map((row) => (row.key || row.id) === key ? { ...row, enabled: !row.enabled } : row));
                    }}
                  >
                    <span className="mc-switch" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="skill-row-expand"
                    aria-expanded={open}
                    aria-controls={detailId}
                    aria-label={`${open ? '收起' : '展开'} ${skill.name} 详情`}
                    onClick={() => setExpanded(open ? null : key)}
                  >
                    <ChevronDown size={16} aria-hidden />
                  </button>
                </div>
              </div>

              <div className="skill-row-detail" id={detailId} hidden={!open}>
                <dl className="skill-facts">
                  <div><dt>Skill ID</dt><dd>{skill.id}</dd></div>
                  <div><dt>来源</dt><dd>{sourceLabel(skill.source)}</dd></div>
                  <div><dt>作用域</dt><dd>{skill.scope || 'project'}</dd></div>
                  <div><dt>路径</dt><dd title={skill.path || ''}>{skill.path || '—'}</dd></div>
                </dl>
                <div className="mc-tags skill-detail-tags">
                  <span className={`mc-tag${skill.enabled ? ' on' : ''}`}>SKILL.md</span>
                  <span className="mc-tag">MultiChat {skill.enabled ? '已启用' : '已停用'}</span>
                  {(skill.resources || []).map((resource: string) => <span className="mc-tag" key={resource}>{resource}</span>)}
                  {skill.invalid && <span className="mc-tag danger">格式无效</span>}
                </div>
                <div className="skill-detail-actions">
                  {['repo', 'plugin'].includes(skill.source?.kind) && (
                    <button className="mc-act wide" type="button" onClick={() => void onDiff(skill)}>
                      <ShieldCheck size={14} aria-hidden /> 查看 Git 变更
                    </button>
                  )}
                  {editable && (
                    <button className="mc-act wide" type="button" onClick={() => onEdit(skill)}>
                      <FilePenLine size={14} aria-hidden /> 编辑
                    </button>
                  )}
                  {editable && (
                    <button className="mc-act wide danger" type="button" onClick={async () => {
                      if (await onDelete(skill)) setSkills((current: any[]) => current.filter((row) => (row.key || row.id) !== key));
                    }}>
                      <Trash2 size={14} aria-hidden /> 删除
                    </button>
                  )}
                  {!editable && !['repo', 'plugin'].includes(skill.source?.kind) && (
                    <span className="skill-readonly-note">只读来源 · 启停可用，编辑请在原目录进行</span>
                  )}
                </div>
              </div>
            </article>
          );
        })}
        {!visible.length && <div className="extension-empty">没有符合筛选条件的 Skill。</div>}
      </div>
    </section>
  );
}

export function ToolSettings({ initialTools, onToggle, agents = [], onTest }: any) {
  const [tools, setTools] = useState(initialTools);
  const [testing, setTesting] = useState('');
  const [results, setResults] = useState<Record<string, string>>({});
  const runTest = async (tool: any, expression?: string) => {
    setTesting(tool.id);
    try {
      const result = await onTest(tool, expression);
      const value = result.ok
        ? `✓ ${tool.type === 'calculator' ? expression + ' = ' : ''}${typeof result.data === 'string' ? result.data : JSON.stringify(result.data)}（${result.elapsedMs}ms）`
        : `✗ ${result.error}`;
      setResults((current) => ({ ...current, [tool.id]: value }));
    } catch (error: any) {
      setResults((current) => ({ ...current, [tool.id]: `✗ ${error.message}` }));
    } finally { setTesting(''); }
  };
  const runTestable = async (tool: any) => {
    if (tool.type === 'calculator') {
      const expression = await showPrompt({ title: `试跑 · ${tool.name}`, label: '数学表达式', placeholder: '例如 (2 + 3) * 14 / 5', maxLength: 200 });
      if (expression == null || !expression.trim()) return;
      await runTest(tool, expression.trim());
    } else await runTest(tool);
  };
  const refCount = (tool: any) => agents.filter((agent: any) => (agent.toolIds || []).includes(tool.id)).length;
  const typeKinds = [...new Set(tools.map((tool: any) => tool.type || 'function'))];
  const items: ResourceItem[] = tools.map((tool: any) => {
    const testable = ['datetime', 'calculator'].includes(tool.type);
    const refs = refCount(tool);
    const permissions: string[] = tool.permissions || [];
    return {
      key: tool.id,
      icon: <Wrench size={18} aria-hidden />,
      name: tool.name,
      badges: [{ label: tool.type || 'function' }],
      description: tool.description || '',
      meta: tool.id,
      haystack: permissions.join(' '),
      sourceKind: tool.type || 'function',
      enabled: !!tool.enabled,
      onToggle: async () => {
        if (await onToggle(tool)) setTools((current: any[]) => current.map((row) => row.id === tool.id ? { ...row, enabled: !row.enabled } : row));
      },
      detail: (
        <>
          <ResourceFacts facts={[
            { label: '工具 ID', value: tool.id },
            { label: '类型', value: tool.type || 'function' },
            { label: '权限', value: permissions.join(', ') || '无' },
            { label: '引用', value: refs ? `${refs} 个运行配置` : '未被引用' },
          ]} />
          <ResourceTags tags={[
            ...permissions.map((label: string) => ({ label })),
            { label: tool.enabled ? '已启用' : '已停用', on: !!tool.enabled },
            { label: refs ? `${refs} 个运行配置引用` : '未被运行配置引用', on: !!refs, title: '引用该工具的运行配置数量' },
          ]} />
          {testable && (
            <ResourceActions note="试跑会真实执行该工具，不会调用模型">
              <button className="mc-act wide" type="button" disabled={testing === tool.id} onClick={() => void runTestable(tool)}>
                {testing === tool.id ? '试跑中…' : '试跑'}
              </button>
            </ResourceActions>
          )}
          {results[tool.id] && <div className="tool-test-result resource-detail-extra" role="status">{results[tool.id]}</div>}
        </>
      ),
    };
  });

  return (
    <ResourceList
      title="内置工具"
      lead="这些是 MultiChat 自身实现的函数调用能力。停用后不会暴露给模型。"
      ariaLabel="内置工具"
      countNoun="个工具"
      items={items}
      emptyText="没有内置工具。"
      searchPlaceholder="搜索名称、说明或 ID"
      tabs={[
        { value: '', label: '全部' },
        { value: 'enabled', label: '已启用' },
        { value: 'disabled', label: '已停用' },
      ]}
      sourceAriaLabel="按类型筛选"
      sourceDefaultLabel="全部类型"
      sourceOptions={typeKinds.map((kind: any) => ({ value: kind, label: kind }))}
    />
  );
}
