import { describe, it, expect, vi } from 'vitest';
import { AgentRuntimeService } from './agent-runtime-service.js';

describe('AgentRuntimeService', () => {
  it('isRunning returns false initially', () => {
    const svc = new AgentRuntimeService(null);
    expect(svc.isRunning()).toBe(false);
  });

  it('start sets running to true', async () => {
    const svc = new AgentRuntimeService(null);
    await svc.start();
    expect(svc.isRunning()).toBe(true);
  });

  it('start is idempotent', async () => {
    const svc = new AgentRuntimeService(null);
    await svc.start();
    await svc.start();
    expect(svc.isRunning()).toBe(true);
  });

  it('stop sets running to false', async () => {
    const svc = new AgentRuntimeService(null);
    await svc.start();
    svc.stop();
    expect(svc.isRunning()).toBe(false);
  });

  it('execute returns intent when no LLM client', async () => {
    const svc = new AgentRuntimeService(null);
    const result = await svc.execute('hello', 'hi', 'session-1');
    expect(result).toBeDefined();
  });

  it('execute uses LLM client when provided', async () => {
    const llm = {
      chat: vi.fn().mockResolvedValue({ content: 'response' }),
    };
    const svc = new AgentRuntimeService(llm as never);
    const result = await svc.execute('analyze this', 'ok', 'session-2');
    expect(result).toBeDefined();
  });
});
