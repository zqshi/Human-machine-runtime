import { Todo } from './Todo';
import type { TodoProps } from './Todo';

export interface TodoListProps {
  id: string;
  name: string;
  icon: string;
  items?: Todo[];
}

export class TodoList {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly items: Todo[];

  private constructor(props: TodoListProps) {
    this.id = props.id;
    this.name = props.name;
    this.icon = props.icon;
    this.items = props.items ?? [];
  }

  static create(props: TodoListProps): TodoList {
    return new TodoList(props);
  }

  addTodo(props: Omit<TodoProps, 'listId'>): TodoList {
    const todo = Todo.create({ ...props, listId: this.id });
    return new TodoList({ ...this, items: [...this.items, todo] });
  }

  toggleTodo(todoId: string): TodoList {
    const items = this.items.map((t) =>
      t.id === todoId ? t.toggleCompleted() : t,
    );
    return new TodoList({ ...this, items });
  }

  toggleSubtask(todoId: string, subtaskId: string): TodoList {
    const items = this.items.map((t) =>
      t.id === todoId ? t.toggleSubtask(subtaskId) : t,
    );
    return new TodoList({ ...this, items });
  }

  removeTodo(todoId: string): TodoList {
    return new TodoList({
      ...this,
      items: this.items.filter((t) => t.id !== todoId),
    });
  }

  get completedCount(): number {
    return this.items.filter((t) => t.completed).length;
  }

  get pendingCount(): number {
    return this.items.filter((t) => !t.completed).length;
  }
}
