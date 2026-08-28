'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// Safe, two-phase import pipeline for Agent Skills, MCP server registries and
// Codex plugins.  The browser first calls inspect(), then sends the exact same
// package plus the returned fingerprint to install().  Imported archives are
// never executed during inspection or installation.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const extensions = require('./manager');
const { AppError } = require('../lib/errors');
const MAX_ARCHIVE_BYTES = 20 * 1024 * 1024;
const MAX_UNPACKED_BYTES = 80 * 1024 * 1024;
const MAX_SINGLE_FILE_BYTES = 24 * 1024 * 1024;
const MAX_MCP_CONFIG_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 600;
const REPO_SKILLS_ROOT = path.join(extensions.PROJECT_ROOT, '.agents', 'skills');
const REPO_PLUGIN_ROOT = path.join(extensions.PROJECT_ROOT, '.agents', 'plugins', 'plugins');
const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const PACKAGE_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EXECUTABLE_RE = /\.(?:bat|cmd|com|cpl|dll|exe|hta|jar|js|mjs|cjs|node|ps1|py|rb|sh|ts|vbs|wsf)$/i;
const WINDOWS_RESERVED_RE = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const FORBIDDEN_PACKAGE_DIRS = new Set(['.git', '.ssh', 'node_modules']);
const ENV_REFERENCE_RE = /\$\{(?:env:)?([A-Za-z_][A-Za-z0-9_]*)\}/g;
function packageError(message) {
    throw new AppError('INVALID_PACKAGE', message);
}
function decodeBase64(value, label, maxBytes = MAX_ARCHIVE_BYTES) {
    const text = String(value || '').trim();
    if (!text || text.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) {
        packageError(`${label} 不是有效的 Base64 文件内容`);
    }
    const data = Buffer.from(text, 'base64');
    if (!data.length)
        packageError(`${label} 不能为空`);
    if (data.length > maxBytes)
        packageError(`${label} 超过 ${Math.floor(maxBytes / 1024 / 1024)} MB 限制`);
    return data;
}
function safeArchivePath(rawPath) {
    let value = String(rawPath || '').normalize('NFC').replace(/\\/g, '/');
    while (value.startsWith('./'))
        value = value.slice(2);
    value = value.replace(/\/$/, '');
    if (!value || value.includes('\0') || value.startsWith('/') || value.startsWith('//') || /^[A-Za-z]:/.test(value)) {
        packageError(`压缩包包含不安全路径：${rawPath}`);
    }
    if (value.length > 512)
        packageError(`压缩包路径过长：${rawPath}`);
    const parts = value.split('/');
    for (const part of parts) {
        if (!part || part === '.' || part === '..' || part.length > 255 || /[<>:"|?*]/.test(part) || /[. ]$/.test(part) || WINDOWS_RESERVED_RE.test(part)) {
            packageError(`压缩包包含不安全路径：${rawPath}`);
        }
        if (FORBIDDEN_PACKAGE_DIRS.has(part.toLocaleLowerCase('en-US')))
            packageError(`导入包不能包含 ${part}/ 目录`);
    }
    const base = parts.at(-1).toLocaleLowerCase('en-US');
    if (/^\.env(?:\..+)?$/.test(base) && !/^\.env\.(?:example|sample|template)$/.test(base))
        packageError(`导入包不能包含可能泄露密钥的文件：${rawPath}`);
    return parts.join('/');
}
function shouldIgnorePath(value) {
    const parts = value.replace(/\\/g, '/').split('/');
    return parts.includes('__MACOSX') || parts.at(-1) === '.DS_Store' || parts.at(-1) === 'Thumbs.db';
}
function assertUniqueFiles(files) {
    if (!files.length)
        packageError('导入包中没有文件');
    if (files.length > MAX_FILES)
        packageError(`导入包文件数超过 ${MAX_FILES} 个限制`);
    const seen = new Set();
    let total = 0;
    for (const file of files) {
        const key = file.path.toLocaleLowerCase('en-US');
        if (seen.has(key))
            packageError(`导入包包含重复路径：${file.path}`);
        seen.add(key);
        if (!Buffer.isBuffer(file.data))
            packageError(`无法读取文件：${file.path}`);
        if (file.data.length > MAX_SINGLE_FILE_BYTES)
            packageError(`单个文件超过 24 MB：${file.path}`);
        total += file.data.length;
    }
    if (total > MAX_UNPACKED_BYTES)
        packageError('导入包解压后超过 80 MB 限制');
    return total;
}
function readZip(buffer) {
    let zip;
    try {
        zip = new AdmZip(buffer);
    }
    catch {
        packageError('ZIP 文件损坏或格式不受支持');
    }
    let entries;
    try {
        entries = zip.getEntries();
    }
    catch {
        packageError('无法读取 ZIP 目录');
    }
    if (entries.length > MAX_FILES)
        packageError(`ZIP 文件条目超过 ${MAX_FILES} 个限制`);
    let announcedTotal = 0;
    const files = [];
    for (const entry of entries) {
        const raw = String(entry.entryName || '');
        if (!raw || shouldIgnorePath(raw) || entry.isDirectory)
            continue;
        const normalized = safeArchivePath(raw);
        const mode = (Number(entry.attr || entry.header?.attr || 0) >>> 16) & 0xffff;
        if ((mode & 0xf000) === 0xa000)
            packageError(`ZIP 不允许符号链接：${normalized}`);
        const size = Number(entry.header?.size || 0);
        const compressedSize = Number(entry.header?.compressedSize || 0);
        if (!Number.isSafeInteger(size) || size < 0 || size > MAX_SINGLE_FILE_BYTES)
            packageError(`ZIP 文件条目过大：${normalized}`);
        announcedTotal += size;
        if (announcedTotal > MAX_UNPACKED_BYTES)
            packageError('ZIP 解压后超过 80 MB 限制');
        if (size > 1024 * 1024 && compressedSize > 0 && size / compressedSize > 250)
            packageError(`ZIP 压缩率异常：${normalized}`);
        let data;
        try {
            data = entry.getData();
        }
        catch {
            packageError(`ZIP 文件条目无法解压：${normalized}`);
        }
        if (data.length !== size)
            packageError(`ZIP 文件条目大小不一致：${normalized}`);
        files.push({ path: normalized, data });
    }
    assertUniqueFiles(files);
    return files;
}
function readFileList(rows) {
    if (!Array.isArray(rows) || !rows.length)
        packageError('请选择一个文件夹或 ZIP 文件');
    const files = rows.map((row, index) => {
        if (!row || typeof row !== 'object')
            packageError(`第 ${index + 1} 个文件无效`);
        const rawPath = String(row.path || row.name || '');
        if (shouldIgnorePath(rawPath))
            return null;
        return {
            path: safeArchivePath(rawPath),
            data: decodeBase64(row.contentBase64, rawPath || `文件 ${index + 1}`, MAX_SINGLE_FILE_BYTES),
        };
    }).filter(Boolean);
    assertUniqueFiles(files);
    return files;
}
function packageFiles(input, kind) {
    if (Array.isArray(input?.files))
        return readFileList(input.files);
    const fileName = String(input?.fileName || '').trim();
    const data = decodeBase64(input?.contentBase64, fileName || '导入文件');
    if (/\.zip$/i.test(fileName))
        return readZip(data);
    if (kind === 'skill' && /(?:^|\.)md$/i.test(fileName))
        return [{ path: 'SKILL.md', data }];
    packageError(`${kind === 'plugin' ? '插件' : 'Skill'} 请上传 ZIP，或直接选择整个目录${kind === 'skill' ? '；Skill 也支持单个 SKILL.md' : ''}`);
}
function rebaseAtMarker(files, marker, label) {
    const candidates = files.filter(file => file.path === marker || file.path.endsWith('/' + marker));
    if (!candidates.length)
        packageError(`${label} 缺少 ${marker}`);
    candidates.sort((a, b) => a.path.split('/').length - b.path.split('/').length);
    const depth = candidates[0].path.split('/').length;
    if (candidates.filter(item => item.path.split('/').length === depth).length > 1) {
        packageError(`${label} 中发现多个并列的 ${marker}，请每次只导入一个包`);
    }
    const selected = candidates[0].path;
    const root = selected.slice(0, -marker.length).replace(/\/$/, '');
    const scoped = root ? files.filter(file => file.path.startsWith(root + '/')) : files;
    const rebased = scoped.map(file => ({ path: root ? file.path.slice(root.length + 1) : file.path, data: file.data }));
    assertUniqueFiles(rebased);
    return { files: rebased, ignoredFiles: files.length - scoped.length };
}
function utf8(file, label = file.path) {
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(file.data);
    }
    catch {
        packageError(`${label} 必须使用 UTF-8 编码`);
    }
}
function findFile(files, name, required = true) {
    const file = files.find(item => item.path === name);
    if (!file && required)
        packageError(`缺少 ${name}`);
    return file;
}
function parseJsonFile(files, name, required = true) {
    const file = findFile(files, name, required);
    if (!file)
        return null;
    let value;
    try {
        value = JSON.parse(utf8(file, name));
    }
    catch {
        packageError(`${name} 必须是有效的 JSON`);
    }
    if (!value || typeof value !== 'object' || Array.isArray(value))
        packageError(`${name} 顶层必须是 JSON 对象`);
    return value;
}
function fingerprint(files) {
    const hash = crypto.createHash('sha256');
    for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path, 'en'))) {
        hash.update(file.path);
        hash.update('\0');
        hash.update(file.data);
        hash.update('\0');
    }
    return hash.digest('hex');
}
function validatePackageName(value, label) {
    const name = String(value || '').trim();
    if (!name || name.length > 64 || !PACKAGE_NAME_RE.test(name))
        packageError(`${label} 必须是 1-64 位小写字母、数字或连字符，且不能连续使用连字符`);
    return name;
}
function validateSkillFiles(files, skillPath = 'SKILL.md') {
    const file = findFile(files, skillPath);
    const text = utf8(file, skillPath);
    const parsed = extensions.parseSkillMarkdown(text, skillPath);
    const name = validatePackageName(parsed.metadata.name, `${skillPath} 的 name`);
    const description = String(parsed.metadata.description || '').trim();
    const allowed = new Set(['name', 'description', 'license', 'allowed-tools', 'metadata']);
    const unexpected = Object.keys(parsed.metadata).filter(key => !allowed.has(key));
    if (unexpected.length)
        packageError(`${skillPath} frontmatter 包含不支持的字段：${unexpected.join(', ')}`);
    if (!description || description.length > 1024 || /[<>]/.test(description))
        packageError(`${skillPath} 的 description 必须为 1-1024 个字符且不能包含尖括号`);
    if (!parsed.instructions.trim())
        packageError(`${skillPath} 必须包含正文指令`);
    if (/(?:^|\n)[ \t]{0,3}\[TODO:[^\n]*\][ \t]*(?:\n|$)/.test(parsed.instructions))
        packageError(`${skillPath} 仍包含 [TODO: ...] 占位符`);
    return { name, description, instructions: parsed.instructions };
}
function executableWarnings(files) {
    const paths = files.filter(file => EXECUTABLE_RE.test(file.path)).map(file => file.path);
    if (!paths.length)
        return [];
    return [`包含 ${paths.length} 个脚本或可执行文件；导入不会执行它们，请在启用前审核：${paths.slice(0, 6).join(', ')}${paths.length > 6 ? '…' : ''}`];
}
function inspectSkill(input) {
    const rebased = rebaseAtMarker(packageFiles(input, 'skill'), 'SKILL.md', 'Skill 包');
    const metadata = validateSkillFiles(rebased.files);
    const destination = path.join(REPO_SKILLS_ROOT, metadata.name);
    const conflict = fs.existsSync(destination);
    const resources = ['scripts', 'references', 'assets', 'templates'].filter(folder => rebased.files.some(file => file.path.startsWith(folder + '/')));
    const warnings = executableWarnings(rebased.files);
    if (rebased.ignoredFiles)
        warnings.push(`包根目录之外的 ${rebased.ignoredFiles} 个文件不会导入`);
    return {
        kind: 'skill',
        name: metadata.name,
        description: metadata.description,
        fingerprint: fingerprint(rebased.files),
        files: rebased.files,
        fileCount: rebased.files.length,
        totalBytes: rebased.files.reduce((sum, file) => sum + file.data.length, 0),
        resources,
        warnings,
        conflicts: conflict ? [{ id: metadata.name, path: destination, replaceable: true }] : [],
        destination,
    };
}
function jsonClone(value) { return JSON.parse(JSON.stringify(value)); }
function hasTodo(value) {
    if (typeof value === 'string')
        return value.includes('[TODO:');
    if (Array.isArray(value))
        return value.some(hasTodo);
    return !!value && typeof value === 'object' && Object.values(value).some(hasTodo);
}
function requireText(object, field, label = field) {
    if (!object || typeof object[field] !== 'string' || !object[field].trim())
        packageError(`plugin.json 字段 ${label} 必须是非空字符串`);
    return object[field].trim();
}
function contractPath(value) {
    return typeof value === 'string' ? value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '') : null;
}
function validateAsset(files, rawPath, label) {
    if (typeof rawPath !== 'string' || !rawPath.trim())
        packageError(`plugin.json 字段 ${label} 必须是相对路径`);
    const normalized = safeArchivePath(rawPath);
    if (!findFile(files, normalized, false))
        packageError(`plugin.json 字段 ${label} 指向不存在的文件：${rawPath}`);
}
function validatePluginManifest(files) {
    const manifest = parseJsonFile(files, '.codex-plugin/plugin.json');
    const allowedTop = new Set(['id', 'name', 'version', 'description', 'skills', 'apps', 'mcpServers', 'interface', 'author', 'homepage', 'repository', 'license', 'keywords']);
    const unknownTop = Object.keys(manifest).filter(key => !allowedTop.has(key));
    if (unknownTop.length)
        packageError(`plugin.json 包含当前 Codex 规范不接受的字段：${unknownTop.join(', ')}`);
    if (hasTodo(manifest))
        packageError('plugin.json 仍包含 [TODO: ...] 占位符');
    const name = validatePackageName(requireText(manifest, 'name'), 'plugin.json 的 name');
    const version = requireText(manifest, 'version');
    if (!SEMVER_RE.test(version))
        packageError('plugin.json 的 version 必须是严格 semver');
    const description = requireText(manifest, 'description');
    if (!manifest.author || typeof manifest.author !== 'object' || Array.isArray(manifest.author))
        packageError('plugin.json 的 author 必须是对象');
    const unknownAuthor = Object.keys(manifest.author).filter(key => !['name', 'email', 'url'].includes(key));
    if (unknownAuthor.length)
        packageError(`plugin.json 的 author 包含不支持的字段：${unknownAuthor.join(', ')}`);
    requireText(manifest.author, 'name', 'author.name');
    if (manifest.skills !== undefined && contractPath(manifest.skills) !== 'skills')
        packageError('plugin.json 的 skills 必须指向 ./skills/');
    if (manifest.apps !== undefined && contractPath(manifest.apps) !== '.app.json')
        packageError('plugin.json 的 apps 必须指向 ./.app.json');
    if (typeof manifest.mcpServers === 'string' && contractPath(manifest.mcpServers) !== '.mcp.json')
        packageError('plugin.json 的 mcpServers 必须指向 ./.mcp.json');
    if (manifest.mcpServers !== undefined && typeof manifest.mcpServers !== 'string' && (!manifest.mcpServers || typeof manifest.mcpServers !== 'object' || Array.isArray(manifest.mcpServers)))
        packageError('plugin.json 的 mcpServers 必须是对象或 ./.mcp.json 路径');
    const ui = manifest.interface;
    if (!ui || typeof ui !== 'object' || Array.isArray(ui))
        packageError('plugin.json 的 interface 必须是对象');
    const allowedInterface = new Set(['displayName', 'shortDescription', 'longDescription', 'developerName', 'category', 'capabilities', 'websiteURL', 'privacyPolicyURL', 'termsOfServiceURL', 'brandColor', 'composerIcon', 'logo', 'logoDark', 'screenshots', 'defaultPrompt', 'default_prompt']);
    const unknownInterface = Object.keys(ui).filter(key => !allowedInterface.has(key));
    if (unknownInterface.length)
        packageError(`plugin.json 的 interface 包含不支持的字段：${unknownInterface.join(', ')}`);
    for (const field of ['displayName', 'shortDescription', 'longDescription', 'developerName', 'category'])
        requireText(ui, field, `interface.${field}`);
    if (!Array.isArray(ui.capabilities) || !ui.capabilities.length || ui.capabilities.some(value => typeof value !== 'string' || !value.trim()))
        packageError('plugin.json 的 interface.capabilities 必须是非空字符串数组');
    const prompts = ui.defaultPrompt ?? ui.default_prompt;
    if (!Array.isArray(prompts) || !prompts.length || prompts.some(value => typeof value !== 'string' || !value.trim()))
        packageError('plugin.json 必须提供 interface.defaultPrompt 字符串数组');
    for (const field of ['websiteURL', 'privacyPolicyURL', 'termsOfServiceURL']) {
        if (ui[field] !== undefined && !/^https:\/\/[^/]+/i.test(String(ui[field])))
            packageError(`plugin.json 的 interface.${field} 必须是绝对 https:// URL`);
    }
    if (ui.brandColor !== undefined && !/^#[0-9A-F]{6}$/i.test(String(ui.brandColor)))
        packageError('plugin.json 的 interface.brandColor 必须使用 #RRGGBB');
    for (const field of ['composerIcon', 'logo', 'logoDark'])
        if (ui[field] !== undefined)
            validateAsset(files, ui[field], `interface.${field}`);
    if (ui.screenshots !== undefined) {
        if (!Array.isArray(ui.screenshots))
            packageError('plugin.json 的 interface.screenshots 必须是数组');
        ui.screenshots.forEach((item, index) => validateAsset(files, item, `interface.screenshots[${index}]`));
    }
    const skillFolders = new Set();
    for (const file of files.filter(item => item.path.startsWith('skills/'))) {
        const parts = file.path.split('/');
        if (parts.length >= 3 && !parts[1].startsWith('.'))
            skillFolders.add(parts[1]);
    }
    for (const folder of skillFolders)
        validateSkillFiles(files, `skills/${folder}/SKILL.md`);
    let mcpMap = {};
    if (typeof manifest.mcpServers === 'object' && manifest.mcpServers)
        mcpMap = manifest.mcpServers;
    if (typeof manifest.mcpServers === 'string' || (manifest.mcpServers === undefined && findFile(files, '.mcp.json', false))) {
        const companion = parseJsonFile(files, '.mcp.json');
        const unknown = Object.keys(companion).filter(key => key !== 'mcpServers');
        if (unknown.length)
            packageError(`.mcp.json 包含不支持的字段：${unknown.join(', ')}`);
        mcpMap = companion.mcpServers;
    }
    if (mcpMap && (typeof mcpMap !== 'object' || Array.isArray(mcpMap)))
        packageError('插件 MCP 配置必须是 server 对象');
    for (const [serverName, server] of Object.entries(mcpMap || {})) {
        if (!serverName.trim() || !server || typeof server !== 'object' || Array.isArray(server))
            packageError(`插件 MCP server ${serverName || '(空名称)'} 配置无效`);
        normalizeImportedMcp(serverName, server, [], { pluginPackage: true });
    }
    if (manifest.apps !== undefined) {
        const appManifest = parseJsonFile(files, '.app.json');
        const unknown = Object.keys(appManifest).filter(key => key !== 'apps');
        if (unknown.length || !appManifest.apps || typeof appManifest.apps !== 'object' || Array.isArray(appManifest.apps))
            packageError('.app.json 必须只包含 apps 对象');
        for (const [appName, app] of Object.entries(appManifest.apps)) {
            if (!app || typeof app !== 'object' || Array.isArray(app))
                packageError(`.app.json 的 app ${appName} 必须是对象`);
            const appUnknown = Object.keys(app).filter(key => !['id', 'category'].includes(key));
            if (appUnknown.length || typeof app.id !== 'string' || !app.id.trim())
                packageError(`.app.json 的 app ${appName} 配置无效`);
        }
    }
    return { manifest, name, version, description, skills: skillFolders.size, mcpServers: Object.keys(mcpMap || {}).length };
}
function inspectPlugin(input) {
    const rebased = rebaseAtMarker(packageFiles(input, 'plugin'), '.codex-plugin/plugin.json', '插件包');
    const details = validatePluginManifest(rebased.files);
    const destination = path.join(REPO_PLUGIN_ROOT, details.name);
    const existing = extensions.listPlugins().filter(item => item.id === details.name);
    const replaceable = existing.every(item => path.resolve(item.path) === path.resolve(destination));
    const conflicts = existing.length || fs.existsSync(destination) ? [{ id: details.name, path: destination, replaceable }] : [];
    const warnings = executableWarnings(rebased.files);
    if (details.mcpServers)
        warnings.push(`插件包含 ${details.mcpServers} 个 MCP server；导入后插件默认停用，不会自动启动进程或连接网络`);
    if (rebased.ignoredFiles)
        warnings.push(`插件根目录之外的 ${rebased.ignoredFiles} 个文件不会导入`);
    return {
        kind: 'plugin',
        name: details.name,
        version: details.version,
        description: details.description,
        fingerprint: fingerprint(rebased.files),
        files: rebased.files,
        fileCount: rebased.files.length,
        totalBytes: rebased.files.reduce((sum, file) => sum + file.data.length, 0),
        components: { skills: details.skills, mcpServers: details.mcpServers },
        warnings,
        conflicts,
        destination,
        manifest: jsonClone(details.manifest),
    };
}
function mcpSlug(value) {
    const result = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
    if (!result || result.length > 64)
        packageError(`MCP server 名称无法转换成有效 ID：${value}`);
    return result;
}
function secretInArgs(args) {
    return (args || []).some((value, index) => {
        const text = String(value);
        return /--?(?:api[-_]?key|token|secret|password|authorization)=.+/i.test(text)
            || (index > 0 && /^--?(?:api[-_]?key|token|secret|password|authorization)$/i.test(String(args[index - 1])));
    });
}
function environmentReference(value) {
    const match = /^\$\{(?:env:)?([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(String(value || '').trim());
    return match && match[1] !== 'PLUGIN_ROOT' ? match[1] : null;
}
function looksLikeLiteralCredential(value) {
    const withoutReferences = String(value || '').replace(ENV_REFERENCE_RE, '').trim();
    if (!withoutReferences)
        return false;
    return /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i.test(withoutReferences)
        || /\b(?:Bearer|Basic)\s+\S+/i.test(withoutReferences)
        || /\b(?:sk-[A-Za-z0-9_-]{8,}|AKIA[0-9A-Z]{12,}|ASIA[0-9A-Z]{12,}|ghp_[A-Za-z0-9]{12,}|github_pat_[A-Za-z0-9_]{12,}|xox[baprs]-[A-Za-z0-9-]{8,})\b/.test(withoutReferences)
        || /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/.test(withoutReferences)
        || /(?:api[-_]?key|access[-_]?key|token|secret|password|authorization|credential|session)\s*[=:]\s*[^\s;,]{4,}/i.test(withoutReferences);
}
function validatePluginCredentialMap(serverName, values, kind) {
    for (const [key, rawValue] of Object.entries(values || {})) {
        const value = String(rawValue);
        if (kind === 'env' && !environmentReference(value)) {
            packageError(`插件 MCP server ${serverName} 的 env.${key} 必须使用 \${ENV_VAR} 环境变量引用，不能在插件包中保存字面量值`);
        }
        if (kind === 'header') {
            const direct = environmentReference(value);
            const authorization = /^(?:Bearer|Basic)\s+(\$\{(?:env:)?[A-Za-z_][A-Za-z0-9_]*\})$/i.exec(value.trim());
            const safeStaticHeader = /^(?:accept|content-type|user-agent)$/i.test(key);
            if (!safeStaticHeader && !direct && (!authorization || !environmentReference(authorization[1]))) {
                packageError(`插件 MCP server ${serverName} 的 header ${key} 必须使用环境变量引用，不能在插件包中保存字面量值`);
            }
        }
        if (looksLikeLiteralCredential(value)) {
            packageError(`插件 MCP server ${serverName} 的 ${kind}.${key} 疑似包含字面量凭据；请改用 \${ENV_VAR} 环境变量引用`);
        }
    }
}
function mcpInput(input) {
    const fileName = String(input?.fileName || '').trim();
    let data;
    if (Array.isArray(input?.files)) {
        const files = readFileList(input.files);
        if (files.length !== 1)
            packageError('MCP 导入每次请选择一个 JSON 文件');
        data = files[0].data;
    }
    else
        data = decodeBase64(input?.contentBase64, fileName || 'MCP 配置', MAX_MCP_CONFIG_BYTES);
    if (data.length > MAX_MCP_CONFIG_BYTES)
        packageError('MCP 配置超过 2 MB 限制');
    let parsed;
    try {
        parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data));
    }
    catch {
        packageError('MCP 配置必须是 UTF-8 JSON 文件');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        packageError('MCP 配置顶层必须是 JSON 对象');
    const map = (parsed.mcpServers || parsed.mcp_servers || parsed.servers || extensions.mcpServerMap(parsed));
    if (!map || typeof map !== 'object' || Array.isArray(map) || !Object.keys(map).length)
        packageError('没有找到 mcpServers 配置');
    const canonical = Buffer.from(JSON.stringify(map));
    return { map, fingerprint: crypto.createHash('sha256').update(canonical).digest('hex') };
}
function normalizeImportedMcp(name, raw, warnings, options = {}) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        packageError(`MCP server ${name} 配置必须是对象`);
    const id = mcpSlug(name);
    const type = String(raw.type || '').toLowerCase();
    if (type === 'sse')
        packageError(`MCP server ${name} 使用旧式 SSE；请改用 Streamable HTTP`);
    if (raw.url && raw.command)
        packageError(`MCP server ${name} 不能同时配置 url 和 command`);
    const transport = raw.url || type === 'http' || type === 'streamable-http' ? 'http' : 'stdio';
    if (options.pluginPackage) {
        const allowed = new Set([
            'name', 'description', 'type',
            ...(transport === 'stdio'
                ? ['command', 'args', 'cwd', 'env']
                : ['url', 'headers', 'http_headers', 'bearer_token_env_var', 'bearerTokenEnvVar']),
        ]);
        const unknown = Object.keys(raw).filter(key => !allowed.has(key));
        if (unknown.length)
            packageError(`插件 MCP server ${name} 包含不支持的字段：${unknown.join(', ')}`);
    }
    const record = {
        id,
        name: String(raw.name || name).trim() || id,
        description: String(raw.description || '').trim(),
        transport,
        enabled: false,
        trustLevel: 'untrusted',
        allowPrivate: false,
        targets: ['multichat', 'codex'],
        source: { kind: 'managed', scope: 'project', imported: true },
    };
    if (transport === 'stdio') {
        record.command = String(raw.command || '').trim();
        if (!record.command)
            packageError(`MCP server ${name} 缺少 command`);
        if (raw.args !== undefined && (!Array.isArray(raw.args) || raw.args.some(value => typeof value !== 'string')))
            packageError(`MCP server ${name} 的 args 必须是字符串数组`);
        record.args = raw.args || [];
        if (secretInArgs(record.args))
            packageError(`MCP server ${name} 的 args 似乎包含密钥；请改用 env 环境变量后再导入`);
        record.cwd = String(raw.cwd || '').trim();
        if (raw.env !== undefined && (!raw.env || typeof raw.env !== 'object' || Array.isArray(raw.env) || Object.values(raw.env).some(value => typeof value !== 'string')))
            packageError(`MCP server ${name} 的 env 必须是字符串映射`);
        record.env = raw.env || {};
        if (options.pluginPackage)
            validatePluginCredentialMap(name, record.env, 'env');
    }
    else {
        record.url = String(raw.url || '').trim();
        if (!/^https?:\/\//i.test(record.url))
            packageError(`MCP server ${name} 必须提供 http(s) URL`);
        let parsedUrl;
        try {
            parsedUrl = new URL(record.url);
        }
        catch {
            packageError(`MCP server ${name} 的 URL 无效`);
        }
        if (parsedUrl.username || parsedUrl.password)
            packageError(`MCP server ${name} 的 URL 不能包含用户名或密码，请改用环境变量`);
        if ([...parsedUrl.searchParams.keys()].some(key => /(?:api[-_]?key|token|secret|password|authorization)/i.test(key)))
            packageError(`MCP server ${name} 的 URL 查询参数疑似包含密钥，请改用 bearer token 环境变量`);
        if (options.pluginPackage && raw.headers !== undefined && raw.http_headers !== undefined)
            packageError(`插件 MCP server ${name} 不能同时配置 headers 与 http_headers`);
        record.headers = raw.headers || raw.http_headers || {};
        if (!record.headers || typeof record.headers !== 'object' || Array.isArray(record.headers) || Object.values(record.headers).some(value => typeof value !== 'string'))
            packageError(`MCP server ${name} 的 headers 必须是字符串映射`);
        record.headers = { ...record.headers };
        if (options.pluginPackage)
            validatePluginCredentialMap(name, record.headers, 'header');
        record.bearerTokenEnvVar = String(raw.bearer_token_env_var || raw.bearerTokenEnvVar || '').trim();
        if (options.pluginPackage && raw.bearer_token_env_var !== undefined && raw.bearerTokenEnvVar !== undefined)
            packageError(`插件 MCP server ${name} 不能重复配置 bearer token 环境变量`);
        if (record.bearerTokenEnvVar && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(record.bearerTokenEnvVar))
            packageError(`MCP server ${name} 的 bearer token 环境变量名无效`);
        if (options.pluginPackage && record.bearerTokenEnvVar && Object.keys(record.headers).some(key => /^authorization$/i.test(key)))
            packageError(`插件 MCP server ${name} 不能同时配置 Authorization header 与 bearer token 环境变量`);
        if (Object.keys(record.headers).length) {
            record.targets = ['multichat'];
            warnings.push(`${name} 含静态 HTTP headers，因此不会自动同步到 Codex；如需同步，请改用 bearer token 环境变量`);
        }
    }
    return record;
}
function inspectMcp(input) {
    const parsed = mcpInput(input);
    const warnings = ['所有导入的 MCP server 都将保持停用和未信任状态，确认配置后再手动启用'];
    const servers = Object.entries(parsed.map).map(([name, raw]) => normalizeImportedMcp(name, raw, warnings));
    if (servers.length > 50)
        packageError('一次最多导入 50 个 MCP server');
    const ids = new Set();
    for (const server of servers) {
        if (ids.has(server.id))
            packageError(`多个 MCP server 会生成同一个 ID：${server.id}`);
        ids.add(server.id);
    }
    const existing = new Map(extensions.listMcpServers().map((server) => [String(server.id), server]));
    const conflicts = servers.filter(server => existing.has(server.id)).map(server => {
        const current = existing.get(server.id);
        return { id: server.id, source: current.source?.kind || 'unknown', replaceable: current.source?.kind === 'managed' };
    });
    return {
        kind: 'mcp',
        name: servers.length === 1 ? servers[0].name : `${servers.length} 个 MCP servers`,
        description: '标准 MCP JSON 配置',
        fingerprint: parsed.fingerprint,
        servers,
        serverCount: servers.length,
        warnings,
        conflicts,
    };
}
function publicInspection(result) {
    const safe = { ...result };
    const files = safe.files;
    const servers = safe.servers;
    delete safe.files;
    delete safe.servers;
    delete safe.manifest;
    delete safe.destination;
    if (files)
        safe.fileTree = files.map(file => file.path).slice(0, 600);
    if (servers) {
        safe.servers = servers.map(server => ({
            id: server.id,
            name: server.name,
            transport: server.transport,
            command: server.command,
            url: (() => {
                if (!server.url)
                    return undefined;
                try {
                    const value = new URL(server.url);
                    if (value.username)
                        value.username = 'redacted';
                    if (value.password)
                        value.password = 'redacted';
                    for (const key of [...value.searchParams.keys()])
                        value.searchParams.set(key, '***');
                    return value.toString();
                }
                catch {
                    return String(server.url).replace(/([?&][^=]+)=([^&]+)/g, '$1=***');
                }
            })(),
            targets: server.targets,
        }));
    }
    return safe;
}
function inspect(kind, input) {
    if (kind === 'skill')
        return publicInspection(inspectSkill(input));
    if (kind === 'mcp')
        return publicInspection(inspectMcp(input));
    if (kind === 'plugin')
        return publicInspection(inspectPlugin(input));
    throw new AppError('NOT_FOUND', '不支持的导入类型');
}
function assertInstallRequest(result, input) {
    if (!input?.expectedFingerprint || input.expectedFingerprint !== result.fingerprint) {
        throw new AppError('CONFLICT', '导入文件在预检后发生了变化，请重新预检');
    }
    const policy = input.conflictPolicy === 'replace' ? 'replace' : 'reject';
    if (result.conflicts.length && policy !== 'replace')
        throw new AppError('CONFLICT', '存在同名项目，请在预检页明确选择覆盖');
    if (policy === 'replace' && result.conflicts.some(item => item.replaceable === false))
        throw new AppError('PERMISSION_DENIED', '冲突项来自其他来源，不能由本次导入覆盖');
    return policy;
}
function writePackageAtomically(files, destination, policy) {
    const root = path.dirname(destination);
    const resolvedRoot = path.resolve(root);
    const resolvedDestination = path.resolve(destination);
    if (resolvedDestination === resolvedRoot || !resolvedDestination.startsWith(resolvedRoot + path.sep))
        throw new AppError('PERMISSION_DENIED', '导入目标越过受管目录');
    fs.mkdirSync(root, { recursive: true });
    const nonce = `${process.pid}-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`;
    const stage = path.join(root, `.multichat-import-${nonce}`);
    const backup = path.join(root, `.multichat-backup-${nonce}`);
    try {
        fs.mkdirSync(stage, { recursive: false });
        for (const file of files) {
            const target = path.resolve(stage, ...file.path.split('/'));
            if (target === path.resolve(stage) || !target.startsWith(path.resolve(stage) + path.sep))
                throw new AppError('PERMISSION_DENIED', `文件路径越界：${file.path}`);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, file.data, { flag: 'wx' });
        }
        if (fs.existsSync(destination)) {
            if (policy !== 'replace')
                throw new AppError('CONFLICT', '目标已存在');
            fs.renameSync(destination, backup);
        }
        fs.renameSync(stage, destination);
        return {
            rollback() {
                if (fs.existsSync(destination))
                    fs.rmSync(destination, { recursive: true, force: true });
                if (fs.existsSync(backup))
                    fs.renameSync(backup, destination);
            },
            commit() {
                if (fs.existsSync(backup)) {
                    try {
                        fs.rmSync(backup, { recursive: true, force: true });
                    }
                    catch {
                        // The active destination is already committed. A stale hidden
                        // backup is safer than reporting failure after a successful swap.
                    }
                }
            },
        };
    }
    catch (error) {
        if (fs.existsSync(stage))
            fs.rmSync(stage, { recursive: true, force: true });
        if (!fs.existsSync(destination) && fs.existsSync(backup))
            fs.renameSync(backup, destination);
        throw error;
    }
}
function installSkill(input) {
    const result = inspectSkill(input);
    const policy = assertInstallRequest(result, input);
    const transaction = writePackageAtomically(result.files, result.destination, policy);
    try {
        const written = extensions.listSkills().find(skill => path.resolve(skill.directory) === path.resolve(result.destination));
        if (!written)
            throw new AppError('INVALID_PACKAGE', 'Skill 写入后无法被项目发现');
        extensions.setSkillEnabled(written.key, false);
        transaction.commit();
    }
    catch (error) {
        transaction.rollback();
        throw error;
    }
    const item = extensions.listSkills().find(skill => path.resolve(skill.directory) === path.resolve(result.destination));
    return { ok: true, kind: 'skill', item, fingerprint: result.fingerprint };
}
function marketplaceForPlugin(result) {
    const file = extensions.REPO_MARKETPLACE;
    let marketplace = { name: 'multichat-project', interface: { displayName: 'MultiChat 项目插件' }, plugins: [] };
    if (fs.existsSync(file)) {
        try {
            marketplace = JSON.parse(fs.readFileSync(file, 'utf8'));
        }
        catch {
            packageError('项目 marketplace.json 已损坏，无法安全更新');
        }
    }
    if (!marketplace || typeof marketplace !== 'object' || !Array.isArray(marketplace.plugins))
        packageError('项目 marketplace.json 格式无效');
    const entry = {
        name: result.name,
        source: { source: 'local', path: `./plugins/${result.name}` },
        policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
        category: String(result.manifest.interface?.category || 'Other'),
    };
    const index = marketplace.plugins.findIndex(item => item?.name === result.name);
    if (index >= 0)
        marketplace.plugins[index] = entry;
    else
        marketplace.plugins.push(entry);
    return { file, marketplace };
}
function atomicJson(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.multichat-${process.pid}-${crypto.randomBytes(5).toString('hex')}.tmp`;
    try {
        fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
        fs.renameSync(temp, file);
    }
    finally {
        if (fs.existsSync(temp))
            fs.rmSync(temp, { force: true });
    }
}
function installPlugin(input) {
    const result = inspectPlugin(input);
    const policy = assertInstallRequest(result, input);
    const marketplace = marketplaceForPlugin(result);
    const previousMarketplace = fs.existsSync(marketplace.file) ? fs.readFileSync(marketplace.file) : null;
    const transaction = writePackageAtomically(result.files, result.destination, policy);
    let item;
    try {
        atomicJson(marketplace.file, marketplace.marketplace);
        item = extensions.listPlugins().find(plugin => plugin.id === result.name && path.resolve(plugin.path) === path.resolve(result.destination));
        if (!item)
            throw new AppError('INVALID_PACKAGE', '插件写入后无法被项目 marketplace 发现');
        extensions.markPluginImported(item.key || item.id);
        transaction.commit();
    }
    catch (error) {
        transaction.rollback();
        if (previousMarketplace)
            fs.writeFileSync(marketplace.file, previousMarketplace);
        else if (fs.existsSync(marketplace.file))
            fs.rmSync(marketplace.file, { force: true });
        throw error;
    }
    return { ok: true, kind: 'plugin', item: extensions.listPlugins().find(plugin => plugin.id === result.name && path.resolve(plugin.path) === path.resolve(result.destination)), fingerprint: result.fingerprint };
}
function installMcp(input) {
    const result = inspectMcp(input);
    const policy = assertInstallRequest(result, input);
    const items = extensions.importMcpServers(result.servers, policy);
    return { ok: true, kind: 'mcp', items, fingerprint: result.fingerprint };
}
function install(kind, input) {
    if (kind === 'skill')
        return installSkill(input);
    if (kind === 'mcp')
        return installMcp(input);
    if (kind === 'plugin')
        return installPlugin(input);
    throw new AppError('NOT_FOUND', '不支持的导入类型');
}
module.exports = {
    MAX_ARCHIVE_BYTES,
    inspect,
    install,
    _test: { safeArchivePath, readZip, inspectSkill, inspectMcp, inspectPlugin, fingerprint },
};
//# sourceMappingURL=importer.js.map