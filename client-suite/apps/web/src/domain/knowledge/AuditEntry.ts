/**
 * AuditEntry — 审计日志值对象
 */
export type AuditOperationType =
  | 'create'
  | 'edit'
  | 'delete'
  | 'publish'
  | 'archive'
  | 'permission'
  | 'review_approve'
  | 'review_reject'
  | 'restore'
  | 'login';

export interface AuditEntryProps {
  id: string;
  timestamp: string;
  operatorId: string;
  operatorName: string;
  operatorRole?: string;
  operatorAvatar?: string;
  operationType: AuditOperationType;
  targetId: string;
  targetName: string;
  resourcePath: string;
  ip?: string;
  metadata?: Record<string, string>;
}

export class AuditEntry {
  readonly id: string;
  readonly timestamp: string;
  readonly operatorId: string;
  readonly operatorName: string;
  readonly operatorRole: string;
  readonly operatorAvatar: string;
  readonly operationType: AuditOperationType;
  readonly targetId: string;
  readonly targetName: string;
  readonly resourcePath: string;
  readonly ip: string;
  readonly metadata: Record<string, string>;

  private constructor(props: AuditEntryProps) {
    this.id = props.id;
    this.timestamp = props.timestamp;
    this.operatorId = props.operatorId;
    this.operatorName = props.operatorName;
    this.operatorRole = props.operatorRole ?? '';
    this.operatorAvatar = props.operatorAvatar ?? '';
    this.operationType = props.operationType;
    this.targetId = props.targetId;
    this.targetName = props.targetName;
    this.resourcePath = props.resourcePath;
    this.ip = props.ip ?? '';
    this.metadata = props.metadata ?? {};
  }

  static create(props: AuditEntryProps): AuditEntry {
    return new AuditEntry(props);
  }

  get operationLabel(): string {
    const labels: Record<AuditOperationType, string> = {
      create: '创建',
      edit: '编辑',
      delete: '删除',
      publish: '发布',
      archive: '归档',
      permission: '权限变更',
      review_approve: '审核通过',
      review_reject: '审核驳回',
      restore: '恢复版本',
      login: '登录',
    };
    return labels[this.operationType];
  }

  get operationColor(): string {
    const colors: Record<AuditOperationType, string> = {
      create: 'text-green-500',
      edit: 'text-blue-500',
      delete: 'text-red-500',
      publish: 'text-primary',
      archive: 'text-slate-500',
      permission: 'text-purple-500',
      review_approve: 'text-green-500',
      review_reject: 'text-orange-500',
      restore: 'text-blue-500',
      login: 'text-orange-500',
    };
    return colors[this.operationType];
  }
}
