import { Box, PlugZap, Upload } from 'lucide-react';
import { ResourceActions, ResourceFacts, ResourceList, ResourceTags, type ResourceItem } from './ResourceList';

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
  const sourceKinds = [...new Set(plugins.map((plugin) => plugin.source?.kind || 'repo'))];
  const items: ResourceItem[] = plugins.map((plugin) => {
    const components = plugin.components || {};
    return {
      key: plugin.key || plugin.id,
      icon: <Box size={18} aria-hidden />,
      name: plugin.name,
      badges: [
        { label: `v${plugin.version || '0.0.0'}` },
        ...(plugin.imported ? [{ label: '已导入' }] : []),
      ],
      description: plugin.description || '',
      meta: plugin.id,
      haystack: [plugin.id, plugin.version, sourceLabel(plugin.source)].filter(Boolean).join(' '),
      sourceKind: plugin.source?.kind || 'repo',
      enabled: !!plugin.enabled,
      onToggle: () => onToggle(plugin),
      detail: (
        <>
          <ResourceFacts facts={[
            { label: '插件 ID', value: plugin.id },
            { label: '版本', value: `v${plugin.version || '0.0.0'}` },
            { label: '来源', value: sourceLabel(plugin.source) },
            { label: '路径', value: plugin.source?.path || '—', title: plugin.source?.path || '' },
          ]} />
          <ResourceTags tags={[
            { label: plugin.imported ? '已导入' : '项目内置', on: !!plugin.imported },
            { label: `${components.skills || 0} Skills` },
            { label: `${components.mcpServers || 0} MCP` },
            ...(components.agents ? [{ label: `${components.agents} Agents` }] : []),
            ...(components.commands ? [{ label: `${components.commands} Commands` }] : []),
            ...(components.hooks ? [{ label: 'Hooks' }] : []),
            { label: plugin.enabled ? 'MultiChat 已启用' : '已停用', on: !!plugin.enabled },
          ]} />
          <ResourceActions note="插件组件保留在原目录，不复制进私有 JSON">
            <button className="mc-act wide" type="button" onClick={() => void onDiff(plugin)}>查看 Diff</button>
            {plugin.removable && (
              <button className="mc-act wide danger" type="button" onClick={() => void onDelete(plugin)}>卸载</button>
            )}
          </ResourceActions>
        </>
      ),
    };
  });

  return (
    <ResourceList
      title="插件"
      lead={<>插件是完整能力包，以 <code>.codex-plugin/plugin.json</code> 为入口，可组合 Skills、MCP servers、hooks 及宿主专属组件。组件保持原目录，不复制进私有 JSON。</>}
      ariaLabel="插件"
      countNoun="个插件"
      items={items}
      emptyText="未发现插件。请在项目的 .agents/plugins/marketplace.json 中登记标准插件包。"
      headingActions={
        <button type="button" className="btn-primary compact-action" onClick={onImport}>
          <Upload size={15} aria-hidden /> 上传 / 安装插件包
        </button>
      }
      tabs={[
        { value: '', label: '全部' },
        { value: 'enabled', label: '已启用' },
        { value: 'disabled', label: '已停用' },
      ]}
      sourceOptions={sourceKinds.map((kind: any) => ({ value: kind, label: sourceLabel({ kind }) }))}
    />
  );
}

export function McpSettings({ servers, sourceLabel, onImport, onSync, onAdd, onDiscover, onEdit, onToggle, onTrust, onPrivate, onDelete }: McpSettingsProps) {
  const items: ResourceItem[] = servers.map((server) => {
    const endpoint = server.transport === 'http' ? server.url : [server.command, ...(server.args || [])].join(' ');
    const statusLabel = server.status === 'ready' ? '已连接' : server.status === 'error' ? '连接失败' : '未探测';
    return {
      key: server.id,
      icon: <PlugZap size={18} aria-hidden />,
      name: server.name,
      badges: [
        { label: server.transport === 'http' ? 'HTTP' : 'STDIO' },
        { label: statusLabel, danger: server.status === 'error' },
      ],
      description: server.description || '',
      meta: server.id,
      haystack: [server.id, endpoint, ...(server.tools || []).map((tool: any) => tool.name)].filter(Boolean).join(' '),
      sourceKind: server.transport === 'http' ? 'http' : 'stdio',
      enabled: !!server.enabled,
      onToggle: () => onToggle(server),
      detail: (
        <>
          <ResourceFacts facts={[
            { label: 'Server ID', value: server.id },
            { label: 'Transport', value: server.transport === 'http' ? 'HTTP' : 'STDIO' },
            { label: '来源', value: sourceLabel(server.source) },
            { label: '环境变量', value: server.envKeys?.length ? server.envKeys.join(', ') : '无' },
          ]} />
          <div className="extension-command resource-detail-extra" title={endpoint}>{endpoint}</div>
          <ResourceTags tags={[
            { label: `${(server.tools || []).length} tools` },
            ...(server.targets || []).map((target: string) => ({ label: target, on: true })),
            { label: server.trustLevel === 'trusted' ? '受信任' : '需审批', on: server.trustLevel === 'trusted' },
            ...(server.allowPrivate ? [{ label: '允许内网' }] : []),
          ]} />
          {!!server.tools?.length && (
            <div className="extension-tool-list resource-detail-extra">
              {server.tools.map((tool: any) => <span title={tool.description || ''} key={tool.name}>{tool.name}</span>)}
            </div>
          )}
          {server.error && <div className="auth-error resource-detail-extra" title={server.error}>{server.error}</div>}
          <ResourceActions>
            <button className="mc-act wide primary" type="button" disabled={!server.enabled} onClick={() => void onDiscover(server)}>探测 tools</button>
            <button className="mc-act wide" type="button" onClick={() => onEdit(server)}>配置</button>
            <button className="mc-act wide" type="button" onClick={() => void onTrust(server)}>{server.trustLevel === 'trusted' ? '改为需审批' : '设为受信任'}</button>
            {server.transport === 'http' && (
              <button className="mc-act wide" type="button" onClick={() => void onPrivate(server)}>{server.allowPrivate ? '阻止内网' : '允许内网'}</button>
            )}
            {server.source?.kind !== 'plugin' && (
              <button className="mc-act wide danger" type="button" onClick={() => void onDelete(server)}>删除</button>
            )}
          </ResourceActions>
        </>
      ),
    };
  });

  return (
    <ResourceList
      title="MCP servers"
      lead={<>每个 server 独立管理 transport、命令或 URL、环境变量、启用范围和实际 tools。Tools 通过实时 <code>tools/list</code> 发现。</>}
      ariaLabel="MCP servers"
      countNoun="个 server"
      items={items}
      emptyText="还没有 MCP server。"
      headingActions={
        <>
          <button className="btn-ghost compact-action" type="button" onClick={onImport}>导入 MCP JSON</button>
          <button className="btn-ghost compact-action" type="button" onClick={() => void onSync()}>同步到 Codex</button>
          <button className="btn-primary compact-action" type="button" onClick={onAdd}>添加 server</button>
        </>
      }
      tabs={[
        { value: '', label: '全部' },
        { value: 'enabled', label: '已启用' },
        { value: 'disabled', label: '已停用' },
      ]}
      sourceAriaLabel="按传输方式筛选"
      sourceDefaultLabel="全部传输方式"
      sourceOptions={[
        { value: 'stdio', label: 'STDIO' },
        { value: 'http', label: 'HTTP' },
      ]}
    />
  );
}
