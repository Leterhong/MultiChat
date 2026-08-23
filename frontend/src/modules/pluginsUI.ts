import { $, esc, api, toast, state } from '../core/index';

const PLUGIN_ICON = {
  mcp: '<circle cx="6" cy="12" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M8.7 10.7 15.3 7.3M8.7 13.3l6.6 3.4"/>',
  bundle: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>'
};
const EXPORT_ICON = '<svg viewBox="0 0 24 24"><path d="M12 3v12M8 11l4 4 4-4M5 21h14"/></svg>';

function sourceLabel(source) {
  const labels = { repo: '项目仓库', managed: 'MultiChat 托管', user: '用户目录', plugin: '插件', builtin: '内置' };
  return labels[source?.kind] || source?.kind || '未知来源';
}

function showDiff(title, result, subject = null) {
  const status = String(result?.status || 'clean').trim() || 'clean';
  const diff = String(result?.diff || '').trim();
  const isClean = status === 'clean' && !diff;
  const isUnavailable = status === 'unavailable';
  const isExternal = status === 'external';
  const isWarning = isUnavailable || isExternal;
  const changeCount = status.split(/\r?\n/).filter(Boolean).length;
  const tone = isClean ? 'clean' : isWarning ? 'warning' : 'changed';
  const label = isClean
    ? '没有未提交变更'
    : isUnavailable
      ? '暂时无法读取变更'
      : isExternal
        ? '不在项目仓库中'
        : `检测到 ${changeCount} 项未提交变更`;
  const description = isClean
    ? '当前内容与 Git 中记录的版本一致。'
    : isUnavailable
      ? '请确认当前目录可由 Git 读取后再试。'
      : isExternal
        ? '该内容位于项目仓库之外，无法提供项目级 Git 差异。'
        : '请在启用或发布前检查下面的差异内容。';
  const context = subject?.name
    ? `<div class="diff-context"><div><span>检查对象</span><strong>${esc(subject.name)}</strong></div>${subject.meta ? `<code title="${esc(subject.meta)}">${esc(subject.meta)}</code>` : ''}</div>`
    : '';
  const details = isClean
    ? ''
    : isWarning
      ? `<div class="diff-message ${isUnavailable ? 'error' : 'warning'}">${esc(result?.error || '此目录不属于当前项目仓库。')}</div>`
      : `<div class="diff-git-status"><span>Git 状态</span><code title="${esc(status)}">${esc(status)}</code></div>
        ${diff
          ? `<pre class="extension-diff" aria-label="Git 变更内容">${esc(diff)}</pre>`
          : '<div class="diff-message">Git 已检测到状态变化，但没有可展示的文本差异。</div>'}`;
  showModal({
    title,
    body: `${context}
      <div class="diff-summary ${tone}" role="status">
        <span class="diff-summary-icon" aria-hidden="true">${isClean ? '✓' : isUnavailable ? '!' : '↗'}</span>
        <div><strong>${label}</strong><span>${description}</span></div>
      </div>
      ${details}
      <div class="row diff-actions"><button class="btn-primary" id="diffClose">关闭</button></div>`,
    onMount: card => { $('#diffClose', card).onclick = closeModal; },
  });
}

