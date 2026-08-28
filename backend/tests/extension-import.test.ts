'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');
import type { JsonRecord } from '../types';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'multichat-import-project-'));
const tempData = fs.mkdtempSync(path.join(os.tmpdir(), 'multichat-import-data-'));
process.env.DATA_DIR = tempData;
process.env.MULTICHAT_PROJECT_ROOT = tempRoot;
process.env.MULTICHAT_STORE = 'json';

const importer = require('../extensions/importer');
const extensions = require('../extensions/manager');
const ctx = require('../lib/context');

function zipPayload(fileName: string, files: Record<string, string | Buffer>) {
  const zip = new AdmZip();
  for (const [name, contents] of Object.entries(files)) zip.addFile(name, Buffer.from(contents));
  return { fileName, contentBase64: zip.toBuffer().toString('base64') };
}

function jsonPayload(name: string, value: unknown) {
  return { fileName: name, contentBase64: Buffer.from(JSON.stringify(value)).toString('base64') };
}

function pluginManifest(name: string, options: JsonRecord = {}) {
  return {
    name,
    version: options.version || '1.0.0',
    description: options.description || `Test plugin ${name}`,
    author: { name: 'MultiChat Tests' },
    ...(options.skills ? { skills: './skills/' } : {}),
    interface: {
      displayName: options.displayName || name,
      shortDescription: options.shortDescription || `Test plugin ${name}`,
      longDescription: options.longDescription || `A complete test plugin package for ${name}.`,
      developerName: 'MultiChat Tests',
      category: 'Developer Tools',
      capabilities: ['Write'],
      defaultPrompt: ['Use the packaged capability.'],
    },
  };
}

function pluginPayload(name: string, mcpServers: JsonRecord, files: Record<string, string | Buffer> = {}, options: JsonRecord = {}) {
  return zipPayload(`${name}.zip`, {
    [`${name}/.codex-plugin/plugin.json`]: JSON.stringify(pluginManifest(name, options)),
    [`${name}/.mcp.json`]: JSON.stringify({ mcpServers }),
    ...files,
  });
}

test.after(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
  fs.rmSync(tempData, { recursive: true, force: true });
});

test('inspects and installs a wrapped Skill directory without flattening resources', () => {
  const payload = zipPayload('release-notes.zip', {
    'release-notes/SKILL.md': '---\nname: release-notes\ndescription: Create release notes from verified changes\n---\n\n# Workflow\n\nSummarize only verified changes.\n',
    'release-notes/references/style.md': '# Style\n\nBe concise.\n',
    'release-notes/scripts/check.js': 'console.log("check")\n',
  });
  const preview = importer.inspect('skill', payload);
  assert.equal(preview.name, 'release-notes');
  assert.deepEqual(preview.resources, ['scripts', 'references']);
  assert.equal(preview.fileCount, 3);
  assert.match(preview.warnings.join('\n'), /脚本或可执行文件/);

  const installed = importer.install('skill', { ...payload, expectedFingerprint: preview.fingerprint });
  assert.equal(installed.ok, true);
  assert.equal(installed.item.enabled, false);
  assert.ok(fs.existsSync(path.join(tempRoot, '.agents', 'skills', 'release-notes', 'references', 'style.md')));
  const registered = extensions.listSkills().find(item => item.id === 'release-notes');
  assert.equal(registered.source.kind, 'repo');
  assert.equal(registered.enabled, false);
});

test('requires explicit replacement when a Skill name conflicts', () => {
  const before = extensions.listSkills().find(item => item.id === 'release-notes');
  extensions.setSkillEnabled(before.key, true);
  assert.equal(extensions.listSkills().find(item => item.key === before.key).enabled, true);
  const payload = zipPayload('release-notes.zip', {
    'SKILL.md': '---\nname: release-notes\ndescription: Updated release-note workflow\n---\n\nUse the updated workflow.\n',
  });
  const preview = importer.inspect('skill', payload);
  assert.equal(preview.conflicts.length, 1);
  assert.throws(() => importer.install('skill', { ...payload, expectedFingerprint: preview.fingerprint }), /明确选择覆盖/);
  const installed = importer.install('skill', { ...payload, expectedFingerprint: preview.fingerprint, conflictPolicy: 'replace' });
  assert.equal(installed.item.description, 'Updated release-note workflow');
  assert.equal(installed.item.enabled, false);
  assert.equal(extensions.listSkills().find(item => item.key === before.key).enabled, false);
});

