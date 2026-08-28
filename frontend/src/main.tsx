import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { AppShell } from './app/AppShell';
import { applyDesignTokens } from './design/tokens';
import './styles.css';
import './workbench-v2.css';

const mount = document.getElementById('root');
if (!mount) throw new Error('MultiChat root mount is missing');

applyDesignTokens();
const root = createRoot(mount);
flushSync(() => root.render(<StrictMode><AppShell /></StrictMode>));

async function start() {
  const [Core, Shell, Init, Data, Conversations, ModelPicker, AgentPicker, Settings,
    PluginsUI, ImportExport, ExtensionImport, Modal, Render, Markdown, Send, Workbench, Compare] = await Promise.all([
    import('./core/index'), import('./modules/shell'), import('./modules/init'), import('./modules/data'),
    import('./modules/conversations'), import('./modules/modelPicker'), import('./modules/agentPicker'),
    import('./modules/settings'), import('./modules/pluginsUI'), import('./modules/importExport'),
    import('./modules/extensionImport'), import('./modules/modal'), import('./modules/render'),
    import('./modules/markdown'), import('./modules/send'), import('./modules/workbench'), import('./modules/compare'),
  ]);

  const namespaces = [Core, Shell, Init, Data, Conversations, ModelPicker, AgentPicker,
    Settings, PluginsUI, ImportExport, ExtensionImport, Modal, Render, Markdown, Send, Workbench, Compare];
  for (const namespace of namespaces) Object.assign(globalThis, namespace);

  Core.applyTheme();
  Shell.setupShell();
  Workbench.setupWorkbench();
  Compare.setupCompare();
  await Init.bootstrap();

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
