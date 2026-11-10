#!/usr/bin/env node
// 供应链闸门：确保三个 lockfile 的 tarball 都锚定在官方 npm registry，
// 且每条远程记录都有 integrity。安装源与审计源分离会让 npm audit 失真。
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const locks = ['package-lock.json', 'backend/package-lock.json', 'frontend/package-lock.json'];
const ALLOWED_HOST = 'registry.npmjs.org';

let checked = 0;
const problems = [];

for (const name of locks) {
  const lock = JSON.parse(readFileSync(path.join(root, name), 'utf8'));
  for (const [key, pkg] of Object.entries(lock.packages || {})) {
    if (pkg.link || !pkg.resolved) continue;
    checked += 1;
    let host = '';
    try {
      host = new URL(pkg.resolved).host;
    } catch {
      problems.push(`${name} ${key}: 无法解析 resolved (${pkg.resolved})`);
      continue;
    }
    if (host !== ALLOWED_HOST) problems.push(`${name} ${key}: 非官方源 ${host}`);
    if (!pkg.integrity) problems.push(`${name} ${key}: 缺少 integrity`);
  }
  console.log(`✓ ${name}: 已校验 ${Object.values(lock.packages || {}).filter((p) => p.resolved && !p.link).length} 条 tarball 记录`);
}

if (problems.length) {
  console.error(`\n发现 ${problems.length} 条供应链异常：`);
  for (const problem of problems.slice(0, 20)) console.error(`  - ${problem}`);
  process.exitCode = 1;
} else {
  console.log(`\n通过：${checked} 条 tarball 记录均来自 ${ALLOWED_HOST} 且带 integrity。`);
}
