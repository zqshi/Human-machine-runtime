import { describe, it, expect } from 'vitest';
import {
  ProjectBoard,
  type ProjectBoardCard,
  type ProjectBoardColumn,
  type ProjectBoardProps,
} from '../ProjectBoard';

const col1: ProjectBoardColumn = { id: 'col-todo', name: 'Todo', color: '#ccc' };
const col2: ProjectBoardColumn = { id: 'col-doing', name: 'Doing', color: '#3af' };

const makeCard = (id: string, columnId: string): ProjectBoardCard => ({
  id,
  title: `Card ${id}`,
  description: '',
  columnId,
  assignedAgentId: null,
  assignedAgentName: null,
  priority: 'normal',
  tags: [],
  executionLogs: [],
  reasoningSteps: [],
  status: 'idle',
  createdAt: 1000,
  updatedAt: 1000,
});

const baseProps: ProjectBoardProps = {
  id: 'board-1',
  name: 'Sprint Board',
  description: 'test board',
  columns: [col1, col2],
  cards: [makeCard('c1', 'col-todo'), makeCard('c2', 'col-todo')],
  agentIds: ['agent-a'],
  createdAt: 1000,
  updatedAt: 1000,
};

describe('ProjectBoard', () => {
  it('creates from props', () => {
    const board = ProjectBoard.create(baseProps);
    expect(board.id).toBe('board-1');
    expect(board.columns).toHaveLength(2);
    expect(board.cards).toHaveLength(2);
  });

  it('getCardsByColumn filters correctly', () => {
    const board = ProjectBoard.create(baseProps);
    expect(board.getCardsByColumn('col-todo')).toHaveLength(2);
    expect(board.getCardsByColumn('col-doing')).toHaveLength(0);
  });

  it('getCardById returns correct card', () => {
    const board = ProjectBoard.create(baseProps);
    expect(board.getCardById('c1')?.title).toBe('Card c1');
    expect(board.getCardById('no-such')).toBeUndefined();
  });

  it('activeAgentCount counts unique assigned agents', () => {
    const board = ProjectBoard.create({
      ...baseProps,
      cards: [
        { ...makeCard('c1', 'col-todo'), assignedAgentId: 'agent-a', assignedAgentName: 'A' },
        { ...makeCard('c2', 'col-todo'), assignedAgentId: 'agent-a', assignedAgentName: 'A' },
        { ...makeCard('c3', 'col-doing'), assignedAgentId: 'agent-b', assignedAgentName: 'B' },
        makeCard('c4', 'col-doing'),
      ],
    });
    expect(board.activeAgentCount).toBe(2);
  });

  it('moveCard moves card to target column', () => {
    const board = ProjectBoard.create(baseProps);
    const updated = board.moveCard('c1', 'col-doing');
    expect(updated.getCardsByColumn('col-doing')).toHaveLength(1);
    expect(updated.getCardsByColumn('col-doing')[0].id).toBe('c1');
    expect(updated.getCardsByColumn('col-todo')).toHaveLength(1);
  });

  it('addCard appends card', () => {
    const board = ProjectBoard.create(baseProps);
    const newCard = makeCard('c3', 'col-doing');
    const updated = board.addCard(newCard);
    expect(updated.cards).toHaveLength(3);
    expect(updated.getCardById('c3')).toBeDefined();
  });

  it('updateCard partial update', () => {
    const board = ProjectBoard.create(baseProps);
    const updated = board.updateCard('c1', { priority: 'critical', status: 'working' });
    const card = updated.getCardById('c1')!;
    expect(card.priority).toBe('critical');
    expect(card.status).toBe('working');
  });

  it('assignAgent sets agent and status', () => {
    const board = ProjectBoard.create(baseProps);
    const updated = board.assignAgent('c1', 'agent-x', 'Agent X');
    const card = updated.getCardById('c1')!;
    expect(card.assignedAgentId).toBe('agent-x');
    expect(card.assignedAgentName).toBe('Agent X');
    expect(card.status).toBe('working');
  });

  it('is immutable — original unchanged after moveCard', () => {
    const board = ProjectBoard.create(baseProps);
    board.moveCard('c1', 'col-doing');
    expect(board.getCardsByColumn('col-todo')).toHaveLength(2);
  });

  it('toProps round-trips', () => {
    const board = ProjectBoard.create(baseProps);
    const props = board.toProps();
    const board2 = ProjectBoard.create(props);
    expect(board2.id).toBe(board.id);
    expect(board2.cards).toHaveLength(board.cards.length);
  });
});