function renderPlugins() {
  const body = $('#settingsBody');
  const plugins = state.plugins || [];
  body.innerHTML = `
    <div class="extension-heading"><div><h3>插件</h3><p class="lead">插件是完整能力包，以 <code>.codex-plugin/plugin.json</code> 为入口，可组合 Skills、MCP servers、hooks 及宿主专属组件。组件保持原目录，不再复制进私有 JSON。</p></div></div>
    <div class="card-grid">
      <button type="button" class="mc-add" id="importPlugin"><span class="plus">⇧</span><span class="plus-t">上传 / 安装插件包</span><span class="mc-sub">ZIP 或完整目录 · 导入后默认停用</span></button>
      ${plugins.map(plugin => {
        const c = plugin.components || {};
        return `<div class="mc-card" data-pid="${esc(plugin.key || plugin.id)}">
          <div class="mc-top">
            <div class="mc-ico"><svg viewBox="0 0 24 24">${PLUGIN_ICON.bundle}</svg></div>
            <div style="min-width:0;flex:1;"><div class="mc-title">${esc(plugin.name)}</div><div class="mc-sub">${esc(plugin.id)} · v${esc(plugin.version)}</div></div>
            <span class="mc-tag ${plugin.enabled ? 'on' : ''}">${plugin.enabled ? 'MultiChat 已启用' : '已停用'}</span>
          </div>
          <div class="mc-desc">${esc(plugin.description || '')}</div>
          <div class="mc-tags">
            <span class="mc-tag ${plugin.imported ? 'on' : ''}">${plugin.imported ? '已导入' : '项目内置'}</span>
            <span class="mc-tag">${c.skills || 0} Skills</span><span class="mc-tag">${c.mcpServers || 0} MCP</span>
            ${(c.agents || 0) ? `<span class="mc-tag">${c.agents} Agents</span>` : ''}
            ${(c.commands || 0) ? `<span class="mc-tag">${c.commands} Commands</span>` : ''}
            ${(c.hooks || 0) ? '<span class="mc-tag">Hooks</span>' : ''}
          </div>
          <div class="extension-source"><span>${esc(sourceLabel(plugin.source))}</span><span title="${esc(plugin.source?.path || '')}">${esc(plugin.source?.path || '')}</span></div>
          <div class="mc-actions" style="opacity:1;position:static;justify-content:space-between;">
            <button class="mc-act wide" data-plugin-diff="${esc(plugin.key || plugin.id)}">查看 Diff</button>
            ${plugin.removable ? `<button class="mc-act wide danger" data-plugin-delete="${esc(plugin.key || plugin.id)}">卸载</button>` : ''}
            <button type="button" class="mc-toggle ${plugin.enabled ? 'on' : ''}" data-plugin-toggle="${esc(plugin.key || plugin.id)}" aria-pressed="${plugin.enabled ? 'true' : 'false'}"><span class="mc-switch" aria-hidden="true"></span><span>${plugin.enabled ? '启用中' : '已停用'}</span></button>
          </div>
        </div>`;
      }).join('') || '<div class="extension-empty">未发现插件。请在项目的 .agents/plugins/marketplace.json 中登记标准插件包。</div>'}
    </div>`;

  $('#importPlugin').onclick = () => showExtensionImport('plugin');
  body.querySelectorAll('[data-plugin-toggle]').forEach((element: any) => element.onclick = async () => {
    const plugin = plugins.find(item => (item.key || item.id) === element.dataset.pluginToggle);
    if (!plugin) return;
    if (!plugin.enabled && (plugin.components?.mcpServers || 0) > 0 && !confirm(`启用插件「${plugin.name}」？\n\n它包含 MCP server。后续只有被 Agent 选中时才会连接，但本地 STDIO server 仍以当前用户权限运行，请先审核插件来源和 Diff。`)) return;
    try {
      await api('/api/plugins/' + encodeURIComponent(plugin.key || plugin.id) + '/toggle', { method: 'POST', body: JSON.stringify({ enabled: !plugin.enabled }) });
      await Promise.all([loadPlugins(), loadSkills(), loadMcpServers()]);
      renderSettings('plugins', true);
      toast(plugin.enabled ? '插件已停用' : '插件已启用');
    } catch (error) { toast(error.message, 'error'); }
  });
  body.querySelectorAll('[data-plugin-diff]').forEach((element: any) => element.onclick = async () => {
    const plugin = plugins.find(item => (item.key || item.id) === element.dataset.pluginDiff);
    try {
      const result = await api('/api/plugins/' + encodeURIComponent(element.dataset.pluginDiff) + '/diff');
      const meta = plugin
        ? [plugin.id, plugin.version ? `v${plugin.version}` : ''].filter(Boolean).join(' · ')
        : '';
      showDiff('插件变更', result, { name: plugin?.name || '插件包', meta });
    }
    catch (error) { toast(error.message, 'error'); }
  });
  body.querySelectorAll('[data-plugin-delete]').forEach((element: any) => element.onclick = async () => {
    const plugin = plugins.find(item => (item.key || item.id) === element.dataset.pluginDelete);
    if (!plugin || !confirm(`卸载插件「${plugin.name}」？\n\n整包目录、项目市场条目，以及 Agent 对其 Skill / MCP 的引用都会移除。`)) return;
    try {
      await api('/api/plugins/' + encodeURIComponent(plugin.key || plugin.id), { method: 'DELETE' });
      await Promise.all([loadPlugins(), loadSkills(), loadMcpServers(), loadAgents(), loadRuntime()]);
      renderSettings('plugins', true); toast('插件已卸载');
    } catch (error) { toast(error.message, 'error'); }
  });
}

