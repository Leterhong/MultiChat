/* =================================================================
 *  MultiChat — 前端入口（Vite 工程化）
 *  业务分区已拆分到 ./modules/*，核心依赖在 ./core/*。
 *  本文件只负责装配：导入所有模块 → 挂到 globalThis（保持原单文件的
 *  全局调用语义，避免逐文件 import 全部交叉依赖，零回归）→ 启动 bootstrap。
 * ================================================================= */
import './styles.css';
import { applyTheme } from './core/theme';
import * as Core from './core/index';
import * as Shell from './modules/shell';
import * as Init from './modules/init';
import * as Data from './modules/data';
import * as Conversations from './modules/conversations';
import * as ModelPicker from './modules/modelPicker';
import * as AgentPicker from './modules/agentPicker';
import * as Settings from './modules/settings';
import * as PluginsUI from './modules/pluginsUI';
import * as ImportExport from './modules/importExport';
import * as ExtensionImport from './modules/extensionImport';
import * as Modal from './modules/modal';
import * as Render from './modules/render';
import * as Markdown from './modules/markdown';
import * as Send from './modules/send';
import * as Workbench from './modules/workbench';

// 装配层：把所有模块导出挂到 globalThis，使业务函数之间保持原全局调用关系。
const namespaces = [
  Core, Shell, Init, Data, Conversations, ModelPicker, AgentPicker,
  Settings, PluginsUI, ImportExport, ExtensionImport, Modal, Render, Markdown, Send, Workbench,
];
for (const ns of namespaces) Object.assign(globalThis, ns);

applyTheme();
window.addEventListener('DOMContentLoaded', () => { Shell.setupShell(); Workbench.setupWorkbench(); bootstrap(); });
window.MC = { state, send, newConversation, openSettings };
