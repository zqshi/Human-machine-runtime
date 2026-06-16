# OpenClaw Client Suite — 架构设计

> 版本 1.0 | 2026-04-14 | MVP 阶段

## 1. 产品形态

OpenClaw Client Suite 是面向终端用户（管理者）的 **React SPA**，实现"人机协同管理者模式"——用户做决策，AI 自主执行。

核心交互范式：
- **异步决策流 (P0)**：AI 生成带理由的推荐方案，用户一键决策
- **目标驱动对话 (P1)**：设定目标 → AI 自主推进 → 里程碑汇报
- **执行看板 (P2)**：数字员工工作台 + 协作链路可视化
- **项目看板 (P2)**：任务/目标/决策/协作的四栏全景面板
- **上下文空间 (P3)**：决策历史 + 业务知识跨会话复用

## 2. DDD 四层架构

```
domain/          →  infrastructure/    →  application/      →  presentation/
（纯业务逻辑）      （外部适配器）          （用例编排）          （React 组件）
```

依赖方向**严格单向向右**，禁止反向引用。

### 2.1 Domain 层（47 文件，12 个测试）

纯业务实体和值对象，零外部依赖。

| 子域 | 文件 | 职责 |
|------|------|------|
| **agent/** | Agent, AgentFactory, AgentRuntime, AgentTask, AgentRoutingService, AgentOrchestrationService, CapabilityRegistry, CapabilityTemplate, AgentCategoryConfig | Agent 实体 + 能力体系 |
| **agent/** | DecisionHub, DecisionRequest, DecisionTree, DecisionTriggerFactories | 统一决策接入层 + 触发器工厂 |
| **agent/** | CollaborationChain, UserGoal, ProjectBoard, CoTMessage, DrawerContent, MessageBlock | 协作链、目标、看板、消息结构 |
| **chat/** | ChatMessage, ChatRoom, ChatService | 对话消息 + 房间管理 |
| **knowledge/** | Document, Folder, Category, Version, Permission, AuditEntry | 知识库实体 |
| **notification/** | Notification, Approval | 通知 + 审批实体 |
| **todo/** | Todo, TodoList | 待办事项 |
| **subscription/** | Subscription | 订阅管理 |
| **shared/** | formatTime, types | 共享工具 + 类型定义 |

### 2.2 Infrastructure 层（19 文件，3 个测试）

外部世界适配器。

| 模块 | 文件 | 职责 |
|------|------|------|
| **api/** | dcfApiClient, documentAdapter, weKnoraClient | 后端 API 客户端 |
| **matrix/** | MatrixClientAdapter (IMatrixClient), MockMatrixClient, RealMatrixClient, crypto-wasm-stub | Matrix SDK 适配 |
| **channels/** | ChannelAdapter, ChannelAdapterRegistry, MockChannelAdapter | 多渠道消息适配 |
| **mock/** | MockOpenClawDataSource, mockNotificationData, mockDecisionGoalData, MockAppTemplates, MockDocTemplates | Mock 数据工厂（演示模式） |
| **storage/** | LocalStorageAdapter | 本地存储 |

### 2.3 Application 层（22 文件，0 个测试）

用例编排 + zustand stores + 事件总线。

| 模块 | 文件 | 职责 |
|------|------|------|
| **stores/** | openclawStore (+Types, +ConversationHelpers, +DiscussionActions) | OpenClaw 主状态（对话/Agent/通知/决策/目标/看板） |
| **stores/** | chatStore, knowledgeStore, agentStore, notificationStore, subscriptionStore, todoStore | 独立功能 store |
| **stores/** | authStore, uiStore, toastStore | 基础设施 store |
| **hooks/** | useAgentChat, useAuth, useMatrixClient, useRooms, useTimeline | React 自定义 hooks |
| **events/** | eventBus | 跨 store 协调事件总线（AppEvents 接口） |
| **decision-triggers/** | CollaborationTrigger, MilestoneTrigger, RiskRuleTrigger | 决策触发器 handler（实现 domain DecisionTriggerHandler） |

### 2.4 Presentation 层（158 文件，0 个测试）

React 组件 + 路由。

| 目录 | 文件数 | 职责 |
|------|-------|------|
| **features/openclaw/** | 37+14 | OpenClaw 主界面 + 消息 blocks |
| **features/knowledge/** | 32 | 知识库管理 |
| **components/ui/** | 14 | 通用 UI 组件 |
| **features/chat/** | 10 | 对话界面 |
| **features/notifications/** | 6 | 通知中心 |
| **features/drawer/panels/** | 6 | Drawer 面板 |
| **features/apps/** | 6 | 应用中心 |
| **features/todo/** | 5 | 待办管理 |
| **features/subscription/** | 5 | 订阅管理 |
| **layouts/** | 4 | AppShell + 布局 |
| **routing/** | 2 | Dock-based SPA 路由 |
| 其他 | 11 | code/contacts/calendar/settings/skills/agents |

## 3. 状态管理架构

```
zustand stores (application/)
├── openclawStore          # 主状态：对话、Agent、通知、决策、目标、看板
│   ├── openclawTypes.ts           # 类型定义
│   ├── openclawConversationHelpers.ts  # 纯函数辅助
│   └── openclawDiscussionActions.ts    # 讨论处理
├── chatStore              # Matrix 对话
├── knowledgeStore         # 知识库
├── agentStore             # Agent 管理
├── notificationStore      # 通知状态
├── todoStore              # 待办
├── subscriptionStore      # 订阅
├── authStore              # 认证状态
├── uiStore                # UI 状态（主题/布局）
└── toastStore             # Toast 消息
```

跨 store 协调通过 `eventBus` 实现事件驱动解耦。

## 4. 信息架构

### 4.1 三栏/四栏自适应布局

```
┌──────────┬──────────────────┬─────────────────┐
│ A 栏     │  B 栏            │ C/D 栏          │
│ 通知列表  │  主对话区         │ Drawer          │
│ 240px    │  flex-1          │ 按需展开         │
│          │                  │                 │
│ · 通知    │  · 对话消息流     │ · 执行看板       │
│ · 决策    │  · 决策卡片       │ · 决策详情       │
│          │  · 目标进展       │ · 目标追踪       │
│          │  [Composer]       │ · 协作链路       │
└──────────┴──────────────────┴─────────────────┘
```

- decision/notification 场景使用**三栏**布局
- task/goal/project-board 场景使用**四栏**布局

### 4.2 Dock 导航

底部 Dock 栏提供主要功能入口：
- OpenClaw（AI 对话）
- 知识库
- 应用中心
- 待办
- 设置

## 5. 设计系统

| 维度 | 规范 |
|------|------|
| 设计语言 | Apple HIG glass morphism |
| 主色 | `#007AFF` (Apple Blue) |
| 暗色模式 | `[data-mode="openclaw"]` CSS 变量覆盖 |
| 样式框架 | Tailwind CSS 3.4 |
| 设计 Token | `@dcf/ui-tokens` preset |
| 卡片风格 | `border-radius: 14px; backdrop-filter: blur` |
| 字体 | -apple-system, SF Pro |

## 6. 技术栈

| 项 | 选型 |
|----|------|
| 框架 | React 18 + TypeScript (strict) |
| 构建 | Vite |
| 样式 | Tailwind CSS 3.4 |
| 状态 | zustand 5 |
| 富文本 | TipTap |
| 代码编辑 | CodeMirror 6 |
| Markdown | react-markdown + remark-gfm |
| Matrix | matrix-js-sdk 39.4 |
| 测试 | vitest + @testing-library/react |
| 包管理 | npm workspaces |

## 7. 依赖倒转模式

domain 层通过接口定义和依赖注入与外部解耦：

- **事件总线**：domain 定义 `DomainEventEmitter` 端口接口，application 注入 `appEvents` 实现
- **决策触发器**：domain 定义 `DecisionTriggerHandler` 接口 + 上下文接口（`CollaborationNodeContext`, `MilestoneContext`），application 实现具体 handler
- **数据源**：domain 定义实体结构，infrastructure 的 MockOpenClawDataSource 提供数据
