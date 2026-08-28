import{$ as e,esc as t,state as n}from"./core-BWSzA0FL.js";function r(){let r=e(`#content`),i=e(`#composerWrap`);if(i&&(i.style.display=n.messages.length?``:`none`),n.messages.length)r.innerHTML=`<div class="transcript" id="transcript">${n.messages.map(a).join(``)}</div>`,n.streaming&&(r.scrollTop=r.scrollHeight);else{let i=!n.selectedProvider||!n.selectedModel,a=n.selectedAssetIds?.size||0,s=(n.memories||[]).filter(e=>e.enabled!==!1).length,c=n.selectedAgent,l=n.runs?.[0],u=[!i,!!n.selectedProject,!!n.selectedWorkspace,!!(c||n.selectedModel)],d=Math.round(u.filter(Boolean).length/u.length*100),f=(c?.toolIds?.length||0)+(c?.mcpServerIds?.length||0);r.innerHTML=`
      <div class="home-workbench">
        <header class="home-intro">
          <div class="home-eyebrow"><span class="status-pulse ${i?`warn`:``}"></span>${i?`需要配置模型`:`工作台已就绪`}<span class="home-location">${t(n.selectedWorkspace?.name||`工作区`)} / ${t(n.selectedProject?.name||`未选择项目`)}</span></div>
          <h1>把一次工作组织清楚</h1>
          <p>选择模型、装配能力、核对上下文，然后保留可追溯的运行记录。</p>
        </header>
        <section class="home-launcher" aria-label="发起工作">
          <div class="home-composer" id="heroCard">
            <label for="heroInput">本次目标</label>
            <textarea class="hero-input" id="heroInput" placeholder="描述要完成的事情、验收标准和限制条件…" rows="2"></textarea>
            <div class="hero-actions">
              <button class="hero-tag" id="heroModelTag">选择模型</button>
              <span class="hero-mode-hint">${t(c?.name||`直接对话`)}</span>
              <button class="hero-context-tag" id="heroWorkspace" type="button">${a} 文件 · ${s} 记忆</button>
              <div class="spacer"></div>
              <button class="btn-secondary home-compare" id="heroCompare" type="button">并行对比</button>
              <button class="send-btn" id="heroSendBtn" title="开始" aria-label="开始运行">↑</button>
            </div>
          </div>
          <div class="home-shortcuts" aria-label="任务起点">
            <button type="button" data-quick-prompt="请分析当前项目上下文，先列出关键事实、未知项和建议的下一步。"><span>01</span><strong>理解项目</strong><small>先梳理上下文与风险</small></button>
            <button type="button" data-quick-prompt="请审查当前方案，指出优先级最高的缺陷、潜在漏洞和可以验证的改进项。"><span>02</span><strong>审查方案</strong><small>输出可执行检查清单</small></button>
            <button type="button" id="quickCompare"><span>03</span><strong>比较模型</strong><small>同一任务并行得到结果</small></button>
          </div>
        </section>
        <div class="home-grid">
          <section class="home-panel assembly-panel">
            <div class="home-panel-head"><div><span>RUN PROFILE</span><strong>${t(c?.name||`直接对话`)}</strong></div><button type="button" id="heroAgents">编辑配置</button></div>
            <dl class="home-facts">
              <div><dt>模型</dt><dd>${t(n.selectedModel||`未选择`)}</dd></div>
              <div><dt>项目</dt><dd>${t(n.selectedProject?.name||`未选择`)}</dd></div>
              <div><dt>能力</dt><dd>${c?`${c.skillRefs?.length||0} Skills · ${f} 工具`:`无能力注入`}</dd></div>
              <div><dt>上下文</dt><dd>${a} 文件 · ${s} 记忆</dd></div>
            </dl>
          </section>
          <section class="home-panel readiness-panel">
            <div class="home-panel-head"><div><span>PREFLIGHT</span><strong>运行前检查</strong></div><button type="button" id="heroInspector">查看详情</button></div>
            <div class="readiness-score"><strong>${d}</strong><span>%</span><div><b>${d===100?`可以开始`:`仍有配置项待处理`}</b><small>模型、项目、上下文与能力组合</small></div></div>
            <div class="readiness-track"><span style="width:${d}%"></span></div>
          </section>
          <section class="home-panel recent-panel">
            <div class="home-panel-head"><div><span>LAST RUN</span><strong>最近运行</strong></div><button type="button" id="heroRuns">全部记录</button></div>
            ${l?`<div class="home-run"><span class="run-state ${t(l.status||``)}">${t(l.status===`completed`?`已完成`:l.status||`未知`)}</span><div><strong>${t(l.agentName||l.agentId||`直接对话`)}</strong><small>${t(l.model||n.selectedModel||``)}</small></div><dl><div><dt>步骤</dt><dd>${t(l.steps||0)}</dd></div><div><dt>工具</dt><dd>${t(l.toolCalls||0)}</dd></div></dl></div>`:`<div class="home-empty-run"><strong>还没有运行记录</strong><span>完成第一项工作后会在这里汇总。</span></div>`}
          </section>
        </div>
        <div class="home-links" aria-label="能力入口">
          <button class="btn-ghost" id="heroSkills">Skills <span>管理</span></button>
          <button class="btn-ghost" id="heroMcp">MCP <span>连接</span></button>
          <button class="btn-ghost" id="heroPlugins">插件 <span>扩展</span></button>
          <button class="btn-ghost" id="heroCapabilities">能力清单 <span>核对</span></button>
        </div>
        <div class="hero-hint"><kbd>Enter</kbd> 开始 <span>·</span> <kbd>Ctrl K</kbd> 命令 <span>·</span> <kbd>Ctrl M</kbd> 对比</div>
      </div>
    `,syncModelUI();let p=e(`#heroInput`),m=e(`#heroSendBtn`);o(p),p.addEventListener(`input`,()=>o(p)),p.addEventListener(`keydown`,e=>{e.key===`Enter`&&!e.shiftKey&&(e.preventDefault(),send())}),m.onclick=send,!e(`#settings`)?.classList.contains(`open`)&&!e(`#modal`)?.classList.contains(`open`)&&p.focus(),e(`#heroAgents`).onclick=()=>openSettings(`agents`),e(`#heroSkills`).onclick=()=>openSettings(`skills`),e(`#heroMcp`).onclick=()=>openSettings(`mcp`),e(`#heroPlugins`).onclick=()=>openSettings(`plugins`),e(`#heroRuns`).onclick=()=>openSettings(`runs`),e(`#heroCapabilities`).onclick=()=>openSettings(`capabilities`),e(`#heroWorkspace`).onclick=()=>openSettings(`workspace`),e(`#heroCompare`).onclick=openCompare,e(`#quickCompare`).onclick=openCompare,document.querySelectorAll(`[data-quick-prompt]`).forEach(e=>{e.onclick=()=>{p.value=e.dataset.quickPrompt||``,o(p),p.focus()}}),e(`#heroInspector`).onclick=openInspector}}function i(e){if(!e||!e.pendingApprovals)return``;let n=Object.values(e.pendingApprovals);return n.length?`<div class="approval-wrap">${n.map(e=>{let n=e.risk===`high`?`risk-high`:e.risk===`medium`?`risk-med`:`risk-low`,r=e.risk===`high`?`高危`:e.risk===`medium`?`中危`:`低危`,i=[`approved`,`rejected`,`timed_out`,`cancelled`].includes(e.status),a=e.args?JSON.stringify(e.args):``,o=a.length>240?a.slice(0,240)+`…`:a,s=(e.permissions||[]).map(e=>`<span class="ap-perm">${t(e)}</span>`).join(``),c=e.trustLevel?`<span class="ap-perm ap-trust">${e.trustLevel===`trusted`?`已信任`:`未信任`}</span>`:``,l=i?`<div class="ap-resolved ${e.status===`approved`?`ok`:`no`}">${e.status===`approved`?`已批准，Agent 继续执行`:e.status===`rejected`?`已拒绝`:e.status===`timed_out`?`超时自动拒绝`:`已取消`}</div>`:`<div class="ap-actions"><button class="ap-btn ap-approve" data-approve="${e.id}">批准执行</button><button class="ap-btn ap-reject" data-reject="${e.id}">拒绝</button></div>`;return`<div class="approval-card ${i?`resolved`:`pending`} ${e.status===`approved`?`is-approved`:i?`is-rejected`:``}">
      <div class="ap-head"><span class="ap-badge ${n}">需授权 · ${r}</span><span class="ap-tool">${t(e.tool||``)}</span>${c}</div>
      <div class="ap-args"><span class="ap-args-label">参数</span><code>${t(o||`（无）`)}</code></div>
      <div class="ap-perms">${s||`<span class="ap-perm">无特殊权限</span>`}</div>
      ${l}
    </div>`}).join(``)}</div>`:``}function a(e,n){let r;r=e.role===`assistant`?renderMarkdown(e.content||``):`<div>${t(e.content||``).replace(/\n/g,`<br/>`)}</div>`;let a=e.model?`<span class="msg-model">${t(e.model)}</span>`:``,o=e.agentTag?`<span class="msg-model" style="background:var(--bg-elevated);border:1px solid var(--border-l2);">${t(e.agentTag)}</span>`:``,s=``;if(e.reasoning){let r=e.streaming||e.thinkOpen?` open`:``;s=`<details class="think-row" data-think="${n}" data-state="${e.streaming?`running`:`ok`}"${r}>
      <summary>
        <svg class="think-ico" viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.5.4.9 1 .9 1.6V16h5.2v-.5c0-.6.4-1.2.9-1.6A6 6 0 0 0 12 3z"/></svg>
        <span>思考</span>
        <span class="think-caret"></span>
        ${e.streaming?``:`<span class="think-summary">${t((e.reasoning||``).split(`
`)[0])}</span>`}
      </summary>
      <div class="think-body">${t(e.reasoning)}</div>
    </details>`}let c=``;Array.isArray(e.toolCalls)&&e.toolCalls.length>0&&(c=e.toolCalls.map((e,r)=>{let i=e.content||``,a=e._open?` open`:``,o=i?i.split(`
`)[0].slice(0,90)||`返回结果`:`执行完成`,s=i.length>2e3?i.slice(0,2e3)+`
...(截断)`:i;return`<details class="tool-card" data-tool="${n}-${r}"${a}>
        <summary>
          <svg class="tool-ico" viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2-2 2.5-2.5z"/></svg>
          <span class="tool-name">${t(e.name)}</span>
          <span class="tool-sep"></span>
          <span class="tool-summary">${t(o)}</span>
          <span class="tool-caret"></span>
        </summary>
        <pre class="tool-body">${t(s)}</pre>
      </details>`}).join(``));let l=i(e),u=Array.isArray(e.mcpWarnings)&&e.mcpWarnings.length?`<div class="mcp-warning"><strong>MCP 连接失败</strong>${e.mcpWarnings.map(e=>`<span>${t(e.name||e.serverId)}：${t(e.error||``)}</span>`).join(``)}</div>`:``,d=``;if(Array.isArray(e.trace)&&e.trace.length>0){let n=e.trace.map(e=>{let n=e.kind===`tool_call`?`<svg class="trace-ico-svg" viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2-2 2.5-2.5z"/></svg>`:`<svg class="trace-ico-svg" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>`,r=e.status===`success`?`ok`:e.status===`error`?`err`:e.status===`rejected`?`rej`:`run`,i=e.durationMs==null?``:(e.durationMs/1e3).toFixed(1)+`s`,a,o;if(e.kind===`tool_call`){let n=e.args?JSON.stringify(e.args).slice(0,80):``;a=`${t(e.tool||`tool`)}${n?`(`+t(n)+`)`:``}`,o=e.result?t(String(e.result).split(`
`)[0].slice(0,90)):e.error||``}else a=`模型请求 · ${t(e.model||``)}`,o=`${e.toolCount||0} 工具 · ${e.messageCount||0} 上下文`+(e.outputLen==null?``:` · 输出 ${e.outputLen} 字`);return`<div class="trace-step ${r}">
        ${n}
        <div class="trace-main"><span class="trace-label">${a}</span>${o?`<span class="trace-sub">${t(o)}</span>`:``}</div>
        <span class="trace-status">${e.status===`success`?`✓`:e.status===`rejected`?`⊘`:e.status===`error`?`✕`:`…`}</span>
        ${i?`<span class="trace-dur">${i}</span>`:``}
      </div>`}).join(``);d=`<details class="mc-trace"${e.streaming?` open`:``}>
      <summary><span class="trace-ico">⟜</span><span class="trace-title">执行轨迹</span><span class="trace-count">${e.trace.length} 步</span></summary>
      <div class="trace-body">${n}</div>
    </details>`}let f=``;if(e.role===`assistant`&&!e.streaming&&(e.usage||e.elapsedMs!=null)){let n=e.usage||{},r=n.prompt_tokens??n.input_tokens,i=n.completion_tokens??n.output_tokens,a=n.total_tokens==null?r!=null&&i!=null?r+i:null:n.total_tokens,o=n.prompt_tokens_details&&n.prompt_tokens_details.cached_tokens||n.cached_tokens||0,s=n.completion_tokens_details&&n.completion_tokens_details.reasoning_tokens||n.reasoning_tokens||0,c=e.elapsedMs==null?null:e.elapsedMs/1e3,l=e.elapsedMs&&i?i/(e.elapsedMs/1e3):null,u=e.providerName||``,d=[];if(a!=null){let e=`共 <strong>${fmtTok(a)}</strong> tokens`;r!=null&&i!=null&&(e+=` <span style="color:var(--label-dimmed)">(输入 ${fmtTok(r)} / 输出 ${fmtTok(i)})</span>`),s>0&&(e+=` · 推理 ${fmtTok(s)}`),d.push(e)}if(o>0&&r){let e=(o/r*100).toFixed(0);d.push(`缓存命中 <strong class="cached">${fmtTok(o)}</strong> <span style="color:var(--label-dimmed)">(${e}%)</span>`)}if(c!=null){let e=`${c.toFixed(1)}s`;l&&(e+=` · <span class="speed">${l.toFixed(0)} tok/s</span>`),d.push(e)}if(e.model&&d.push(`模型 <strong>${t(e.model)}</strong>`),u&&d.push(`渠道 <strong>${t(u)}</strong>`),d.length){let e=d.join(`  |  `),n=d.map(e=>`<span>${e}</span>`).join(`<span class="sep">|</span>`);f=`<div class="msg-stats" title="${t(e)}">${n}</div>`}}return`
    <div class="msg ${e.role}" data-idx="${n}" aria-label="${e.role===`user`?`你的消息`:`MultiChat 回复`}">
      <div class="msg-avatar" aria-hidden="true">${e.role===`assistant`?`M`:`你`}</div>
      <div class="msg-body">
        <div class="msg-role">${e.role===`assistant`?`MultiChat`:`你`}${e.role===`assistant`?o+a:``}${e.streaming?`<span class="busy-label">处理中</span>`:``}</div>
        ${s}
        <div class="msg-content">${u}${r}${c}${l}${d}</div>
        ${f}
        <div class="msg-actions">
          ${e.role===`assistant`&&!e.streaming?`<button class="msg-action" data-copy="${n}">复制</button><button class="msg-action" data-regen="${n}">重新生成</button>`:``}
          ${e.role===`user`?`<button class="msg-action" data-edit="${n}">编辑</button>`:``}
        </div>
      </div>
    </div>`}function o(e){e.style.height=`auto`,e.style.height=Math.min(240,e.scrollHeight)+`px`}export{o as autoresize,i as renderApprovalCards,r as renderContent,a as renderMessage};