import { describe, expect, it } from 'vitest';
import { isProjectTextFile, selectProjectFiles } from '../assets';

function projectFile(path: string, content = 'export const value = 1;', type = 'text/plain') {
  const file = new File([content], path.split('/').at(-1) || 'file.txt', { type });
  Object.defineProperty(file, 'webkitRelativePath', { value: path });
  return file;
}

describe('project folder import', () => {
  it('keeps source files with their relative directory structure', () => {
    const result = selectProjectFiles([
      projectFile('demo/src/index.ts'),
      projectFile('demo/README.md', '# Demo'),
    ]);
    expect(result.selected.map((item) => item.name)).toEqual(['demo/src/index.ts', 'demo/README.md']);
    expect(result.skipped).toBe(0);
  });

  it('filters dependencies, build output and binary files', () => {
    const source = projectFile('demo/src/app.tsx');
    const dependency = projectFile('demo/node_modules/pkg/index.js');
    const build = projectFile('demo/dist/index.js');
    const binary = projectFile('demo/assets/logo.png', 'png', 'image/png');
    expect(isProjectTextFile(source)).toBe(true);
    expect(isProjectTextFile(dependency)).toBe(false);
    expect(isProjectTextFile(build)).toBe(false);
    expect(isProjectTextFile(binary)).toBe(false);
    expect(selectProjectFiles([source, dependency, build, binary]).skipped).toBe(3);
  });
});
