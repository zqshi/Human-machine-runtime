export type ApprovalType = 'leave' | 'expense' | 'purchase' | 'access';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Applicant {
  name: string;
  department: string;
  avatar?: string;
}

export interface Attachment {
  name: string;
  size: number;
}

export interface ApprovalProps {
  id: string;
  type: ApprovalType;
  title: string;
  applicant: Applicant;
  status: ApprovalStatus;
  reason?: string;
  amount?: number;
  createdAt: string;
  attachments?: Attachment[];
}

export class Approval {
  readonly id: string;
  readonly type: ApprovalType;
  readonly title: string;
  readonly applicant: Applicant;
  readonly status: ApprovalStatus;
  readonly reason?: string;
  readonly amount?: number;
  readonly createdAt: string;
  readonly attachments?: Attachment[];

  private constructor(props: ApprovalProps) {
    this.id = props.id;
    this.type = props.type;
    this.title = props.title;
    this.applicant = props.applicant;
    this.status = props.status;
    this.reason = props.reason;
    this.amount = props.amount;
    this.createdAt = props.createdAt;
    this.attachments = props.attachments;
  }

  static create(props: ApprovalProps): Approval {
    return new Approval(props);
  }

  approve(): Approval {
    return new Approval({ ...this.toProps(), status: 'approved' });
  }

  reject(reason: string): Approval {
    return new Approval({ ...this.toProps(), status: 'rejected', reason });
  }

  get isPending(): boolean {
    return this.status === 'pending';
  }

  private toProps(): ApprovalProps {
    return {
      id: this.id,
      type: this.type,
      title: this.title,
      applicant: this.applicant,
      status: this.status,
      reason: this.reason,
      amount: this.amount,
      createdAt: this.createdAt,
      attachments: this.attachments,
    };
  }
}
