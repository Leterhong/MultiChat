import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { AppShell } from './app/AppShell';
import * as Core from './core/index';
import { installRuntimeActions, markAppReady } from './store/appStore';
import './design/tokens.css';
import './styles.css';
import './workbench.css';
import './developer-workspace.css';

const mount = document.getElementById('root');
if (!mount) throw new Error('MultiChat root mount is missing');

const root = createRoot(mount);
flushSync(() => root.render(<StrictMode><AppShell /></StrictMode>));

async function start() {
  const [Shell, Init, Data, Conversations, ModelPicker, AgentPicker, Settings,
    PluginsUI, ImportExport, ExtensionImport, Modal, Render, Send, Workbench, Compare, Assets] = await Promise.all([
    import('./modules/shell'), import('./modules/init'), import('./modules/data'),
    import('./modules/conversations'), import('./modules/modelPicker'), import('./modules/agentPicker'),
    import('./modules/settings'), import('./modules/pluginsUI'), import('./modules/importExport'),
    import('./modules/extensionImport'), import('./modules/modal'), import('./modules/render'),
    import('./modules/send'), import('./modules/workbench'), import('./modules/compare'), import('./modules/assets'),
  ]);

  const namespaces = [Core, Shell, Init, Data, Conversations, ModelPicker, AgentPicker,
    Settings, PluginsUI, ImportExport, ExtensionImport, Modal, Render, Send, Workbench, Compare, Assets];
  for (const namespace of namespaces) Object.assign(globalThis, namespace);

  Core.applyTheme();
  Shell.setupShell();
  Workbench.setupWorkbench();
  Compare.setupCompare();
  installRuntimeActions({
    send: Send.send,
    stop: Send.stopStream,
    openSettings: Settings.openSettings,
    openModelPicker: ModelPicker.openModelPicker,
    selectModel: ModelPicker.selectModel,
    openCompare: Compare.openCompare,
    openConversation: Conversations.openConversation,
    openInspector: Workbench.openInspector,
    importProjectFolder: async () => {
      await Assets.importProjectFolder();
      Workbench.renderInspector();
    },
    copyMessage: Send.copyMessage,
    editMessage: Send.editMessage,
    regenerateMessage: Send.regenerateMessage,
    resumeMessage: Send.resumeMessage,
    resolveApproval: Send.resolveApproval,
    refreshFileContext: () => {
      Render.renderContent();
      Workbench.renderInspector();
    },
  });
  await Init.bootstrap();
  markAppReady();
  Render.renderContent();

  window.MC = {
    state: Core.state,
    send: Send.send,
    newConversation: Conversations.newConversation,
    openSettings: Settings.openSettings,
    openCompare: Compare.openCompare,
  };
}

start().catch((error) => {
  window.dispatchEvent(new ErrorEvent('error', { message: 'MultiChat failed to start', error }));
  mount.innerHTML = '<main class="boot-error"><strong>MultiChat 启动失败</strong><p>请刷新页面；如果问题持续存在，请查看浏览器控制台。</p></main>';
});
