import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('automation keeps the repository single-branch friendly', () => {
  const release = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
  assert.doesNotMatch(release, /ci\/npm-publish-debug/);
  assert.doesNotMatch(release, /issues:\s*write/);

  const dependabot = readFileSync(new URL('../.github/dependabot.yml', import.meta.url), 'utf8');
  assert.equal((dependabot.match(/open-pull-requests-limit:\s*1/g) || []).length, 4);
  assert.equal((dependabot.match(/version-update:semver-major/g) || []).length, 3);

  const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const auditLines = ci.split('\n').filter((line) => line.includes('npm audit'));
  assert.ok(auditLines.length >= 3, 'CI 需要在三处依赖安装位置执行 audit');
  // 安装源与审计源必须一致，否则本机镜像会让 audit 返回 404 假绿。
  assert.ok(
    auditLines.every((line) => line.includes('--registry=https://registry.npmjs.org')),
    '所有 npm audit 必须显式指定官方 registry'
  );
  assert.ok((ci.match(/--audit-level=high/g) || []).length >= 3);
  assert.match(ci, /scripts\/check-lock-registry\.mjs/);
});
