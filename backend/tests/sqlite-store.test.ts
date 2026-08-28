import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { createSqliteStore } = require('../lib/sqlite-store');
const { createRuntimeStore } = require('../lib/runtime-store');

test('SQLite store migrates legacy JSON and keeps transactional state', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'multichat-sqlite-'));
  fs.writeFileSync(path.join(root, 'runs.json'), JSON.stringify([{ id: 'legacy' }]));
  const store = createSqliteStore(root);
  try {
    assert.equal(store.kind, 'sqlite');
    assert.deepEqual(store.read('runs.json', []), [{ id: 'legacy' }]);
    await Promise.all(Array.from({ length: 20 }, (_, index) => store.mutate('runs.json', (rows) => [...rows, { id: String(index) }], [])));
    assert.equal(store.read('runs.json', []).length, 21);
    assert.equal(fs.existsSync(path.join(root, 'multichat.sqlite3')), true);
  } finally {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('SQLite FTS index searches project assets without scanning JSON files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'multichat-fts-'));
  const store = createSqliteStore(root);
  try {
    store.write('assets.json', [
      { id: 'a1', projectId: 'p1', name: '架构说明', content: 'MultiChat 使用项目知识检索和本地模型。' },
      { id: 'a2', projectId: 'p2', name: '其他项目', content: '不应出现在当前项目结果。' },
    ]);
    const rows = store.searchDocuments('项目知识', { projectId: 'p1', limit: 5 });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].entityId, 'a1');
    assert.match(rows[0].snippet, /项目知识/);
  } finally {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('runtime store falls back to JSON when SQLite initialization fails', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'multichat-fallback-'));
  const warnings: string[] = [];
  try {
    const result = createRuntimeStore(root, {
      preferred: 'sqlite',
      createSqliteStore: () => { throw new Error('sqlite unavailable'); },
      warn: (message: string) => warnings.push(message),
    });
    assert.equal(result.store.kind, 'json');
    assert.equal(result.fallbackReason, 'sqlite unavailable');
    assert.match(warnings[0], /已降级为 JSON/);
    result.store.write('fallback.json', { ok: true });
    assert.deepEqual(result.store.read('fallback.json', null), { ok: true });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
