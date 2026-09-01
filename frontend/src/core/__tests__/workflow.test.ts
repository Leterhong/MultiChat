import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildWorkflowInstruction,
  createWorkflowSession,
  loadWorkflowSession,
  saveWorkflowSession,
  workflowScope,
} from '../workflow';

describe('workflow session', () => {
  beforeEach(() => localStorage.clear());

  it('keeps sessions isolated by conversation and project draft', () => {
    expect(workflowScope('conv-1', 'project-1')).toBe('conversation:conv-1');
    expect(workflowScope(null, 'project-1')).toBe('project:project-1:draft');
    const scope = workflowScope('conv-1', 'project-1');
    saveWorkflowSession(scope, { ...createWorkflowSession(), mode: 'review', acceptance: '没有高危问题' });
    expect(loadWorkflowSession(scope)).toMatchObject({ mode: 'review', acceptance: '没有高危问题' });
    expect(loadWorkflowSession(workflowScope('conv-2', 'project-1')).mode).toBe('execute');
  });

  it('builds a hidden task protocol with plan, checks, and approval boundaries', () => {
    const instruction = buildWorkflowInstruction({
      ...createWorkflowSession(),
      mode: 'execute',
      acceptance: '测试通过\n没有明显回归',
      steps: [{ id: 'one', text: '修复布局问题', done: false }],
      checks: { tests: true, review: true, security: true },
    });
    expect(instruction).toContain('当前任务计划');
    expect(instruction).toContain('修复布局问题');
    expect(instruction).toContain('测试通过');
    expect(instruction).toContain('安全风险');
    expect(instruction).toContain('必须先获得确认');
  });
});
