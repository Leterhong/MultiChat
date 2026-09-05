import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentType,
  type ReactNode,
} from 'react';
import {
  Activity,
  Bot,
  ChevronDown,
  Command,
  FolderKanban,
  GitFork,
  Home,
  Menu,
  MessageSquare,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRight,
  Pencil,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { BrandMark } from '../components/BrandMark';
import { WorkspaceContent } from '../components/WorkspaceContent';
import { WorkspaceRail } from '../components/WorkspaceRail';
import { openWorkflowRail, setWorkflowRailOpen, syncWorkflowRailLayout } from '../components/workflowRailDom';
import { getTheme, setTheme, type ThemePreference } from '../core/theme';
import { useAppStore, useBusinessStore, type TaskMode } from '../store/appStore';
import { formatRecentTime } from '../utils/format';

type Icon = ComponentType<{ size?: number; strokeWidth?: number; className?: string; 'aria-hidden'?: boolean }>;
type SettingsItem = { tab: string; label: string; icon: Icon };

const settingsGroups: Array<{ label: string; items: SettingsItem[] }> = [
  {
    label: '工作空间',
    items: [
      { tab: 'general', label: '通用与外观', icon: Settings },
      { tab: 'workspace', label: '项目、文件与记忆', icon: FolderKanban },
      { tab: 'providers', label: '模型', icon: Sparkles },
      { tab: 'agents', label: '智能体', icon: Bot },
      { tab: 'experiment', label: '模型对比', icon: Activity },
    ],
  },
  {
    label: '能力与记录',
    items: [
      { tab: 'skills', label: 'Skills', icon: Sparkles },
      { tab: 'tools', label: '工具', icon: Command },
      { tab: 'mcp', label: 'MCP', icon: Activity },
      { tab: 'plugins', label: '插件', icon: Plus },
      { tab: 'capabilities', label: '能力审计', icon: MoreHorizontal },
      { tab: 'runs', label: '运行记录', icon: Activity },
      { tab: 'usage', label: 'Token 用量', icon: Activity },
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
  return (
    <IconButton
      label={dark ? '切换到浅色主题' : '切换到深色主题'}
      icon={dark ? Sun : Moon}
      onClick={() => {
        const next = dark ? 'light' : 'dark';
        setTheme(next);
        setPreference(next);
      }}
    />
  );
}

function taskModeLabel(mode: TaskMode) {
  return mode === 'agent' ? '智能体任务' : mode === 'compare' ? '模型对比' : '新对话';
}

export function AppShell() {
  const actions = useAppStore((current) => current.actions);
  const workspaceView = useAppStore((current) => current.workspaceView);
  const setWorkspaceView = useAppStore((current) => current.setWorkspaceView);
  const taskMode = useAppStore((current) => current.taskMode);
  const setTaskMode = useAppStore((current) => current.setTaskMode);
  const selectedWorkspace = useBusinessStore((current) => current.selectedWorkspace) as any;
  const selectedProject = useBusinessStore((current) => current.selectedProject) as any;
  const selectedAgent = useBusinessStore((current) => current.selectedAgent) as any;
  const currentConvId = useBusinessStore((current) => current.currentConvId);
  const conversations = useBusinessStore((current) => current.conversations) as any[];
  const streaming = useBusinessStore((current) => current.streaming);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('multichat_sidebar_collapsed') === 'true');
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const newTaskRef = useRef<HTMLDivElement>(null);

  const conversationTitle = useMemo(
    () => conversations.find((item) => item.id === currentConvId)?.title || '新任务',
    [conversations, currentConvId]
  );
  const pageTitle = workspaceView === 'home' ? '新任务' : conversationTitle;
  const projectName = selectedProject?.id === 'pr_inbox' ? '临时任务' : selectedProject?.name || '未打开项目';
  const workspaceName = selectedWorkspace?.name || '本机工作区';

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

  const goHome = () => {
    closeMobileSidebar();
    setWorkspaceView('home');
    if (location.hash !== '#/home') history.pushState(null, '', '#/home');
  };

  const showAllWork = () => {
    closeMobileSidebar();
    setWorkspaceView('chat');
    if (currentConvId) {
      const route = `#/chat/${encodeURIComponent(currentConvId)}`;
      if (location.hash !== route) history.pushState(null, '', route);
    } else if (location.hash !== '#/new') history.pushState(null, '', '#/new');
  };

  const startTask = (mode: TaskMode) => {
    setNewTaskOpen(false);
    closeMobileSidebar();
    setTaskMode(mode);
    if (mode === 'compare') {
      actions.openCompare?.();
      return;
    }
    void actions.newConversation?.().then(() => {
      if (mode === 'agent') document.getElementById('agentPicker')?.click();
    });
  };

  const openSettings = (tab = 'general') => {
    closeMobileSidebar();
    actions.openSettings?.(tab);
  };

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!newTaskRef.current?.contains(event.target as Node)) setNewTaskOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => {
    const onResize = () => syncWorkflowRailLayout();
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        setCollapsed((value) => {
          const next = !value;
          localStorage.setItem('multichat_sidebar_collapsed', String(next));
          return next;
        });
      }
      if (event.key === 'Escape' && document.body.classList.contains('workflow-rail-open')) {
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
      <div className={`app${collapsed ? ' shell-collapsed' : ''}`} id="app">
        <aside className="sidebar" id="sidebar" aria-label="MultiChat 主导航">
          <div className="brand">
            <BrandMark className="brand-logo" size={32} />
            <div className="brand-copy">
              <strong>MultiChat</strong>
              <span>AI Workspace</span>
            </div>
            <IconButton id="sidebarClose" className="sidebar-close" label="关闭主导航" icon={X} />
            <IconButton
              className="sidebar-collapse"
              label={collapsed ? '展开主导航' : '折叠主导航'}
              title={`${collapsed ? '展开' : '折叠'}主导航 · Ctrl B`}
              icon={collapsed ? PanelLeftOpen : PanelLeftClose}
              onClick={() => {
                const next = !collapsed;
                setCollapsed(next);
                localStorage.setItem('multichat_sidebar_collapsed', String(next));
              }}
            />
          </div>

          <button className="sidebar-workspace-switcher" id="workspacePicker" type="button">
            <span className="workspace-switcher-mark">{projectName.slice(0, 1)}</span>
            <span>
              <strong id="workspacePickerName">{projectName}</strong>
              <small>{workspaceName}</small>
            </span>
            <ChevronDown size={14} aria-hidden />
          </button>

          <div className="new-task" ref={newTaskRef}>
            <button
              className="new-task-button"
              type="button"
              aria-haspopup="menu"
              aria-expanded={newTaskOpen}
              onClick={() => setNewTaskOpen((value) => !value)}
            >
              <Plus size={16} aria-hidden />
              <span>新任务</span>
              <ChevronDown size={14} aria-hidden />
            </button>
            {newTaskOpen && (
              <div className="new-task-menu" role="menu" aria-label="选择任务模式">
                {(['chat', 'agent', 'compare'] as TaskMode[]).map((mode) => (
                  <button type="button" role="menuitem" key={mode} onClick={() => startTask(mode)}>
                    {mode === 'chat' ? (
                      <MessageSquare size={15} aria-hidden />
                    ) : mode === 'agent' ? (
                      <Bot size={15} aria-hidden />
                    ) : (
                      <Activity size={15} aria-hidden />
                    )}
                    <span>
                      <strong>{taskModeLabel(mode)}</strong>
                      <small>
                        {mode === 'chat'
                          ? '使用当前模型交流'
                          : mode === 'agent'
                            ? '使用工具与能力完成任务'
                            : '并行比较多个模型'}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <nav className="primary-nav" aria-label="工作区">
            <span className="sidebar-section-label">工作区</span>
            <button className={workspaceView === 'home' ? 'active' : ''} type="button" onClick={goHome}>
              <Home size={16} aria-hidden />
              <span>首页</span>
            </button>
            <button type="button" onClick={() => openSettings('workspace')}>
              <FolderKanban size={16} aria-hidden />
              <span>项目</span>
            </button>
          </nav>

          <section className="recent-work" aria-label="侧栏最近任务">
            <div className="recent-work-heading">
              <span>最近</span>
              <button type="button" onClick={showAllWork}>
                全部
              </button>
            </div>
            <div className="recent-work-list">
              {conversations.slice(0, 8).map((conversation) => (
                <div
                  className={`recent-work-row${conversation.id === currentConvId ? ' active' : ''}`}
                  key={conversation.id}
                >
                  <button
                    className="recent-work-open"
                    type="button"
                    onClick={() => void actions.openConversation?.(conversation.id)}
                  >
                    <span className="recent-indicator" aria-hidden />
                    <span className="recent-work-copy">
                      <strong>{conversation.title || '新任务'}</strong>
                      <small>
                        {formatRecentTime(conversation.updatedAt || conversation.createdAt)} ·{' '}
                        {conversation.compareMode ? '模型对比' : conversation.agentId ? 'Agent' : '对话'}
                      </small>
                    </span>
                  </button>
                  <div className="recent-work-actions">
                    <button
                      type="button"
                      aria-label={`重命名：${conversation.title || '新任务'}`}
                      title="重命名"
                      onClick={() => void actions.renameConversation?.(conversation.id)}
                    >
                      <Pencil size={13} aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={`删除：${conversation.title || '新任务'}`}
                      title="删除"
                      onClick={() => void actions.deleteConversation?.(conversation.id)}
                    >
                      <Trash2 size={13} aria-hidden />
                    </button>
                  </div>
                </div>
              ))}
              {!conversations.length && <p>还没有任务。先描述你想完成的工作。</p>}
            </div>
          </section>

          <div className="sidebar-footer">
            <button
              className="sidebar-utility"
              id="commandBtnSide"
              type="button"
              onClick={() => document.getElementById('commandBtn')?.click()}
            >
              <Command size={16} aria-hidden />
              <span>命令</span>
              <kbd>Ctrl K</kbd>
            </button>
          </div>
        </aside>

        <div className="workspace-frame">
          <header className="topbar">
            <IconButton
              id="sidebarToggle"
              className="mobile-menu"
              label="打开主导航"
              icon={Menu}
              aria-expanded="false"
            />
            <div className="topbar-context">
              <div className="topbar-title" id="topbarTitle">
                {pageTitle}
              </div>
              <div className="topbar-path" id="topbarPath">
                {projectName}
              </div>
            </div>
            <button
              className="global-search"
              id="commandBtn"
              type="button"
              aria-label="搜索任务与命令"
              aria-haspopup="dialog"
              aria-controls="commandPalette"
            >
              <Search size={15} aria-hidden />
              <span>搜索任务、项目或命令...</span>
              <kbd>Ctrl K</kbd>
            </button>
            <div className="topbar-spacer" />
            <span
              className={`connection-status${streaming ? ' busy' : ''}`}
              title={streaming ? '模型正在响应' : '本机服务已连接'}
            >
              <i aria-hidden />
              {streaming ? '运行中' : '已连接'}
            </span>
            <button className="model-picker contextual-agent" id="agentPicker" hidden={taskMode !== 'agent'}>
              <span className="picker-status" aria-hidden />
              <span className="mp-name" id="agentPickerName">
                {selectedAgent?.name || '选择智能体'}
              </span>
              <ChevronDown size={14} aria-hidden />
            </button>
            <IconButton
              id="forkBtn"
              className="icon-btn task-only"
              label="创建任务分支"
              icon={GitFork}
              disabled={!currentConvId}
              hidden={workspaceView !== 'chat'}
            />
            <ThemeToggle />
            <IconButton
              id="workflowRailToggle"
              label="打开活动与上下文"
              icon={PanelRight}
              aria-controls="workflowRail"
              aria-expanded="false"
              onClick={() => openWorkflowRail('activity')}
            />
            <IconButton id="settingsBtn" label="设置" icon={Settings} onClick={() => openSettings('general')} />
          </header>

          <main className="main" id="mainWorkspace">
            <div className="content" id="content">
              <WorkspaceContent />
            </div>
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
            <BrandMark className="brand-logo" size={30} />
            <div>
              <strong>MultiChat</strong>
              <span>Settings</span>
            </div>
          </div>
          {settingsGroups.map((group) => (
            <div className="settings-nav-group" key={group.label}>
              <div className="settings-group-label">{group.label}</div>
              {group.items.map(({ tab, label, icon: ItemIcon }) => (
                <button className={`settings-tab${tab === 'general' ? ' active' : ''}`} data-tab={tab} key={tab}>
                  <ItemIcon className="tab-ico" size={16} strokeWidth={1.8} aria-hidden />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          ))}
          <div className="settings-side-spacer" />
          <button className="settings-tab settings-close-side" id="closeSettings">
            <X className="tab-ico" size={16} aria-hidden />
            <span>返回工作区</span>
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
              placeholder="搜索任务、模型或命令"
              aria-label="搜索命令"
            />
            <kbd>Esc</kbd>
          </div>
          <div className="command-caption" id="commandTitle">
            命令
          </div>
          <div className="command-list" id="commandList" />
        </div>
      </div>
    </>
  );
}
