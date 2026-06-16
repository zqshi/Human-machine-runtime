/**
 * ProjectBoard — 项目看板领域实体
 * 支持多列看板、卡片管理、Agent 任务编排。
 */
import type { ExecutionLog } from './AgentTask';
import type { ReasoningStep } from '../notification/Notification';

export interface ProjectBoardColumn {
  id: string;
  name: string;
  color: string;
}

export type CardPriority = 'critical' | 'high' | 'normal' | 'low';
export type CardStatus = 'idle' | 'working' | 'done';

export interface ProjectBoardCard {
  id: string;
  title: string;
  description: string;
  columnId: string;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  priority: CardPriority;
  tags: string[];
  executionLogs: ExecutionLog[];
  reasoningSteps: ReasoningStep[];
  status: CardStatus;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectBoardProps {
  id: string;
  name: string;
  description: string;
  columns: ProjectBoardColumn[];
  cards: ProjectBoardCard[];
  agentIds: string[];
  createdAt: number;
  updatedAt: number;
}

export class ProjectBoard {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly columns: ProjectBoardColumn[];
  readonly cards: ProjectBoardCard[];
  readonly agentIds: string[];
  readonly createdAt: number;
  readonly updatedAt: number;

  private constructor(props: ProjectBoardProps) {
    this.id = props.id;
    this.name = props.name;
    this.description = props.description;
    this.columns = props.columns;
    this.cards = props.cards;
    this.agentIds = props.agentIds;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: ProjectBoardProps): ProjectBoard {
    return new ProjectBoard(props);
  }

  getCardsByColumn(columnId: string): ProjectBoardCard[] {
    return this.cards.filter((c) => c.columnId === columnId);
  }

  getCardById(cardId: string): ProjectBoardCard | undefined {
    return this.cards.find((c) => c.id === cardId);
  }

  get activeAgentCount(): number {
    const ids = new Set(this.cards.filter((c) => c.assignedAgentId).map((c) => c.assignedAgentId));
    return ids.size;
  }

  moveCard(cardId: string, toColumnId: string): ProjectBoard {
    return new ProjectBoard({
      ...this.toProps(),
      cards: this.cards.map((c) =>
        c.id === cardId ? { ...c, columnId: toColumnId, updatedAt: Date.now() } : c,
      ),
      updatedAt: Date.now(),
    });
  }

  addCard(card: ProjectBoardCard): ProjectBoard {
    return new ProjectBoard({
      ...this.toProps(),
      cards: [...this.cards, card],
      updatedAt: Date.now(),
    });
  }

  updateCard(cardId: string, partial: Partial<ProjectBoardCard>): ProjectBoard {
    return new ProjectBoard({
      ...this.toProps(),
      cards: this.cards.map((c) =>
        c.id === cardId ? { ...c, ...partial, updatedAt: Date.now() } : c,
      ),
      updatedAt: Date.now(),
    });
  }

  assignAgent(cardId: string, agentId: string, agentName: string): ProjectBoard {
    return this.updateCard(cardId, {
      assignedAgentId: agentId,
      assignedAgentName: agentName,
      status: 'working',
    });
  }

  toProps(): ProjectBoardProps {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      columns: this.columns,
      cards: this.cards,
      agentIds: this.agentIds,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
