/**
 * AgentSimulator — Agent 行为模拟引擎
 *
 * 定时产生决策请求、更新任务进度、检测过期决策、推进目标里程碑。
 * 所有变更通过 broadcast 回调通知外部（SSE 推送）。
 */

import { newId } from '../../../shared/utils.js';
import {
  type BroadcastFn,
  type IMapStore,
  type AgentSimulatorStores,
  type SimTask,
  type TaskStatus,
  type Decision,
  type Goal,
  type Milestone,
  type SuccessCriterion,
  DECISION_TEMPLATES,
  URGENCY_DEADLINE_MINUTES,
  rand,
  pick,
} from './agent-simulator-types.js';

export type {
  BroadcastFn,
  Urgency,
  RiskLevel,
  DecisionResponseStatus,
  TaskStatus,
  GoalStatus,
  MilestoneStatus,
  IMapStore,
  AgentSimulatorStores,
  SimTask,
  DecisionOption,
  Decision,
  Milestone,
  GoalConstraint,
  GoalAuthorization,
  SuccessCriterion,
  Goal,
} from './agent-simulator-types.js';

export class AgentSimulator {
  private readonly decisionStore: IMapStore<Decision>;
  private readonly taskStore: IMapStore<SimTask>;
  private readonly goalStore: IMapStore<Goal>;
  private readonly broadcast: BroadcastFn;
  private timers: ReturnType<typeof setTimeout>[] = [];

  /* judgmentStore / workOrderStore are retained for interface compatibility
     even though the current simulation logic does not actively use them. */
  private readonly _judgmentStore: IMapStore<unknown>;
  private readonly _workOrderStore: IMapStore<unknown>;

  constructor(stores: AgentSimulatorStores, broadcast: BroadcastFn) {
    this.decisionStore = stores.decisions;
    this.taskStore = stores.tasks;
    this.goalStore = stores.goals;
    this._judgmentStore = stores.judgments;
    this._workOrderStore = stores.workOrders ?? createEmptyMapStore<unknown>();
    this.broadcast = broadcast;
  }

  start(): void {
    this._seedData();
    this._scheduleDecisionGeneration();
    this._scheduleTaskProgress();
    this._scheduleExpirationCheck();
    this._scheduleMilestoneCheck();
    this._scheduleConstraintCheck();
  }

  stop(): void {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
  }

  /** Expose stores for external callers that may need direct access. */
  get judgmentStore(): IMapStore<unknown> {
    return this._judgmentStore;
  }

  get workOrderStore(): IMapStore<unknown> {
    return this._workOrderStore;
  }

  // ── Seed data ────────────────────────────────────────────────────