function parseJsonObject(value, label) {
  const text = String(value || '').trim();
  if (!text) return undefined;
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error(label + ' 必须是合法 JSON 对象'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(label + ' 必须是 JSON 对象');
  return parsed;
}

function showMcpModal(id = null) {
  const editing = !!id;
  const current = editing ? state.mcpServers.find(item => item.id === id) : null;
  const readOnly = current?.source?.kind === 'plugin';
  showModal({
    title: editing ? '编辑 MCP server' : '添加 MCP server',
    body: `<form id="mcpForm">
      <p class="lead" style="margin-bottom:12px;">STDIO server 会在保存后按你的操作启动本地进程；“受信任”只控制工具调用是否逐次审批，不是进程沙箱。只配置你确认可信的命令。</p>
      <div class="field"><label>Server ID</label><input name="id" value="${esc(current?.id || '')}" placeholder="context7" ${editing ? 'readonly' : ''} required /></div>
      <div class="field"><label>显示名称</label><input name="name" value="${esc(current?.name || '')}" placeholder="Context7" required /></div>
      <div class="field"><label>说明</label><input name="description" value="${esc(current?.description || '')}" /></div>
      <div class="field"><label>传输方式</label><select name="transport" id="mcpTransport"><option value="stdio" ${current?.transport !== 'http' ? 'selected' : ''}>STDIO</option><option value="http" ${current?.transport === 'http' ? 'selected' : ''}>Streamable HTTP</option></select></div>
      <div id="mcpStdioFields">
        <div class="field"><label>Command</label><input name="command" value="${esc(current?.command || '')}" placeholder="npx" /></div>
        <div class="field"><label>Args（每行一个，原样传递）</label><textarea name="args" rows="3" placeholder="-y&#10;@upstash/context7-mcp">${esc((current?.args || []).join('\n'))}</textarea></div>
        <div class="field"><label>Working directory</label><input name="cwd" value="${esc(current?.cwd || '')}" placeholder=".（相对项目根目录）" /></div>
        <div class="field"><label>Environment JSON</label><textarea name="env" rows="2" placeholder='{"TOKEN":"value"}'></textarea>${current?.envKeys?.length ? `<div class="pmeta">已保存：${esc(current.envKeys.join(', '))}；留空即保留</div>` : ''}</div>
      </div>
      <div id="mcpHttpFields">
        <div class="field"><label>URL</label><input name="url" value="${esc(current?.url || '')}" placeholder="https://example.com/mcp" /></div>
        <div class="field"><label>Bearer token 环境变量名</label><input name="bearerTokenEnvVar" value="${esc(current?.bearerTokenEnvVar || '')}" placeholder="MCP_TOKEN" /></div>
        <div class="field"><label>Headers JSON</label><textarea name="headers" rows="2" placeholder='{"X-Region":"cn"}'></textarea>${current?.headerKeys?.length ? `<div class="pmeta">已保存：${esc(current.headerKeys.join(', '))}；留空即保留</div>` : ''}</div>
      </div>
      <div class="field"><label>信任级别</label><select name="trustLevel"><option value="untrusted" ${current?.trustLevel !== 'trusted' ? 'selected' : ''}>未信任（调用前审批）</option><option value="trusted" ${current?.trustLevel === 'trusted' ? 'selected' : ''}>受信任</option></select></div>
      <div class="field"><label>启用范围</label><div class="extension-checks"><label><input type="checkbox" name="target" value="multichat" ${(current?.targets || ['multichat','codex']).includes('multichat') ? 'checked' : ''}/> MultiChat</label><label><input type="checkbox" name="target" value="codex" ${(current?.targets || ['multichat','codex']).includes('codex') ? 'checked' : ''}/> 当前项目 Codex</label></div></div>
      <div id="mcpErr" class="auth-error">${readOnly ? '此 server 来自插件，请在插件源中修改。' : ''}</div>
      <div class="row"><button type="button" class="btn-ghost" id="mcpCancel">取消</button><button class="btn-primary" type="submit" ${readOnly ? 'disabled' : ''} style="width:auto;padding:9px 18px;">保存</button></div>
    </form>`,
    onMount: card => {
      const transport: any = $('#mcpTransport', card);
      const refresh = () => {
        ($('#mcpStdioFields', card) as HTMLElement).style.display = transport.value === 'stdio' ? '' : 'none';
        ($('#mcpHttpFields', card) as HTMLElement).style.display = transport.value === 'http' ? '' : 'none';
      };
      transport.onchange = refresh; refresh();
      $('#mcpCancel', card).onclick = closeModal;
      $('#mcpForm', card).onsubmit = async event => {
        event.preventDefault();
        const form: any = event.target;
        const fd = new FormData(form);
        const payload: any = Object.fromEntries(fd.entries());
        payload.args = String(payload.args || '').split(/\r?\n/).map(item => item.trim()).filter(Boolean);
        payload.targets = Array.from(form.querySelectorAll('input[name="target"]:checked')).map((item: any) => item.value);
        try {
          const env = parseJsonObject(payload.env, 'Environment'); if (env) payload.env = env; else delete payload.env;
          const headers = parseJsonObject(payload.headers, 'Headers'); if (headers) payload.headers = headers; else delete payload.headers;
          if (payload.transport === 'stdio' && (!editing || payload.command !== current?.command || payload.args.join('\n') !== (current?.args || []).join('\n'))) {
            if (!confirm(`允许 MultiChat 启动这个本地 MCP 进程？\n\n${payload.command} ${payload.args.join(' ')}`)) return;
          }
          const endpoint = editing ? '/api/mcp-servers/' + encodeURIComponent(id) : '/api/mcp-servers';
          await api(endpoint, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(payload) });
          await loadMcpServers(); renderSettings('mcp', true); closeModal(); toast('MCP server 已保存并同步');
        } catch (error) { $('#mcpErr', card).textContent = error.message; }
      };
    },
  });
}

