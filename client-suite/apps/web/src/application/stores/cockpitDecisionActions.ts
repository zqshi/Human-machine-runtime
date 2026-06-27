/**
 * cockpitDecisionActions —— 决策请求 CRUD + respondDecision 跨聚合事务
 *
 * respondDecision 在单次调用内同步：更新 decisionRequests → 调用
 * CorrectionPropagator 计算纠偏影响（读取 tasks/goals/collaborationChains）
 * → 回写 goals（linkDecision）→ 写 lastCorrectionPlan → 落 JudgmentRecord。
 * 这是「单事务语义」，不可拆分到独立 store（详见 cockpitStore.ts 头注释）。
 */
import { cockpitApiAdapter } from '../../infrastructure/api/cockpitApiAdapter';
import { CorrectionPropagator } from '../../domain/agent/CorrectionPropagator';
import { JudgmentRecord } from '../../domain/agent/JudgmentRecord';
import type { DecisionSource } from '../../domain/agent/DecisionHub';
import type { DecisionRequest } from '../../domain/agent/DecisionRequest';
import { appEvents } from '../events/eventBus';
import { useToastStore } from './toastStore';
import { useJudgmentStore } from './judgmentStore';
import type { StoreSet, StoreGet } from './cockpitTypes';

export function decisionActions(set: StoreSet, get: StoreGet) {
  return {
    addDecisionRequest(request: DecisionRequest) {
      set({ decisionRequests: [request, ...get().decisionRequests] });
      appEvents.emit('decision:created', {
        decisionId: request.id,
        agentId: request.agentId,
        urgency: request.urgency,
      });
      get().rebuildAttentionItems();
    },

    respondToDecision(decisionId: string, updater: (d: DecisionRequest) => DecisionRequest) {
      set({
        decisionRequests: get().decisionRequests.map((d) => (d.id === decisionId ? updater(d) : d)),
      });
      const updated = get().decisionRequests.find((d) => d.id === decisionId);
      if (updated) {
        appEvents.emit('decision:responded', { decisionId, response: updated.responseStatus });
      }
      get().rebuildAttentionItems();
    },

    respondDecision(
      decisionId: string,
      action: 'accept' | 'modify' | 'decline' | 'defer',
      params?: {
        feedback?: string;
        optionId?: string;
        deferUntil?: number;
      }
    ) {
      const decision = get().decisionRequests.find((d) => d.id === decisionId);
      if (!decision) return;

      let updatedDecision = decision;

      switch (action) {
        case 'accept':
          updatedDecision = decision.accept();
          break;
        case 'modify':
          updatedDecision = decision.modify(
            params?.optionId ?? decision.recommendation.id,
            params?.feedback ?? ''
          );
          break;
        case 'decline':
          updatedDecision = decision.decline(params?.feedback ?? '');
          break;
        case 'defer':
          updatedDecision = decision.defer(params?.deferUntil ?? Date.now() + 2 * 60 * 60 * 1000);
          break;
      }

      set({
        decisionRequests: get().decisionRequests.map((d) =>
          d.id === decisionId ? updatedDecision : d
        ),
      });

      cockpitApiAdapter.respondDecision(decisionId, action, params).catch((err) => {
        console.warn('[CockpitStore] Backend respond failed, local state preserved', err);
      });

      appEvents.emit('decision:responded', {
        decisionId,
        response: updatedDecision.responseStatus,
      });

      for (const goalId of updatedDecision.downstreamGoalIds) {
        const goal = get().goals.find((g) => g.id === goalId);
        if (goal) {
          const updatedGoal = goal.linkDecision(decisionId);
          set({
            goals: get().goals.map((g) => (g.id === goalId ? updatedGoal : g)),
          });
        }
      }

      get().rebuildAttentionItems();

      if (action !== 'defer') {
        const plan = CorrectionPropagator.computePlan(
          updatedDecision,
          get().tasks,
          get().goals,
          get().collaborationChains
        );
        if (plan.affectedTasks.length > 0 || plan.affectedGoals.length > 0) {
          set({ lastCorrectionPlan: plan });
          appEvents.emit('decision:correction-propagated', {
            decisionId,
            affectedTasks: plan.affectedTasks.length,
            affectedGoals: plan.affectedGoals.length,
          });
        }
      }

      try {
        const sourceMap: Record<string, DecisionSource> = {
          'ops-assistant': 'risk-rule-trigger',
          'security-agent': 'risk-rule-trigger',
          'milestone-agent': 'milestone-arrival',
          'collab-agent': 'collaboration-node',
        };
        const source: DecisionSource = sourceMap[updatedDecision.agentId] ?? 'agent-discovery';
        const record = JudgmentRecord.fromDecisionResponse(updatedDecision, source);
        useJudgmentStore.getState().addRecord(record);
        appEvents.emit('judgment:recorded', {
          recordId: record.id,
          decisionId,
          action: record.action,
        });
      } catch {
        // deferred 或其他非终态不生成记录
      }

      const toastStore = useToastStore.getState();
      const actionLabels: Record<string, string> = {
        accept: '已采纳',
        modify: '已修改',
        decline: '已拒绝',
        defer: '已延后',
      };
      toastStore.addToast(`${actionLabels[action]}: ${decision.title}`, 'success');
    },
  };
}
