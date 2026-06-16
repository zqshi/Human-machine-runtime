import { describe, it, expect } from 'vitest';
import { CapabilityRegistry } from '../CapabilityRegistry';
import { Agent } from '../Agent';

function makeAgent(id: string): Agent {
  return Agent.create({
    id,
    name: `Agent ${id}`,
    role: 'developer',
    department: 'engineering',
    personality: 'professional',
    model: 'gpt-4o',
    creatorId: 'user-1',
    createdAt: Date.now(),
  });
}

describe('CapabilityRegistry', () => {
  it('createDefault has 8 templates and 0 agents', () => {
    const reg = CapabilityRegistry.createDefault();
    expect(reg.getAvailableTemplates()).toHaveLength(8);
    expect(reg.getActiveAgentCount()).toBe(0);
  });

  it('registerAgent adds agent to template', () => {
    const reg = CapabilityRegistry.createDefault();
    const agent = makeAgent('a1');
    const updated = reg.registerAgent('cap-dev', agent);
    expect(updated.hasActiveAgent('cap-dev')).toBe(true);
    expect(updated.getActiveAgent('cap-dev')?.id).toBe('a1');
    expect(updated.getActiveAgentCount()).toBe(1);
  });

  it('registerAgent is idempotent — no-op for same template', () => {
    const reg = CapabilityRegistry.createDefault();
    const agent1 = makeAgent('a1');
    const agent2 = makeAgent('a2');
    const r1 = reg.registerAgent('cap-dev', agent1);
    const r2 = r1.registerAgent('cap-dev', agent2);
    expect(r2.getActiveAgent('cap-dev')?.id).toBe('a1');
    expect(r2.getActiveAgentCount()).toBe(1);
  });

  it('getAllActiveAgents returns all registered', () => {
    let reg = CapabilityRegistry.createDefault();
    reg = reg.registerAgent('cap-dev', makeAgent('a1'));
    reg = reg.registerAgent('cap-docs', makeAgent('a2'));
    expect(reg.getAllActiveAgents()).toHaveLength(2);
  });

  it('findTemplate returns matching template', () => {
    const reg = CapabilityRegistry.createDefault();
    const t = reg.findTemplate('cap-dev');
    expect(t).toBeDefined();
    expect(t!.name).toBe('代码开发');
  });

  it('findTemplate returns undefined for unknown', () => {
    const reg = CapabilityRegistry.createDefault();
    expect(reg.findTemplate('no-such')).toBeUndefined();
  });

  it('findTemplateByCategory returns matching', () => {
    const reg = CapabilityRegistry.createDefault();
    const t = reg.findTemplateByCategory('data');
    expect(t).toBeDefined();
    expect(t!.name).toBe('数据分析');
  });

  it('is immutable — original unchanged after registerAgent', () => {
    const reg = CapabilityRegistry.createDefault();
    reg.registerAgent('cap-dev', makeAgent('a1'));
    expect(reg.getActiveAgentCount()).toBe(0);
  });
});
