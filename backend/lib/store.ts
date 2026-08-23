const fs = require('fs');
const path = require('path');
import type { JsonStore } from '../types';

function createJsonStore(rootDir: string): JsonStore {
  // per-file 串行化队列：防止多个并发请求对同一 JSON 做 read-modify-write 时互相覆盖
  const chains = new Map<string, Promise<unknown>>();

  function resolve(name: string) {
    if (typeof name !== 'string' || !name || path.basename(name) !== name) {
      throw new Error('invalid data file name');
    }
    return path.join(rootDir, name);
  }

  function read<T>(name: string, fallback: T): T {
    const file = resolve(name);
    if (!fs.existsSync(file)) return fallback;
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return fallback;
    }
  }

  function write(name: string, value: unknown) {
    const file = resolve(name);
    fs.mkdirSync(rootDir, { recursive: true });
    const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(temp, file);
  }

  function remove(name: string) {
    const file = resolve(name);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }

  // 串行化 read-modify-write：fn(currentValue) => newValue（或 undefined 表示不写回）。
  // 同一 name 的多次 mutate 会严格按调用顺序排队执行，杜绝并发覆盖。
  function mutate<T>(name: string, fn: (current: T) => T | undefined | Promise<T | undefined>, fallback: T) {
    const prev = chains.get(name) || Promise.resolve();
    const run = prev
      .then(() => fn(read(name, fallback)))
      .then((result) => {
        if (result === undefined) return result;
        write(name, result);
        return result;
      });
    // 存入"已处理 rejection"的链，避免后续排队因前序失败而中断，也避免 unhandled rejection
    chains.set(name, run.then(() => {}, () => {}));
    return run;
  }

  return { read, write, remove, resolve, mutate };
}

module.exports = { createJsonStore };
