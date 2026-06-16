import { describe, it, expect } from 'vitest';
import { AgentFactory, type CreateAgentInput } from '../AgentFactory';

const input: CreateAgentInput = {
  name: '代码助手',
  role: 'developer',
  department: 'engineering',
  personality: 'professional',
  model: 'gpt-4o',
  creatorId: 'user-1',
  description: '专注代码审查',
};

describe('AgentFactory', () => {
  it('creates agent with generated id', () => {
    const agent = AgentFactory.createAgent(input);
    expect(agent.id).toMatch(/^agent-/);
    expect(agent.name).toBe('代码助手');
    expect(agent.role).toBe('developer');
    expect(agent.department).toBe('engineering');
  });

  it('each call generates unique id', () => {
    const a1 = AgentFactory.createAgent(input);
    const a2 = AgentFactory.createAgent(input);
    expect(a1.id).not.toBe(a2.id);
  });

  it('passes description through', () => {
    const agent = AgentFactory.createAgent(input);
    expect(agent.description).toBe('专注代码审查');
  });
});
