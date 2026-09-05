import { useEffect, useState, type ButtonHTMLAttributes, type ComponentType, type ReactNode } from 'react';
import {
  Activity,
  Bot,
  Box,
  Braces,
  CheckCircle2,
  ChevronDown,
  Cpu,
  FileText,
  FlaskConical,
  FolderKanban,
  GitFork,
  Home,
  Layers3,
  Menu,
  ListChecks,
  MessageSquarePlus,
  PanelRight,
  Moon,
  PlugZap,
  Search,
  Settings,
  SlidersHorizontal,
  Sun,
  X,
  Zap,
} from 'lucide-react';
import { ConversationComposer, WorkspaceContent } from '../components/WorkspaceContent';
import { WorkspaceRail } from '../components/WorkspaceRail';
import { BrandMark } from '../components/BrandMark';
import {
  openWorkflowRail,
  setWorkflowRailOpen,
  syncWorkflowRailLayout,
  workflowRailUsesDrawer,
} from '../components/workflowRailDom';
import { getTheme, setTheme, type ThemePreference } from '../core/theme';
import { useAppStore } from '../store/appStore';

type Icon = ComponentType<{ size?: number; strokeWidth?: number; className?: string; 'aria-hidden'?: boolean }>;
type SettingsItem = { tab: string; label: string; icon: Icon };

const settingsGroups: Array<{ label: string; items: SettingsItem[] }> = [
  {
    label: '工作台',
    items: [
      { tab: 'general', label: '偏好设置', icon: SlidersHorizontal },
      { tab: 'workspace', label: '项目与文件', icon: FolderKanban },
      { tab: 'providers', label: '模型连接', icon: Layers3 },
      { tab: 'experiment', label: '模型实验', icon: FlaskConical },
    ],
  },
  {
    label: '能力编排',
    items: [
      { tab: 'agents', label: '运行配置', icon: Bot },
      { tab: 'skills', label: 'Skills', icon: FileText },
      { tab: 'tools', label: '内置工具', icon: Braces },
      { tab: 'mcp', label: 'MCP', icon: PlugZap },
      { tab: 'plugins', label: '插件', icon: Box },
    ],
  },
  {
    label: '观察与治理',
    items: [
      { tab: 'capabilities', label: '能力清单', icon: CheckCircle2 },
      { tab: 'usage', label: '用量', icon: Activity },
      { tab: 'runs', label: '运行日志', icon: Zap },
    ],
  },
];

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: Icon;
  children?: ReactNode;
};

function IconButton({ label, title, icon: IconView, children, className = 'icon-btn', ...props }: IconButtonProps) {
  return (
    <button className={className} aria-label={label} title={title || label} {...props}>
      <IconView size={16} strokeWidth={1.8} aria-hidden />
      {children}
    </button>
  );
}

function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>(() => getTheme());
  useEffect(() => {
    const sync = () => setPreference(getTheme());
    window.addEventListener('multichat:themechange', sync);
    return () => window.removeEventListener('multichat:themechange', sync);
  }, []);
  const dark =
    preference === 'dark' || (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const next = dark ? 'light' : 'dark';
  return (
    <IconButton
      className="icon-btn theme-toggle"
      label={dark ? '切换到浅色主题' : '切换到深色主题'}
      icon={dark ? Sun : Moon}
      onClick={() => {
        setTheme(next);
        setPreference(next);
      }}
    />
  );
}

