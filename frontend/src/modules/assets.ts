import { api, state, toast } from '../core';

type ProjectFile = File & { webkitRelativePath?: string };

const MAX_FILE_BYTES = 1_800_000;
const MAX_FOLDER_BYTES = 16_000_000;
const MAX_FOLDER_FILES = 240;
const IGNORED_PARTS = new Set([
  '.git', '.hg', '.svn', '.idea', '.vscode', 'node_modules', 'dist', 'build',
  'coverage', '.next', '.nuxt', '.cache', 'target', 'vendor', '__pycache__',
]);
const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'mdx', 'json', 'jsonc', 'csv', 'tsv', 'js', 'jsx', 'mjs', 'cjs',
  'ts', 'tsx', 'py', 'go', 'rs', 'java', 'kt', 'kts', 'c', 'h', 'cpp', 'hpp',
  'cs', 'php', 'rb', 'swift', 'vue', 'svelte', 'html', 'htm', 'css', 'scss',
  'sass', 'less', 'yaml', 'yml', 'toml', 'ini', 'conf', 'env', 'sql', 'graphql',
  'gql', 'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd', 'xml', 'svg', 'lock',
]);
const TEXT_FILENAMES = new Set([
  'readme', 'license', 'changelog', 'makefile', 'procfile', 'dockerfile',
  '.gitignore', '.gitattributes', '.editorconfig', '.npmrc', '.nvmrc',
]);

function relativeName(file: ProjectFile): string {
  return String(file.webkitRelativePath || file.name).replaceAll('\\', '/').replace(/^\/+/, '');
}

export function isProjectTextFile(file: ProjectFile): boolean {
  const name = relativeName(file);
  const parts = name.split('/').filter(Boolean);
  if (!parts.length || parts.some((part) => IGNORED_PARTS.has(part.toLowerCase()))) return false;
  if (!file.size || file.size > MAX_FILE_BYTES) return false;
  const filename = parts.at(-1)?.toLowerCase() || '';
  const extension = filename.includes('.') ? filename.split('.').pop() || '' : '';
  return file.type.startsWith('text/') || TEXT_EXTENSIONS.has(extension) || TEXT_FILENAMES.has(filename);
}

export function selectProjectFiles(files: Iterable<ProjectFile>) {
  const selected: Array<{ file: ProjectFile; name: string }> = [];
  let bytes = 0;
  let skipped = 0;
  for (const file of files) {
    if (selected.length >= MAX_FOLDER_FILES || !isProjectTextFile(file) || bytes + file.size > MAX_FOLDER_BYTES) {
      skipped += 1;
      continue;
    }
    selected.push({ file, name: relativeName(file) });
    bytes += file.size;
  }
  return { selected, skipped, bytes };
}

async function uploadProjectFiles(files: ProjectFile[]): Promise<void> {
  if (!state.selectedProject) {
    toast('请先选择一个项目，再添加文件夹', 'error');
    return;
  }
  const projectId = state.selectedProject.id;
  const { selected, skipped } = selectProjectFiles(files);
  if (!selected.length) {
    toast('文件夹中没有可导入的文本或源代码文件', 'error');
    return;
  }

  const existingNames = new Set((state.assets || []).map((asset: any) => String(asset.name).toLowerCase()));
  const pending = selected.filter((item) => !existingNames.has(item.name.toLowerCase()));
  const duplicateCount = selected.length - pending.length;
  if (!pending.length) {
    toast('该文件夹中的可用文件已经在当前项目中');
    return;
  }

  toast(`正在导入 ${pending.length} 个项目文件…`);
  const uploaded: any[] = [];
  const failed: string[] = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < pending.length) {
      const item = pending[cursor++];
      try {
        const asset = await api('/api/assets', {
          method: 'POST',
          body: JSON.stringify({
            projectId,
            name: item.name,
            mimeType: item.file.type || 'text/plain',
            content: await item.file.text(),
          }),
        });
        uploaded.push(asset);
      } catch {
        failed.push(item.name);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, pending.length) }, () => worker()));
  if (uploaded.length) {
    state.assets = [...uploaded, ...state.assets];
    state.selectedAssetIds = new Set([...state.selectedAssetIds, ...uploaded.map((asset) => asset.id)]);
  }
  const notes = [
    skipped ? `跳过 ${skipped} 个构建产物、二进制或超限文件` : '',
    duplicateCount ? `忽略 ${duplicateCount} 个重复文件` : '',
    failed.length ? `${failed.length} 个文件导入失败` : '',
  ].filter(Boolean);
  toast(`已添加 ${uploaded.length} 个项目文件${notes.length ? `；${notes.join('，')}` : ''}`, failed.length ? 'error' : undefined);
}

export function importProjectFolder(): Promise<void> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    input.accept = 'text/*,.md,.mdx,.json,.jsonc,.js,.jsx,.ts,.tsx,.py,.go,.rs,.java,.kt,.c,.h,.cpp,.hpp,.cs,.php,.rb,.swift,.vue,.svelte,.html,.css,.scss,.less,.yaml,.yml,.toml,.ini,.env,.sql,.graphql,.sh,.ps1,.bat,.xml,.svg';
    input.className = 'project-folder-input';
    input.setAttribute('aria-hidden', 'true');
    document.body.appendChild(input);
    const cleanup = () => { input.remove(); resolve(); };
    input.addEventListener('change', () => {
      void uploadProjectFiles(Array.from(input.files || []) as ProjectFile[]).finally(cleanup);
    }, { once: true });
    input.addEventListener('cancel', cleanup, { once: true });
    input.click();
  });
}
