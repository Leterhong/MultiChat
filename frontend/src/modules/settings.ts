import { $, $$, esc, api, toast, state, DEFAULT_PARAMS, loadSelectedAgent, saveSelectedAgent, saveParams } from '../core/index';

/* --------------------------- Settings --------------------------- */
$('#settingsBtn').onclick = () => openSettings();
function openSettings(tab = 'general') { $('#settings').classList.add('open'); $('#scrim').classList.add('open'); switchSettingsTab(tab); }
function closeSettings() { $('#settings').classList.remove('open'); $('#scrim').classList.remove('open'); }
$('#scrim').onclick = closeSettings;
$('#closeSettings').onclick = closeSettings;
$('#closeSettingsTop').onclick = closeSettings;
$$('.settings-tab[data-tab]').forEach(b => b.onclick = () => switchSettingsTab(b.dataset.tab));
function switchSettingsTab(tab) {
  state.currentTab = tab;
  $$('.settings-tab[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  renderSettings(tab);
}
function renderSettings(tab = 'general', keepScroll = false) {
  const body = $('#settingsBody');
  const _prevScroll = keepScroll ? body.scrollTop : 0;
  if (tab === 'general') {
    const p = state.params;
    body.innerHTML = `
      <h3>通用设置</h3>
      <p class="lead">模型参数与外观</p>
      <div class="provider-card">
        <h4>模型参数</h4>
        <div class="pmeta">应用于每次对话请求（OpenAI 兼容）</div>
        <div class="field">
          <label>温度 Temperature：<span id="tVal">${p.temperature}</span></label>
          <input type="range" id="pTemp" min="0" max="2" step="0.1" value="${p.temperature}" />
        </div>
        <div class="field">
          <label>最大输出 Token（max_tokens）</label>
          <input type="number" id="pMax" value="${p.max_tokens}" min="1" max="128000" />
        </div>
        <div class="field">
          <label>Top P：<span id="pTopVal">${p.top_p}</span></label>
          <input type="range" id="pTop" min="0" max="1" step="0.05" value="${p.top_p}" />
        </div>
        <div class="provider-row">
          <button class="btn-ghost" id="pReset">重置</button>
          <button class="btn-primary" id="pSave" style="width:auto;padding:8px 18px;">保存</button>
        </div>
      </div>
      <div class="provider-card">
        <h4>外观</h4>
        <div class="pmeta">界面主题</div>
        <div class="field">
          <label>主题</label>
          <select id="themeSel"><option value="light" selected>浅色</option><option value="dark" disabled>深色（敬请期待）</option></select>
        </div>
      </div>
      <div class="provider-card">
        <h4>关于</h4>
        <div class="pmeta">MultiChat · 本地优先<br/>无登录 · 无计费 · 模型接入优先<br/>支持 OpenAI / Anthropic / Ollama / LM Studio 等 OpenAI 兼容协议</div>
      </div>
    `;
    const tEl = $('#pTemp'), tVal = $('#tVal'), topEl = $('#pTop'), topVal = $('#pTopVal');
    tEl.oninput = () => { tVal.textContent = tEl.value; };
    topEl.oninput = () => { topVal.textContent = topEl.value; };
    $('#pSave').onclick = () => {
      state.params = {
        temperature: parseFloat(tEl.value),
        max_tokens: parseInt($('#pMax').value, 10) || 2000,
        top_p: parseFloat(topEl.value)
      };
      saveParams();
      toast('已保存');
    };
    $('#pReset').onclick = () => {
      state.params = { ...DEFAULT_PARAMS }; saveParams(); renderSettings('general', true); toast('已重置');
    };
  } else if (tab === 'workspace') {
    const workspace = state.selectedWorkspace;
    const project = state.selectedProject;
    body.innerHTML = `
      <h3>工作区</h3>
      <p class="lead">按工作区和项目组织会话、文件和 Agent 上下文。文件内容只保存在本地数据目录。</p>
      <div class="provider-card">
        <h4>当前空间</h4>
        <div class="field"><label>工作区</label><select id="workspaceSelect">${state.workspaces.map(w => `<option value="${esc(w.id)}" ${w.id === workspace?.id ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select></div>
        <div class="field"><label>项目</label><select id="projectSelect">${state.projects.map(p => `<option value="${esc(p.id)}" ${p.id === project?.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
        <div class="field"><label>项目默认智能体</label><select id="projAgentSelect"><option value="">（继承全局）</option>${state.agents.map(a => `<option value="${esc(a.id)}" ${project?.defaultAgentId === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>
        <div class="field"><label>项目默认模型</label><select id="projModelSelect"><option value="">（继承全局）</option>${state.providers.flatMap(p => (p.models || []).map(m => ({ pid: p.id, m, label: (p.name || p.id) + ' · ' + m }))).map(o => `<option value="${esc(o.pid + ':' + o.m)}" ${project?.defaultProviderId === o.pid && project?.defaultModel === o.m ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></div>
        <div class="provider-row"><button class="btn-primary" id="saveProjDefaults" style="width:auto;padding:8px 18px;">保存项目默认</button></div>
        <div class="provider-row"><button class="btn-ghost" id="newWorkspace">新建工作区</button><button class="btn-ghost" id="newProject">新建项目</button></div>
      </div>
      <div class="provider-card">
        <h4>项目文件</h4>
        <div class="pmeta">支持本地文本文件和 URL 文本资源，单个文件最大 2 MB。</div>
        <div class="provider-row" style="margin-top:12px;"><button class="btn-ghost" id="uploadAsset">上传本地文件</button><button class="btn-ghost" id="importAssetUrl">从 URL 添加</button><input type="file" id="assetFileInput" accept=".txt,.md,.json,.csv,.js,.ts,.py,.html,.css,.yaml,.yml" style="display:none" /></div>
        <div class="run-list" style="margin-top:14px;">${state.assets.map(asset => `<div class="run-row"><span class="run-dot completed"></span><div class="run-main"><div class="run-title">${esc(asset.name)}</div><div class="run-meta">${esc(asset.mimeType)} · ${esc(asset.size)} bytes · ${esc(asset.source)}</div></div><button class="mc-act danger" data-del-asset="${esc(asset.id)}" title="删除">删除</button></div>`).join('') || '<div style="color:var(--label-caption);font-size:13px;padding:8px 0;">当前项目还没有文件。</div>'}</div>
      </div>
    `;
    $('#workspaceSelect').onchange = async (event) => { state.selectedWorkspace = state.workspaces.find(x => x.id === event.target.value) || null; await loadProjects(); renderTopbar(); renderSettings('workspace', true); renderFileContext(); };
    $('#projectSelect').onchange = async (event) => { state.selectedProject = state.projects.find(x => x.id === event.target.value) || null; if (state.selectedProject) localStorage.setItem('multichat_project', state.selectedProject.id); await loadProjects(); renderTopbar(); renderSettings('workspace', true); renderFileContext(); };
    $('#saveProjDefaults').onclick = async () => {
      if (!state.selectedProject) { toast('请先选择项目', 'error'); return; }
      const aid = $('#projAgentSelect').value || null;
      const mv = $('#projModelSelect').value || '';
      const [pid, ...rest] = mv.split(':');
      const model = rest.join(':');
      try {
        await api('/api/projects/' + state.selectedProject.id, { method: 'PUT', body: JSON.stringify({ defaultAgentId: aid, defaultProviderId: pid || null, defaultModel: model || null }) });
        Object.assign(state.selectedProject, { defaultAgentId: aid, defaultProviderId: pid || null, defaultModel: model || null });
        applyProjectDefaults();
        toast('已保存项目默认');
      } catch (e) { toast(e.message, 'error'); }
    };
    $('#newWorkspace').onclick = () => showWorkspaceForm();
    $('#newProject').onclick = () => showProjectForm();
    $('#importAssetUrl').onclick = () => showAssetUrlModal();
    const fileInput = $('#assetFileInput');
    $('#uploadAsset').onclick = () => fileInput.click();
    fileInput.onchange = async () => {
      const file = fileInput.files?.[0];
      if (!file || !state.selectedProject) return;
      try { await api('/api/assets', { method: 'POST', body: JSON.stringify({ projectId: state.selectedProject.id, name: file.name, mimeType: file.type || 'text/plain', content: await file.text() }) }); await loadProjects(); renderSettings('workspace', true); toast('文件已加入项目'); }
      catch (error) { toast(error.message, 'error'); }
      fileInput.value = '';
    };
    body.querySelectorAll('[data-del-asset]').forEach(button => button.onclick = async () => { try { await api('/api/assets/' + button.dataset.delAsset, { method: 'DELETE' }); await loadProjects(); renderSettings('workspace', true); } catch (error) { toast(error.message, 'error'); } });
  } else if (tab === 'providers') {
    body.innerHTML = `
      <h3>模型</h3>
      <p class="lead">填入各提供方的 API 密钥即可使用其模型。无登录、无计费。</p>
      <div id="providerList">
        ${state.providers.map(p => `
          <div class="provider-card" data-pid="${esc(p.id)}">
            <h4>${esc(p.name || p.id)} <span style="color:var(--label-caption);font-weight:400;font-size:12px;">${esc(p.id)}</span></h4>
            <div class="pmeta">${esc(p.apiType || 'openai')} · ${esc((p.models||[]).join(', ') || p.model || p.baseUrl || '')}</div>
            <div class="field">
              <label>API 密钥</label>
              <input type="password" data-k="${esc(p.id)}" value="${esc(p.apiKey || '')}" placeholder="输入 API 密钥" />
            </div>
            <div class="field">
              <label>模型列表</label>
              <textarea data-m="${esc(p.id)}" rows="2" placeholder="deepseek-chat, deepseek-reasoner">${esc((p.models||[]).join(', '))}</textarea>
              <div style="font-size:11.5px;color:var(--label-caption);margin-top:4px;">逗号或换行分隔；留空则该提供方需在选模型时手动输入。</div>
            </div>
            <div class="provider-row">
              <button class="btn-ghost" data-del="${esc(p.id)}">删除</button>
              <button class="btn-primary" data-save="${esc(p.id)}" style="width:auto;padding:8px 18px;">保存</button>
            </div>
          </div>
        `).join('') || '<div style="color:var(--label-caption);font-size:13px;padding:8px 0;">还没有添加任何模型，点击下方按钮添加。</div>'}
      </div>
      <div class="add-provider">
        <div class="add-tile" id="addBuiltin"><span class="ico">＋</span>添加提供方</div>
        <div class="add-tile" id="addCustom"><span class="ico">＋</span>添加自定义提供方</div>
      </div>
    `;
    body.querySelectorAll('[data-save]').forEach(b => b.onclick = async () => {
      const pid = b.dataset.save;
      const apiKey = body.querySelector(`[data-k="${pid}"]`).value;
      const models = (body.querySelector(`[data-m="${pid}"]`).value || '')
        .split(/[,\n]/).map(s => s.trim()).filter(Boolean);
      try {
        await api('/api/providers/' + pid, { method: 'PUT', body: JSON.stringify({ apiKey, models }) });
        toast('已保存'); await loadProviders(); renderSettings('providers', true); renderTopbar();
      } catch (e) { toast(e.message, 'error'); }
    });
    body.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      const pid = b.dataset.del;
      if (!confirm('删除该模型？')) return;
      try { await api('/api/providers/' + pid, { method: 'DELETE' }); } catch (e) { toast(e.message, 'error'); return; }
      await loadProviders(); renderSettings('providers', true); renderTopbar();
    });
    $('#addBuiltin').onclick = () => showAddBuiltin();
    $('#addCustom').onclick = () => showAddCustom();
  } else if (tab === 'agents') {
    const agents = state.agents;
    body.innerHTML = `
      <h3>智能体</h3>
      <p class="lead">智能体 = 系统提示词 + 关联技能。点击卡片可编辑；对话中启用后，LLM 会按系统提示词输出并调用已启用工具。</p>
      ${importBarHTML()}
      <div class="card-grid">
        ${agents.map(a => {
          const active = state.selectedAgent && state.selectedAgent.id === a.id;
          const skillIds = a.skillIds || [];
          return `
          <div class="mc-card" data-aid="${esc(a.id)}">
            <div class="mc-top">
              <div class="mc-ico"><svg viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="11" rx="2.5"/><path d="M12 8V5M9 3h6M9 13h.01M15 13h.01M9.5 16h5"/></svg></div>
              <div style="min-width:0;flex:1;">
                <div class="mc-title">${esc(a.name)}</div>
                <div class="mc-sub">${esc(a.id)}</div>
              </div>
              ${active ? '<span class="mc-tag on">使用中</span>' : ''}
            </div>
            <div class="mc-desc">${esc(a.description || '（暂无描述）')}</div>
            <div class="mc-tags">
              <span class="mc-tag">${skillIds.length} 个技能</span>
              ${skillIds.slice(0, 3).map(tid => `<span class="mc-tag">${esc(tid)}</span>`).join('')}
              ${(skillIds.length > 3) ? `<span class="mc-tag">+${skillIds.length - 3}</span>` : ''}
            </div>
            <div class="mc-actions">
              <button class="mc-act" data-export-a="${esc(a.id)}" title="导出">${EXPORT_ICON}</button>
              <button class="mc-act" data-edit-a="${esc(a.id)}" title="编辑"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
              <button class="mc-act danger" data-del-a="${esc(a.id)}" title="删除"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg></button>
            </div>
          </div>`;
        }).join('')}
        <div class="mc-add" id="addAgent"><span class="plus">＋</span><span class="plus-t">新建智能体</span></div>
      </div>
    `;
    body.querySelectorAll('.mc-card[data-aid]').forEach(c => c.onclick = () => showAgentModal(c.dataset.aid));
    body.querySelectorAll('[data-edit-a]').forEach(b => b.onclick = (e) => { e.stopPropagation(); showAgentModal(b.dataset.editA); });
    body.querySelectorAll('[data-export-a]').forEach(b => b.onclick = (e) => { e.stopPropagation(); const a = state.agents.find(x => x.id === b.dataset.exportA); if (a) exportEntity(a, 'agent'); });
    body.querySelectorAll('[data-del-a]').forEach(b => b.onclick = async (e) => {
      e.stopPropagation();
      const aid = b.dataset.delA;
      if (!confirm('删除该智能体？')) return;
      try { await api('/api/agents/' + aid, { method: 'DELETE' }); } catch (err) { toast(err.message, 'error'); return; }
      if (state.selectedAgent && state.selectedAgent.id === aid) state.selectedAgent = null;
      saveSelectedAgent();
      await loadAgents(); renderSettings(state.currentTab || 'agents', true); renderTopbar();
    });
    $('#addAgent').onclick = () => showAgentModal(null);
    wireImportBar();
  } else if (tab === 'skills') {
    const iconOf = (type) => ({
      datetime: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      calculator: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15v3M8 18h4"/>',
      web_fetch: '<path d="M12 3v11M8 10l4 4 4-4M4 20h16"/>',
      web_search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>',
      prompt: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>'
    })[type] || '<circle cx="12" cy="12" r="9"/>';
    const editIco = '<svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
    const trashIco = '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>';
    body.innerHTML = `
      <h3>技能</h3>
      <p class="lead">技能是可被智能体调用的工具 / 提示片段。工具类（时间 / 计算 / 抓取 / 搜索）与提示类（注入系统提示）均为内置能力，可在此启停。</p>
      ${importBarHTML()}
      <div class="card-grid">
        ${state.skills.map(s => `
          <div class="mc-card" data-sid="${esc(s.id)}">
            <div class="mc-top">
              <div class="mc-ico"><svg viewBox="0 0 24 24">${iconOf(s.type)}</svg></div>
              <div style="min-width:0;flex:1;">
                <div class="mc-title">${esc(s.name)}</div>
                <div class="mc-sub">${esc(s.id)}</div>
              </div>
            </div>
            <div class="mc-desc">${esc(s.description || '（暂无描述）')}</div>
            <div class="mc-tags">
              <span class="mc-tag ${s.enabled ? 'on' : ''}">${esc(s.type)}</span>
              <span class="mc-tag">${s.enabled ? '已启用' : '已停用'}</span>
              ${s.permissions?.length ? `<span class="mc-tag">权限：${esc(s.permissions.join(' / '))}</span>` : ''}
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:auto;padding-top:6px;">
              <span class="mc-toggle ${s.enabled ? 'on' : ''}" data-toggle-s="${esc(s.id)}"><span class="mc-switch"></span><span>${s.enabled ? '启用中' : '已停用'}</span></span>
            <div class="mc-actions" style="opacity:1;position:static;">
              <button class="mc-act" data-export-s="${esc(s.id)}" title="导出">${EXPORT_ICON}</button>
              ${s.type === 'prompt' ? `<button class="mc-act" data-edit-s="${esc(s.id)}" title="编辑">${editIco}</button>` : ''}
              <button class="mc-act danger" data-del-s="${esc(s.id)}" title="删除">${trashIco}</button>
            </div>
            </div>
          </div>`).join('')}
        <div class="mc-add" id="addSkill"><span class="plus">＋</span><span class="plus-t">新建技能</span></div>
      </div>
    `;
    body.querySelectorAll('[data-toggle-s]').forEach(b => b.onclick = async (e) => {
      e.stopPropagation();
      const sid = b.dataset.toggleS;
      const sk = state.skills.find(x => x.id === sid);
      if (!sk) return;
      const next = !sk.enabled;
      const card = b.closest('.mc-card');
      const flip = (on) => {
        b.classList.toggle('on', on);
        const lbl = b.querySelector('span:last-child'); if (lbl) lbl.textContent = on ? '启用中' : '已停用';
        if (card) {
          const tags = card.querySelectorAll('.mc-tag');
          if (tags[0]) tags[0].classList.toggle('on', on);
          if (tags[1]) tags[1].textContent = on ? '已启用' : '已停用';
        }
      };
      // 乐观更新：原地翻转开关与卡片标签，避免整段 innerHTML 重建（即“页面重置”感）
      sk.enabled = next; flip(next);
      try {
        const payload: any = { enabled: next };
        if (sk.type === 'prompt' && sk.config) payload.config = sk.config;
        await api('/api/skills/' + sid, { method: 'PUT', body: JSON.stringify(payload) });
      } catch (err) {
        sk.enabled = !next; flip(!next); // 失败回滚
        toast(err.message, 'error');
      }
    });
    body.querySelectorAll('[data-edit-s]').forEach(b => b.onclick = (e) => { e.stopPropagation(); showSkillModal(b.dataset.editS); });
    body.querySelectorAll('[data-export-s]').forEach(b => b.onclick = (e) => { e.stopPropagation(); const s = state.skills.find(x => x.id === b.dataset.exportS); if (s) exportEntity(s, 'skill'); });
    body.querySelectorAll('[data-del-s]').forEach(b => b.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm('删除该技能？关联智能体的引用也将被移除。')) return;
      try { await api('/api/skills/' + b.dataset.delS, { method: 'DELETE' }); } catch (err) { toast(err.message, 'error'); return; }
      await loadSkills(); await loadAgents(); renderSettings(state.currentTab || 'skills', true);
    });
    body.querySelectorAll('.mc-card[data-sid]').forEach(c => c.onclick = () => showSkillModal(c.dataset.sid));
    $('#addSkill').onclick = () => showSkillModal(null);
    wireImportBar();
  } else if (tab === 'plugins') {
    renderPlugins();
  } else if (tab === 'runs') {
    renderRuns();
  }
  if (keepScroll) body.scrollTop = Math.min(_prevScroll, Math.max(0, body.scrollHeight - body.clientHeight));
}

function showWorkspaceForm() {
  showModal({
    title: '新建工作区',
    body: `<form id="workspaceForm"><div class="field"><label>名称</label><input name="name" required placeholder="例如：产品研发" /></div><div class="field"><label>描述</label><input name="description" placeholder="这个工作区用于什么" /></div><div class="row"><button type="button" class="btn-ghost" id="workspaceCancel">取消</button><button class="btn-primary" type="submit">创建</button></div></form>`,
    onMount: (card) => {
      $('#workspaceCancel', card).onclick = closeModal;
      $('#workspaceForm', card).onsubmit = async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.target).entries()); try { await api('/api/workspaces', { method: 'POST', body: JSON.stringify(data) }); await loadWorkspaces(); renderTopbar(); renderSettings('workspace'); closeModal(); toast('工作区已创建'); } catch (error) { toast(error.message, 'error'); } };
    }
  });
}

