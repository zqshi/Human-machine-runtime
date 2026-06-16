import { DecisionRequest } from '../../domain/agent/DecisionRequest';
import { UserGoal } from '../../domain/agent/UserGoal';
import { WorkOrder } from '../../domain/agent/WorkOrder';
import { AgentTask } from '../../domain/agent/AgentTask';
import { CoTMessage } from '../../domain/agent/CoTMessage';
import { ProjectBoard } from '../../domain/agent/ProjectBoard';
import { openclawApiAdapter } from '../../infrastructure/api/openclawApiAdapter';
import { useNotificationStore } from './notificationStore';
import { useToastStore } from './toastStore';
import { appEvents } from '../events/eventBus';
import type { OpenClawEvent } from '../../domain/agent/IOpenClawDataSource';
import type { WorkOrderProps } from '../../domain/agent/WorkOrder';
import type { MessageBlock } from '../../domain/agent/MessageBlock';
import type { AppArtifact, DocumentArtifact } from './openclawTypes';
import type { StoreApi } from 'zustand';
import type { OpenClawState } from './openclawTypes';

type StoreAccessors = {
  get: StoreApi<OpenClawState>['getState'];
  set: StoreApi<OpenClawState>['setState'];
};

export function createSSEHandler({ get, set }: StoreAccessors): () => void {
  return openclawApiAdapter.subscribeEvents((event: OpenClawEvent) => {
    switch (event.type) {
      case 'connected': {
        get().fetchWorkOrders();
        break;
      }
      case 'decision:created': {
        try {
          const dec = DecisionRequest.create(
            event.data as unknown as Parameters<typeof DecisionRequest.create>[0]
          );
          get().addDecisionRequest(dec);
        } catch (e) {
          console.warn('[SSE] decision:created malformed', e, event.data);
        }
        break;
      }
      case 'decision:updated': {
        try {
          const data = event.data;
          const decId = String(data.id);
          const updated = DecisionRequest.create(
            data as unknown as Parameters<typeof DecisionRequest.create>[0]
          );
          set({
            decisionRequests: get().decisionRequests.map((d) => (d.id === decId ? updated : d)),
          });
        } catch (e) {
          console.warn('[SSE] decision:updated malformed', e, event.data);
        }
        get().rebuildAttentionItems();
        break;
      }
      case 'task:updated': {
        const data = event.data as { id: string; progress?: number; status?: string };
        get().updateTask(data.id, (t) => {
          let updated = t;
          if (data.progress !== undefined) updated = updated.withProgress(data.progress);
          if (data.status === 'completed' && t.status !== 'completed') {
            useNotificationStore.getState().addCompletionNotification(data.id, t.name);
            appEvents.emit('agent:task-updated', {
              taskId: data.id,
              progress: 100,
              status: 'completed',
            });
          }
          return updated;
        });
        break;
      }
      case 'goal:updated': {
        try {
          const data = event.data;
          const goalId = String(data.id);
          const updated = UserGoal.create(data as unknown as Parameters<typeof UserGoal.create>[0]);
          set({
            goals: get().goals.map((g) => (g.id === goalId ? updated : g)),
          });
        } catch (e) {
          console.warn('[SSE] goal:updated malformed', e, event.data);
        }
        get().rebuildAttentionItems();
        break;
      }
      case 'workorder:created': {
        try {
          const wo = WorkOrder.create(event.data as unknown as WorkOrderProps);
          const existing = get().workOrders;
          if (!existing.some((w) => w.id === wo.id)) {
            set({ workOrders: [wo, ...existing] });
          }
        } catch {
          get().fetchWorkOrders();
        }
        useToastStore
          .getState()
          .addToast(
            `收到协作请求: ${(event.data as { title?: string }).title || '新工单'}`,
            'info'
          );
        get().rebuildAttentionItems();
        break;
      }
      case 'workorder:completed': {
        try {
          const data = event.data as { id?: string; title?: string };
          if (data.id) {
            set({
              workOrders: get().workOrders.map((w) =>
                w.id === data.id ? w.complete('已完成') : w
              ),
            });
          }
        } catch {
          /* ignore */
        }
        useToastStore
          .getState()
          .addToast(`协作完成: ${(event.data as { title?: string }).title || '工单'}`, 'success');
        get().rebuildAttentionItems();
        break;
      }

      // ── Artifact lifecycle events (from AgentExecutor) ──

      case 'artifact:created': {
        const data = event.data as {
          type: string;
          id: string;
          sessionId?: string;
          data: Record<string, unknown>;
        };
        handleArtifactCreated(data, get, set);
        break;
      }
      case 'artifact:progress': {
        const data = event.data as {
          type: string;
          id: string;
          progress?: number;
          stage?: string;
          sectionIndex?: number;
          totalSections?: number;
          currentSubtask?: number;
          status?: string;
          tick?: number;
        };
        handleArtifactProgress(data, get, set);
        break;
      }
      case 'artifact:completed': {
        const data = event.data as {
          type: string;
          id: string;
          sessionId?: string;
          summary: string;
        };
        handleArtifactCompleted(data, get, set);
        break;
      }
      case 'signal:created': {
        const data = event.data as {
          id: string;
          source: string;
          urgency: string;
          payload: unknown;
        };
        appEvents.emit('signal:created', data);
        break;
      }
      case 'correction:applied': {
        const data = event.data as {
          planId: string;
          affectedTasks: string[];
          affectedGoals: string[];
        };
        appEvents.emit('correction:applied', data);
        break;
      }
      case 'intent:dispatched': {
        const data = event.data as {
          intentId: string;
          fromAgent: string;
          toAgent: string;
          payload: unknown;
        };
        appEvents.emit('intent:dispatched', data);
        break;
      }
      case 'session:created': {
        const data = event.data as { sessionId: string; agents: string[]; purpose: string };
        appEvents.emit('session:created', data);
        break;
      }
      case 'session:escalated': {
        const data = event.data as { sessionId: string; reason: string; confidence: number };
        appEvents.emit('session:escalated', data);
        break;
      }
      case 'escalation:triggered': {
        const data = event.data as { taskId: string; stage: string; reason: string };
        appEvents.emit('escalation:triggered', data);
        break;
      }
      case 'escalation:resolved': {
        const data = event.data as { taskId: string; resolution: string };
        appEvents.emit('escalation:resolved', data);
        break;
      }
      case 'agent-profile:updated': {
        const data = event.data as { agentId: string; metric: string; newValue: number };
        appEvents.emit('agent-profile:updated', data);
        break;
      }
      case 'objective:updated': {
        const data = event.data as { objectiveId: string; level: string; confidence: number };
        appEvents.emit('objective:updated', data);
        break;
      }
      case 'objective:decoded': {
        const data = event.data as { l0Id: string; questions: string[] };
        appEvents.emit('objective:decoded', data);
        break;
      }
      case 'emergent-signal:detected': {
        const data = event.data as {
          patternId: string;
          severity: string;
          correlatedSignals: string[];
        };
        appEvents.emit('emergent-signal:detected', data);
        useToastStore
          .getState()
          .addToast(
            `涌现信号: ${data.severity} 级别`,
            data.severity === 'critical' ? 'error' : 'info'
          );
        break;
      }
      case 'pattern:discovered': {
        const data = event.data as { patternId: string; context: string; suggestion: string };
        appEvents.emit('pattern:discovered', data);
        break;
      }
      case 'runtime:message-scored': {
        const data = event.data as {
          messageId: string;
          intent: string;
          urgency: string;
          score: number;
          channelType: string;
        };
        appEvents.emit('runtime:message-scored', data);
        break;
      }
      case 'runtime:recommendation': {
        const data = event.data as {
          messageId: string;
          recommendations: Array<{
            id: string;
            action: string;
            confidence: number;
            reasoning: string;
          }>;
        };
        appEvents.emit('runtime:recommendation', data);
        break;
      }
      case 'orchestration:chain-created': {
        const data = event.data as {
          id: string;
          steps: unknown[];
          status: string;
        };
        appEvents.emit('orchestration:chain-created', data);
        break;
      }
      case 'orchestration:step-advanced': {
        const data = event.data as { chainId: string; step: number };
        appEvents.emit('orchestration:step-advanced', data);
        break;
      }
      case 'orchestration:escalation-created': {
        const data = event.data as {
          id: string;
          reason: string;
          status: string;
        };
        appEvents.emit('orchestration:escalation-created', data);
        useToastStore.getState().addToast(`编排升维: ${data.reason}`, 'info');
        break;
      }
      case 'receipt:sent': {
        const data = event.data as {
          receiptId: string;
          taskId: string;
          channel: string;
          success: boolean;
        };
        appEvents.emit('receipt:sent', data);
        break;
      }
    }
  });
}