export function AppShell() {
  const actions = useAppStore((current) => current.actions);
  const closeMobileSidebar = () => {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar?.classList.contains('open')) return;
    sidebar.classList.remove('open');
    document.getElementById('mobileScrim')?.classList.remove('open');
    document.getElementById('sidebarToggle')?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('mobile-nav-open');
    const main = document.querySelector<HTMLElement>('.main');
    if (main) main.inert = false;
  };
  const openSection = (tab: string) => {
    closeMobileSidebar();
    actions.openSettings?.(tab);
  };
  useEffect(() => {
    const onResize = () => syncWorkflowRailLayout();
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        workflowRailUsesDrawer() &&
        document.body.classList.contains('workflow-rail-open')
      ) {
        event.preventDefault();
        setWorkflowRailOpen(false, { restoreFocus: true });
      }
    };
    syncWorkflowRailLayout();
    window.addEventListener('resize', onResize);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <>
      <div className="app" id="app">
        <aside className="sidebar" id="sidebar" aria-label="MultiChat 主导航">
          <div className="brand">
            <BrandMark className="brand-logo" size={36} />
            <div className="brand-copy">
              <strong>MultiChat</strong>
              <span>多模型运行工作台</span>
            </div>
            <IconButton id="sidebarClose" className="sidebar-close" label="关闭对话导航" icon={X} />
          </div>
          <button className="new-chat" id="newChatBtn">
            <MessageSquarePlus size={17} strokeWidth={1.8} aria-hidden />
            <span>新建对话</span>
            <kbd>Ctrl N</kbd>
          </button>
          <nav className="workspace-nav" aria-label="工作台导航">
            <div className="workspace-nav-label">工作台</div>
            <button
              className="workspace-nav-item active"
              type="button"
              onClick={() => {
                closeMobileSidebar();
                void actions.newConversation?.();
              }}
            >
              <Home size={16} aria-hidden />
              <span>对话首页</span>
            </button>
            <button className="workspace-nav-item" type="button" onClick={() => openSection('workspace')}>
              <FolderKanban size={16} aria-hidden />
              <span>项目与文件</span>
            </button>
            <button className="workspace-nav-item" type="button" onClick={() => openSection('agents')}>
              <Bot size={16} aria-hidden />
              <span>智能体</span>
            </button>
            <button className="workspace-nav-item" type="button" onClick={() => openSection('experiment')}>
              <FlaskConical size={16} aria-hidden />
              <span>模型实验</span>
            </button>
            <button className="workspace-nav-item" type="button" onClick={() => openSection('runs')}>
              <Activity size={16} aria-hidden />
              <span>运行记录</span>
            </button>
            <div className="workspace-nav-label compact">能力</div>
            <button className="workspace-nav-item" type="button" onClick={() => openSection('skills')}>
              <FileText size={16} aria-hidden />
              <span>Skills</span>
            </button>
            <button className="workspace-nav-item" type="button" onClick={() => openSection('mcp')}>
              <PlugZap size={16} aria-hidden />
              <span>MCP</span>
            </button>
            <button className="workspace-nav-item" type="button" onClick={() => openSection('plugins')}>
              <Box size={16} aria-hidden />
              <span>插件</span>
            </button>
            <button className="workspace-nav-item" type="button" onClick={() => openSection('usage')}>
              <Zap size={16} aria-hidden />
              <span>Token 用量</span>
            </button>
          </nav>
          <section className="sidebar-conversations" aria-label="最近对话">
            <label className="conv-search-wrap">
              <Search size={15} strokeWidth={1.8} aria-hidden />
              <input className="conv-search" id="convSearch" placeholder="搜索对话" aria-label="搜索对话" />
            </label>
            <div className="conv-section-title">
              <span>最近对话</span>
              <small>本机保存</small>
            </div>
            <div className="conv-list" id="convList">
              <div className="sidebar-empty">还没有对话</div>
            </div>
          </section>
          <div className="sidebar-footer">
            <button className="sidebar-settings" id="settingsBtn" type="button" onClick={() => openSection('general')}>
              <Settings size={16} aria-hidden />
              <span>设置</span>
            </button>
            <div className="sidebar-local" title="模型凭据、项目与对话默认保存在当前设备">
              <span className="status-pulse" />
              <span>
                <strong>本机工作区</strong>
                <small>数据保存在此设备</small>
              </span>
              <Cpu size={14} aria-hidden />
            </div>
          </div>
        </aside>

        <div className="workspace-frame">
          <header className="topbar">
            <IconButton
              id="sidebarToggle"
              className="mobile-menu"
              label="打开对话导航"
              icon={Menu}
              aria-expanded="false"
            />
            <div className="topbar-context">
              <div className="topbar-title" id="topbarTitle">
                新对话
              </div>
              <div className="topbar-path" id="topbarPath">
                未添加项目文件夹
              </div>
            </div>
            <button
              className="global-search"
              id="commandBtn"
              type="button"
              aria-label="搜索功能与命令"
              aria-haspopup="dialog"
              aria-controls="commandPalette"
            >
              <Search size={15} aria-hidden />
              <span>搜索功能与命令</span>
              <kbd>Ctrl K</kbd>
            </button>
            <div className="topbar-spacer" />
            <button className="model-picker workspace-picker" id="workspacePicker">
              <FolderKanban size={15} aria-hidden />
              <span className="mp-name" id="workspacePickerName">
                添加项目
              </span>
              <ChevronDown size={14} aria-hidden />
            </button>
            <button className="model-picker" id="agentPicker">
              <span className="picker-status" aria-hidden />
              <span className="mp-name" id="agentPickerName">
                直接对话
              </span>
              <ChevronDown size={14} aria-hidden />
            </button>
            <IconButton id="forkBtn" label="创建分支" title="从当前对话创建分支" icon={GitFork}>
              <span className="icon-btn-label">分支</span>
            </IconButton>
            <IconButton
              id="workflowRailToggle"
              label="开发工作台"
              title="打开任务计划与运行配置"
              icon={ListChecks}
              aria-controls="workflowRail"
              aria-expanded="false"
              onClick={() => openWorkflowRail('run')}
            >
              <span className="icon-btn-label">任务</span>
            </IconButton>
            <IconButton
              id="inspectorBtn"
              label="上下文检查"
              icon={PanelRight}
              aria-controls="sessionInspector"
              aria-expanded="false"
            >
              <span className="icon-btn-label">上下文</span>
            </IconButton>
            <ThemeToggle />
          </header>

          <main className="main" id="mainWorkspace">
            <div className="content" id="content">
              <WorkspaceContent />
            </div>
            <ConversationComposer />

            <aside className="session-inspector" id="sessionInspector" aria-label="会话检查器" aria-hidden="true" inert>
              <div className="inspector-head">
                <div>
                  <strong>上下文检查</strong>
                  <span>核对模型真正收到的内容</span>
                </div>
                <IconButton id="inspectorClose" className="inspector-close" label="关闭上下文检查" icon={X} />
              </div>
              <div className="inspector-body" id="inspectorBody" />
            </aside>
          </main>
          <WorkspaceRail />
        </div>
      </div>

      <div className="mobile-scrim" id="mobileScrim" />
      <div className="scrim" id="scrim" />
      <div
        className="settings"
        id="settings"
        role="dialog"
        aria-modal="true"
        aria-label="MultiChat 设置"
        aria-hidden="true"
        inert
      >
        <aside className="settings-side">
          <div className="settings-brand">
            <BrandMark className="brand-logo" size={34} />
            <div>
              <strong>MultiChat 控制中心</strong>
              <span>配置、能力与运行</span>
            </div>
          </div>
          {settingsGroups.map((group) => (
            <div className="settings-nav-group" key={group.label}>
              <div className="settings-group-label">{group.label}</div>
              {group.items.map(({ tab, label, icon: ItemIcon }) => (
                <button className={`settings-tab${tab === 'general' ? ' active' : ''}`} data-tab={tab} key={tab}>
                  <ItemIcon className="tab-ico" size={17} strokeWidth={1.8} aria-hidden />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          ))}
          <div className="settings-side-spacer" />
          <button className="settings-tab settings-close-side" id="closeSettings">
            <X className="tab-ico" size={17} aria-hidden />
            <span>关闭</span>
          </button>
        </aside>
        <div className="settings-body" id="settingsBody" tabIndex={-1} />
        <div className="settings-top">
          <IconButton id="closeSettingsTop" className="icon-btn close-round" label="关闭设置" icon={X} />
        </div>
      </div>

      <div className="modal" id="modal" role="dialog" aria-modal="true" aria-live="polite" aria-hidden="true" inert>
        <div className="modal-card" id="modalCard" tabIndex={-1} />
      </div>
      <div className="toast" id="toast" role="status" aria-live="polite" />
      <div
        className="command-palette"
        id="commandPalette"
        role="dialog"
        aria-modal="true"
        aria-labelledby="commandTitle"
        aria-hidden="true"
        inert
      >
        <div className="command-panel">
          <div className="command-search-wrap">
            <Search size={17} aria-hidden />
            <input
              id="commandSearch"
              type="search"
              autoComplete="off"
              placeholder="搜索操作、设置或能力"
              aria-label="搜索命令"
            />
            <kbd>Esc</kbd>
          </div>
          <div className="command-caption" id="commandTitle">
            快速命令
          </div>
          <div className="command-list" id="commandList" />
        </div>
      </div>
    </>
  );
}
