'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
/**
 * Selects the local persistence backend without making SQLite a hard startup
 * dependency. The SQLite module is loaded lazily so older or restricted Node
 * runtimes can still reach the JSON recovery path.
 */
function createRuntimeStore(rootDir, options = {}) {
    const preferred = options.preferred || (process.env.MULTICHAT_STORE === 'json' ? 'json' : 'sqlite');
    const createJson = options.createJsonStore || require('./store').createJsonStore;
    if (preferred === 'json')
        return { store: createJson(rootDir), fallbackReason: null };
    try {
        const createSqlite = options.createSqliteStore || require('./sqlite-store').createSqliteStore;
        return { store: createSqlite(rootDir), fallbackReason: null };
    }
    catch (error) {
        const fallbackReason = errorMessage(error);
        const message = `[MultiChat] SQLite 初始化失败，已降级为 JSON 存储：${fallbackReason}`;
        (options.warn || console.warn)(message);
        return { store: createJson(rootDir), fallbackReason };
    }
}
module.exports = { createRuntimeStore };
//# sourceMappingURL=runtime-store.js.map