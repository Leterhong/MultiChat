'use strict';
// ── 技能压缩包（.zip）上传：解压 + 安全校验 + 落盘 + 注册 ────────────────
// 设计：复用插件目录模型（backend/plugins/<id>/）。包内 manifest 结构兼容
// 现有插件清单，但强制 type=bundle（绝不启动 MCP 子进程），技能/智能体经
// installPlugin 注入 skills.json / agents.json（带 _plugin 标记，可整体卸载）。
//
// 安全校验（入口即拦截，先于任何落盘）：
//   1) 压缩包原始大小上限（防大文件）
//   2) 文件数上限
//   3) 单文件未压缩上限 + 解压后总大小上限（防 zip-bomb）
//   4) 扩展名白名单（禁止可执行/脚本类文件）
//   5) zip-slip 路径穿越防护（绝对路径 / .. 段 / 逃逸 root）
//   6) manifest 合法性：id(safeId) / name / type 归一 bundle / 技能类型白名单 /
//      prompt 必填且 ≤8000 字 / 权限声明白名单
const path = require('path');
const AdmZip = require('adm-zip');
const { AppError } = require('../lib/errors');
const ctx = require('./context');
const pm = require('../plugins/manager');

// ── 安全边界 ──
const MAX_ZIP_BYTES = 8 * 1024 * 1024;       // 压缩包原始大小上限
const MAX_UNCOMPRESSED = 20 * 1024 * 1024;   // 解压后总大小上限（防 zip-bomb）
const MAX_SINGLE = 5 * 1024 * 1024;          // 单文件未压缩上限
const MAX_FILES = 200;                        // 文件数上限
const ALLOWED_EXT = new Set([
  '.json', '.md', '.txt', '.yaml', '.yml',
  '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.html', '.css', '.csv', '.pdf',
]);
// 技能压缩包只允许「数据/模板/文档」类资源；严禁脚本与二进制可执行文件
const SKILL_TYPES = new Set(['prompt', 'datetime', 'calculator', 'web_fetch', 'web_search']);
const PERMISSIONS = new Set(['network']); // 仅允许已知集合，未知权限一律拒绝
const MANIFEST_CANDIDATES = ['manifest.json', 'skill.json', 'package.json'];

function entryIsDir(e) {
  if (typeof e.isDirectory === 'function') return e.isDirectory();
  return e.entryName.endsWith('/');
}

// 防 zip-slip：拒绝绝对路径、.. 段、逃逸出 root 的条目
function safeJoin(root, name) {
  if (!name || typeof name !== 'string') throw new AppError('INVALID_PACKAGE', '非法条目名');
  if (path.isAbsolute(name)) throw new AppError('INVALID_PACKAGE', '压缩包含绝对路径条目：' + name);
  if (name.split(/[\\/]/).some(s => s === '..')) throw new AppError('INVALID_PACKAGE', '检测到路径穿越：' + name);
  const full = path.resolve(root, name);
  const rootResolved = path.resolve(root);
  if (full !== rootResolved && !full.startsWith(rootResolved + path.sep)) {
    throw new AppError('INVALID_PACKAGE', '检测到路径穿越攻击：' + name);
  }
  return full;
}

// 业务层 manifest 校验；会就地归一 type=bundle
function validateManifest(mf) {
  if (!mf.id || !mf.name) throw new AppError('INVALID_PACKAGE', 'manifest 需含 id 与 name');
  const hasSkills = Array.isArray(mf.skills) && mf.skills.length > 0;
  const hasAgents = Array.isArray(mf.agents) && mf.agents.length > 0;
  if (!hasSkills && !hasAgents) throw new AppError('INVALID_PACKAGE', 'manifest 须至少含一个 skill 或 agent');
  // 技能压缩包不允许启动 MCP 子进程（避免任意远程代码执行）
  if (mf.type === 'mcp') throw new AppError('INVALID_PACKAGE', '技能压缩包不允许 mcp 类型（禁止远程代码执行）');
  mf.type = 'bundle';
  for (const s of (mf.skills || [])) {
    if (!s.id || !s.name) throw new AppError('INVALID_PACKAGE', '技能须含 id 与 name');
    if (!SKILL_TYPES.has(s.type)) throw new AppError('INVALID_PACKAGE', '不支持的技能类型：' + (s.type || '（缺失）'));
    if (s.type === 'prompt') {
      if (!s.config || typeof s.config.prompt !== 'string' || !s.config.prompt.trim()) {
        throw new AppError('INVALID_PACKAGE', 'prompt 技能需 config.prompt（非空文本）');
      }
      if (s.config.prompt.length > 8000) throw new AppError('INVALID_PACKAGE', 'prompt 超过 8000 字符');
    }
    if (Array.isArray(s.permissions)) {
      for (const p of s.permissions) {
        if (!PERMISSIONS.has(p)) throw new AppError('INVALID_PACKAGE', '未知权限声明：' + p);
      }
    }
  }
  for (const a of (mf.agents || [])) {
    if (!a.id || !a.name) throw new AppError('INVALID_PACKAGE', '智能体须含 id 与 name');
  }
  return mf;
}