test('rejects traversal and case-folded duplicate paths before writing', () => {
  assert.throws(() => importer.inspect('skill', {
    files: [
      { path: 'safe/SKILL.md', contentBase64: Buffer.from('---\nname: safe\ndescription: Safe test\n---\n\nDo work.').toString('base64') },
      { path: '../escape.txt', contentBase64: Buffer.from('no').toString('base64') },
    ],
  }), /不安全路径/);
  assert.throws(() => importer.inspect('skill', {
    files: [
      { path: 'safe/SKILL.md', contentBase64: Buffer.from('---\nname: safe\ndescription: Safe test\n---\n\nDo work.').toString('base64') },
      { path: 'safe/readme.md', contentBase64: Buffer.from('a').toString('base64') },
      { path: 'safe/README.md', contentBase64: Buffer.from('b').toString('base64') },
    ],
  }), /重复路径/);
});

test('imports an MCP JSON map atomically as disabled and untrusted', () => {
  const payload = jsonPayload('mcp.json', {
    mcpServers: {
      docs: { command: 'node', args: ['server.js'], env: { DOCS_TOKEN: '${DOCS_TOKEN}' } },
      remote: { type: 'http', url: 'https://mcp.example.test/api' },
    },
  });
  const preview = importer.inspect('mcp', payload);
  assert.equal(preview.serverCount, 2);
  const result = importer.install('mcp', { ...payload, expectedFingerprint: preview.fingerprint });
  assert.equal(result.items.length, 2);
  assert.ok(result.items.every(item => item.enabled === false && item.trustLevel === 'untrusted'));
  assert.equal(extensions.listMcpServers().find(item => item.id === 'docs').envKeys[0], 'DOCS_TOKEN');
});

test('rejects literal credentials in plugin MCP config but accepts environment references', () => {
  const cases = [
    pluginPayload('literal-env-secret', {
      secret: { command: 'node', args: ['server.js'], env: { OPENAI_API_KEY: 'sk-plaintext-test' } },
    }),
    pluginPayload('literal-header-secret', {
      secret: { type: 'http', url: 'https://mcp.example.test/api', headers: { Authorization: 'Bearer literal-secret' } },
    }),
    pluginPayload('disguised-env-secret', {
      secret: { command: 'node', args: ['server.js'], env: { SAFE_NAME: 'literal-secret-value' } },
    }),
    pluginPayload('invalid-env-reference', {
      secret: { command: 'node', args: ['server.js'], env: { SAFE_NAME: '$MCP_TOKEN' } },
    }),
  ];
  for (const payload of cases) {
    assert.throws(
      () => importer.inspect('plugin', payload),
      error => error?.code === 'INVALID_PACKAGE' && /凭据|环境变量引用/.test(error.message),
    );
  }
  assert.equal(fs.existsSync(path.join(tempRoot, '.agents', 'plugins', 'plugins', 'literal-env-secret')), false);
  assert.equal(fs.existsSync(path.join(tempRoot, '.agents', 'plugins', 'plugins', 'literal-header-secret')), false);
  assert.equal(fs.existsSync(path.join(tempRoot, '.agents', 'plugins', 'plugins', 'disguised-env-secret')), false);
  assert.equal(fs.existsSync(path.join(tempRoot, '.agents', 'plugins', 'plugins', 'invalid-env-reference')), false);

  const safe = importer.inspect('plugin', pluginPayload('referenced-secrets', {
    stdio: { command: 'node', args: ['server.js'], env: { OPENAI_API_KEY: '${OPENAI_API_KEY}', SECOND_TOKEN: '${env:SECOND_TOKEN}' } },
    remote: { type: 'http', url: 'https://mcp.example.test/api', headers: { Authorization: 'Bearer ${MCP_TOKEN}' } },
  }));
  assert.equal(safe.components.mcpServers, 2);

  process.env.MULTICHAT_IMPORT_TEST_TOKEN = 'runtime-only-secret';
  try {
    assert.deepEqual(extensions._test.expandEnvironmentMap({
      direct: '${MULTICHAT_IMPORT_TEST_TOKEN}',
      bearer: 'Bearer ${env:MULTICHAT_IMPORT_TEST_TOKEN}',
      missing: '${MULTICHAT_IMPORT_TEST_MISSING}',
      static: 'safe-static-value',
    }), {
      direct: 'runtime-only-secret',
      bearer: 'Bearer runtime-only-secret',
      static: 'safe-static-value',
    });
  } finally {
    delete process.env.MULTICHAT_IMPORT_TEST_TOKEN;
  }
});

