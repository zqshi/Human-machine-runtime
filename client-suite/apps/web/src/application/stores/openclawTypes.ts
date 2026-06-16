import type { AgentRuntime } from '../../domain/agent/AgentRuntime';
import type { AgentTask } from '../../domain/agent/AgentTask';
import type { CoTMessage } from '../../domain/agent/CoTMessage';
import type { DecisionRequest } from '../../domain/agent/DecisionRequest';
import type { UserGoal } from '../../domain/agent/UserGoal';
import type { ProjectBoard } from '../../domain/agent/ProjectBoard';
import type { SystemHealthSnapshot } from '../../domain/agent/AgentOrchestrationService';
import type { DecisionTree } from '../../domain/agent/DecisionTree';
import type { CollaborationChain } from '../../domain/agent/CollaborationChain';
import type { OpenClawDrawerContent } from '../../domain/agent/DrawerContent';
import type { CorrectionPlan } from '../../domain/agent/CorrectionPropagator';
import type { AttentionItem } from '../../domain/agent/DrawerContent';
import type {
  CreateGoalInput,
  DecomposeResult,
  CreateWorkOrderInput,
  TaskAssignment,
} from '../../domain/agent/IOpenClawDataSource';
import type { WorkOrder } from '../../domain/agent/WorkOrder';

export interface AppArtifact {
  id: string;
  name: string;
  description: string;
  stage: 'designing' | 'building' | 'preview' | 'done';
  codeSnapshots: Array<{ html: string; css: string; js: string; timestamp: number }>;
  createdAt: number;
  updatedAt: number;
}

export interface DocumentArtifact {
  id: string;
  title: string;
  content: string;
  sections: Array<{ title: string; status: 'pending' | 'writing' | 'done' }>;
  createdAt: number;
  updatedAt: number;
}

export interface ProactiveActivity {
  id: string;
  icon: string;
  iconColor: string;
  action: string;
  detail: string;
  time: string;
  category: 'autonomous' | 'monitoring' | 'insight';
}

export interface ProactiveInsight {
  id: string;
  icon: string;
  color: string;
  title: string;
  description: string;
  urgency: 'info' | 'warning' | 'success';
}

export interface ConversationSession {
  id: string;
  title: string;
  createdAt: number;
  lastMessageAt: number;
  messageCount: number;
  type: 'primary' | 'discussion' | 'shared';
}

export interface OpenClawState {
  runtimes: AgentRuntime[];
  tasks: AgentTask[];
  selectedTaskId: string | null;
  /** 按上下文隔离的对话存储，key: 'primary' | 'task-<id>' | 'shared-<id>' */
  conversations: Record<string, CoTMessage[]>;
  /** 当前活跃的对话上下文 ID */
  activeConversationId: string;
  sessionId: string | null;
  /** 当前对话绑定的数字员工实例 id；null = 平台统一助手（不受模型授权约束） */
  activeInstanceId: string | null;
  isSending: boolean;
  systemHealth: SystemHealthSnapshot | null;
  quickCommands: Array<{ id: string; icon: string; label: string; desc: string }>;
  proactiveActivities: ProactiveActivity[];
  proactiveInsights: ProactiveInsight[];
  decisionTrees: Record<string, DecisionTree>;
  expandedActivityId: string | null;
  collaborationChains: CollaborationChain[];
  decisionRequests: DecisionRequest[];
  goals: UserGoal[];
  activeGoalId: string | null;
  apps: AppArtifact[];
  documents: DocumentArtifact[];
  boards: ProjectBoard[];
  drawerContent: OpenClawDrawerContent | null;
  drawerWidth: number;
  activeSharedAgentId: string | null;
  activeAttentionItemId: string | null;
  composerPrefill: string | null;
  /** C 栏正在讨论的通知 ID（非 null 时 C 栏显示事件上下文而非聊天） */
  discussingNotificationId: string | null;
  /** C 栏正在讨论的决策 ID（非 null 时 C 栏显示决策上下文） */
  discussingDecisionId: string | null;
  /** C 栏正在讨论的任务 ID（非 null 时 C 栏显示任务上下文） */
  discussingTaskId: string | null;
  /** C 栏正在讨论的目标 ID（非 null 时 C 栏显示目标上下文） */
  discussingGoalId: string | null;
  /** 派生自对话 blocks + 外部通知 */
  attentionItems: AttentionItem[];
  /** 最近一次纠偏传播计划 */
  lastCorrectionPlan: CorrectionPlan | null;
  /** B 栏当前展示的任务 ID（与 selectedNotificationId 互斥） */
  bColumnTaskId: string | null;
  /** B 栏当前展示的目标 ID */
  bColumnGoalId: string | null;
  /** B 栏当前展示的决策 ID */
  bColumnDecisionId: string | null;
  /** 中栏需要滚动到的消息 ID */
  scrollToMessageId: string | null;
  /** 所有对话会话列表 */
  conversationSessions: ConversationSession[];
  /** A 栏当前 Tab */
  aColumnTab: 'attention' | 'history';
  /** 工单列表 */
  workOrders: WorkOrder[];
  /** C 栏正在讨论的工单 ID */
  discussingWorkOrderId: string | null;
  /** 初始化加载中 */
  isInitializing: boolean;
  /** 初始化失败错误信息 */
  initError: string | null;
  _cleanup: (() => void) | null;

