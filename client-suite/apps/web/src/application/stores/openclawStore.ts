import { create } from 'zustand';
import { decisionActions } from './openclawDecisionActions';
import { decisionTreeActions } from './openclawDecisionTreeActions';
import { drawerActions } from './openclawDrawerActions';
import { runtimeTaskActions } from './openclawRuntimeTaskActions';
import { conversationActions } from './openclawConversationActions';
import { artifactActions } from './openclawArtifactActions';
import { sharedAgentActions } from './openclawSharedAgentActions';
import {
  handleSetDiscussingNotificationId,
  handleSetDiscussingDecisionId,
  handleSetDiscussingTaskId,
  handleSetDiscussingGoalId,
} from './openclawDiscussionActions';
import type { OpenClawState } from './openclawTypes';
import { goalActions, workOrderActions } from './openclawGoalWorkOrderActions';
import { clearPersistedConversations } from './openclawPersistence';
import { initializeOpenClaw } from './openclawInitializer';

export type {
  AppArtifact,
  DocumentArtifact,
  ProactiveActivity,
  ProactiveInsight,
  ConversationSession,
  OpenClawState,
} from './openclawTypes';

/**
 * useOpenClawStore —— OpenClaw 工作区全局 store（多聚合协调面）
 *
 * ┌─ 为什么是「单 store」而非按聚合根拆分 ─────────────────────────────┐
 * │ 本 store 承载 goal / decision / task / workOrder / conversation     │
 * │ / notification / drawer 等多个聚合，但它们之间存在**强运行时耦合**： │
 * │                                                                     │
 * │ 1. 跨聚合派生：rebuildAttentionItems() 同时消费 goals / decisions / │
 * │    tasks / workOrders / notifications，是 A 栏 attentionItems 的唯  │
 * │    一数据源。拆分后该 reducer 需订阅多个 store，引入跨 store 同步   │
 * │    一致性问题。                                                     │
 * │ 2. 跨聚合写：decisionActions 在 respondDecision 中同时改 decision / │
 * │    goals / tasks / collaborationChains，并经 CorrectionPropagator   │
 * │    传播纠偏；goalActions.dispatchGoalPlan 同时写 goals / tasks /    │
 * │    workOrders。这些是**单事务语义**，拆 store 会破坏原子性。        │
 * │ 3. 共享会话上下文：所有 setDiscussingXxx / selectBColumnXxx 都围绕  │
 * │    同一组 `discussing*Id` + `bColumn*Id` + `activeConversationId`  │
 * │    的互斥选择状态机运作，且依赖 switchConversation 这把「单钥匙」。  │
 * │ 4. 命令式跨模块访问：全仓 39 处 `useOpenClawStore.getState()` 命令  │
 * │    式调用（20 个文件），多数跨聚合；硬拆需逐处重指向，回归面大。   │
 * │ 5. 缺安全网：openclaw store 无单测，仅靠 1 个 apiAdapter 测试 +     │
 * │    集成测试兜底，拆分无细粒度回归保护。                             │
 * │                                                                     │
 * │ 结论：当前按辅助文件模块化的结构（见下方「文件分工」）已是合理的    │
 * │ 解耦粒度。强行按聚合拆 store 会把「跨聚合事务」拆成「跨 store 协调」│
 * │ 收益为负。维持现状。                                                │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ 文件分工（已完成的模块化拆分）──────────────────────────────────┐
 * │ openclawStore.ts                  本文件：state 定义 + reset/       │
 * │                                   initialize + 组装入口              │
 * │ openclawTypes.ts                  OpenClawState 接口 + StoreSet/Get │
 * │ openclawDrawerActions.ts          Drawer 开关 + B 栏选择 +           │
 * │                                   rebuildAttentionItems 派生        │
 * │ openclawConversationActions.ts    对话 CRUD / 会话生命周期 / 流式   │
 * │ openclawRuntimeTaskActions.ts     Runtime/Task CRUD + 工作流干预    │
 * │ openclawDecisionTreeActions.ts    决策树主动活动展开/后续动作       │
 * │ openclawArtifactActions.ts        App/Document/Board 展示聚合 CRUD  │
 * │ openclawSharedAgentActions.ts     共享 Agent 直聊 + 全局上下文重置  │
 * │ openclawDecisionActions.ts        决策请求 CRUD + respondDecision   │
 * │                                   事务（含纠偏传播 + 判断记录落库） │
 * │ openclawGoalWorkOrderActions.ts   目标 CRUD/拆解/下发 + 工单 CRUD   │
 * │ openclawDiscussionActions.ts      setDiscussingNotificationId 等 4  │
 * │                                   个上下文切换处理器（生成首条分析  │
 * │                                   消息）                            │
 * │ openclawConversationHelpers.ts    buildDeepDiscussionResponse 等     │
 * │                                   纯函数（CoT/blocks 构造，无依赖） │
 * │ openclawSSEHandler.ts             SSE 订阅 → store 增量更新          │
 * │ openclawInitializer.ts            bootstrap 拉取 + SSE 挂载 + 首编排 │
 * │ openclawPersistence.ts            sessionStorage 对话持久化（纯函数）│
 * └────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ 后续演进路线图（非阻塞，条件成熟后再做）────────────────────────┐
 * │ 阶段 1（低风险）：把 _sharedAgentMeta / composerPrefill / drawerWidth│
 * │   等纯 UI 状态抽到 useOpenClawUIStore，组件改 import 即可，无跨聚  │
 * │   合事务。                                                          │
 * │ 阶段 2（中风险）：apps / documents / boards / collaborationChains  │
 * │   这类「只读展示聚合」可独立 store，需把 rebuildAttentionItems 中   │
 * │   对它们的引用改为订阅。                                            │
 * │ 阶段 3（高风险，需先补测试）：goal / decision / task / workOrder   │
 * │   这类「相互写」的核心聚合，必须先补 domain + action 单测，再引入  │
 * │   跨 store 事务抽象（如 event-saga），否则原子性丢失。             │
 * │ 前置条件：补齐 openclaw store 的单测（rebuildAttentionItems /      │
 * │   respondDecision / dispatchGoalPlan 三条事务路径 100% 覆盖）。     │
 * └────────────────────────────────────────────────────────────────────┘
 */
