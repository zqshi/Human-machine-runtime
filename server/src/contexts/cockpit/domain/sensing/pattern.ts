/**
 * Pattern — 模式领域实体（v2.1 EAOS 感知子系统，对标前端 client-suite domain/knowledge/DecisionPattern）。
 *
 * immutable DDD：private constructor + static create/fromProps。
 * 不变式：patternType 限定枚举（pattern | knowledge_pattern，fromProps 校验）。
 * pattern / knowledge_pattern 两类 EAV entityType 合并到本表。
 * 零外部依赖（守 §1.1）。
 */

export type PatternType = 'pattern' | 'knowledge_pattern';

const PATTERN_TYPES: readonly PatternType[] = ['pattern', 'knowledge_pattern'];

export interface PatternProps {
  id: string;
  patternType: PatternType;
  pattern?: string;
  data: Record<string, unknown>;
  tenantId?: string;
  createdAt: Date;
}

function asPatternType(value: string): PatternType {
  if (!PATTERN_TYPES.includes(value as PatternType)) {
    throw new Error(`invalid patternType "${value}", expected one of ${PATTERN_TYPES.join('|')}`);
  }
  return value as PatternType;
}

export class Pattern {
  readonly id: string;
  readonly patternType: PatternType;
  readonly pattern?: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly tenantId?: string;
  readonly createdAt: Date;

  private constructor(props: PatternProps) {
    this.id = props.id;
    this.patternType = props.patternType;
    this.pattern = props.pattern;
    this.data = props.data;
    this.tenantId = props.tenantId;
    this.createdAt = props.createdAt;
  }

  /** 工厂：新建 pattern（默认 patternType=pattern）。 */
  static create(props: {
    pattern?: string;
    data?: Record<string, unknown>;
    patternType?: PatternType;
    tenantId?: string;
  }): Pattern {
    const now = new Date();
    return new Pattern({
      id: `pat-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
      patternType: props.patternType ?? 'pattern',
      pattern: props.pattern,
      data: props.data ?? {},
      tenantId: props.tenantId,
      createdAt: now,
    });
  }

  /** DB 重建：校验 patternType 不变式，脏数据拒建。 */
  static fromProps(props: PatternProps): Pattern {
    return new Pattern({
      id: props.id,
      patternType: asPatternType(props.patternType),
      pattern: props.pattern,
      data: props.data ?? {},
      tenantId: props.tenantId,
      createdAt: props.createdAt,
    });
  }

  get isKnowledgePattern(): boolean {
    return this.patternType === 'knowledge_pattern';
  }

  toProps(): PatternProps {
    return {
      id: this.id,
      patternType: this.patternType,
      pattern: this.pattern,
      data: { ...this.data },
      tenantId: this.tenantId,
      createdAt: this.createdAt,
    };
  }
}
