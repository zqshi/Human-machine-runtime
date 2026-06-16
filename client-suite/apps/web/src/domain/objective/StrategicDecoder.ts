/**
 * StrategicDecoder — 苏格拉底式战略解码器
 *
 * 从模糊意图产出结构化提问链，引导决策者明确战略要素。
 */

export type QuestionCategory =
  | 'measurement'
  | 'risk'
  | 'constraint'
  | 'priority'
  | 'division'
  | 'timeline';

export interface StrategicQuestion {
  readonly id: string;
  readonly question: string;
  readonly category: QuestionCategory;
  readonly priority: 'high' | 'medium' | 'low';
  readonly followUpOnAnswer?: string;
}

export interface DecodedStrategy {
  readonly originalIntent: string;
  readonly questions: readonly StrategicQuestion[];
  readonly hypotheses: readonly string[];
  readonly identifiedConstraints: readonly string[];
  readonly suggestedL1Objectives: readonly string[];
  readonly createdAt: number;
}

const QUESTION_TEMPLATES: Array<{
  category: QuestionCategory;
  template: (intent: string) => string;
  priority: 'high' | 'medium' | 'low';
}> = [
  {
    category: 'measurement',
    template: (i) => `"${i}" 的核心成功指标是什么？如何量化？`,
    priority: 'high',
  },
  { category: 'risk', template: (_) => '实现这一目标最大的不确定性在哪里？', priority: 'high' },
  {
    category: 'constraint',
    template: (_) => '哪些约束是绝对不可违反的？（预算/时间/合规/资源）',
    priority: 'high',
  },
  {
    category: 'priority',
    template: (_) => '如果只能做一件事来推进这个目标，应该是什么？',
    priority: 'medium',
  },
  {
    category: 'division',
    template: (_) => '哪些判断必须由人来做？哪些可以委托给 AI？',
    priority: 'medium',
  },
  {
    category: 'timeline',
    template: (_) => '这个目标的时间边界是什么？有哪些关键里程碑？',
    priority: 'medium',
  },
  {
    category: 'measurement',
    template: (_) => '如何区分"进展顺利"和"偏离轨道"？早期预警信号是什么？',
    priority: 'medium',
  },
  {
    category: 'risk',
    template: (_) => '最坏情况下的损失是什么？可接受的失败边界在哪里？',
    priority: 'low',
  },
];

export class StrategicDecoder {
  static decode(intent: string): DecodedStrategy {
    const questions = StrategicDecoder.generateQuestions(intent);
    const hypotheses = StrategicDecoder.extractHypotheses(intent);
    const constraints = StrategicDecoder.inferConstraints(intent);
    const suggestedL1 = StrategicDecoder.suggestL1Objectives(intent);

    return {
      originalIntent: intent,
      questions,
      hypotheses,
      identifiedConstraints: constraints,
      suggestedL1Objectives: suggestedL1,
      createdAt: Date.now(),
    };
  }

  static generateQuestions(intent: string): StrategicQuestion[] {
    return QUESTION_TEMPLATES.map((tmpl, i) => ({
      id: `sq-${Date.now()}-${i}`,
      question: tmpl.template(intent),
      category: tmpl.category,
      priority: tmpl.priority,
    }));
  }

  static generateFollowUp(question: StrategicQuestion, answer: string): StrategicQuestion[] {
    const followUps: StrategicQuestion[] = [];

    if (question.category === 'measurement' && answer.length > 0) {
      followUps.push({
        id: `sq-fu-${Date.now()}-0`,
        question: `这个指标当前的基线值是多少？目标值是多少？`,
        category: 'measurement',
        priority: 'medium',
      });
    }

    if (question.category === 'risk' && answer.length > 0) {
      followUps.push({
        id: `sq-fu-${Date.now()}-1`,
        question: `针对这一风险，现有的缓解措施是什么？足够吗？`,
        category: 'risk',
        priority: 'medium',
      });
    }

    if (question.category === 'constraint' && answer.length > 0) {
      followUps.push({
        id: `sq-fu-${Date.now()}-2`,
        question: `这些约束中，哪些有协商空间？哪些是硬性的？`,
        category: 'constraint',
        priority: 'low',
      });
    }

    return followUps;
  }

  private static extractHypotheses(intent: string): string[] {
    const hypotheses: string[] = [];
    hypotheses.push(`假设：团队有能力和资源在期望时间内实现"${intent}"`);
    hypotheses.push(`假设：当前市场/组织环境在执行期间保持稳定`);
    hypotheses.push(`假设：关键利益相关者对此目标有共识`);
    return hypotheses;
  }

  private static inferConstraints(intent: string): string[] {
    const constraints: string[] = [];
    if (intent.includes('预算') || intent.includes('成本')) constraints.push('预算约束');
    if (intent.includes('季度') || intent.includes('月')) constraints.push('时间约束');
    if (intent.includes('合规') || intent.includes('安全')) constraints.push('合规约束');
    if (constraints.length === 0) constraints.push('待明确约束');
    return constraints;
  }

  private static suggestL1Objectives(intent: string): string[] {
    return [
      `关键判断 1：${intent} 的可行性评估`,
      `关键判断 2：资源分配优先级决策`,
      `关键判断 3：进度偏差时的调整决策`,
    ];
  }
}
