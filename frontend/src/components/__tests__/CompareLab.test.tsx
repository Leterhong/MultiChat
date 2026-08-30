import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompareLab, type CompareResult, type CompareTarget } from '../CompareLab';

const targets: CompareTarget[] = [
  { id: 'one:fast', providerId: 'one', providerName: 'Provider One', model: 'fast' },
  { id: 'two:lean', providerId: 'two', providerName: 'Provider Two', model: 'lean' },
];

const props = {
  targets,
  defaultTargetIds: targets.map((target) => target.id),
  initialPrompt: '比较任务',
  projectName: '测试项目',
  fileCount: 1,
  memoryCount: 2,
  adopt: vi.fn(async () => {}),
};

describe('CompareLab', () => {
  beforeEach(() => localStorage.clear());

  it('summarizes only measurable speed and token results', async () => {
    const execute = vi.fn(async (target: CompareTarget): Promise<CompareResult> => target.model === 'fast'
      ? { ...target, status: 'success', text: '更快', elapsedMs: 800, usage: { total_tokens: 300 } }
      : { ...target, status: 'success', text: '更省', elapsedMs: 1500, usage: { total_tokens: 120 } });
    render(<CompareLab {...props} execute={execute} />);

    fireEvent.click(screen.getByRole('button', { name: '开始实验' }));
    await screen.findByRole('region', { name: '实验摘要' });
    expect(screen.getByText('最快响应').parentElement).toHaveTextContent('fast');
    expect(screen.getByText('最低消耗').parentElement).toHaveTextContent('lean');
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('allows an in-flight experiment to be stopped', async () => {
    const execute = vi.fn((target: CompareTarget, _prompt: string, signal?: AbortSignal) => new Promise<CompareResult>((resolve) => {
      signal?.addEventListener('abort', () => resolve({ ...target, status: 'cancelled' }), { once: true });
    }));
    render(<CompareLab {...props} execute={execute} />);

    fireEvent.click(screen.getByRole('button', { name: '开始实验' }));
    const stop = await screen.findByRole('button', { name: '停止实验' });
    fireEvent.click(stop);
    await waitFor(() => expect(screen.getAllByText('已停止')).toHaveLength(2));
    expect(screen.getByRole('button', { name: '再次实验' })).toBeEnabled();
  });
});