function showProjectForm() {
  if (!state.selectedWorkspace) return toast('请先选择工作区', 'error');
  showModal({
    title: '新建项目',
    body: `<form id="projectForm"><div class="field"><label>名称</label><input name="name" required placeholder="例如：移动端重构" /></div><div class="field"><label>描述</label><input name="description" placeholder="项目目标或范围" /></div><div class="row"><button type="button" class="btn-ghost" id="projectCancel">取消</button><button class="btn-primary" type="submit">创建</button></div></form>`,
    onMount: (card) => {
      $('#projectCancel', card).onclick = closeModal;
      $('#projectForm', card).onsubmit = async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.target).entries()); data.workspaceId = state.selectedWorkspace.id; try { await api('/api/projects', { method: 'POST', body: JSON.stringify(data) }); await loadProjects(); renderSettings('workspace'); closeModal(); toast('项目已创建'); } catch (error) { toast(error.message, 'error'); } };
    }
  });
}

function showAssetUrlModal() {
  if (!state.selectedProject) return toast('请先选择项目', 'error');
  showModal({
    title: '从 URL 添加文件',
    body: `<form id="assetUrlForm"><div class="field"><label>URL</label><input name="url" type="url" required placeholder="https://example.com/notes.md" /></div><div class="field"><label>显示名称（可选）</label><input name="name" placeholder="自动从 URL 推断" /></div><div id="assetUrlErr" class="auth-error"></div><div class="row"><button type="button" class="btn-ghost" id="assetUrlCancel">取消</button><button class="btn-primary" type="submit">添加</button></div></form>`,
    onMount: (card) => {
      $('#assetUrlCancel', card).onclick = closeModal;
      $('#assetUrlForm', card).onsubmit = async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.target).entries()); data.projectId = state.selectedProject.id; try { await api('/api/assets', { method: 'POST', body: JSON.stringify(data) }); await loadProjects(); renderSettings('workspace'); closeModal(); toast('远程文件已加入项目'); } catch (error) { $('#assetUrlErr', card).textContent = error.message; } };
    }
  });
}

