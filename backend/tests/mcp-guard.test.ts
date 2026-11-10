'use strict';
// MCP STDIO 启动策略单元测试：确认审计中复现的 RCE 载荷及其绕过变体都被拒绝。
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { assertSafeMcpLaunch } = require('../lib/mcp-guard');

const safe = () => ({ command: process.execPath, args: [path.join(__dirname, 'demo.js')], env: { TOKEN: 'value' } });

function rejected(mutate) {
  const launch = safe();
  mutate(launch);
  assert.throws(() => assertSafeMcpLaunch(launch), /MCP 启动配置被拒绝/);
}

test('允许内置 demo MCP 的启动形态', () => {
  assert.doesNotThrow(() => assertSafeMcpLaunch(safe()));
});

test('拒绝 node -e / --eval 内联代码执行（原 RCE 载荷）', () => {
  rejected(launch => { launch.args = ['-e', 'require("fs").writeFileSync("pwned","1")']; });
  rejected(launch => { launch.args = ['--eval=process.exit(0)']; });
  rejected(launch => { launch.args = ['demo.js', '--print', '1']; });
  rejected(launch => { launch.args = ['--import=data:text/javascript,process.exit(0)']; });
});

test('拒绝非白名单可执行文件', () => {
  rejected(launch => { launch.command = 'cmd.exe'; });
  rejected(launch => { launch.command = 'powershell'; });
  rejected(launch => { launch.command = ''; });
});

test('拒绝 NODE_OPTIONS 等可改变解释器行为的环境变量', () => {
  rejected(launch => { launch.env = { NODE_OPTIONS: '--import=data:text/javascript,evil()' }; });
  rejected(launch => { launch.env = { PATH: '/tmp/evil' }; });
  rejected(launch => { launch.env = { LD_PRELOAD: '/tmp/evil.so' }; });
});

test('拒绝 shell 元字符与 data/file scheme 参数', () => {
  rejected(launch => { launch.args = ['demo.js', '; rm -rf /']; });
  rejected(launch => { launch.args = ['data:text/javascript,evil()']; });
  rejected(launch => { launch.args = ['javascript:evil()']; });
});

test('HTTP MCP 不走 spawn，仍由 SSRF 校验负责', () => {
  assert.doesNotThrow(() => assertSafeMcpLaunch({ url: 'http://127.0.0.1:8080/mcp', args: [], env: {} }));
  assert.throws(
    () => assertSafeMcpLaunch({ url: 'http://127.0.0.1:8080/mcp', command: 'node' }),
    /MCP 启动配置被拒绝/
  );
});

test('部署方可显式扩展可执行白名单', () => {
  const previous = process.env.MULTICHAT_MCP_ALLOWED_COMMANDS;
  process.env.MULTICHAT_MCP_ALLOWED_COMMANDS = 'my-runtime';
  try {
    assert.doesNotThrow(() => assertSafeMcpLaunch({ ...safe(), command: 'my-runtime' }));
  } finally {
    if (previous === undefined) delete process.env.MULTICHAT_MCP_ALLOWED_COMMANDS;
    else process.env.MULTICHAT_MCP_ALLOWED_COMMANDS = previous;
  }
});