function handleArtifactCreated(
  data: { type: string; id: string; sessionId?: string; data: Record<string, unknown> },
  get: StoreAccessors['get'],
  set: StoreAccessors['set']
) {
  const artifactData = data.data;
  const targetConvId = data.sessionId || get().activeConversationId;
  const updateMsg = (
    updater: (
      m: import('../../domain/agent/CoTMessage').CoTMessage
    ) => import('../../domain/agent/CoTMessage').CoTMessage
  ) => {
    get().updateLastMessageIn(targetConvId, updater);
  };
  switch (data.type) {
    case 'task': {
      if (get().tasks.some((t) => t.id === String(artifactData.id))) break;
      const task = AgentTask.create({
        id: String(artifactData.id),
        agentId: String(artifactData.agentId || 'primary'),
        todoId: String(artifactData.todoId || `todo-${artifactData.id}`),
        name: String(artifactData.name),
        status: (artifactData.status as 'running') || 'running',
        progress: Number(artifactData.progress || 0),
        subtasks: (artifactData.subtasks || []) as Parameters<
          typeof AgentTask.create
        >[0]['subtasks'],
        logs: (artifactData.logs || []) as Parameters<typeof AgentTask.create>[0]['logs'],
        color: String(artifactData.color || '#007AFF'),
        createdAt: Number(artifactData.createdAt),
        updatedAt: Number(artifactData.updatedAt),
      });
      set({ tasks: [...get().tasks, task] });
      const block: MessageBlock = { type: 'task-card', taskId: task.id };
      updateMsg((m) => m.appendBlock(block));
      break;
    }
    case 'app': {
      const appId = String(artifactData.id);
      if (get().apps.some((a) => a.id === appId)) break;
      const app: AppArtifact = {
        id: String(artifactData.id),
        name: String(artifactData.name),
        description: String(artifactData.description || ''),
        stage: (artifactData.stage as AppArtifact['stage']) || 'designing',
        codeSnapshots: (artifactData.codeSnapshots || []) as AppArtifact['codeSnapshots'],
        createdAt: Number(artifactData.createdAt),
        updatedAt: Number(artifactData.updatedAt),
      };
      get().addApp(app);
      const block: MessageBlock = {
        type: 'app-preview',
        appId: app.id,
        appName: app.name,
        stage: 'designing',
      };
      updateMsg((m) => m.appendBlock(block));
      get().openDrawer({
        type: 'app-preview',
        title: `${app.name} - 构建预览`,
        data: { appId: app.id },
      });
      break;
    }
    case 'doc': {
      const docId = String(artifactData.id);
      if (get().documents.some((d) => d.id === docId)) break;
      const doc: DocumentArtifact = {
        id: String(artifactData.id),
        title: String(artifactData.title),
        content: String(artifactData.content || ''),
        sections: (artifactData.sections || []) as DocumentArtifact['sections'],
        createdAt: Number(artifactData.createdAt),
        updatedAt: Number(artifactData.updatedAt),
      };
      get().addDocument(doc);
      const block: MessageBlock = {
        type: 'doc-editor',
        docId: doc.id,
        docTitle: doc.title,
        sectionsReady: 0,
        totalSections: doc.sections.length,
      };
      updateMsg((m) => m.appendBlock(block));
      get().openDrawer({ type: 'doc-editor', title: doc.title, data: { docId: doc.id } });
      break;
    }
    case 'board': {
      try {
        const boardId = String(artifactData.id);
        if (get().boards.some((b) => b.id === boardId)) break;
        const board = ProjectBoard.create(
          artifactData as unknown as Parameters<typeof ProjectBoard.create>[0]
        );
        get().addBoard(board);
        const block: MessageBlock = {
          type: 'project-board',
          boardId: board.id,
          boardName: board.name,
          totalCards: board.cards.length,
          activeAgents: board.activeAgentCount,
        };
        updateMsg((m) => m.appendBlock(block));
        get().openDrawer({ type: 'project-board', title: board.name, data: { boardId: board.id } });
      } catch (e) {
        console.warn('[SSE] artifact:created board malformed', e, artifactData);
      }
      break;
    }
  }
}

