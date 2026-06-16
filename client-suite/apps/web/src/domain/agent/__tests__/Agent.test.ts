import { describe, it, expect } from 'vitest';
import { Agent } from '../Agent';
import { AgentFactory } from '../AgentFactory';

describe('Agent', () => {
  it('creates an agent with required fields', () => {
    const agent = Agent.create({
      id: 'agent-001',
      name: 'Alice',
      role: 'Frontend Engineer',
      department: 'Engineering',
      personality: 'professional',
      model: 'claude-sonnet-4-6',
    });
    expect(agent.id).toBe('agent-001');
    expect(agent.name).toBe('Alice');
    expect(agent.status).toBe('online');
    expect(agent.employeeId).toBeDefined();
  });

  it('generates employee ID and email', () => {
    const agent = Agent.create({
      id: 'agent-002',
      name: 'Bob',
      role: 'QA Engineer',
      department: 'QA',
      personality: 'analytical',
      model: 'gpt-4o',
    });
    expect(agent.employeeId).toMatch(/^DCF-/);
    expect(agent.email).toMatch(/@example\.com$/);
  });

  it('tracks invocation count', () => {
    const agent = Agent.create({
      id: 'agent-003',
      name: 'Test',
      role: 'Dev',
      department: 'Eng',
      personality: 'creative',
      model: 'deepseek-r1',
    });
    expect(agent.invokeCount).toBe(0);
    const invoked = agent.withInvoke();
    expect(invoked.invokeCount).toBe(1);
    expect(agent.invokeCount).toBe(0); // immutable
  });
});

describe('AgentFactory', () => {
  it('creates agent with auto-generated fields', () => {
    const agent = AgentFactory.createAgent({
      name: 'Doc Helper',
      role: 'Doc Writer',
      department: 'Content',
      personality: 'friendly',
      model: 'claude-opus-4-6',
      creatorId: '@alice:example.com',
    });
    expect(agent.id).toMatch(/^agent-/);
    expect(agent.createdAt).toBeDefined();
    expect(agent.creatorId).toBe('@alice:example.com');
  });
});