// 从内存 buffer 安装技能压缩包；调用方应包裹在 store.mutate 并发锁内
function installSkillPackFromBuffer(buf, opts = {}) {
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
  if (buf.length > MAX_ZIP_BYTES) throw new AppError('IMPORT_FAILED', '压缩包超过 ' + (MAX_ZIP_BYTES / 1024 / 1024) + ' MB');
  if (buf.length === 0) throw new AppError('INVALID_PACKAGE', '空压缩包');
  let zip;
  try { zip = new AdmZip(buf); } catch (e) { throw new AppError('INVALID_PACKAGE', '不是合法的 zip：' + e.message); }

  const entries = zip.getEntries();
  if (entries.length > MAX_FILES) throw new AppError('INVALID_PACKAGE', '文件数超过 ' + MAX_FILES);

  let total = 0;
  let manifestEntry = null;
  for (const e of entries) {
    const size = e.header.size || 0;
    if (size > MAX_SINGLE) throw new AppError('INVALID_PACKAGE', '单文件超过 ' + (MAX_SINGLE / 1024 / 1024) + ' MB：' + e.entryName);
    total += size;
    if (total > MAX_UNCOMPRESSED) throw new AppError('INVALID_PACKAGE', '解压后总大小超过 ' + (MAX_UNCOMPRESSED / 1024 / 1024) + ' MB（疑似 zip-bomb）');
    if (!entryIsDir(e)) {
      const ext = path.extname(e.entryName.toLowerCase());
      if (!ALLOWED_EXT.has(ext)) throw new AppError('INVALID_PACKAGE', '禁用文件类型：' + e.entryName);
    }
    if (!manifestEntry && MANIFEST_CANDIDATES.includes(e.entryName)) manifestEntry = e;
  }
  if (!manifestEntry) throw new AppError('INVALID_PACKAGE', '缺少 manifest.json / skill.json / package.json');

  let manifest;
  try { manifest = JSON.parse(manifestEntry.getData().toString('utf-8')); }
  catch (e) { throw new AppError('INVALID_PACKAGE', 'manifest 不是合法 JSON：' + e.message); }
  manifest = ctx.normalizePackage(manifest); // 校验 id(safeId) / skills·agents 数组形状
  validateManifest(manifest);

  // 落盘到 plugins/<id>/（先清旧版本残留，再写入，最后注册）
  const dir = path.join(ctx.PLUGIN_DIR, ctx.safeId(manifest.id, 'plugin id'));
  pm.uninstallPlugin(manifest);
  ctx.fs.mkdirSync(dir, { recursive: true });
  for (const e of entries) {
    const full = safeJoin(dir, e.entryName);
    if (entryIsDir(e)) { ctx.fs.mkdirSync(full, { recursive: true }); continue; }
    ctx.fs.mkdirSync(path.dirname(full), { recursive: true });
    ctx.fs.writeFileSync(full, e.getData());
  }
  const r = pm.installPlugin(manifest, dir);
  return {
    plugin: { id: manifest.id, name: manifest.name, type: manifest.type, version: manifest.version || '0.0.0' },
    skills: r.skills,
    agents: r.agents,
    source: opts.source,
  };
}

module.exports = {
  installSkillPackFromBuffer,
  MAX_ZIP_BYTES, MAX_UNCOMPRESSED, MAX_SINGLE, MAX_FILES,
  ALLOWED_EXT, SKILL_TYPES, PERMISSIONS,
};