  private _seedData(): void {
    const now = Date.now();
    const hour = 3_600_000;
    const day = 86_400_000;

    // Seed tasks
    const seedTasks: SimTask[] = [
      {
        id: 'task-sec-scan',
        agentId: 'security-agent',
        name: '安全漏洞巡检',
        status: 'running',
        progress: 65,
        subtasks: [],
        logs: [],
        createdAt: now - 2 * hour,
        updatedAt: now,
      },
      {
        id: 'task-db-optimize',
        agentId: 'data-analyst',
        name: '数据库查询优化',
        status: 'running',
        progress: 30,
        subtasks: [],
        logs: [],
        createdAt: now - hour,
        updatedAt: now,
      },
      {
        id: 'task-log-cleanup',
        agentId: 'ops-assistant',
        name: '日志归档清理',
        status: 'queued',
        progress: 0,
        subtasks: [],
        logs: [],
        createdAt: now - 30 * 60_000,
        updatedAt: now,
      },
      {
        id: 'task-deploy-v3',
        agentId: 'dev-assistant',
        name: 'v3.2.0 部署准备',
        status: 'running',
        progress: 80,
        subtasks: [],
        logs: [],
        createdAt: now - 3 * hour,
        updatedAt: now,
      },
      {
        id: 'task-cert-renew',
        agentId: 'ops-assistant',
        name: 'SSL 证书续期',
        status: 'queued',
        progress: 0,
        subtasks: [],
        logs: [],
        createdAt: now - 10 * 60_000,
        updatedAt: now,
      },
    ];
    for (const t of seedTasks) {
      this.taskStore.set(t.id, t);
    }

    // Seed goals (contract format with constraints/authorization/successCriteria)
    const seedGoals: Goal[] = [
      {
        id: 'goal-security',
        title: '完成 Q2 安全加固',
        description: '在月底前完成所有高危和中危漏洞的修复，确保安全评分达到 A+ 级别。',
        intent: '将安全评分从 B 提升至 A+，消除所有 high/critical 漏洞',
        priority: 'high',
        status: 'active',
        deadline: now + 14 * day,
        milestones: [
          {
            id: 'ms-s1',
            name: '高危漏洞修复',
            status: 'completed',
            completedAt: now - 3 * day,
            relatedTaskIds: [],
          },
          {
            id: 'ms-s2',
            name: '中危漏洞修复',
            status: 'active',
            relatedTaskIds: ['task-sec-scan'],
          },
          {
            id: 'ms-s3',
            name: '安全评分验证',
            status: 'pending',
            relatedTaskIds: [],
          },
        ],
        constraints: [
          {
            id: 'c-s1',
            type: 'timeline',
            description: '必须在 Q2 结束前完成',
            threshold: '14 days',
            hardLimit: true,
          },
          {
            id: 'c-s2',
            type: 'compliance',
            description: '修复过程不可引入新的高危漏洞',
            hardLimit: true,
          },
          {
            id: 'c-s3',
            type: 'quality',
            description: '修复后回归测试通过率 > 99%',
            threshold: '99%',
            hardLimit: false,
          },
        ],
        authorization: {
          autoExecute: ['中低危漏洞补丁升级', '依赖版本更新', '配置变更'],
          requireOwner: ['高危漏洞修复方案', '回滚决策', '延期申请'],
          requireCollaborator: [{ action: '第三方组件替换', collaboratorRole: 'tech-lead' }],
        },
        successCriteria: [
          {
            id: 'sc-s1',
            metric: '高危漏洞数量',
            target: '0',
            measureMethod: '安全扫描报告',
            currentValue: '0',
          },
          {
            id: 'sc-s2',
            metric: '中危漏洞数量',
            target: '0',
            measureMethod: '安全扫描报告',
            currentValue: '3',
          },
          {
            id: 'sc-s3',
            metric: '安全评分',
            target: 'A+',
            measureMethod: '安全评分系统',
            currentValue: 'B+',
          },
        ],
        ownerId: 'admin',
        collaboratorIds: ['sec-lead'],
        parentGoalId: null,
        decompositionStrategy: 'security',
        relatedTaskIds: ['task-sec-scan'],
        relatedDecisionIds: [],
        progressUpdates: [],
        createdAt: now - 5 * day,
        updatedAt: now - day,
      },
      {
        id: 'goal-performance',
        title: '提升 API 性能至 SLA 标准',
        description: '将核心 API 的 P99 延迟降至 150ms 以下，错误率控制在 0.05% 以内。',
        intent: '核心 API P99 < 150ms，错误率 < 0.05%',
        priority: 'critical',
        status: 'active',
        deadline: now + 7 * day,
        milestones: [
          {
            id: 'ms-p1',
            name: '性能基线测量',
            status: 'completed',
            completedAt: now - 2 * day,
            relatedTaskIds: [],
          },
          {
            id: 'ms-p2',
            name: '数据库索引优化',
            status: 'active',
            relatedTaskIds: ['task-db-optimize'],
          },
          {
            id: 'ms-p3',
            name: '连接池扩容',
            status: 'pending',
            relatedTaskIds: [],
          },
          {
            id: 'ms-p4',
            name: '回归验证',
            status: 'pending',
            relatedTaskIds: [],
          },
        ],
        constraints: [
          {
            id: 'c-p1',
            type: 'budget',
            description: '扩容预算不超过 5 万元/月',
            threshold: '50000 CNY',
            hardLimit: true,
          },
          {
            id: 'c-p2',
            type: 'timeline',
            description: '7 日内完成',
            threshold: '7 days',
            hardLimit: true,
          },
          {
            id: 'c-p3',
            type: 'quality',
            description: '优化不可降低现有功能的可用性',
            hardLimit: true,
          },
        ],
        authorization: {
          autoExecute: ['索引创建', '连接池参数调整', '缓存策略变更'],
          requireOwner: ['水平扩容', '架构变更', '预算追加'],
          requireCollaborator: [{ action: '数据库 schema 变更', collaboratorRole: 'dba' }],
        },
        successCriteria: [
          {
            id: 'sc-p1',
            metric: 'P99 延迟',
            target: '< 150ms',
            measureMethod: 'Grafana 监控',
            currentValue: '320ms',
          },
          {
            id: 'sc-p2',
            metric: '错误率',
            target: '< 0.05%',
            measureMethod: 'Prometheus 告警',
            currentValue: '0.12%',
          },
          {
            id: 'sc-p3',
            metric: '可用性',
            target: '> 99.9%',
            measureMethod: 'SLA 仪表盘',
            currentValue: '99.7%',
          },
        ],
        ownerId: 'admin',
        collaboratorIds: ['ops-lead'],
        parentGoalId: null,
        decompositionStrategy: 'performance',
        relatedTaskIds: ['task-db-optimize'],
        relatedDecisionIds: [],
        progressUpdates: [],
        createdAt: now - 3 * day,
        updatedAt: now - 12 * 60_000,
      },
    ];
    for (const g of seedGoals) {
      this.goalStore.set(g.id, g);
    }

    // Seed 1 pending decision
    const dec = this._generateDecision();
    this.decisionStore.set(dec.id, dec);
  }

