const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
import type { JsonRecord, JsonStore } from '../types';

type SearchRow = {
  entityId: string;
  projectId: string;
  title: string;
  snippet: string;
  rank: number;
  source: string;
};

function createSqliteStore(rootDir: string): JsonStore {
  fs.mkdirSync(rootDir, { recursive: true });
  const databaseFile = path.join(rootDir, 'multichat.sqlite3');
  const database = new DatabaseSync(databaseFile);
  const chains = new Map<string, Promise<unknown>>();

  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS kv_store (
      name TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS store_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  let ftsEnabled = false;
  try {
    database.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS search_fts USING fts5(
      source UNINDEXED,
      entity_id UNINDEXED,
      project_id UNINDEXED,
      title,
      content,
      tokenize='trigram'
    );`);
    ftsEnabled = true;
  } catch {
    try {
      database.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS search_fts USING fts5(
        source UNINDEXED,
        entity_id UNINDEXED,
        project_id UNINDEXED,
        title,
        content
      );`);
      ftsEnabled = true;
    } catch {
      database.exec(`
        CREATE TABLE IF NOT EXISTS search_documents (
          source TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          PRIMARY KEY(source, entity_id)
        );
        CREATE INDEX IF NOT EXISTS search_documents_project ON search_documents(project_id);
      `);
    }
  }

  const selectValue = database.prepare('SELECT value FROM kv_store WHERE name = ?');
  const upsertValue = database.prepare(`
    INSERT INTO kv_store(name, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);
  const deleteValue = database.prepare('DELETE FROM kv_store WHERE name = ?');
  const migrationValue = database.prepare("SELECT value FROM store_meta WHERE key = 'json_migration_v1'");

  function validName(name: string) {
    if (typeof name !== 'string' || !name || path.basename(name) !== name) throw new Error('invalid data file name');
    return name;
  }

  function resolve(name: string) {
    return path.join(rootDir, validName(name));
  }

  function importJsonFiles() {
    if (migrationValue.get()) return;
    database.exec('BEGIN IMMEDIATE');
    try {
      const names = fs.readdirSync(rootDir).filter((name: string) => name.endsWith('.json') && path.basename(name) === name);
      for (const name of names) {
        if (selectValue.get(name)) continue;
        try {
          const parsed = JSON.parse(fs.readFileSync(path.join(rootDir, name), 'utf8'));
          upsertValue.run(name, JSON.stringify(parsed), new Date().toISOString());
        } catch {
          // Corrupt legacy files remain untouched for manual recovery.
        }
      }
      database.prepare("INSERT OR REPLACE INTO store_meta(key, value) VALUES ('json_migration_v1', ?)").run(new Date().toISOString());
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  function read<T>(name: string, fallback: T): T {
    validName(name);
    const row = selectValue.get(name) as { value?: string } | undefined;
    if (!row?.value) return fallback;
    try { return JSON.parse(row.value) as T; }
    catch { return fallback; }
  }

  function reindex(source: string, value: unknown) {
    if (!['assets.json', 'memories.json'].includes(source)) return;
    const rows = Array.isArray(value) ? value : [];
    const table = ftsEnabled ? 'search_fts' : 'search_documents';
    const removeSource = database.prepare(`DELETE FROM ${table} WHERE source = ?`);
    const insert = database.prepare(`INSERT INTO ${table}(source, entity_id, project_id, title, content) VALUES (?, ?, ?, ?, ?)`);
    database.exec('SAVEPOINT reindex_source');
    try {
      removeSource.run(source);
      for (const row of rows as JsonRecord[]) {
        if (!row?.id || !row?.content) continue;
        insert.run(source, String(row.id), String(row.projectId || ''), String(row.name || row.title || ''), String(row.content));
      }
      database.exec('RELEASE reindex_source');
    } catch (error) {
      database.exec('ROLLBACK TO reindex_source');
      database.exec('RELEASE reindex_source');
      throw error;
    }
  }

  function write(name: string, value: unknown) {
    validName(name);
    database.exec('BEGIN IMMEDIATE');
    try {
      upsertValue.run(name, JSON.stringify(value), new Date().toISOString());
      reindex(name, value);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  function remove(name: string) {
    validName(name);
    database.exec('BEGIN IMMEDIATE');
    try {
      deleteValue.run(name);
      database.prepare(`DELETE FROM ${ftsEnabled ? 'search_fts' : 'search_documents'} WHERE source = ?`).run(name);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  function mutate<T>(name: string, update: (current: T) => T | undefined | Promise<T | undefined>, fallback: T) {
    const previous = chains.get(name) || Promise.resolve();
    const run = previous
      .then(() => update(read(name, fallback)))
      .then((result) => {
        if (result !== undefined) write(name, result);
        return result;
      });
    chains.set(name, run.then(() => {}, () => {}));
    return run;
  }

  function searchDocuments(query: string, options: { projectId?: string; limit?: number } = {}): SearchRow[] {
    const text = String(query || '').trim();
    if (!text) return [];
    const projectId = String(options.projectId || '');
    const limit = Math.max(1, Math.min(100, Number(options.limit) || 12));
    const commonSelect = `SELECT source, entity_id AS entityId, project_id AS projectId, title,
      snippet(search_fts, 4, '', '', ' … ', 56) AS snippet,
      bm25(search_fts) AS rank FROM search_fts`;
    try {
      if (!ftsEnabled) throw new Error('fts5 unavailable');
      if ([...text].length >= 3) {
        const phrase = `"${text.replace(/"/g, '""')}"`;
        return database.prepare(`${commonSelect}
          WHERE search_fts MATCH ? AND (? = '' OR project_id = ?)
          ORDER BY rank LIMIT ?`).all(phrase, projectId, projectId, limit) as SearchRow[];
      }
    } catch {
      // Invalid FTS syntax and short queries use the bounded LIKE fallback.
    }
    const like = `%${text.replace(/[\\%_]/g, '\\$&')}%`;
    return database.prepare(`SELECT source, entity_id AS entityId, project_id AS projectId, title,
      substr(content, 1, 2400) AS snippet, 0 AS rank FROM ${ftsEnabled ? 'search_fts' : 'search_documents'}
      WHERE (title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\') AND (? = '' OR project_id = ?)
      LIMIT ?`).all(like, like, projectId, projectId, limit) as SearchRow[];
  }

  importJsonFiles();
  reindex('assets.json', read('assets.json', []));
  reindex('memories.json', read('memories.json', []));

  return {
    kind: 'sqlite',
    read,
    write,
    remove,
    resolve,
    mutate,
    searchDocuments,
    close: () => database.close(),
  };
}

module.exports = { createSqliteStore };
