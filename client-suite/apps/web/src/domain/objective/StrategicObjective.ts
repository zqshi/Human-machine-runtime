/**
 * StrategicObjective — L0 战略目标
 *
 * 组织级别的方向性目标：
 * direction + coreConstraints + confidenceScore + timeHorizon
 */

export type TimeHorizon = 'quarterly' | 'half-year' | 'annual' | 'multi-year';

export interface StrategicConstraint {
  readonly id: string;
  readonly description: string;
  readonly type: 'budget' | 'resource' | 'compliance' | 'timeline' | 'technology';
  readonly isMandatory: boolean;
}

export interface StrategicObjectiveProps {
  id: string;
  direction: string;
  description: string;
  coreConstraints: StrategicConstraint[];
  confidenceScore: number;
  timeHorizon: TimeHorizon;
  linkedL1Ids: string[];
  status: 'draft' | 'active' | 'paused' | 'achieved' | 'abandoned';
  createdAt: number;
  updatedAt: number;
}

export class StrategicObjective {
  readonly id: string;
  readonly direction: string;
  readonly description: string;
  readonly coreConstraints: readonly StrategicConstraint[];
  readonly confidenceScore: number;
  readonly timeHorizon: TimeHorizon;
  readonly linkedL1Ids: readonly string[];
  readonly status: StrategicObjectiveProps['status'];
  readonly createdAt: number;
  readonly updatedAt: number;

  private constructor(props: StrategicObjectiveProps) {
    this.id = props.id;
    this.direction = props.direction;
    this.description = props.description;
    this.coreConstraints = props.coreConstraints;
    this.confidenceScore = props.confidenceScore;
    this.timeHorizon = props.timeHorizon;
    this.linkedL1Ids = props.linkedL1Ids;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(
    props: Omit<
      StrategicObjectiveProps,
      'id' | 'createdAt' | 'updatedAt' | 'status' | 'linkedL1Ids' | 'confidenceScore'
    >
  ): StrategicObjective {
    const now = Date.now();
    return new StrategicObjective({
      ...props,
      id: `l0-${now}-${Math.random().toString(36).slice(2, 7)}`,
      status: 'draft',
      linkedL1Ids: [],
      confidenceScore: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromProps(props: StrategicObjectiveProps): StrategicObjective {
    return new StrategicObjective(props);
  }

  activate(): StrategicObjective {
    return new StrategicObjective({ ...this.toProps(), status: 'active', updatedAt: Date.now() });
  }

  pause(): StrategicObjective {
    return new StrategicObjective({ ...this.toProps(), status: 'paused', updatedAt: Date.now() });
  }

  achieve(): StrategicObjective {
    return new StrategicObjective({ ...this.toProps(), status: 'achieved', updatedAt: Date.now() });
  }

  linkL1(l1Id: string): StrategicObjective {
    if (this.linkedL1Ids.includes(l1Id)) return this;
    return new StrategicObjective({
      ...this.toProps(),
      linkedL1Ids: [...this.linkedL1Ids, l1Id],
      updatedAt: Date.now(),
    });
  }

  unlinkL1(l1Id: string): StrategicObjective {
    return new StrategicObjective({
      ...this.toProps(),
      linkedL1Ids: this.linkedL1Ids.filter((id) => id !== l1Id),
      updatedAt: Date.now(),
    });
  }

  updateConfidence(score: number): StrategicObjective {
    return new StrategicObjective({
      ...this.toProps(),
      confidenceScore: Math.max(0, Math.min(1, score)),
      updatedAt: Date.now(),
    });
  }

  get mandatoryConstraints(): readonly StrategicConstraint[] {
    return this.coreConstraints.filter((c) => c.isMandatory);
  }

  get isActive(): boolean {
    return this.status === 'active';
  }

  private toProps(): StrategicObjectiveProps {
    return {
      id: this.id,
      direction: this.direction,
      description: this.description,
      coreConstraints: [...this.coreConstraints],
      confidenceScore: this.confidenceScore,
      timeHorizon: this.timeHorizon,
      linkedL1Ids: [...this.linkedL1Ids],
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
