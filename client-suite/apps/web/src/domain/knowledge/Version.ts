export type VersionStatus = 'auto' | 'manual' | 'published';

export interface VersionProps {
  id: string;
  documentId: string;
  version: number;
  author: { name: string; avatar?: string };
  createdAt: string;
  changeDescription: string;
  diffStats: { added: number; removed: number };
  // ── New fields ──
  contentSnapshot?: string;
  status?: VersionStatus;
}

export class Version {
  readonly id: string;
  readonly documentId: string;
  readonly version: number;
  readonly author: { name: string; avatar?: string };
  readonly createdAt: string;
  readonly changeDescription: string;
  readonly diffStats: { added: number; removed: number };
  readonly contentSnapshot: string;
  readonly status: VersionStatus;

  private constructor(props: VersionProps) {
    this.id = props.id;
    this.documentId = props.documentId;
    this.version = props.version;
    this.author = props.author;
    this.createdAt = props.createdAt;
    this.changeDescription = props.changeDescription;
    this.diffStats = props.diffStats;
    this.contentSnapshot = props.contentSnapshot ?? '';
    this.status = props.status ?? 'auto';
  }

  static create(props: VersionProps): Version {
    return new Version(props);
  }

  get totalChanges(): number {
    return this.diffStats.added + this.diffStats.removed;
  }

  get hasSnapshot(): boolean {
    return this.contentSnapshot.length > 0;
  }

  get isPublished(): boolean {
    return this.status === 'published';
  }

  get statusLabel(): string {
    const labels: Record<VersionStatus, string> = {
      auto: '自动保存',
      manual: '手动保存',
      published: '发布版本',
    };
    return labels[this.status];
  }
}
