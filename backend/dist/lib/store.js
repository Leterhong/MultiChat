"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('fs');
const path = require('path');
function createJsonStore(rootDir) {
    // per-file 串行化队列：防止多个并发请求对同一 JSON 做 read-modify-write 时互相覆盖
    const chains = new Map();
    function resolve(name) {
        if (typeof name !== 'string' || !name || path.basename(name) !== name) {
            throw new Error('invalid data file name');
        }
        return path.join(rootDir, name);
    }
    function read(name, fallback) {
        const file = resolve(name);
        if (!fs.existsSync(file))
            return fallback;
        try {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        }
        catch {
            // A partially written/corrupted JSON file should not silently erase the
            // user's view of their data. Every successful write keeps one local
            // recovery copy, so prefer that before falling back to an empty value.
            const backup = `${file}.bak`;
            try {
                if (fs.existsSync(backup))
                    return JSON.parse(fs.readFileSync(backup, 'utf8'));
            }
            catch { }
            return fallback;
        }
    }
    function write(name, value) {
        const file = resolve(name);
        fs.mkdirSync(rootDir, { recursive: true });
        const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
        fs.writeFileSync(temp, JSON.stringify(value, null, 2), 'utf8');
        // Keep one known-good recovery point. On Windows rename-over-existing can
        // fail with EPERM, so use a guarded replacement fallback while retaining
        // the backup. The temporary file is always cleaned up.
        try {
            if (fs.existsSync(file))
                fs.copyFileSync(file, `${file}.bak`);
            try {
                fs.renameSync(temp, file);
            }
            catch (error) {
                if (!['EEXIST', 'EPERM'].includes(error?.code))
                    throw error;
                fs.rmSync(file, { force: true });
                fs.renameSync(temp, file);
            }
        }
        finally {
            if (fs.existsSync(temp))
                fs.rmSync(temp, { force: true });
        }
    }
    function remove(name) {
        const file = resolve(name);
        if (fs.existsSync(file))
            fs.unlinkSync(file);
    }
    // 串行化 read-modify-write：fn(currentValue) => newValue（或 undefined 表示不写回）。
    // 同一 name 的多次 mutate 会严格按调用顺序排队执行，杜绝并发覆盖。
    function mutate(name, fn, fallback) {
        const prev = chains.get(name) || Promise.resolve();
        const run = prev
            .then(() => fn(read(name, fallback)))
            .then((result) => {
            if (result === undefined)
                return result;
            write(name, result);
            return result;
        });
        // 存入"已处理 rejection"的链，避免后续排队因前序失败而中断，也避免 unhandled rejection
        chains.set(name, run.then(() => { }, () => { }));
        return run;
    }
    return { kind: 'json', read, write, remove, resolve, mutate };
}
module.exports = { createJsonStore };
//# sourceMappingURL=store.js.map