function renderRuns() {
  const body = $('#settingsBody');
  const runs = state.runs || [];
  body.innerHTML = `
    <h3>运行记录</h3>
    <p class="lead">查看智能体每次运行的状态、步骤和工具调用，便于复盘失败原因。</p>
    <div class="provider-row" style="margin-bottom:14px;"><button class="btn-ghost" id="refreshRuns">刷新</button><span class="pmeta">保留最近 ${runs.length} 条记录</span></div>
    <div class="run-list">
      ${runs.map(r => `
        <div class="run-row">
          <span class="run-dot ${esc(r.status || '')}"></span>
          <div class="run-main"><div class="run-title">${esc(r.agentName || r.agentId || '智能体运行')}</div><div class="run-meta">${esc(r.model || '未指定模型')} · ${esc(r.steps || 0)} 步 · ${esc(r.toolCalls || 0)} 次工具调用 · ${esc(r.startedAt || '')}</div></div>
          <span class="run-status">${r.status === 'completed' ? '已完成' : r.status === 'error' ? '失败' : '进行中'}</span>
        </div>`).join('') || '<div style="color:var(--label-caption);font-size:13px;padding:8px 0;">还没有 Agent 运行记录。</div>'}
    </div>`;
  $('#refreshRuns').onclick = async () => { await loadRuns(); renderSettings('runs', true); };
}

export { openSettings,closeSettings,switchSettingsTab,renderSettings,showWorkspaceForm,showProjectForm,showAssetUrlModal,renderRuns };