test('installs a standard Codex plugin as a complete, disabled project package', () => {
  const manifest = {
    name: 'sample-bundle',
    version: '1.2.0',
    description: 'A complete sample capability bundle',
    author: { name: 'MultiChat Tests' },
    skills: './skills/',
    interface: {
      displayName: 'Sample bundle',
      shortDescription: 'Sample capability bundle',
      longDescription: 'A complete sample capability bundle used by the importer tests.',
      developerName: 'MultiChat Tests',
      category: 'Developer Tools',
      capabilities: ['Write'],
      defaultPrompt: ['Use the sample workflow.'],
    },
  };
  const payload = zipPayload('sample-bundle.zip', {
    'sample-bundle/.codex-plugin/plugin.json': JSON.stringify(manifest),
    'sample-bundle/.mcp.json': JSON.stringify({ mcpServers: { sample: { command: 'node', args: ['${PLUGIN_ROOT}/server.js'], env: { SAMPLE_PLUGIN_TOKEN: '${SAMPLE_PLUGIN_TOKEN}' } } } }),
    'sample-bundle/server.js': 'process.exit(0);\n',
    'sample-bundle/skills/sample/SKILL.md': '---\nname: sample\ndescription: Run the sample workflow\n---\n\nFollow the sample steps.\n',
    'sample-bundle/assets/readme.txt': 'preserved asset',
  });
  const preview = importer.inspect('plugin', payload);
  assert.equal(preview.name, 'sample-bundle');
  assert.equal(preview.components.skills, 1);
  assert.equal(preview.components.mcpServers, 1);
  const result = importer.install('plugin', { ...payload, expectedFingerprint: preview.fingerprint });
  assert.equal(result.item.enabled, false);
  assert.equal(result.item.imported, true);
  assert.equal(result.item.removable, true);
  assert.ok(fs.existsSync(path.join(tempRoot, '.agents', 'plugins', 'plugins', 'sample-bundle', 'assets', 'readme.txt')));
  const storedMcp = fs.readFileSync(path.join(tempRoot, '.agents', 'plugins', 'plugins', 'sample-bundle', '.mcp.json'), 'utf8');
  assert.match(storedMcp, /\$\{SAMPLE_PLUGIN_TOKEN\}/);
  assert.doesNotMatch(JSON.stringify(extensions.listMcpServers()), /SAMPLE_PLUGIN_TOKEN.*\$\{/);
  const marketplace = JSON.parse(fs.readFileSync(path.join(tempRoot, '.agents', 'plugins', 'marketplace.json'), 'utf8'));
  assert.equal(marketplace.plugins[0].source.path, './plugins/sample-bundle');
  const standalone = extensions.createSkill({
    id: 'sample',
    name: 'sample-standalone',
    description: 'Independent Skill with the same legacy id',
    instructions: 'Keep this independent workflow.',
  });
  const pluginSkill = extensions.listSkills().find(item => item.source?.kind === 'plugin' && item.source?.plugin === 'sample-bundle');
  const pluginMcp = extensions.listMcpServers().find(item => item.source?.kind === 'plugin' && item.source?.plugin === 'sample-bundle');
  assert.equal(pluginSkill.enabled, false);
  ctx.store.write(ctx.AGENT_FILE, [{
    id: 'same-id-agent',
    skillRefs: [standalone.key, pluginSkill.key, 'sample'],
    skillIds: ['sample'],
    mcpServerIds: [pluginMcp.id],
  }]);
  assert.equal(extensions.deleteImportedPlugin(result.item.key).ok, true);
  assert.equal(extensions.listPlugins().some(item => item.id === 'sample-bundle'), false);
  assert.equal(fs.existsSync(path.join(tempRoot, '.agents', 'plugins', 'plugins', 'sample-bundle')), false);
  const agent = ctx.store.read(ctx.AGENT_FILE, [])[0];
  assert.deepEqual(agent.skillRefs, [standalone.key, 'sample']);
  assert.deepEqual(agent.skillIds, ['sample']);
  assert.deepEqual(agent.mcpServerIds, []);
  extensions.deleteSkill(standalone.key);
  ctx.store.write(ctx.AGENT_FILE, []);
});

test('rolls back the whole plugin uninstall when a late agent write fails', () => {
  const payload = pluginPayload('rollback-bundle', {
    rollback: { command: 'node', args: ['${PLUGIN_ROOT}/server.js'] },
  }, {
    'rollback-bundle/server.js': 'process.exit(0);\n',
    'rollback-bundle/skills/rollback-skill/SKILL.md': '---\nname: rollback-skill\ndescription: Exercise uninstall rollback\n---\n\nKeep this package recoverable.\n',
  }, { skills: true });
  const preview = importer.inspect('plugin', payload);
  const installed = importer.install('plugin', { ...payload, expectedFingerprint: preview.fingerprint });
  extensions.setPluginEnabled(installed.item.key, true);
  const plugin = extensions.listPlugins().find(item => item.key === installed.item.key);
  const skill = extensions.listSkills().find(item => item.source?.kind === 'plugin' && item.source?.plugin === 'rollback-bundle');
  const mcp = extensions.listMcpServers().find(item => item.source?.kind === 'plugin' && item.source?.plugin === 'rollback-bundle');
  ctx.store.write(ctx.AGENT_FILE, [{ id: 'rollback-agent', skillRefs: [skill.key], skillIds: [skill.id], mcpServerIds: [mcp.id] }]);

  const marketplaceFile = path.join(tempRoot, '.agents', 'plugins', 'marketplace.json');
  const marketplaceBefore = JSON.parse(fs.readFileSync(marketplaceFile, 'utf8'));
  const stateBefore = ctx.store.read('extensions_state.json', {});
  const agentsBefore = ctx.store.read(ctx.AGENT_FILE, []);
  const originalWrite = ctx.store.write;
  let injectFailure = true;
  ctx.store.write = (name, value) => {
    if (name === ctx.AGENT_FILE && injectFailure) {
      injectFailure = false;
      throw new Error('injected agent write failure');
    }
    return originalWrite(name, value);
  };
  try {
    assert.throws(() => extensions.deleteImportedPlugin(plugin.key), /injected agent write failure/);
  } finally {
    ctx.store.write = originalWrite;
  }

  assert.equal(fs.existsSync(plugin.path), true);
  assert.deepEqual(JSON.parse(fs.readFileSync(marketplaceFile, 'utf8')), marketplaceBefore);
  assert.deepEqual(ctx.store.read('extensions_state.json', {}), stateBefore);
  assert.deepEqual(ctx.store.read(ctx.AGENT_FILE, []), agentsBefore);
  const restored = extensions.listPlugins().find(item => item.key === plugin.key);
  assert.equal(restored.imported, true);
  assert.equal(restored.enabled, true);
  const pluginRoot = path.dirname(plugin.path);
  assert.equal(fs.readdirSync(pluginRoot).some(name => name.startsWith('.multichat-remove-')), false);

  assert.equal(extensions.deleteImportedPlugin(plugin.key).ok, true);
  assert.equal(extensions.listPlugins().some(item => item.id === 'rollback-bundle'), false);
  ctx.store.write(ctx.AGENT_FILE, []);
});
