/**
 * openclawDecisionTreeActions —— 决策树主动活动切片
 *
 * 从 openclawStore 拆分。包含：
 * - expandActivity：展开/收起主动活动（互斥展开）
 * - executeFollowUp：执行决策树的后续动作（当前仅 toast 反馈，占位）
 */
import { useToastStore } from './toastStore';
import type { StoreSet, StoreGet } from './openclawTypes';

export function decisionTreeActions(set: StoreSet, get: StoreGet) {
  return {
    expandActivity(activityId: string | null) {
      const current = get().expandedActivityId;
      set({ expandedActivityId: current === activityId ? null : activityId });
    },

    executeFollowUp(activityId: string, actionId: string) {
      const tree = get().decisionTrees[activityId];
      if (!tree) return;
      const action = tree.followUpActions.find((a) => a.id === actionId);
      if (!action) return;
      useToastStore.getState().addToast(`正在执行: ${action.label}`, 'info');
    },
  };
}
