import type { AgentCategory } from '../shared/types';
import type { Agent } from './Agent';
import type { CapabilityTemplate } from './CapabilityTemplate';
import { DEFAULT_CAPABILITY_TEMPLATES } from './CapabilityTemplate';

/**
 * CapabilityRegistry — 组织级能力注册表
 *
 * 管理所有能力模板（8 个预置）及其已激活的 Agent 实例。
 * 核心规则：同一 templateId 只允许注册一个 active agent，防止重复创建。
 * 不可变值对象 — 所有变更返回新实例。
 */
export class CapabilityRegistry {
  private constructor(
    private readonly templates: CapabilityTemplate[],
    private readonly activeAgents: ReadonlyMap<string, Agent>,
  ) {}

  static createDefault(): CapabilityRegistry {
    return new CapabilityRegistry(DEFAULT_CAPABILITY_TEMPLATES, new Map());
  }

  static fromSnapshot(
    templates: CapabilityTemplate[],
    agents: ReadonlyMap<string, Agent>,
  ): CapabilityRegistry {
    return new CapabilityRegistry(templates, agents);
  }

  hasActiveAgent(templateId: string): boolean {
    return this.activeAgents.has(templateId);
  }

  getActiveAgent(templateId: string): Agent | undefined {
    return this.activeAgents.get(templateId);
  }

  getAllActiveAgents(): Agent[] {
    return [...this.activeAgents.values()];
  }

  getActiveAgentCount(): number {
    return this.activeAgents.size;
  }

  registerAgent(templateId: string, agent: Agent): CapabilityRegistry {
    if (this.activeAgents.has(templateId)) {
      return this; // already registered — no-op per design
    }
    const next = new Map(this.activeAgents);
    next.set(templateId, agent);
    return new CapabilityRegistry(this.templates, next);
  }

  getAvailableTemplates(): CapabilityTemplate[] {
    return this.templates;
  }

  findTemplate(templateId: string): CapabilityTemplate | undefined {
    return this.templates.find((t) => t.id === templateId);
  }

  findTemplateByCategory(category: AgentCategory): CapabilityTemplate | undefined {
    return this.templates.find((t) => t.category === category);
  }
}
