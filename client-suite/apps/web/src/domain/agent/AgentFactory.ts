import type { AgentPersonality, ModelId, UserId } from '../shared/types';
import { Agent } from './Agent';

export interface CreateAgentInput {
  name: string;
  role: string;
  department: string;
  personality: AgentPersonality;
  model: ModelId;
  creatorId: UserId;
  description?: string;
}

export class AgentFactory {
  static createAgent(input: CreateAgentInput): Agent {
    const id = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    return Agent.create({
      id,
      name: input.name,
      role: input.role,
      department: input.department,
      personality: input.personality,
      model: input.model,
      creatorId: input.creatorId,
      description: input.description,
      createdAt: Date.now(),
    });
  }
}