  openDrawer(content: OpenClawDrawerContent): void;
  closeDrawer(): void;
  toggleDrawer(): void;
  setDrawerWidth(width: number): void;
  setActiveAttentionItem(id: string | null): void;
  selectBColumnTask(id: string | null): void;
  selectBColumnGoal(id: string | null): void;
  selectBColumnDecision(id: string | null): void;
  /** 切换活跃对话上下文，自动创建空对话 */
  switchConversation(id: string): void;
  /** 设置当前对话绑定的数字员工实例；null 回到平台统一助手 */
  setActiveInstanceId(instanceId: string | null): void;
  openDrawerForAttentionItem(itemId: string): void;
  clearScrollTarget(): void;
  rebuildAttentionItems(): void;
  setRuntimes(runtimes: AgentRuntime[]): void;
  updateRuntime(agentId: string, updater: (r: AgentRuntime) => AgentRuntime): void;
  setTasks(tasks: AgentTask[]): void;
  updateTask(taskId: string, updater: (t: AgentTask) => AgentTask): void;
  selectTask(taskId: string | null): void;
  appendMessage(msg: CoTMessage): void;
  appendMessageTo(conversationId: string, msg: CoTMessage): void;
  updateLastMessage(updater: (m: CoTMessage) => CoTMessage): void;
  updateLastMessageIn(conversationId: string, updater: (m: CoTMessage) => CoTMessage): void;
  setIsSending(v: boolean): void;
  setSystemHealth(health: SystemHealthSnapshot): void;
  expandActivity(activityId: string | null): void;
  executeFollowUp(activityId: string, actionId: string): void;
  pauseTask(taskId: string): void;
  resumeTask(taskId: string): void;
  cancelTask(taskId: string): void;
  addDecisionRequest(request: DecisionRequest): void;
  respondToDecision(decisionId: string, updater: (d: DecisionRequest) => DecisionRequest): void;
  respondDecision(
    decisionId: string,
    action: 'accept' | 'modify' | 'decline' | 'defer',
    params?: {
      feedback?: string;
      optionId?: string;
      deferUntil?: number;
    }
  ): void;
  addGoal(goal: UserGoal): void;
  updateGoal(goalId: string, updater: (g: UserGoal) => UserGoal): void;
  setActiveGoal(goalId: string | null): void;
  createGoal(input: CreateGoalInput): Promise<UserGoal>;
  decomposeGoal(goalId: string, apply?: boolean): Promise<DecomposeResult>;
  dispatchGoalPlan(
    goalId: string,
    tasks: Array<{ id: string; name: string; agentId: string; [k: string]: unknown }>,
    assignments: TaskAssignment[]
  ): Promise<void>;
  addApp(app: AppArtifact): void;
  updateApp(appId: string, updater: (a: AppArtifact) => AppArtifact): void;
  addDocument(doc: DocumentArtifact): void;
  updateDocument(docId: string, updater: (d: DocumentArtifact) => DocumentArtifact): void;
  addBoard(board: ProjectBoard): void;
  updateBoard(boardId: string, updater: (b: ProjectBoard) => ProjectBoard): void;
  setSharedAgentMeta(agentId: string, name: string): void;
  startSharedAgentChat(agentId: string): void;
  returnToPrimaryAgent(): void;
  setComposerPrefill(text: string | null): void;
  setDiscussingNotificationId(id: string | null): void;
  setDiscussingDecisionId(id: string | null): void;
  setDiscussingTaskId(id: string | null): void;
  setDiscussingGoalId(id: string | null): void;
  setDiscussingWorkOrderId(id: string | null): void;
  fetchWorkOrders(): Promise<void>;
  respondWorkOrder(id: string, response: string): Promise<void>;
  createWorkOrder(input: CreateWorkOrderInput): Promise<WorkOrder>;
  returnToHome(): void;
  setAColumnTab(tab: 'attention' | 'history'): void;
  createNewConversation(title?: string): void;
  switchToSession(sessionId: string): void;
  initConversation(): void;
  initialize(): Promise<void>;
  reset(): void;
}

export type StoreSet = (
  partial: Partial<OpenClawState> | ((state: OpenClawState) => Partial<OpenClawState>)
) => void;
export type StoreGet = () => OpenClawState;
