import type { DocumentPermission, PermissionLevel } from './Permission';
import { hasAtLeast } from './Permission';

export type DocumentType = 'doc' | 'sheet' | 'slide' | 'markdown';
export type DocumentStatus = 'draft' | 'pending_review' | 'published' | 'archived';

/** Valid status transitions */
const VALID_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  draft: ['pending_review', 'published'], // direct publish for admins
  pending_review: ['published', 'draft'], // approve → published, reject → draft
  published: ['archived', 'draft'],       // archive or unpublish
  archived: ['draft'],                     // restore to draft
};

export interface SecuritySettings {
  watermark: boolean;
  preventCopy: boolean;
  preventDownload: boolean;
}

export interface DocumentProps {
  id: string;
  title: string;
  content: string;
  folderId: string;
  type: DocumentType;
  createdAt: string;
  updatedAt: string;
  author: { name: string; avatar?: string };
  tags?: string[];
  starred?: boolean;
  size?: string;
  // ── New fields ──
  status?: DocumentStatus;
  categoryId?: string;
  departmentId?: string;
  ownerId?: string;
  permissions?: DocumentPermission[];
  reviewedBy?: { name: string; avatar?: string };
  reviewComment?: string;
  readCount?: number;
  coverUrl?: string;
  expiryDate?: string;
  securitySettings?: SecuritySettings;
}

export class Document {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly folderId: string;
  readonly type: DocumentType;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly author: { name: string; avatar?: string };
  readonly tags: string[];
  readonly starred: boolean;
  readonly size: string;
  // ── New fields ──
  readonly status: DocumentStatus;
  readonly categoryId: string;
  readonly departmentId: string;
  readonly ownerId: string;
  readonly permissions: DocumentPermission[];
  readonly reviewedBy: { name: string; avatar?: string } | null;
  readonly reviewComment: string;
  readonly readCount: number;
  readonly coverUrl: string;
  readonly expiryDate: string;
  readonly securitySettings: SecuritySettings;

  private constructor(props: DocumentProps) {
    this.id = props.id;
    this.title = props.title;
    this.content = props.content;
    this.folderId = props.folderId;
    this.type = props.type;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.author = props.author;
    this.tags = props.tags ?? [];
    this.starred = props.starred ?? false;
    this.size = props.size ?? '0 KB';
    // New fields with backward-compatible defaults
    this.status = props.status ?? 'draft';
    this.categoryId = props.categoryId ?? props.folderId;
    this.departmentId = props.departmentId ?? '';
    this.ownerId = props.ownerId ?? '';
    this.permissions = props.permissions ?? [];
    this.reviewedBy = props.reviewedBy ?? null;
    this.reviewComment = props.reviewComment ?? '';
    this.readCount = props.readCount ?? 0;
    this.coverUrl = props.coverUrl ?? '';
    this.expiryDate = props.expiryDate ?? '';
    this.securitySettings = props.securitySettings ?? {
      watermark: false,
      preventCopy: false,
      preventDownload: false,
    };
  }

  static create(props: DocumentProps): Document {
    return new Document(props);
  }

  // ── Immutable updaters ──

  withContent(content: string): Document {
    return new Document({ ...this.toProps(), content, updatedAt: new Date().toISOString() });
  }

  withStarred(starred: boolean): Document {
    return new Document({ ...this.toProps(), starred });
  }

  withTitle(title: string): Document {
    return new Document({ ...this.toProps(), title, updatedAt: new Date().toISOString() });
  }

  withStatus(status: DocumentStatus): Document {
    return new Document({ ...this.toProps(), status, updatedAt: new Date().toISOString() });
  }

  withCategory(categoryId: string): Document {
    return new Document({ ...this.toProps(), categoryId, folderId: categoryId, updatedAt: new Date().toISOString() });
  }

  withPermissions(permissions: DocumentPermission[]): Document {
    return new Document({ ...this.toProps(), permissions });
  }

