'use strict';

import type { JsonStore } from '../types';

type StoreFactory = (rootDir: string) => JsonStore;
type RuntimeStoreOptions = {
  preferred?: 'sqlite' | 'json';
  createJsonStore?: StoreFactory;
  createSqliteStore?: StoreFactory;
  warn?: (message: string) => void;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Selects the local persistence backend without making SQLite a hard startup
 * dependency. The SQLite module is loaded lazily so older or restricted Node
 * runtimes can still reach the JSON recovery path.
 */
function createRuntimeStore(rootDir: string, options: RuntimeStoreOptions = {}) {
  const preferred = options.preferred || (process.env.MULTICHAT_STORE === 'json' ? 'json' : 'sqlite');
  const createJson = options.createJsonStore || (require('./store').createJsonStore as StoreFactory);
  if (preferred === 'json') return { store: createJson(rootDir), fallbackReason: null };

  try {
    const createSqlite = options.createSqliteStore || (require('./sqlite-store').createSqliteStore as StoreFactory);
    return { store: createSqlite(rootDir), fallbackReason: null };
  } catch (error) {
    const fallbackReason = errorMessage(error);
    const message = `[MultiChat] SQLite 初始化失败，已降级为 JSON 存储：${fallbackReason}`;
    (options.warn || console.warn)(message);
    return { store: createJson(rootDir), fallbackReason };
  }
}

module.exports = { createRuntimeStore };