function renderMcpServers() {
  const body = $('#settingsBody');
  const servers = state.mcpServers || [];
  body.innerHTML = `
    <div class="extension-heading"><div><h3>MCP servers</h3><p class="lead">每个 server 独立管理 transport、command / URL、args、环境变量、启用范围和实际 tools。Tools 通过实时 <code>tools/list</code> 发现，不再伪装成 Skill。</p></div><div class="extension-heading-actions"><button class="btn-ghost" id="importMcp">导入 MCP JSON</button><button class="btn-ghost" id="syncCodexMcp">同步到 Codex</button><button class="btn-primary" id="addMcp" style="width:auto;padding:8px 16px;">添加 server</button></div></div>
    <div class="card-grid">
      ${servers.map(server => `<div class="mc-card">
        <div class="mc-top"><div class="mc-ico"><svg viewBox="0 0 24 24">${PLUGIN_ICON.mcp}</svg></div><div style="min-width:0;flex:1;"><div class="mc-title">${esc(server.name)}</div><div class="mc-sub">${esc(server.id)} · ${server.transport === 'http' ? 'HTTP' : 'STDIO'}</div></div><span class="mc-tag ${server.status === 'ready' ? 'on' : ''}">${server.status === 'ready' ? '已连接' : server.status === 'error' ? '连接失败' : '未探测'}</span></div>
        <div class="mc-desc">${esc(server.description || '')}</div>
        <div class="extension-command">${esc(server.transport === 'http' ? server.url : [server.command, ...(server.args || [])].join(' '))}</div>
        <div class="mc-tags"><span class="mc-tag">${(server.tools || []).length} tools</span>${(server.targets || []).map(target => `<span class="mc-tag on">${esc(target)}</span>`).join('')}<span class="mc-tag">${server.trustLevel === 'trusted' ? '受信任' : '需审批'}</span></div>
        ${(server.tools || []).length ? `<div class="extension-tool-list">${server.tools.map(tool => `<span title="${esc(tool.description || '')}">${esc(tool.name)}</span>`).join('')}</div>` : ''}
        <div class="extension-source"><span>${esc(sourceLabel(server.source))}</span><span>${esc((server.envKeys || []).length ? 'env: ' + server.envKeys.join(', ') : '无环境变量')}</span></div>
        ${server.error ? `<div class="auth-error" title="${esc(server.error)}">${esc(server.error)}</div>` : ''}
        <div class="mc-actions" style="opacity:1;position:static;justify-content:flex-start;align-items:center;gap:8px;flex-wrap:wrap;"><button class="mc-act wide primary" data-discover-mcp="${esc(server.id)}" ${server.enabled ? '' : 'disabled'}>探测 tools</button><button class="mc-act wide" data-edit-mcp="${esc(server.id)}">配置</button><button class="mc-act wide" data-trust-mcp="${esc(server.id)}">${server.trustLevel === 'trusted' ? '改为需审批' : '设为受信任'}</button>${server.transport === 'http' ? `<button class="mc-act wide" data-private-mcp="${esc(server.id)}">${server.allowPrivate ? '阻止内网' : '允许内网'}</button>` : ''}${server.source?.kind !== 'plugin' ? `<button class="mc-act wide danger" data-delete-mcp="${esc(server.id)}">删除</button>` : ''}<button type="button" class="mc-toggle ${server.enabled ? 'on' : ''}" data-toggle-mcp="${esc(server.id)}" aria-pressed="${server.enabled ? 'true' : 'false'}"><span class="mc-switch" aria-hidden="true"></span><span>${server.enabled ? '启用中' : '已停用'}</span></button></div>
      </div>`).join('') || '<div class="extension-empty">还没有 MCP server。</div>'}
    </div>`;
  $('#importMcp').onclick = () => showExtensionImport('mcp');
  $('#addMcp').onclick = () => showMcpModal();
  $('#syncCodexMcp').onclick = async () => {
    try { const result = await api('/api/mcp-servers/sync/codex', { method: 'POST' }); toast(`已同步 ${result.servers} 个 server 到项目 Codex 配置`); }
    catch (error) { toast(error.message, 'error'); }
  };
  body.querySelectorAll('[data-discover-mcp]').forEach((element: any) => element.onclick = async () => {
    try { const result = await api('/api/mcp-servers/' + encodeURIComponent(element.dataset.discoverMcp) + '/discover', { method: 'POST' }); await loadMcpServers(); renderSettings('mcp', true); toast(`发现 ${result.tools.length} 个 tools`); }
    catch (error) { await loadMcpServers(); renderSettings('mcp', true); toast(error.message, 'error'); }
  });
  body.querySelectorAll('[data-edit-mcp]').forEach((element: any) => element.onclick = () => showMcpModal(element.dataset.editMcp));
  body.querySelectorAll('[data-toggle-mcp]').forEach((element: any) => element.onclick = async () => {
    const server = servers.find(item => item.id === element.dataset.toggleMcp);
    if (!server) return;
    if (!server.enabled) {
      const endpoint = server.transport === 'http' ? server.url : [server.command, ...(server.args || [])].join(' ');
      if (!confirm(`启用 MCP server「${server.name}」？\n\n${endpoint}\n\nSTDIO 命令会以当前用户权限运行；HTTP server 会连接所示地址。`)) return;
    }
    try {
      await api('/api/mcp-servers/' + encodeURIComponent(server.id), { method: 'PUT', body: JSON.stringify({ enabled: !server.enabled }) });
      await loadMcpServers(); renderSettings('mcp', true); toast(server.enabled ? 'MCP server 已停用' : 'MCP server 已启用');
    } catch (error) { toast(error.message, 'error'); }
  });
  body.querySelectorAll('[data-trust-mcp]').forEach((element: any) => element.onclick = async () => {
    const server = servers.find(item => item.id === element.dataset.trustMcp);
    if (!server) return;
    try {
      const trustLevel = server.trustLevel === 'trusted' ? 'untrusted' : 'trusted';
      await api('/api/mcp-servers/' + encodeURIComponent(server.id), { method: 'PUT', body: JSON.stringify({ trustLevel }) });
      await loadMcpServers(); renderSettings('mcp', true); toast(trustLevel === 'trusted' ? '已设为受信任；工具调用将不再逐次审批' : '已恢复工具调用审批');
    } catch (error) { toast(error.message, 'error'); }
  });
  body.querySelectorAll('[data-private-mcp]').forEach((element: any) => element.onclick = async () => {
    const server = servers.find(item => item.id === element.dataset.privateMcp);
    if (!server) return;
    if (!server.allowPrivate && !confirm('允许此 HTTP MCP 访问 localhost 或内网地址？只应对你信任的服务器启用。')) return;
    try {
      await api('/api/mcp-servers/' + encodeURIComponent(server.id), { method: 'PUT', body: JSON.stringify({ allowPrivate: !server.allowPrivate }) });
      await loadMcpServers(); renderSettings('mcp', true); toast(server.allowPrivate ? '已阻止内网地址' : '已允许内网地址');
    } catch (error) { toast(error.message, 'error'); }
  });
  body.querySelectorAll('[data-delete-mcp]').forEach((element: any) => element.onclick = async () => {
    if (!confirm('删除这个 MCP server？项目 Codex 配置也会同步移除。')) return;
    try { await api('/api/mcp-servers/' + encodeURIComponent(element.dataset.deleteMcp), { method: 'DELETE' }); await loadMcpServers(); renderSettings('mcp', true); toast('已删除'); }
    catch (error) { toast(error.message, 'error'); }
  });
}

export { PLUGIN_ICON, EXPORT_ICON, sourceLabel, renderPlugins, renderMcpServers, showDiff };
