import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'node:path';

import { parseCliArgs, probeSqlite, supportsRequiredNode } from '../bin/multichat.mjs';

test('web is the default command and stays on loopback', () => {
  const parsed = parseCliArgs([], path.resolve('example-workspace'));
  assert.equal(parsed.command, 'web');
  assert.equal(parsed.commandExplicit, false);
  assert.equal(parsed.options.host, '127.0.0.1');
  assert.equal(parsed.options.port, 3000);
  assert.equal(parsed.options.open, true);
});

test('web options are parsed without mixing workspace and data paths', () => {
  const cwd = path.resolve('example-root');
  const parsed = parseCliArgs([
    'web',
    '--host', '0.0.0.0',
    '--port=43123',
    '--no-open',
    '--workspace', './workspace',
    '--data-dir=./runtime-data',
  ], cwd);
  assert.equal(parsed.command, 'web');
  assert.equal(parsed.commandExplicit, true);
  assert.equal(parsed.options.host, '0.0.0.0');
  assert.equal(parsed.options.port, 43123);
  assert.equal(parsed.options.open, false);
  assert.equal(parsed.options.workspace, path.resolve(cwd, 'workspace'));
  assert.equal(parsed.options.dataDir, path.resolve(cwd, 'runtime-data'));
});

test('init accepts one target directory', () => {
  const parsed = parseCliArgs(['init', 'checkout']);
  assert.deepEqual(parsed.positionals, ['checkout']);
});

test('invalid ports and unknown options are rejected', () => {
  assert.throws(() => parseCliArgs(['web', '--port', '0']), /1 到 65535/);
  assert.throws(() => parseCliArgs(['web', '--unknown']), /未知参数/);
});

test('Node version guard matches the unflagged node:sqlite baseline', () => {
  assert.equal(supportsRequiredNode('22.12.0'), false);
  assert.equal(supportsRequiredNode('22.13.0'), true);
  assert.equal(supportsRequiredNode('23.0.0'), true);
});

test('doctor SQLite probe opens an in-memory DatabaseSync database', () => {
  const result = probeSqlite();
  assert.equal(result.ok, true, result.detail);
  assert.match(result.detail, /DatabaseSync/);
});