  // ── Decision generation ──────────────────────────────────────────

  private _generateDecision(): Decision {
    const tpl = pick(DECISION_TEMPLATES);
    const now = Date.now();
    const deadlineMin = URGENCY_DEADLINE_MINUTES[tpl.urgency];

    const taskIds: string[] = [];
    for (const [id, t] of this.taskStore.entries()) {
      if (t.agentId === tpl.agentId && t.status === 'running') taskIds.push(id);
    }
    const goalIds: string[] = [];
    for (const [, g] of this.goalStore.entries()) {
      if (g.relatedTaskIds && g.relatedTaskIds.some((tid) => taskIds.includes(tid)))
        goalIds.push(g.id);
    }

    return {
      id: newId('dec'),
      agentId: tpl.agentId,
      title: tpl.titleFn(),
      context: tpl.contextFn(),
      recommendation: {
        id: newId('opt'),
        label: tpl.rec.label,
        description: `基于当前系统状态的最优方案`,
        reasoning: `AI 分析后推荐此方案，综合风险最低`,
        estimatedImpact: '预计 30 分钟内恢复正常',
        riskLevel: tpl.rec.riskLevel,
      },
      alternatives: [
        {
          id: newId('alt'),
          label: tpl.alt.label,
          description: `备选方案，适用于更保守的策略`,
          reasoning: `在无法确认主方案可行性时的替代选择`,
          estimatedImpact: '恢复时间较长但风险可控',
          riskLevel: tpl.alt.riskLevel,
        },
      ],
      urgency: tpl.urgency,
      deadline: now + deadlineMin * 60_000,
      responseStatus: 'pending',
      userResponse: null,
      responseAt: null,
      createdAt: now,
      updatedAt: now,
      impactScope: taskIds.length + goalIds.length + rand(1, 4),
      downstreamTaskIds: taskIds.slice(0, 2),
      downstreamGoalIds: goalIds.slice(0, 1),
    };
  }

