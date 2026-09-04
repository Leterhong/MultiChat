import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('automation keeps the repository single-branch friendly', () => {
  const release = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
  assert.doesNotMatch(release, /ci\/npm-publish-debug/);
  assert.doesNotMatch(release, /issues:\s*write/);

  const dependabot = readFileSync(new URL('../.github/dependabot.yml', import.meta.url), 'utf8');
  assert.equal((dependabot.match(/open-pull-requests-limit:\s*0/g) || []).length, 4);
  assert.equal((dependabot.match(/version-update:semver-major/g) || []).length, 3);

  const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.ok((ci.match(/npm audit --audit-level=high/g) || []).length >= 3);
});
