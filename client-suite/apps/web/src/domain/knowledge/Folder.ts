export type FolderType = 'system' | 'department' | 'personal' | 'user';

export interface FolderProps {
  id: string;
  name: string;
  parentId: string | null;
  icon: string;
  children?: Folder[];
  documentCount?: number;
  // ── New fields ──
  type?: FolderType;
  departmentId?: string;
  ownerId?: string;
  description?: string;
  color?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class Folder {
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly icon: string;
  readonly children: Folder[];
  readonly documentCount: number;
  readonly type: FolderType;
  readonly departmentId: string;
  readonly ownerId: string;
  readonly description: string;
  readonly color: string;
  readonly createdAt: string;
  readonly updatedAt: string;

  private constructor(props: FolderProps) {
    this.id = props.id;
    this.name = props.name;
    this.parentId = props.parentId;
    this.icon = props.icon;
    this.children = props.children ?? [];
    this.documentCount = props.documentCount ?? 0;
    this.type = props.type ?? 'user';
    this.departmentId = props.departmentId ?? '';
    this.ownerId = props.ownerId ?? '';
    this.description = props.description ?? '';
    this.color = props.color ?? '';
    this.createdAt = props.createdAt ?? new Date().toISOString();
    this.updatedAt = props.updatedAt ?? new Date().toISOString();
  }

  static create(props: FolderProps): Folder {
    return new Folder(props);
  }

  get isRoot(): boolean {
    return this.parentId === null;
  }

  get hasChildren(): boolean {
    return this.children.length > 0;
  }

  get isSystem(): boolean {
    return this.type === 'system';
  }

  get isDepartment(): boolean {
    return this.type === 'department';
  }

  withChildren(children: Folder[]): Folder {
    return new Folder({ ...this.toProps(), children });
  }

  withName(name: string): Folder {
    return new Folder({ ...this.toProps(), name, updatedAt: new Date().toISOString() });
  }

  withDocumentCount(count: number): Folder {
    return new Folder({ ...this.toProps(), documentCount: count });
  }

  addChild(child: Folder): Folder {
    return this.withChildren([...this.children, child]);
  }

  removeChild(childId: string): Folder {
    return this.withChildren(this.children.filter((c) => c.id !== childId));
  }

  matchesSearch(query: string): boolean {
    if (!query) return true;
    return this.name.toLowerCase().includes(query.toLowerCase());
  }

  toProps(): FolderProps {
    return {
      id: this.id,
      name: this.name,
      parentId: this.parentId,
      icon: this.icon,
      children: this.children,
      documentCount: this.documentCount,
      type: this.type,
      departmentId: this.departmentId,
      ownerId: this.ownerId,
      description: this.description,
      color: this.color,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
