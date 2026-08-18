import { $, $$, esc, api, toast, state, DEFAULT_PARAMS, loadSelectedAgent, saveSelectedAgent, saveParams } from '../core/index.js';

/* --------------------------- Plugins UI --------------------------- */
const PLUGIN_ICON = {
  mcp: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12l8.73-5.04M12 22V12"/>',
  bundle: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>'
};
const EXPORT_ICON = '<svg viewBox="0 0 24 24"><path d="M12 3v12M8 11l4 4 4-4M5 21h14"/></svg>';
function renderPlugins() {
  const body = $('#settingsBody');
  const plugins = state.plugins || [];
  body.innerHTML = `
    <h3>插件 / 扩展</h3>
    <p class="lead">插件是打包好的能力合集，可一键安装 / 卸载、启用 / 停用。两类：<b>本地合集</b>（内置技能 + 智能体）与 <b>MCP 连接器</b>（通过标准 MCP 协议接入外部工具，如读取本地文件、调用 API）。安装后其技能会出现在「技能」页、智能体出现在「智能体」页，并能被其它智能体引用。</p>
    <div class="card-grid">
      ${plugins.map(p => `
        <div class="mc-card" data-pid="${esc(p.id)}">
          <div class="mc-top">
            <div class="mc-ico"><svg viewBox="0 0 24 24">${PLUGIN_ICON[p.type] || PLUGIN_ICON.bundle}</svg></div>
            <div style="min-width:0;flex:1;">
              <div class="mc-title">${esc(p.name)}</div>
              <div class="mc-sub">v${esc(p.version || '1.0.0')} · ${esc(p.author || '')}</div>
            </div>
            <span class="mc-tag ${p.type === 'mcp' ? 'mcp' : 'bundle'}">${p.type === 'mcp' ? 'MCP 连接器' : '本地合集'}</span>
          </div>
          <div class="mc-desc">${esc(p.description || '')}</div>
          <div class="mc-tags">
            <span class="mc-tag">${p.skillCount} 技能</span>
            <span class="mc-tag">${p.agentCount} 智能体</span>
            ${p.installed ? '<span class="mc-tag on">已安装</span>' : ''}
          </div>
          <div class="mc-actions" style="opacity:1;position:static;justify-content:flex-start;gap:10px;">
            ${p.installed
              ? `<button class="mc-act wide" data-uninstall="${esc(p.id)}">卸载</button>
                 <span class="mc-toggle ${p.enabled ? 'on' : ''}" data-plug-toggle="${esc(p.id)}"><span class="mc-switch"></span><span>${p.enabled ? '已启用' : '已停用'}</span></span>`
              : `<button class="mc-act wide primary" data-install="${esc(p.id)}">安装</button>`}
          </div>
        </div>`).join('') || '<div style="color:var(--label-caption);font-size:13px;padding:8px 0;">暂无可用插件。把插件的 manifest.json 放到后端 backend/plugins/&lt;目录&gt;/ 即可在此出现。</div>'}
    </div>
  `;
  body.querySelectorAll('[data-install]').forEach(b => b.onclick = async () => {
    const id = b.dataset.install;
    try {
      const r = await api('/api/plugins/' + id + '/install', { method: 'POST' });
      await loadPlugins(); await loadSkills(); await loadAgents(); renderSettings('plugins', true); renderTopbar();
      toast('已安装：' + id + (r.agents ? `（+${r.skills} 技能 / +${r.agents} 智能体）` : ''));
    } catch (e) { toast(e.message, 'error'); }
  });
  body.querySelectorAll('[data-uninstall]').forEach(b => b.onclick = async () => {
    const id = b.dataset.uninstall;
    if (!confirm('卸载该插件？其技能与智能体将从本地移除（不影响你自己新建的）。')) return;
    try {
      await api('/api/plugins/' + id + '/uninstall', { method: 'POST' });
      await loadPlugins(); await loadSkills(); await loadAgents(); renderSettings('plugins', true); renderTopbar();
      toast('已卸载：' + id);
    } catch (e) { toast(e.message, 'error'); }
  });
  body.querySelectorAll('[data-plug-toggle]').forEach(b => b.onclick = async (e) => {
    e.stopPropagation();
    const id = b.dataset.plugToggle;
    const pl = (state.plugins || []).find(x => x.id === id);
    const next = !(pl && pl.enabled);
    try {
      await api('/api/plugins/' + id + '/toggle', { method: 'POST', body: JSON.stringify({ enabled: next }) });
      await loadPlugins(); await loadSkills(); renderSettings('plugins', true);
      toast(next ? '已启用' : '已停用');
    } catch (e) { toast(e.message, 'error'); }
  });
}

export { PLUGIN_ICON,EXPORT_ICON,renderPlugins };
