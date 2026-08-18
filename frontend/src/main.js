/* =================================================================
 *  MultiChat — 前端入口（Vite 工程化）
 *  业务分区已拆分到 ./modules/*，核心依赖在 ./core/*。
 *  本文件只负责装配：导入所有模块 → 挂到 globalThis（保持原单文件的
 *  全局调用语义，避免逐文件 import 全部交叉依赖，零回归）→ 启动 bootstrap。
 * ================================================================= */
import './styles.css';
import * as Core from './core/index.js';
import * as Init from './modules/init.js';
import * as Data from './modules/data.js';
import * as Conversations from './modules/conversations.js';
import * as ModelPicker from './modules/modelPicker.js';
import * as AgentPicker from './modules/agentPicker.js';
import * as Settings from './modules/settings.js';
import * as PluginsUI from './modules/pluginsUI.js';
import * as ImportExport from './modules/importExport.js';
import * as Modal from './modules/modal.js';
import * as Render from './modules/render.js';
import * as Markdown from './modules/markdown.js';
import * as Send from './modules/send.js';

// 装配层：把所有模块导出挂到 globalThis，使业务函数之间保持原全局调用关系。
const namespaces = [
  Core, Init, Data, Conversations, ModelPicker, AgentPicker,
  Settings, PluginsUI, ImportExport, Modal, Render, Markdown, Send,
];
for (const ns of namespaces) Object.assign(globalThis, ns);

window.addEventListener('DOMContentLoaded', () => { bootstrap(); });
window.MC = { state, send, newConversation, openSettings };
