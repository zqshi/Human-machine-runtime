/**
 * AgentCell — 智能单元
 *
 * 员工 + 其 AI 协作者组成的最小单元。
 * 发布 capability（通过 IntentProtocol）+ 接收 intent。
 */

import type { IntentDescriptor } from './IntentProtocol';

export interface AgentCellMember {
  readonly id: string;
  readonly type: 'human' | 'agent';
  readonly name: string;
  readonly role: string;
}

export interface AgentCellProps {
  id: string;
  name: string;
  members: AgentCellMember[];
  capabilities: IntentDescriptor[];
  activeSessionIds: string[];
  createdAt: number;
}

export class AgentCell {
  readonly id: string;
  readonly name: string;
  readonly members: readonly AgentCellMember[];
  readonly capabilities: readonly IntentDescriptor[];
  readonly activeSessionIds: readonly string[];
  readonly createdAt: number;

  private constructor(props: AgentCellProps) {
    this.id = props.id;
    this.name = props.name;
    this.members = props.members;
    this.capabilities = props.capabilities;
    this.activeSessionIds = props.activeSessionIds;
    this.createdAt = props.createdAt;
  }

  static create(props: {
    name: string;
    members: AgentCellMember[];
    capabilities?: IntentDescriptor[];
  }): AgentCell {
    return new AgentCell({
      id: `cell-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: props.name,
      members: props.members,
      capabilities: props.capabilities ?? [],
      activeSessionIds: [],
      createdAt: Date.now(),
    });
  }

  addMember(member: AgentCellMember): AgentCell {
    if (this.members.some((m) => m.id === member.id)) return this;
    return new AgentCell({
      ...this.toProps(),
      members: [...this.members, member],
    });
  }

  removeMember(memberId: string): AgentCell {
    return new AgentCell({
      ...this.toProps(),
      members: this.members.filter((m) => m.id !== memberId),
    });
  }

  addCapability(capability: IntentDescriptor): AgentCell {
    if (this.capabilities.some((c) => c.type === capability.type)) return this;
    return new AgentCell({
      ...this.toProps(),
      capabilities: [...this.capabilities, capability],
    });
  }

  removeCapability(intentType: string): AgentCell {
    return new AgentCell({
      ...this.toProps(),
      capabilities: this.capabilities.filter((c) => c.type !== intentType),
    });
  }

  joinSession(sessionId: string): AgentCell {
    if (this.activeSessionIds.includes(sessionId)) return this;
    return new AgentCell({
      ...this.toProps(),
      activeSessionIds: [...this.activeSessionIds, sessionId],
    });
  }

  leaveSession(sessionId: string): AgentCell {
    return new AgentCell({
      ...this.toProps(),
      activeSessionIds: this.activeSessionIds.filter((id) => id !== sessionId),
    });
  }

  get humanMembers(): readonly AgentCellMember[] {
    return this.members.filter((m) => m.type === 'human');
  }

  get agentMembers(): readonly AgentCellMember[] {
    return this.members.filter((m) => m.type === 'agent');
  }

  get isActive(): boolean {
    return this.activeSessionIds.length > 0;
  }

  canHandle(intentType: string): boolean {
    return this.capabilities.some((c) => c.type === intentType);
  }

  private toProps(): AgentCellProps {
    return {
      id: this.id,
      name: this.name,
      members: [...this.members],
      capabilities: [...this.capabilities],
      activeSessionIds: [...this.activeSessionIds],
      createdAt: this.createdAt,
    };
  }
}
