import { describe, it, expect } from 'vitest';
import { Todo } from '../Todo';

describe('Todo', () => {
  const base = {
    id: 'todo-1',
    title: '完成需求文档',
    listId: 'list-1',
  };

  it('creates with defaults', () => {
    const todo = Todo.create(base);
    expect(todo.id).toBe('todo-1');
    expect(todo.completed).toBe(false);
    expect(todo.priority).toBe('medium');
    expect(todo.dueDate).toBeNull();
    expect(todo.subtasks).toEqual([]);
    expect(todo.assignee).toBeNull();
    expect(todo.description).toBe('');
  });

  it('creates with all props', () => {
    const todo = Todo.create({
      ...base,
      completed: true,
      priority: 'high',
      dueDate: '2026-03-10',
      assignee: 'Alice',
      description: '编写 PRD',
      subtasks: [{ id: 's1', title: '草稿', completed: true }],
    });
    expect(todo.completed).toBe(true);
    expect(todo.priority).toBe('high');
    expect(todo.assignee).toBe('Alice');
    expect(todo.subtasks).toHaveLength(1);
  });

  it('toggles completion immutably', () => {
    const todo = Todo.create(base);
    const toggled = todo.toggleCompleted();
    expect(toggled.completed).toBe(true);
    expect(todo.completed).toBe(false);
  });

  it('toggles subtask completion', () => {
    const todo = Todo.create({
      ...base,
      subtasks: [{ id: 's1', title: '子任务', completed: false }],
    });
    const toggled = todo.toggleSubtask('s1');
    expect(toggled.subtasks[0].completed).toBe(true);
    expect(todo.subtasks[0].completed).toBe(false);
  });

  it('counts completed subtasks', () => {
    const todo = Todo.create({
      ...base,
      subtasks: [
        { id: 's1', title: 'A', completed: true },
        { id: 's2', title: 'B', completed: false },
      ],
    });
    expect(todo.completedSubtaskCount).toBe(1);
  });
});
