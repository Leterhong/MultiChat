export type WorkMode = 'execute' | 'plan' | 'review';

export type WorkflowStep = {
  id: string;
  text: string;
  done: boolean;
};

export type WorkflowChecks = {
  tests: boolean;
  review: boolean;
  security: boolean;
};

export type WorkflowSession = {
  mode: WorkMode;
  acceptance: string;
  steps: WorkflowStep[];
  checks: WorkflowChecks;
  updatedAt: string;
};

const STORAGE_PREFIX = 'multichat_workflow:';

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  execute: '执行',
  plan: '规划',
  review: '审查',
};

export function createWorkflowSession(): WorkflowSession {
  return {
    mode: 'execute',
    acceptance: '',
    steps: [],
    checks: { tests: true, review: true, security: false },
    updatedAt: new Date().toISOString(),
  };
}

export function workflowScope(conversationId?: string | null, projectId?: string | null) {
  if (conversationId) return `conversation:${conversationId}`;
  if (projectId) return `project:${projectId}:draft`;
  return 'draft';
}

function normalizeWorkflow(value: Partial<WorkflowSession> | null | undefined): WorkflowSession {
  const fallback = createWorkflowSession();
  const mode = value?.mode;
  return {
    mode: mode === 'plan' || mode === 'review' || mode === 'execute' ? mode : fallback.mode,
    acceptance: String(value?.acceptance || '').slice(0, 2400),
    steps: Array.isArray(value?.steps) ? value.steps.slice(0, 30).map((step, index) => ({
      id: String(step?.id || `step_${index}`),
      text: String(step?.text || '').trim().slice(0, 240),
      done: Boolean(step?.done),
    })).filter((step) => step.text) : [],
    checks: {
      tests: value?.checks?.tests !== false,
      review: value?.checks?.review !== false,
      security: Boolean(value?.checks?.security),
    },
    updatedAt: String(value?.updatedAt || fallback.updatedAt),
  };
}

export function loadWorkflowSession(scope: string): WorkflowSession {
  try {
    return normalizeWorkflow(JSON.parse(localStorage.getItem(STORAGE_PREFIX + scope) || 'null'));
  } catch {
    return createWorkflowSession();
  }
}

export function saveWorkflowSession(scope: string, session: WorkflowSession): WorkflowSession {
  const next = normalizeWorkflow({ ...session, updatedAt: new Date().toISOString() });
  try { localStorage.setItem(STORAGE_PREFIX + scope, JSON.stringify(next)); } catch {}
  return next;
}

export function copyWorkflowSession(fromScope: string, toScope: string, session: WorkflowSession) {
  if (fromScope === toScope) return session;
  const next = saveWorkflowSession(toScope, session);
  try { localStorage.removeItem(STORAGE_PREFIX + fromScope); } catch {}
  return next;
}

export function buildWorkflowInstruction(session: WorkflowSession): string {
  const lines = [
    '[MultiChat 开发工作协议]',
    session.mode === 'plan'
      ? '当前模式：规划。先检查上下文并给出可执行计划、风险和验收方法；不要直接修改或执行有副作用的操作。'
      : session.mode === 'review'
        ? '当前模式：审查。以发现缺陷、回归风险和安全问题为目标；给出证据与修复建议，不主动扩大修改范围。'
        : '当前模式：执行。围绕用户目标持续推进，在安全且属于当前范围的本地操作上无需反复确认。',
    '权限边界：外部写入、破坏性操作、付费操作或明显扩大范围前必须先获得确认。',
  ];
  if (session.steps.length) {
    lines.push('当前任务计划：');
    session.steps.forEach((step, index) => lines.push(`${index + 1}. [${step.done ? 'x' : ' '}] ${step.text}`));
  }
  const acceptance = session.acceptance.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  if (acceptance.length) {
    lines.push('验收标准：');
    acceptance.forEach((item) => lines.push(`- ${item}`));
  }
  const checks = [];
  if (session.checks.tests) checks.push('运行与改动风险相称的测试或验证，并报告结果');
  if (session.checks.review) checks.push('完成后复查改动、边界条件与明显回归');
  if (session.checks.security) checks.push('检查输入处理、权限、凭据和依赖相关安全风险');
  if (checks.length) lines.push(`收尾要求：${checks.join('；')}。`);
  lines.push('最终回复先给结果，再给验证证据、未解决风险和必要的下一步。');
  return lines.join('\n');
}
