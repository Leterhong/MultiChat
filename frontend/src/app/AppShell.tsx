import { useEffect, useState, type ButtonHTMLAttributes, type ComponentType, type ReactNode } from 'react';
import {
  Activity, Blocks, Bot, Box, Braces, CheckCircle2, ChevronDown, Command,
  FileText, FlaskConical, FolderKanban, FolderPlus, GitFork, Layers3, Menu,
  MessageSquarePlus, PanelRight, Moon, PlugZap, Search, Settings,
  SlidersHorizontal, Sun, X, Zap,
} from 'lucide-react';
import { ConversationComposer, WorkspaceContent } from '../components/WorkspaceContent';
import { WorkspaceRail } from '../components/WorkspaceRail';
import { BrandMark } from '../components/BrandMark';
import { getTheme, setTheme, type ThemePreference } from '../core/theme';
import { useAppStore } from '../store/appStore';

type Icon = ComponentType<{ size?: number; strokeWidth?: number; className?: string; 'aria-hidden'?: boolean }>;
type SettingsItem = { tab: string; label: string; icon: Icon };

const settingsGroups: Array<{ label: string; items: SettingsItem[] }> = [
  { label: '工作台', items: [
    { tab: 'general', label: '偏好设置', icon: SlidersHorizontal },
    { tab: 'workspace', label: '工作区', icon: FolderKanban },
    { tab: 'providers', label: '模型连接', icon: Layers3 },
    { tab: 'experiment', label: '模型实验', icon: FlaskConical },
  ] },
  { label: '能力编排', items: [
    { tab: 'agents', label: '运行配置', icon: Bot },
    { tab: 'skills', label: 'Skills', icon: FileText },
    { tab: 'tools', label: '内置工具', icon: Braces },
    { tab: 'mcp', label: 'MCP', icon: PlugZap },
    { tab: 'plugins', label: '插件', icon: Box },
  ] },
  { label: '观察与治理', items: [
    { tab: 'capabilities', label: '能力清单', icon: CheckCircle2 },
    { tab: 'usage', label: '用量', icon: Activity },
    { tab: 'runs', label: '运行日志', icon: Zap },
  ] },
];

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: Icon;
  children?: ReactNode;
};

function IconButton({ label, title, icon: IconView, children, className = 'icon-btn', ...props }: IconButtonProps) {
  return <button className={className} aria-label={label} title={title || label} {...props}>
    <IconView size={16} strokeWidth={1.8} aria-hidden />{children}
  </button>;
}

function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>(() => getTheme());
  useEffect(() => {
    const sync = () => setPreference(getTheme());
    window.addEventListener('multichat:themechange', sync);
    return () => window.removeEventListener('multichat:themechange', sync);
  }, []);
  const dark = preference === 'dark' || (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const next = dark ? 'light' : 'dark';
  return <IconButton className="icon-btn theme-toggle" label={dark ? '切换到浅色主题' : '切换到深色主题'} icon={dark ? Sun : Moon} onClick={() => { setTheme(next); setPreference(next); }} />;
}