export const useOpenClawStore = create<OpenClawState>((set, get) => ({
  runtimes: [],
  tasks: [],
  selectedTaskId: null,
  conversations: {},
  activeConversationId: 'primary',
  sessionId: null,
  /** 当前对话绑定的数字员工实例 id；null = 平台统一助手（不受模型授权约束） */
  activeInstanceId: null as string | null,
  isSending: false,
  systemHealth: null,
  quickCommands: [],
  proactiveActivities: [],
  proactiveInsights: [],
  decisionTrees: {},
  expandedActivityId: null,
  collaborationChains: [],
  decisionRequests: [],
  goals: [],
  activeGoalId: null,
  apps: [],
  documents: [],
  boards: [],
  drawerContent: null,
  drawerWidth: 360,
  activeSharedAgentId: null,
  activeAttentionItemId: null,
  composerPrefill: null,
  discussingNotificationId: null,
  discussingDecisionId: null,
  discussingTaskId: null,
  discussingGoalId: null,
  attentionItems: [],
  lastCorrectionPlan: null,
  bColumnTaskId: null,
  bColumnGoalId: null,
  bColumnDecisionId: null,
  scrollToMessageId: null,
  conversationSessions: [],
  _sharedAgentMeta: {} as Record<string, string>,
  aColumnTab: 'attention' as const,
  workOrders: [],
  discussingWorkOrderId: null,
  isInitializing: false,
  initError: null,
  _cleanup: null,

  // ── Drawer + B-column selection + Attention rebuild (openclawDrawerActions.ts) ──
  ...drawerActions(set, get),

  // ── Conversation management (openclawConversationActions.ts) ──
  ...conversationActions(set, get),

  // ── Runtime/Task CRUD + workflow intervention (openclawRuntimeTaskActions.ts) ──
  ...runtimeTaskActions(set, get),

  // ── Decision Tree actions (openclawDecisionTreeActions.ts) ──
  ...decisionTreeActions(set, get),

  // ── Decision requests (openclawDecisionActions.ts) ──
  ...decisionActions(set, get),

  // ── Goals + WorkOrders (openclawGoalWorkOrderActions.ts) ──
  ...goalActions(set, get),
  ...workOrderActions(set, get),

  // ── App/Document/Board artifacts (openclawArtifactActions.ts) ──
  ...artifactActions(set, get),

  // ── Shared Agent direct chat + global context reset (openclawSharedAgentActions.ts) ──
  ...sharedAgentActions(set, get),

  // ── Discussion actions (delegated to openclawDiscussionActions.ts) ──

  setDiscussingNotificationId(id) {
    handleSetDiscussingNotificationId(id, set, get);
  },

  setDiscussingDecisionId(id) {
    handleSetDiscussingDecisionId(id, set, get);
  },

  setDiscussingTaskId(id) {
    handleSetDiscussingTaskId(id, set, get);
  },

  setDiscussingGoalId(id) {
    handleSetDiscussingGoalId(id, set, get);
  },

  async initialize() {
    await initializeOpenClaw(set, get);
  },

  reset() {
    const cleanup = get()._cleanup;
    if (cleanup) cleanup();
    clearPersistedConversations();
    set({
      runtimes: [],
      tasks: [],
      selectedTaskId: null,
      conversations: {},
      activeConversationId: 'primary',
      sessionId: null,
      activeInstanceId: null,
      isSending: false,
      systemHealth: null,
      quickCommands: [],
      proactiveActivities: [],
      proactiveInsights: [],
      decisionTrees: {},
      expandedActivityId: null,
      collaborationChains: [],
      goals: [],
      activeGoalId: null,
      apps: [],
      documents: [],
      boards: [],
      decisionRequests: [],
      lastCorrectionPlan: null,
      drawerContent: null,
      drawerWidth: 360,
      activeSharedAgentId: null,
      activeAttentionItemId: null,
      composerPrefill: null,
      discussingNotificationId: null,
      discussingDecisionId: null,
      discussingTaskId: null,
      discussingGoalId: null,
      attentionItems: [],
      bColumnTaskId: null,
      bColumnGoalId: null,
      bColumnDecisionId: null,
      scrollToMessageId: null,
      conversationSessions: [],
      aColumnTab: 'attention' as const,
      workOrders: [],
      discussingWorkOrderId: null,
      isInitializing: false,
      initError: null,
      _cleanup: null,
    });
  },
}));
