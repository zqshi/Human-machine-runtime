import type {
  AgentPersonality,
  AgentStatus,
  AgentCategory,
  AgentType,
  ModelId,
  UserId,
} from '../shared/types';

export interface AgentProps {
  id: string;
  name: string;
  role: string;
  department: string;
  personality: AgentPersonality;
  model: ModelId;
  agentType?: AgentType;
  status?: AgentStatus;
  category?: AgentCategory;
  employeeId?: string;
  email?: string;
  invokeCount?: number;
  creatorId?: UserId;
  createdAt?: number;
  description?: string;
  avatarGradient?: string;
  capabilities?: string[];
  ownerId?: string;
  persona?: string;
}

export class Agent {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly department: string;
  readonly personality: AgentPersonality;
  readonly model: ModelId;
  readonly agentType: AgentType;
  readonly status: AgentStatus;
  readonly category?: AgentCategory;
  readonly employeeId: string;
  readonly email: string;
  readonly invokeCount: number;
  readonly creatorId?: UserId;
  readonly createdAt: number;
  readonly description?: string;
  readonly avatarGradient?: string;
  readonly capabilities: string[];
  readonly ownerId?: string;
  readonly persona?: string;

  private constructor(props: AgentProps) {
    this.id = props.id;
    this.name = props.name;
    this.role = props.role;
    this.department = props.department;
    this.personality = props.personality;
    this.model = props.model;
    this.agentType = props.agentType ?? 'capability';
    this.status = props.status ?? 'online';
    this.category = props.category;
    this.employeeId = props.employeeId ?? Agent.generateEmployeeId();
    this.email = props.email ?? `${props.id}@example.com`;
    this.invokeCount = props.invokeCount ?? 0;
    this.creatorId = props.creatorId;
    this.createdAt = props.createdAt ?? Date.now();
    this.description = props.description;
    this.avatarGradient = props.avatarGradient;
    this.capabilities = props.capabilities ?? [];
    this.ownerId = props.ownerId;
    this.persona = props.persona;
  }

  static create(props: AgentProps): Agent {
    return new Agent(props);
  }

  private static generateEmployeeId(): string {
    const num = Math.floor(1000 + Math.random() * 9000);
    return `DCF-${num}`;
  }

  isPrimary(): boolean {
    return this.agentType === 'primary';
  }

  isCapability(): boolean {
    return this.agentType === 'capability';
  }

  withInvoke(): Agent {
    return new Agent({
      ...this.toProps(),
      invokeCount: this.invokeCount + 1,
    });
  }

  withCapability(capId: string): Agent {
    if (this.capabilities.includes(capId)) return this;
    return new Agent({
      ...this.toProps(),
      capabilities: [...this.capabilities, capId],
    });
  }

  removeCapability(capId: string): Agent {
    return new Agent({
      ...this.toProps(),
      capabilities: this.capabilities.filter((c) => c !== capId),
    });
  }

  toProps(): AgentProps {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      department: this.department,
      personality: this.personality,
      model: this.model,
      agentType: this.agentType,
      status: this.status,
      category: this.category,
      employeeId: this.employeeId,
      email: this.email,
      invokeCount: this.invokeCount,
      creatorId: this.creatorId,
      createdAt: this.createdAt,
      description: this.description,
      avatarGradient: this.avatarGradient,
      capabilities: this.capabilities,
      ownerId: this.ownerId,
      persona: this.persona,
    };
  }
}