export function AppShell() {
  const actions = useAppStore((current) => current.actions);
  return <>
    <div className="app" id="app">
      <aside className="sidebar" id="sidebar" aria-label="对话导航">
        <div className="brand">
          <BrandMark className="brand-logo" size={36} />
          <div className="brand-copy"><strong>MultiChat</strong><span>多模型运行工作台</span></div>
          <IconButton id="sidebarClose" className="sidebar-close" label="关闭对话导航" icon={X} />
        </div>
        <button className="new-chat" id="newChatBtn">
          <MessageSquarePlus size={17} strokeWidth={1.8} aria-hidden /><span>新建对话</span><kbd>Ctrl N</kbd>
        </button>
        <label className="conv-search-wrap">
          <Search size={15} strokeWidth={1.8} aria-hidden />
          <input className="conv-search" id="convSearch" placeholder="搜索对话" aria-label="搜索对话" />
        </label>
        <div className="conv-section-title"><span>最近对话</span><small>本机保存</small></div>
        <div className="conv-list" id="convList"><div className="sidebar-empty">还没有对话</div></div>
        <nav className="sidebar-tools" aria-label="工作台入口">
          <span className="sidebar-tools-label">工作台</span>
          <button type="button" data-open-settings="providers"><Layers3 size={16} aria-hidden /><span>模型连接</span></button>
          <button type="button" data-open-settings="experiment"><FlaskConical size={16} aria-hidden /><span>模型实验</span></button>
          <button type="button" data-open-settings="capabilities"><Blocks size={16} aria-hidden /><span>能力中心</span></button>
          <button type="button" data-open-settings="runs"><Activity size={16} aria-hidden /><span>运行记录</span></button>
          <button type="button" data-open-settings="usage"><Zap size={16} aria-hidden /><span>Token 用量</span></button>
          <button type="button" data-open-settings="general"><Settings size={16} aria-hidden /><span>设置</span></button>
        </nav>
        <div className="sidebar-runtime"><span className="status-pulse" /><span>本机服务已连接</span><small>Local</small></div>
      </aside>

      <div className="workspace-frame">
        <header className="topbar">
          <IconButton id="sidebarToggle" className="mobile-menu" label="打开对话导航" icon={Menu} aria-expanded="false" />
          <div className="topbar-context"><div className="topbar-title" id="topbarTitle">新对话</div><div className="topbar-path" id="topbarPath">默认工作区 / 默认项目</div></div>
          <div className="topbar-spacer" />
          <button className="model-picker workspace-picker" id="workspacePicker"><span className="picker-prefix">项目</span><span className="mp-name" id="workspacePickerName">默认工作区</span><ChevronDown size={14} aria-hidden /></button>
          <button className="model-picker" id="agentPicker"><span className="picker-status" aria-hidden /><span className="mp-name" id="agentPickerName">直接对话</span><ChevronDown size={14} aria-hidden /></button>
          <IconButton id="folderImportBtn" label="添加项目文件夹" title="将本地项目文件夹导入当前对话上下文" icon={FolderPlus} onClick={() => void actions.importProjectFolder?.()}><span className="icon-btn-label">文件夹</span></IconButton>
          <IconButton id="forkBtn" label="创建分支" title="从当前对话创建分支" icon={GitFork}><span className="icon-btn-label">分支</span></IconButton>
          <button className="command-btn" id="commandBtn" type="button" aria-haspopup="dialog" aria-controls="commandPalette"><Command size={15} aria-hidden /><span>命令</span><kbd>Ctrl K</kbd></button>
          <IconButton id="inspectorBtn" label="上下文检查" icon={PanelRight} aria-controls="sessionInspector" aria-expanded="false"><span className="icon-btn-label">上下文</span></IconButton>
          <ThemeToggle />
          <IconButton id="settingsBtn" label="设置" icon={Settings} />
        </header>

        <main className="main" id="mainWorkspace">
          <div className="content" id="content"><WorkspaceContent /></div>
          <ConversationComposer />

          <aside className="session-inspector" id="sessionInspector" aria-label="会话检查器" aria-hidden="true" inert>
            <div className="inspector-head"><div><strong>上下文检查</strong><span>核对模型真正收到的内容</span></div><IconButton id="inspectorClose" className="inspector-close" label="关闭上下文检查" icon={X} /></div>
            <div className="inspector-body" id="inspectorBody" />
          </aside>
        </main>
        <WorkspaceRail />
      </div>
    </div>

    <div className="mobile-scrim" id="mobileScrim" />
    <div className="scrim" id="scrim" />
    <div className="settings" id="settings" role="dialog" aria-modal="true" aria-label="MultiChat 设置" aria-hidden="true" inert>
      <aside className="settings-side">
        <div className="settings-brand"><BrandMark className="brand-logo" size={34} /><div><strong>MultiChat 控制中心</strong><span>配置、能力与运行</span></div></div>
        {settingsGroups.map(group => <div className="settings-nav-group" key={group.label}>
          <div className="settings-group-label">{group.label}</div>
          {group.items.map(({ tab, label, icon: ItemIcon }) => <button className={`settings-tab${tab === 'general' ? ' active' : ''}`} data-tab={tab} key={tab}>
            <ItemIcon className="tab-ico" size={17} strokeWidth={1.8} aria-hidden /><span>{label}</span>
          </button>)}
        </div>)}
        <div className="settings-side-spacer" />
        <button className="settings-tab settings-close-side" id="closeSettings"><X className="tab-ico" size={17} aria-hidden /><span>关闭</span></button>
      </aside>
      <div className="settings-body" id="settingsBody" tabIndex={-1} />
      <div className="settings-top"><IconButton id="closeSettingsTop" className="icon-btn close-round" label="关闭设置" icon={X} /></div>
    </div>

    <div className="modal" id="modal" role="dialog" aria-modal="true" aria-live="polite" aria-hidden="true" inert><div className="modal-card" id="modalCard" tabIndex={-1} /></div>
    <div className="toast" id="toast" role="status" aria-live="polite" />
    <div className="command-palette" id="commandPalette" role="dialog" aria-modal="true" aria-labelledby="commandTitle" aria-hidden="true" inert>
      <div className="command-panel"><div className="command-search-wrap"><Search size={17} aria-hidden /><input id="commandSearch" type="search" autoComplete="off" placeholder="搜索操作、设置或能力" aria-label="搜索命令" /><kbd>Esc</kbd></div><div className="command-caption" id="commandTitle">快速命令</div><div className="command-list" id="commandList" /></div>
    </div>
  </>;
}
