import { $, esc, api, toast } from '../core/index';

type ImportKind = 'skill' | 'mcp' | 'plugin';

const DROP_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/></svg>';

let lastSelection: { kind: ImportKind; files: FileList | File[] } | null = null;

const IMPORT_COPY: Record<ImportKind, any> = {
  skill: {
    title: '导入 Agent Skill',
    tab: 'skills',
    accept: '.zip,.md',
    fileLabel: '选择 ZIP / SKILL.md',
    directory: true,
    help: '支持 WorkBuddy 风格的 Skill ZIP、单个 SKILL.md，或直接选择完整目录。目录中的 scripts、references、assets 和 templates 会原样保留。',
  },
  mcp: {
    title: '导入 MCP 配置',
    tab: 'mcp',
    accept: '.json,.mcp.json',
    fileLabel: '选择 MCP JSON',
    directory: false,
    help: '支持 mcpServers、mcp_servers、servers 和直接 server map。导入项默认停用且未信任，不会在导入时启动命令或连接网络。',
  },
  plugin: {
    title: '安装插件包',
    tab: 'plugins',
    accept: '.zip',
    fileLabel: '选择插件 ZIP',
    directory: true,
    help: '插件以 .codex-plugin/plugin.json 为入口，整包注册到当前项目市场，Skill、MCP 与资源目录不会被扁平化。安装与启用分离。',
  },
};

function fileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`无法读取 ${file.name}`));
    reader.onload = () => {
      const value = String(reader.result || '');
      const comma = value.indexOf(',');
      if (comma < 0) reject(new Error(`无法编码 ${file.name}`));
      else resolve(value.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

async function filesPayload(files: FileList | File[]) {
  const rows = Array.from(files || []);
  if (!rows.length) throw new Error('请先选择文件');
  if (rows.length > 600) throw new Error('一次最多导入 600 个文件');
  const total = rows.reduce((sum, file) => sum + file.size, 0);
  if (total > 20 * 1024 * 1024) throw new Error('导入文件总大小不能超过 20 MB');
  const isDirectory = rows.length > 1 || rows.some(file => !!(file as any).webkitRelativePath);
  if (!isDirectory) {
    const file = rows[0];
    return { fileName: file.name, contentBase64: await fileBase64(file) };
  }
  return {
    files: await Promise.all(rows.map(async file => ({
      path: (file as any).webkitRelativePath || file.name,
      contentBase64: await fileBase64(file),
    }))),
  };
}

function formatBytes(value: number) {
  if (!Number.isFinite(value)) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function previewDetails(kind: ImportKind, preview: any) {
  if (kind === 'mcp') {
    return `<div class="extension-import-list">${(preview.servers || []).map((server: any) => `
      <div class="extension-import-row"><div><strong>${esc(server.name)}</strong><span>${esc(server.id)}</span></div><div class="mc-tags"><span class="mc-tag">${esc(String(server.transport || '').toUpperCase())}</span>${(server.targets || []).map((target: string) => `<span class="mc-tag">${esc(target)}</span>`).join('')}</div></div>`).join('')}</div>`;
  }
  const components = preview.components || {};
  const chips = [
    preview.fileCount !== undefined ? `${preview.fileCount} 个文件` : '',
    preview.totalBytes !== undefined ? formatBytes(preview.totalBytes) : '',
    ...(preview.resources || []),
    components.skills !== undefined ? `${components.skills} Skills` : '',
    components.mcpServers !== undefined ? `${components.mcpServers} MCP` : '',
  ].filter(Boolean);
  return `<div class="mc-tags extension-import-tags">${chips.map(value => `<span class="mc-tag">${esc(value)}</span>`).join('')}</div>
    ${(preview.fileTree || []).length ? `<details class="extension-file-tree"><summary>查看包内文件</summary><pre>${esc(preview.fileTree.join('\n'))}</pre></details>` : ''}`;
}

async function refreshAfterImport(kind: ImportKind) {
  if (kind === 'skill') await Promise.all([loadSkills(), loadAgents(), loadRuntime()]);
  if (kind === 'mcp') await Promise.all([loadMcpServers(), loadAgents(), loadRuntime()]);
  if (kind === 'plugin') await Promise.all([loadPlugins(), loadSkills(), loadMcpServers(), loadAgents(), loadRuntime()]);
}

function showImportPreview(kind: ImportKind, payload: any, preview: any) {
  const copy = IMPORT_COPY[kind];
  const conflicts = preview.conflicts || [];
  const cannotReplace = conflicts.some((item: any) => item.replaceable === false);
  const warnings = preview.warnings || [];
  showModal({
    title: `预检通过 · ${preview.name}`,
    body: `<div class="extension-import-summary">
        <div class="extension-import-kind">${kind === 'skill' ? 'SKILL' : kind === 'mcp' ? 'MCP' : 'PLUGIN'}</div>
        <div><div class="extension-import-name">${esc(preview.name)}</div><div class="pmeta">${esc(preview.description || '')}${preview.version ? ` · v${esc(preview.version)}` : ''}</div></div>
      </div>
      <div class="field"><label>安装范围</label><div class="extension-import-scope">当前项目 · ${kind === 'mcp' ? '.codex/config.toml（启用且选择 Codex 后同步）' : kind === 'skill' ? '.agents/skills' : '.agents/plugins/marketplace.json'}</div></div>
      ${previewDetails(kind, preview)}
      ${warnings.length ? `<div class="extension-import-warnings"><strong>启用前请确认</strong>${warnings.map((warning: string) => `<div>• ${esc(warning)}</div>`).join('')}</div>` : ''}
      ${conflicts.length ? `<div class="extension-import-conflicts"><strong>发现同名项</strong>${conflicts.map((item: any) => `<div>${esc(item.id)}${item.path ? ` · ${esc(item.path)}` : ''}${item.replaceable === false ? ' · 其他来源，不可覆盖' : ''}</div>`).join('')}</div>` : ''}
      ${kind === 'plugin' ? '<div class="extension-import-note">插件以完整资源包安装并独立启停，包契约使用 Codex plugin。MultiChat 当前会加载其中的 Skills 与 MCP；其他资源会保留，但不会把上传的 JS、hooks 直接注入网站主进程。</div>' : ''}
      ${conflicts.length && !cannotReplace ? '<label class="extension-import-confirm"><input type="checkbox" id="replaceExtension" /> 我已确认，用这个包覆盖当前项目中的同名项</label>' : ''}
      <div id="extensionImportErr" class="auth-error">${cannotReplace ? '同名项来自插件或其他受保护来源，本次导入不能覆盖。' : ''}</div>
      <div class="row"><button type="button" class="btn-ghost" id="importBack">重新选择</button><button type="button" class="btn-primary btn-auto" id="importCommit" ${cannotReplace ? 'disabled' : ''}>确认导入</button></div>`,
    onMount: (card: any) => {
      $('#importBack', card).onclick = () => showExtensionImport(kind);
      $('#importCommit', card).onclick = async () => {
        const replace = conflicts.length > 0 && !!($('#replaceExtension', card) as HTMLInputElement | null)?.checked;
        if (conflicts.length && !replace) {
          ($('#extensionImportErr', card) as HTMLElement).textContent = '请先确认覆盖同名项。';
          return;
        }
        const button = $('#importCommit', card) as HTMLButtonElement;
        button.disabled = true; button.textContent = '正在导入…';
        try {
          await api(`/api/extensions/import/${kind}/install`, {
            method: 'POST',
            body: JSON.stringify({ ...payload, expectedFingerprint: preview.fingerprint, conflictPolicy: replace ? 'replace' : 'reject' }),
          });
          await refreshAfterImport(kind);
          renderSettings(copy.tab, true);
          closeModal();
          toast(kind === 'plugin' ? '插件包已导入，当前保持停用' : kind === 'mcp' ? 'MCP 配置已导入，当前保持停用' : 'Skill 已导入当前项目');
        } catch (error: any) {
          ($('#extensionImportErr', card) as HTMLElement).textContent = error.message;
          button.disabled = false; button.textContent = '确认导入';
        }
      };
    },
  });
}

async function inspectSelection(kind: ImportKind, files: FileList | File[], card: any) {
  const status = $('#extensionPickStatus', card) as HTMLElement;
  status.classList.remove('error');
  status.textContent = '正在读取并预检…';
  const retry = $('#extensionPickRetry', card) as HTMLButtonElement | null;
  if (retry) { retry.hidden = true; retry.disabled = true; }
  try {
    const payload = await filesPayload(files);
    const preview = await api(`/api/extensions/import/${kind}/inspect`, { method: 'POST', body: JSON.stringify(payload) });
    showImportPreview(kind, payload, preview);
  } catch (error: any) {
    lastSelection = { kind, files };
    status.textContent = error.message;
    status.classList.add('error');
    if (retry) { retry.hidden = false; retry.disabled = false; retry.onclick = () => lastSelection && inspectSelection(lastSelection.kind, lastSelection.files, card); }
  }
}

function showExtensionImport(kind: ImportKind) {
  const copy = IMPORT_COPY[kind];
  showModal({
    title: copy.title,
    body: `<p class="lead lead-tight">${esc(copy.help)}</p>
      <div class="extension-dropzone" id="extensionDropzone" tabindex="0">
        <div class="extension-drop-icon">${DROP_ICON}</div><strong>拖入文件进行预检</strong><span>不会在预检阶段执行任何脚本或 MCP 命令</span>
      </div>
      <div class="extension-picker-actions">
        <button type="button" class="btn-primary btn-auto" id="pickExtensionFile">${esc(copy.fileLabel)}</button>
        ${copy.directory ? '<button type="button" class="btn-ghost" id="pickExtensionDirectory">选择完整目录</button>' : ''}
      </div>
      <input type="file" id="extensionFileInput" accept="${esc(copy.accept)}" hidden />
      ${copy.directory ? '<input type="file" id="extensionDirectoryInput" hidden multiple />' : ''}
      <div id="extensionPickStatus" class="extension-pick-status" role="status"></div>
      <button type="button" class="btn-ghost" id="extensionPickRetry" hidden>用刚才的文件重新预检</button>
      <div class="extension-import-note">默认冲突策略是拒绝覆盖；只有预检发现冲突且你再次勾选确认后，才会替换旧版本。</div>
      <div class="row"><button type="button" class="btn-ghost" id="extensionImportCancel">取消</button></div>`,
    onMount: (card: any) => {
      const fileInput = $('#extensionFileInput', card) as HTMLInputElement;
      const directoryInput = $('#extensionDirectoryInput', card) as HTMLInputElement | null;
      if (directoryInput) directoryInput.setAttribute('webkitdirectory', '');
      $('#pickExtensionFile', card).onclick = () => fileInput.click();
      if (directoryInput) $('#pickExtensionDirectory', card).onclick = () => directoryInput.click();
      $('#extensionImportCancel', card).onclick = closeModal;
      fileInput.onchange = () => fileInput.files?.length && inspectSelection(kind, fileInput.files, card);
      if (directoryInput) directoryInput.onchange = () => directoryInput.files?.length && inspectSelection(kind, directoryInput.files, card);
      const dropzone = $('#extensionDropzone', card) as HTMLElement;
      dropzone.ondragover = event => { event.preventDefault(); dropzone.classList.add('dragging'); };
      dropzone.ondragleave = () => dropzone.classList.remove('dragging');
      dropzone.ondrop = event => {
        event.preventDefault(); dropzone.classList.remove('dragging');
        if (event.dataTransfer?.files?.length) inspectSelection(kind, event.dataTransfer.files, card);
      };
    },
  });
}

export { showExtensionImport };