  // ── Scheduled loops ──────────────────────────────────────────────

  private _scheduleDecisionGeneration(): void {
    const generate = (): void => {
      const pendingCount = Array.from(this.decisionStore.values()).filter(
        (d) => d.responseStatus === 'pending'
      ).length;
      if (pendingCount < 5) {
        const dec = this._generateDecision();
        this.decisionStore.set(dec.id, dec);
        this.broadcast('decision:created', dec);
      }
      const delay = rand(30, 90) * 1000;
      const timer = setTimeout(generate, delay);
      this.timers.push(timer);
    };
    const initial = setTimeout(generate, rand(15, 30) * 1000);
    this.timers.push(initial);
  }

  private _scheduleTaskProgress(): void {
    const tick = (): void => {
      for (const [id, task] of this.taskStore.entries()) {
        if (task.status !== 'running') continue;
        const increment = rand(2, 8);
        const newProgress = Math.min(100, task.progress + increment);
        const newStatus: TaskStatus = newProgress >= 100 ? 'completed' : 'running';
        const updated: SimTask = {
          ...task,
          progress: newProgress,
          status: newStatus,
          updatedAt: Date.now(),
        };
        this.taskStore.set(id, updated);
        this.broadcast('task:updated', {
          id,
          progress: newProgress,
          status: newStatus,
        });

        if (newStatus === 'completed') {
          this._promoteQueuedTask();
        }
      }
      const timer = setTimeout(tick, 15_000);
      this.timers.push(timer);
    };
    const initial = setTimeout(tick, 15_000);
    this.timers.push(initial);
  }

  private _promoteQueuedTask(): void {
    for (const [id, task] of this.taskStore.entries()) {
      if (task.status === 'queued') {
        const updated: SimTask = {
          ...task,
          status: 'running',
          updatedAt: Date.now(),
        };
        this.taskStore.set(id, updated);
        this.broadcast('task:updated', {
          id,
          status: 'running',
          progress: 0,
        });
        break;
      }
    }
  }

  private _scheduleExpirationCheck(): void {
    const check = (): void => {
      const now = Date.now();
      for (const [id, dec] of this.decisionStore.entries()) {
        if (dec.responseStatus === 'pending' && now > dec.deadline) {
          const updated: Decision = {
            ...dec,
            responseStatus: 'expired',
            updatedAt: now,
          };
          this.decisionStore.set(id, updated);
          this.broadcast('decision:updated', updated);
        }
      }
      const timer = setTimeout(check, 10_000);
      this.timers.push(timer);
    };
    const initial = setTimeout(check, 10_000);
    this.timers.push(initial);
  }

  private _scheduleMilestoneCheck(): void {
    const check = (): void => {
      for (const [goalId, goal] of this.goalStore.entries()) {
        if (goal.status !== 'active') continue;
        let changed = false;
        const milestones: Milestone[] = (goal.milestones || []).map((ms): Milestone => {
          if (ms.status !== 'active') return ms;
          const allDone =
            ms.relatedTaskIds.length > 0 &&
            ms.relatedTaskIds.every((tid) => {
              const t = this.taskStore.get(tid);
              return t && t.status === 'completed';
            });
          if (allDone) {
            changed = true;
            return { ...ms, status: 'completed', completedAt: Date.now() };
          }
          return ms;
        });

        if (changed) {
          const promoted: Milestone[] = milestones.map((ms, i): Milestone => {
            if (ms.status === 'pending' && i > 0 && milestones[i - 1].status === 'completed') {
              return { ...ms, status: 'active' };
            }
            return ms;
          });
          const allComplete = promoted.every((ms) => ms.status === 'completed');
          const updated: Goal = {
            ...goal,
            milestones: promoted,
            status: allComplete ? 'completed' : 'active',
            updatedAt: Date.now(),
          };
          this.goalStore.set(goalId, updated);
          this.broadcast('goal:updated', updated);

          // Simulate successCriteria progress when milestones complete
          if (goal.successCriteria && goal.successCriteria.length > 0) {
            const completedCount = promoted.filter((ms) => ms.status === 'completed').length;
            const total = promoted.length;
            const ratio = completedCount / total;
            const updatedCriteria: SuccessCriterion[] = goal.successCriteria.map((sc) => {
              if (ratio >= 1) return { ...sc, currentValue: sc.target };
              return sc;
            });
            const g = this.goalStore.get(goalId);
            if (g) {
              g.successCriteria = updatedCriteria;
              g.updatedAt = Date.now();
              this.goalStore.set(goalId, g);
            }
          }
        }
      }
      const timer = setTimeout(check, 20_000);
      this.timers.push(timer);
    };
    const initial = setTimeout(check, 20_000);
    this.timers.push(initial);
  }