function handleArtifactProgress(
  data: {
    type: string;
    id: string;
    progress?: number;
    stage?: string;
    sectionIndex?: number;
    totalSections?: number;
    currentSubtask?: number;
    status?: string;
    tick?: number;
  },
  get: StoreAccessors['get'],
  _set: StoreAccessors['set']
) {
  switch (data.type) {
    case 'task': {
      get().updateTask(data.id, (t) => {
        let updated = t;
        if (data.progress !== undefined) updated = updated.withProgress(data.progress);
        if (data.currentSubtask !== undefined) {
          const subtasks = (updated.subtasks || []).map((st, i) => ({
            ...st,
            status: (i < data.currentSubtask!
              ? 'success'
              : i === data.currentSubtask!
                ? 'running'
                : 'pending') as typeof st.status,
          }));
          updated = AgentTask.create({
            id: updated.id,
            agentId: updated.agentId,
            todoId: updated.todoId,
            name: updated.name,
            status: updated.status,
            progress: updated.progress,
            subtasks,
            logs: updated.logs,
            color: updated.color,
            createdAt: updated.createdAt,
            updatedAt: Date.now(),
          });
        }
        return updated;
      });
      break;
    }
    case 'app': {
      if (data.stage) {
        get().updateApp(data.id, (a) => ({
          ...a,
          stage: data.stage as AppArtifact['stage'],
          updatedAt: Date.now(),
        }));
      }
      break;
    }
    case 'doc': {
      if (data.sectionIndex !== undefined) {
        get().updateDocument(data.id, (d) => ({
          ...d,
          sections: d.sections.map((s, i) => ({
            ...s,
            status: (i <= data.sectionIndex!
              ? 'done'
              : i === data.sectionIndex! + 1
                ? 'writing'
                : 'pending') as typeof s.status,
          })),
          updatedAt: Date.now(),
        }));
      }
      break;
    }
    case 'board': {
      // Board progress ticks are informational; real card updates come via board-specific events
      break;
    }
  }
}

