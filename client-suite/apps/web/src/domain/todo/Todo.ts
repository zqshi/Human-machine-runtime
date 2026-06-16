export type TodoPriority = 'high' | 'medium' | 'low';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TodoProps {
  id: string;
  title: string;
  completed?: boolean;
  priority?: TodoPriority;
  dueDate?: string | null;
  subtasks?: Subtask[];
  assignee?: string | null;
  description?: string;
  listId: string;
  channelId?: string | null;
  channelName?: string | null;
  documentId?: string | null;
  documentName?: string | null;
}

export class Todo {
  readonly id: string;
  readonly title: string;
  readonly completed: boolean;
  readonly priority: TodoPriority;
  readonly dueDate: string | null;
  readonly subtasks: Subtask[];
  readonly assignee: string | null;
  readonly description: string;
  readonly listId: string;
  readonly channelId: string | null;
  readonly channelName: string | null;
  readonly documentId: string | null;
  readonly documentName: string | null;

  private constructor(props: TodoProps) {
    this.id = props.id;
    this.title = props.title;
    this.completed = props.completed ?? false;
    this.priority = props.priority ?? 'medium';
    this.dueDate = props.dueDate ?? null;
    this.subtasks = props.subtasks ?? [];
    this.assignee = props.assignee ?? null;
    this.description = props.description ?? '';
    this.listId = props.listId;
    this.channelId = props.channelId ?? null;
    this.channelName = props.channelName ?? null;
    this.documentId = props.documentId ?? null;
    this.documentName = props.documentName ?? null;
  }

  static create(props: TodoProps): Todo {
    return new Todo(props);
  }

  toggleCompleted(): Todo {
    return new Todo({ ...this, completed: !this.completed });
  }

  toggleSubtask(subtaskId: string): Todo {
    const subtasks = this.subtasks.map((s) =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s,
    );
    return new Todo({ ...this, subtasks });
  }

  get completedSubtaskCount(): number {
    return this.subtasks.filter((s) => s.completed).length;
  }

  get isOverdue(): boolean {
    if (!this.dueDate) return false;
    return new Date(this.dueDate) < new Date();
  }
}
