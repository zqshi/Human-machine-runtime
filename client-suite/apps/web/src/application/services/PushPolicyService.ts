import { appEvents } from '../events/eventBus';
import { useToastStore } from '../stores/toastStore';
import type { DecisionUrgency } from '../../domain/agent/DecisionRequest';

type PendingHigh = { agentId: string; count: number; timer: ReturnType<typeof setTimeout> };

let highBatch: PendingHigh | null = null;
const HIGH_BATCH_WINDOW_MS = 5000;

function handleCreated(payload: { decisionId: string; agentId: string; urgency: string }) {
  const urgency = payload.urgency as DecisionUrgency;

  switch (urgency) {
    case 'critical':
      useToastStore.getState().addToast(`[紧急决策] 需要立即处理`, 'error');
      setTimeout(() => {
        import('../stores/openclawStore')
          .then(({ useOpenClawStore }) => {
            useOpenClawStore.getState().selectBColumnDecision(payload.decisionId);
          })
          .catch(() => {});
      }, 0);
      break;

    case 'high':
      if (highBatch && highBatch.agentId === payload.agentId) {
        highBatch.count++;
        clearTimeout(highBatch.timer);
        highBatch.timer = setTimeout(() => {
          if (highBatch) {
            flushHighBatch(highBatch);
            highBatch = null;
          }
        }, HIGH_BATCH_WINDOW_MS);
      } else {
        if (highBatch) {
          clearTimeout(highBatch.timer);
          flushHighBatch(highBatch);
        }
        highBatch = {
          agentId: payload.agentId,
          count: 1,
          timer: setTimeout(() => {
            if (highBatch) {
              flushHighBatch(highBatch);
              highBatch = null;
            }
          }, HIGH_BATCH_WINDOW_MS),
        };
      }
      break;

    case 'normal':
    case 'low':
      break;
  }
}

function flushHighBatch(batch: PendingHigh) {
  const msg = batch.count === 1 ? `有 1 项需要关注的决策` : `有 ${batch.count} 项需要关注的决策`;
  useToastStore.getState().addToast(msg, 'info');
}

let unsubscribe: (() => void) | null = null;

export function initPushPolicy(): () => void {
  if (unsubscribe) return unsubscribe;
  const unsub = appEvents.on('decision:created', handleCreated);
  unsubscribe = () => {
    unsub();
    unsubscribe = null;
    if (highBatch) {
      clearTimeout(highBatch.timer);
      highBatch = null;
    }
  };
  return unsubscribe;
}