  private _scheduleConstraintCheck(): void {
    const check = (): void => {
      for (const [goalId, goal] of this.goalStore.entries()) {
        if (goal.status !== 'active') continue;
        if (!goal.constraints || goal.constraints.length === 0) continue;

        const now = Date.now();
        for (const constraint of goal.constraints) {
          if (!constraint.hardLimit) continue;

          let violated = false;
          let violationMsg = '';

          if (constraint.type === 'timeline' && goal.deadline) {
            const remaining = goal.deadline - now;
            const completedMs = (goal.milestones || []).filter(
              (m) => m.status === 'completed'
            ).length;
            const totalMs = (goal.milestones || []).length;
            if (remaining < 3 * 86_400_000 && totalMs > 0 && completedMs / totalMs < 0.7) {
              violated = true;
              violationMsg = `距离截止日期不足 3 天，但里程碑完成率仅 ${Math.round((completedMs / totalMs) * 100)}%`;
            }
          }

          if (constraint.type === 'budget' && constraint.threshold) {
            if (Math.random() < 0.03) {
              violated = true;
              violationMsg = `预算使用率接近上限 ${constraint.threshold}，当前已使用 ${rand(85, 98)}%`;
            }
          }

          if (violated) {
            const dec: Decision = {
              id: newId('dec'),
              agentId: 'ops-assistant',
              title: `约束告警：${constraint.description}`,
              context: `目标「${goal.title}」的约束条件面临违反风险。${violationMsg}`,
              recommendation: {
                id: newId('opt'),
                label: '调整资源优先级',
                description: '将该目标提升为最高优先级，集中资源推进',
                reasoning: '约束告警需要立即响应以避免违反',
                estimatedImpact: '可能影响其他低优先级目标的进度',
                riskLevel: 'medium',
              },
              alternatives: [
                {
                  id: newId('alt'),
                  label: '协商放宽约束',
                  description: '与目标 owner 沟通，评估是否可以调整约束阈值',
                  reasoning: '某些约束可能在实际执行中过于严格',
                  estimatedImpact: '降低风险但可能影响目标达成标准',
                  riskLevel: 'low',
                },
              ],
              urgency: 'high',
              deadline: now + 30 * 60_000,
              responseStatus: 'pending',
              userResponse: null,
              responseAt: null,
              createdAt: now,
              updatedAt: now,
              impactScope: 1,
              downstreamTaskIds: goal.relatedTaskIds || [],
              downstreamGoalIds: [goalId],
            };
            this.decisionStore.set(dec.id, dec);
            this.broadcast('decision:created', dec);
          }
        }
      }
      const timer = setTimeout(check, 60_000);
      this.timers.push(timer);
    };
    const initial = setTimeout(check, 45_000);
    this.timers.push(initial);
  }
}

// ── Utility: minimal IMapStore implementation ────────────────────────

function createEmptyMapStore<V>(): IMapStore<V> {
  const map = new Map<string, V>();
  return {
    get: (key: string) => map.get(key),
    set: (key: string, value: V) => {
      map.set(key, value);
    },
    values: () => map.values(),
    entries: () => map.entries(),
  };
}
