/**
 * openclawRuntimeTaskActions —— Runtime / Task CRUD + 工作流干预
 *
 * 从 openclawStore 拆分。包含：
 * - setRuntimes / updateRuntime：运行时实例读写
 * - setTasks / updateTask / selectTask：任务读写
 * - pauseTask / resumeTask / cancelTask：工作流干预（依赖 updateTask，
 *   并经 appEvents 通知 SSE 层与 toast 层）
 *
 * pauseTask 等是「跨切片写」的轻量事务：调 updateTask 改任务状态并联动
 * rebuildAttentionItems。
 */
import type { AgentRuntime } from '../../domain/agent/AgentRuntime';
import type { AgentTask } from '../../domain/agent/AgentTask';
import { appEvents } from '../events/eventBus';
import { useToastStore } from './toastStore';
import type { StoreSet, StoreGet } from './openclawTypes';

export function runtimeTaskActions(set: StoreSet, get: StoreGet) {
  return {
    setRuntimes(runtimes: AgentRuntime[]) {
      set({ runtimes });
    },

    updateRuntime(agentId: string, updater: (r: AgentRuntime) => AgentRuntime) {
      set({
        runtimes: get().runtimes.map((r) => (r.agentId === agentId ? updater(r) : r)),
      });
    },

    setTasks(tasks: AgentTask[]) {
      set({ tasks });
    },

    updateTask(taskId: string, updater: (t: AgentTask) => AgentTask) {
      set({
        tasks: get().tasks.map((t) => (t.id === taskId ? updater(t) : t)),
      });
      get().rebuildAttentionItems();
    },

    selectTask(taskId: string | null) {
      set({ selectedTaskId: taskId });
    },

    pauseTask(taskId: string) {
      const task = get().tasks.find((t) => t.id === taskId);
      if (!task?.canPause) return;
      get().updateTask(taskId, (t) => t.pause());
      useToastStore.getState().addToast(`已暂停任务: ${task.name}`, 'info');
    },

    resumeTask(taskId: string) {
      const task = get().tasks.find((t) => t.id === taskId);
      if (!task?.canResume) return;
      get().updateTask(taskId, (t) => t.resume());
      useToastStore.getState().addToast(`已恢复任务: ${task.name}`, 'info');
    },

    cancelTask(taskId: string) {
      const task = get().tasks.find((t) => t.id === taskId);
      if (!task?.canCancel) return;
      get().updateTask(taskId, (t) => t.cancel());
      useToastStore.getState().addToast(`已停止任务: ${task.name}`, 'error');
      appEvents.emit('agent:task-updated', { taskId, progress: task.progress, status: 'failed' });
    },
  };
}
