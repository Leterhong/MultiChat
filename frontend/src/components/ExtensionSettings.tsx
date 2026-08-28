import { Box, PlugZap, Upload } from 'lucide-react';

type CommonProps = { sourceLabel: (source: any) => string };
type PluginSettingsProps = CommonProps & {
  plugins: any[];
  onImport: () => void;
  onToggle: (plugin: any) => Promise<void>;
  onDiff: (plugin: any) => Promise<void>;
  onDelete: (plugin: any) => Promise<void>;
};
type McpSettingsProps = CommonProps & {
  servers: any[];
  onImport: () => void;
  onSync: () => Promise<void>;
  onAdd: () => void;
  onDiscover: (server: any) => Promise<void>;
  onEdit: (server: any) => void;
  onToggle: (server: any) => Promise<void>;
  onTrust: (server: any) => Promise<void>;
  onPrivate: (server: any) => Promise<void>;
  onDelete: (server: any) => Promise<void>;
};

export function PluginSettings({ plugins, sourceLabel, onImport, onToggle, onDiff, onDelete }: PluginSettingsProps) {
  return <>
    <div className="extension-heading"><div><h3>插件</h3><p className="lead">插件是完整能力包，以 <code>.codex-plugin/plugin.json</code> 为入口，可组合 Skills、MCP servers、hooks 及宿主专属组件。组件保持原目录，不复制进私有 JSON。</p></div></div>
    <div className="card-grid">
      <button type="button" className="mc-add" onClick={onImport}><Upload size={20} aria-hidden /><span className="plus-t">上传 / 安装插件包</span><span className="mc-sub">ZIP 或完整目录 · 导入后默认停用</span></button>
      {plugins.map((plugin) => {
        const components = plugin.components || {};
        const key = plugin.key || plugin.id;
        return <article className="mc-card" key={key}>
          <div className="mc-top"><div className="mc-ico"><Box size={19} aria-hidden /></div><div className="mc-title-wrap"><div className="mc-title">{plugin.name}</div><div className="mc-sub">{plugin.id} · v{plugin.version}</div></div><span className={`mc-tag${plugin.enabled ? ' on' : ''}`}>{plugin.enabled ? 'MultiChat 已启用' : '已停用'}</span></div>
          <div className="mc-desc">{plugin.description || ''}</div>
          <div className="mc-tags"><span className={`mc-tag${plugin.imported ? ' on' : ''}`}>{plugin.imported ? '已导入' : '项目内置'}</span><span className="mc-tag">{components.skills || 0} Skills</span><span className="mc-tag">{components.mcpServers || 0} MCP</span>{components.agents ? <span className="mc-tag">{components.agents} Agents</span> : null}{components.commands ? <span className="mc-tag">{components.commands} Commands</span> : null}{components.hooks ? <span className="mc-tag">Hooks</span> : null}</div>
          <div className="extension-source"><span>{sourceLabel(plugin.source)}</span><span title={plugin.source?.path || ''}>{plugin.source?.path || ''}</span></div>
          <div className="mc-actions extension-card-actions"><button className="mc-act wide" type="button" onClick={() => void onDiff(plugin)}>查看 Diff</button>{plugin.removable && <button className="mc-act wide danger" type="button" onClick={() => void onDelete(plugin)}>卸载</button>}<button type="button" className={`mc-toggle${plugin.enabled ? ' on' : ''}`} aria-pressed={!!plugin.enabled} onClick={() => void onToggle(plugin)}><span className="mc-switch" aria-hidden /><span>{plugin.enabled ? '启用中' : '已停用'}</span></button></div>
        </article>;
      })}
      {!plugins.length && <div className="extension-empty">未发现插件。请在项目的 .agents/plugins/marketplace.json 中登记标准插件包。</div>}
    </div>
  </>;
}

export function McpSettings({ servers, sourceLabel, onImport, onSync, onAdd, onDiscover, onEdit, onToggle, onTrust, onPrivate, onDelete }: McpSettingsProps) {
  return <>
    <div className="extension-heading"><div><h3>MCP servers</h3><p className="lead">每个 server 独立管理 transport、命令或 URL、环境变量、启用范围和实际 tools。Tools 通过实时 <code>tools/list</code> 发现。</p></div><div className="extension-heading-actions"><button className="btn-ghost" type="button" onClick={onImport}>导入 MCP JSON</button><button className="btn-ghost" type="button" onClick={() => void onSync()}>同步到 Codex</button><button className="btn-primary compact-action" type="button" onClick={onAdd}>添加 server</button></div></div>
    <div className="card-grid">{servers.map((server) => {
      const endpoint = server.transport === 'http' ? server.url : [server.command, ...(server.args || [])].join(' ');
      return <article className="mc-card" key={server.id}>
        <div className="mc-top"><div className="mc-ico"><PlugZap size={19} aria-hidden /></div><div className="mc-title-wrap"><div className="mc-title">{server.name}</div><div className="mc-sub">{server.id} · {server.transport === 'http' ? 'HTTP' : 'STDIO'}</div></div><span className={`mc-tag${server.status === 'ready' ? ' on' : ''}`}>{server.status === 'ready' ? '已连接' : server.status === 'error' ? '连接失败' : '未探测'}</span></div>
        <div className="mc-desc">{server.description || ''}</div><div className="extension-command">{endpoint}</div>
        <div className="mc-tags"><span className="mc-tag">{(server.tools || []).length} tools</span>{(server.targets || []).map((target: string) => <span className="mc-tag on" key={target}>{target}</span>)}<span className="mc-tag">{server.trustLevel === 'trusted' ? '受信任' : '需审批'}</span></div>
        {!!server.tools?.length && <div className="extension-tool-list">{server.tools.map((tool: any) => <span title={tool.description || ''} key={tool.name}>{tool.name}</span>)}</div>}
        <div className="extension-source"><span>{sourceLabel(server.source)}</span><span>{server.envKeys?.length ? `env: ${server.envKeys.join(', ')}` : '无环境变量'}</span></div>
        {server.error && <div className="auth-error" title={server.error}>{server.error}</div>}
        <div className="mc-actions extension-card-actions left"><button className="mc-act wide primary" type="button" disabled={!server.enabled} onClick={() => void onDiscover(server)}>探测 tools</button><button className="mc-act wide" type="button" onClick={() => onEdit(server)}>配置</button><button className="mc-act wide" type="button" onClick={() => void onTrust(server)}>{server.trustLevel === 'trusted' ? '改为需审批' : '设为受信任'}</button>{server.transport === 'http' && <button className="mc-act wide" type="button" onClick={() => void onPrivate(server)}>{server.allowPrivate ? '阻止内网' : '允许内网'}</button>}{server.source?.kind !== 'plugin' && <button className="mc-act wide danger" type="button" onClick={() => void onDelete(server)}>删除</button>}<button type="button" className={`mc-toggle${server.enabled ? ' on' : ''}`} aria-pressed={!!server.enabled} onClick={() => void onToggle(server)}><span className="mc-switch" aria-hidden /><span>{server.enabled ? '启用中' : '已停用'}</span></button></div>
      </article>;
    })}{!servers.length && <div className="extension-empty">还没有 MCP server。</div>}</div>
  </>;
}
