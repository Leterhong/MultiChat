// 全局符号类型声明（MultiChat 前端 globalThis 装配模式）
//
// main.ts 将各模块的导出通过 Object.assign(globalThis, ns) 挂到全局，
// 业务函数之间保持裸名互调（零回归）。此处为这些全局符号提供宽松类型，
// 使 `tsc --noEmit` 类型检查门禁得以通过，同时不改变任何运行时行为。
// 模块内部通过 import 得到的符号仍保留其具体类型检查，从而能捕获真实类型错误。
export {};

declare global {
  // ── core ──
  const api: any;
  const esc: any;
  const toast: any;
  const state: any;
  const loadParams: any;
  const saveParams: any;
  const loadSelectedAgent: any;
  const saveSelectedAgent: any;

  // ── data ──
  const loadProviders: any;
  const loadRuntime: any;
  const loadRuns: any;
  const loadUsage: any;
  const loadCapabilities: any;
  const loadProjectControlData: any;
  const loadWorkspaces: any;
  const loadProjects: any;
  const loadSkills: any;
  const loadTools: any;
  const loadMcpServers: any;
  const loadAgents: any;
  const loadPlugins: any;

  // ── conversations ──
  const loadConversations: any;
  const renderConvList: any;
  const newConversation: any;
  const openConversation: any;
  const fmtSize: any;
  const renderFileContext: any;
  const applyProjectDefaults: any;

  // ── settings ──
  const openSettings: any;
  const closeSettings: any;
  const switchSettingsTab: any;
  const renderSettings: any;
  const showWorkspaceForm: any;
  const showProjectForm: any;
  const showAssetUrlModal: any;
  const renderRuns: any;
  const renderUsage: any;
  const renderCapabilities: any;
  const showRunDetail: any;
  const showMemoryModal: any;

  // ── modal ──
  const showModal: any;
  const closeModal: any;

  // ── modelPicker ──
  const openModelPicker: any;
  const renderTopbar: any;
  const syncModelUI: any;

  // ── render ──
  const renderContent: any;
  const renderApprovalCards: any;
  const renderMessage: any;
  const autoresize: any;

  // ── workbench ──
  const setupWorkbench: any;
  const renderInspector: any;
  const openInspector: any;
  const closeInspector: any;
  const toggleInspector: any;
  const openCommandPalette: any;
  const closeCommandPalette: any;

  // ── compare ──
  const openCompare: any;
  const setupCompare: any;

  // ── markdown ──
  const fmtTok: any;
  const renderMarkdown: any;

  // ── init ──
  const bootstrap: any;
  const initApp: any;
  const setupDrop: any;
  const forkConversation: any;

  // ── send ──
  const send: any;
  const updateSendBtn: any;
  const stopStream: any;
  const ensureConversation: any;
  const saveCurrentMessages: any;
  const streamReply: any;

  // ── pluginsUI ──
  const PLUGIN_ICON: any;
  const EXPORT_ICON: any;
  const sourceLabel: any;
  const renderPlugins: any;
  const renderMcpServers: any;
  const showDiff: any;
  const showExtensionImport: any;

  // ── importExport ──
  const importBarHTML: any;
  const doImport: any;
  const normalizeImport: any;
  const wireImportBar: any;
  const exportEntity: any;
  const showAgentModal: any;
  const showSkillModal: any;
  const BUILTIN_PROVIDERS: any;
  const showAddBuiltin: any;
  const showAddCustom: any;

  // ── 挂到 window 的入口对象 ──
  interface Window {
    MC: any;
  }
}
