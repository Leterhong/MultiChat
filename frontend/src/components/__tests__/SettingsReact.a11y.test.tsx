import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { CompareLab } from '../CompareLab';
import { ProviderSettings, SkillSettings } from '../CoreSettings';
import { McpSettings, PluginSettings } from '../ExtensionSettings';

const noop = vi.fn();
const noopAsync = vi.fn(async () => {});
const sourceLabel = () => '项目仓库';

describe('React settings surfaces', () => {
  it('renders the model experiment without accessibility violations', async () => {
    const view = render(<CompareLab
      targets={[
        { id: 'one:m1', providerId: 'one', providerName: '提供方一', model: 'm1' },
        { id: 'two:m2', providerId: 'two', providerName: '提供方二', model: 'm2' },
      ]}
      defaultTargetIds={['one:m1', 'two:m2']}
      initialPrompt="比较任务"
      projectName="默认项目"
      fileCount={1}
      memoryCount={2}
      execute={async (target) => ({ ...target, status: 'success', text: '完成' })}
      adopt={noopAsync}
    />);
    expect(await axe(view.container)).toHaveNoViolations();
  });

  it('renders plugin and MCP metadata as text with accessible controls', async () => {
    const plugin = render(<PluginSettings
      plugins={[{ id: '<img src=x onerror=alert(1)>', key: 'safe', name: '测试插件', version: '1.0.0', description: '<script>bad()</script>', enabled: false, components: {}, source: { kind: 'repo', path: '.agents/plugins/safe' } }]}
      sourceLabel={sourceLabel}
      onImport={noop}
      onToggle={noopAsync}
      onDiff={noopAsync}
      onDelete={noopAsync}
    />);
    expect(plugin.container.querySelector('script')).toBeNull();
    expect(await axe(plugin.container)).toHaveNoViolations();
    plugin.unmount();

    const mcp = render(<McpSettings
      servers={[{ id: 'local-tools', name: '本地工具', transport: 'stdio', command: 'node', args: ['server.js'], enabled: false, status: 'idle', tools: [], source: { kind: 'repo' } }]}
      sourceLabel={sourceLabel}
      onImport={noop}
      onSync={noopAsync}
      onAdd={noop}
      onDiscover={noopAsync}
      onEdit={noop}
      onToggle={noopAsync}
      onTrust={noopAsync}
      onPrivate={noopAsync}
      onDelete={noopAsync}
    />);
    expect(await axe(mcp.container)).toHaveNoViolations();
  });

  it('keeps provider and Skill management accessible after the React migration', async () => {
    const providers = render(<ProviderSettings providers={[{ id: 'mock', name: '本地体验', apiType: 'openai', models: ['echo'], allowPrivate: true }]} onSave={noopAsync} onDelete={noopAsync} onAddBuiltin={noop} onAddCustom={noop} />);
    expect(await axe(providers.container)).toHaveNoViolations();
    providers.unmount();
    const skills = render(<SkillSettings initialSkills={[{ id: 'review', key: 'review', name: '代码审查', description: '检查代码风险', enabled: true, source: { kind: 'repo' }, resources: ['references'] }]} sourceLabel={sourceLabel} onToggle={noopAsync} onEdit={noop} onDiff={noopAsync} onDelete={noopAsync} onImport={noop} onAdd={noop} />);
    expect(await axe(skills.container)).toHaveNoViolations();
  });
});
