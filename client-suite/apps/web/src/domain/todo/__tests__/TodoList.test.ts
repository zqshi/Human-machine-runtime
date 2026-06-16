import { describe, it, expect } from 'vitest';
import { Todo } from '../Todo';
import { TodoList } from '../TodoList';

describe('TodoList', () => {
  const makeList = () =>
    TodoList.create({
      id: 'list-1',
      name: '今日待办',
      icon: 'today',
      items: [
        Todo.create({ id: 't1', title: '任务A', listId: 'list-1' }),
        Todo.create({ id: 't2', title: '任务B', listId: 'list-1', completed: true }),
      ],
    });

  it('creates with items', () => {
    const list = makeList();
    expect(list.id).toBe('list-1');
    expect(list.items).toHaveLength(2);
  });

  it('adds a todo', () => {
    const list = makeList();
    const updated = list.addTodo({ id: 't3', title: '新任务' });
    expect(updated.items).toHaveLength(3);
    expect(updated.items[2].listId).toBe('list-1');
    expect(list.items).toHaveLength(2);
  });

  it('toggles a todo', () => {
    const list = makeList();
    const updated = list.toggleTodo('t1');
    expect(updated.items[0].completed).toBe(true);
    expect(list.items[0].completed).toBe(false);
  });

  it('removes a todo', () => {
    const list = makeList();
    const updated = list.removeTodo('t1');
    expect(updated.items).toHaveLength(1);
    expect(updated.items[0].id).toBe('t2');
  });

  it('counts completed and pending', () => {
    const list = makeList();
    expect(list.completedCount).toBe(1);
    expect(list.pendingCount).toBe(1);
  });

  it('creates empty list', () => {
    const list = TodoList.create({ id: 'l', name: 'Empty', icon: 'list' });
    expect(list.items).toEqual([]);
    expect(list.completedCount).toBe(0);
    expect(list.pendingCount).toBe(0);
  });
});
