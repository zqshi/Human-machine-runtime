import { describe, it, expect } from 'vitest';
import { AgentTask } from '../AgentTask';
import type { AgentTaskProps } from '../AgentTask';

function makeProps(overrides?: Partial<AgentTaskProps>): AgentTaskProps {
  return {
    id: 'task-1',
    agentId: 'ops-assistant',
    todoId: 'todo-1',
    name: '安全扫描',
    status: 'running',
    progress: 50,
    subtasks: [{ id: 'sub-1', name: '子任务A', status: 'pending' }],
    logs: [],
    color: '#007AFF',
    createdAt: 1000,
    updatedAt: 2000,
    ...overrides,
  };
}

describe('AgentTask', () => {
  it('creates from props', () => {
    const task = AgentTask.create(makeProps());
    expect(task.id).toBe('task-1');
    expect(task.agentId).toBe('ops-assistant');
    expect(task.progress).toBe(50);
  });

  it('isActive returns true for running/queued', () => {
    expect(AgentTask.create(makeProps({ status: 'running' })).isActive).toBe(true);
    expect(AgentTask.create(makeProps({ status: 'queued' })).isActive).toBe(true);
    expect(AgentTask.create(makeProps({ status: 'completed' })).isActive).toBe(false);
  });

  it('isTerminal returns true for completed/failed', () => {
    expect(AgentTask.create(makeProps({ status: 'completed' })).isTerminal).toBe(true);
    expect(AgentTask.create(makeProps({ status: 'failed' })).isTerminal).toBe(true);
    expect(AgentTask.create(makeProps({ status: 'running' })).isTerminal).toBe(false);
  });

  it('pause changes status to paused', () => {
    const task = AgentTask.create(makeProps({ status: 'running' }));
    const paused = task.pause();
    expect(paused.status).toBe('paused');
    expect(paused.id).toBe(task.id);
  });

  it('pause is no-op when not running', () => {
    const task = AgentTask.create(makeProps({ status: 'queued' }));
    expect(task.pause().status).toBe('queued');
  });

  it('resume changes status from paused to running', () => {
    const task = AgentTask.create(makeProps({ status: 'paused' }));
    expect(task.resume().status).toBe('running');
  });

  it('resume is no-op when not paused', () => {
    const task = AgentTask.create(makeProps({ status: 'running' }));
    expect(task.resume().status).toBe('running');
  });

  it('cancel changes status to failed', () => {
    const task = AgentTask.create(makeProps({ status: 'running' }));
    expect(task.cancel().status).toBe('failed');
  });

  it('cancel works from paused and queued', () => {
    expect(AgentTask.create(makeProps({ status: 'paused' })).cancel().status).toBe('failed');
    expect(AgentTask.create(makeProps({ status: 'queued' })).cancel().status).toBe('failed');
  });

  it('cancel is no-op when terminal', () => {
    const task = AgentTask.create(makeProps({ status: 'completed' }));
    expect(task.cancel().status).toBe('completed');
  });

  it('withProgress caps at 100', () => {
    const task = AgentTask.create(makeProps({ progress: 80 }));
    expect(task.withProgress(120).progress).toBe(100);
    expect(task.withProgress(90).progress).toBe(90);
  });

  it('withStatus returns new instance', () => {
    const task = AgentTask.create(makeProps());
    const completed = task.withStatus('completed');
    expect(completed.status).toBe('completed');
    expect(task.status).toBe('running');
  });

  it('addLog appends to logs', () => {
    const task = AgentTask.create(makeProps({ logs: [] }));
    const log = { timestamp: Date.now(), level: 'INFO' as const, message: 'done' };
    const updated = task.addLog(log);
    expect(updated.logs).toHaveLength(1);
    expect(updated.logs[0].message).toBe('done');
  });

  it('updateSubtask changes subtask status', () => {
    const task = AgentTask.create(
      makeProps({
        subtasks: [{ id: 'sub-1', name: 'A', status: 'pending' }],
      })
    );
    const updated = task.updateSubtask('sub-1', 'success');
    expect(updated.subtasks[0].status).toBe('success');
  });

  it('canPause/canResume/canCancel guards', () => {
    expect(AgentTask.create(makeProps({ status: 'running' })).canPause).toBe(true);
    expect(AgentTask.create(makeProps({ status: 'paused' })).canResume).toBe(true);
    expect(AgentTask.create(makeProps({ status: 'completed' })).canCancel).toBe(false);
  });
});