  withReview(reviewedBy: { name: string; avatar?: string }, comment?: string): Document {
    return new Document({ ...this.toProps(), reviewedBy, reviewComment: comment ?? '' });
  }

  withSecuritySettings(settings: Partial<SecuritySettings>): Document {
    return new Document({
      ...this.toProps(),
      securitySettings: { ...this.securitySettings, ...settings },
    });
  }

  // ── Lifecycle methods ──

  canTransitionTo(target: DocumentStatus): boolean {
    return VALID_TRANSITIONS[this.status].includes(target);
  }

  submitForReview(): Document {
    if (!this.canTransitionTo('pending_review')) {
      throw new Error(`Cannot submit for review from status: ${this.status}`);
    }
    return this.withStatus('pending_review');
  }

  approve(reviewer: { name: string; avatar?: string }): Document {
    if (!this.canTransitionTo('published')) {
      throw new Error(`Cannot approve from status: ${this.status}`);
    }
    return new Document({
      ...this.toProps(),
      status: 'published',
      reviewedBy: reviewer,
      reviewComment: '',
      updatedAt: new Date().toISOString(),
    });
  }

  reject(reviewer: { name: string; avatar?: string }, comment: string): Document {
    if (this.status !== 'pending_review') {
      throw new Error(`Cannot reject from status: ${this.status}`);
    }
    return new Document({
      ...this.toProps(),
      status: 'draft',
      reviewedBy: reviewer,
      reviewComment: comment,
      updatedAt: new Date().toISOString(),
    });
  }

  publish(): Document {
    if (!this.canTransitionTo('published')) {
      throw new Error(`Cannot publish from status: ${this.status}`);
    }
    return this.withStatus('published');
  }

  archive(): Document {
    if (!this.canTransitionTo('archived')) {
      throw new Error(`Cannot archive from status: ${this.status}`);
    }
    return this.withStatus('archived');
  }

  // ── Permission checks ──

  isAccessibleBy(userId: string, requiredLevel: PermissionLevel = 'view'): boolean {
    if (this.ownerId === userId) return true;
    const perm = this.permissions.find((p) => p.userId === userId);
    if (!perm) return false;
    return hasAtLeast(perm.level, requiredLevel);
  }

  // ── Queries ──

  get excerpt(): string {
    const plain = this.content.replace(/<[^>]*>/g, '');
    return plain.length > 100 ? plain.slice(0, 100) + '...' : plain;
  }

  get isDraft(): boolean { return this.status === 'draft'; }
  get isPendingReview(): boolean { return this.status === 'pending_review'; }
  get isPublished(): boolean { return this.status === 'published'; }
  get isArchived(): boolean { return this.status === 'archived'; }

  get statusLabel(): string {
    const labels: Record<DocumentStatus, string> = {
      draft: '草稿',
      pending_review: '审核中',
      published: '已发布',
      archived: '已归档',
    };
    return labels[this.status];
  }

  get statusColor(): string {
    const colors: Record<DocumentStatus, string> = {
      draft: 'text-slate-400',
      pending_review: 'text-orange-400',
      published: 'text-green-400',
      archived: 'text-slate-500',
    };
    return colors[this.status];
  }

  matchesSearch(query: string): boolean {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      this.title.toLowerCase().includes(q) ||
      this.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  /** Serialize back to props (for spreading into constructor) */
  toProps(): DocumentProps {
    return {
      id: this.id,
      title: this.title,
      content: this.content,
      folderId: this.folderId,
      type: this.type,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      author: this.author,
      tags: this.tags,
      starred: this.starred,
      size: this.size,
      status: this.status,
      categoryId: this.categoryId,
      departmentId: this.departmentId,
      ownerId: this.ownerId,
      permissions: this.permissions,
      reviewedBy: this.reviewedBy ?? undefined,
      reviewComment: this.reviewComment,
      readCount: this.readCount,
      coverUrl: this.coverUrl,
      expiryDate: this.expiryDate,
      securitySettings: this.securitySettings,
    };
  }
}