function handleArtifactCompleted(
  data: { type: string; id: string; sessionId?: string; summary: string },
  get: StoreAccessors['get'],
  _set: StoreAccessors['set']
) {
  const targetConvId = data.sessionId || get().activeConversationId;
  const sessionId = get().sessionId ?? '';
  const msg = CoTMessage.create({
    id: `artifact-done-${data.id}-${Date.now()}`,
    agentId: 'primary',
    sessionId,
    role: 'agent',
    text: data.summary,
    timestamp: Date.now(),
    cotSteps: [
      { id: `ac-${Date.now()}`, label: `${data.type} 完成`, status: 'done', detail: data.summary },
    ],
  });

  let block: MessageBlock | undefined;
  if (data.type === 'task') {
    block = { type: 'task-card', taskId: data.id };
    useNotificationStore.getState().addCompletionNotification(data.id, data.summary);
    appEvents.emit('agent:task-updated', { taskId: data.id, progress: 100, status: 'completed' });
  } else if (data.type === 'app') {
    block = { type: 'app-preview', appId: data.id, appName: '', stage: 'done' };
  } else if (data.type === 'doc') {
    block = {
      type: 'doc-editor',
      docId: data.id,
      docTitle: '',
      sectionsReady: 0,
      totalSections: 0,
    };
  } else if (data.type === 'board') {
    block = {
      type: 'project-board',
      boardId: data.id,
      boardName: '',
      totalCards: 0,
      activeAgents: 0,
    };
  }

  const finalMsg = block ? msg.appendBlock(block) : msg;
  get().appendMessageTo(targetConvId, finalMsg);
}
