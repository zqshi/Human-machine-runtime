# OpenClaw Client Suite — 里程碑计划

> 版本 1.0 | 2026-04-14

## M0: 基础对话 + 知识库 + Todo [已完成]

- React SPA 骨架（Vite + Tailwind + zustand）
- DDD 四层架构建立（domain/infrastructure/application/presentation）
- Matrix 客户端适配（IMatrixClient 接口 + MockMatrixClient 演示模式）
- AI 对话基础功能（消息流 + Markdown 渲染 + 多 Agent 路由）
- 知识库 CRUD（文件夹/文档/版本/权限/审计）
- 代码编辑器集成（CodeMirror 多语言）
- 待办管理
- 设计系统基础（@dcf/ui-tokens + Apple HIG glass morphism）

**交付物**: 可用的对话 + 知识库 + 待办功能。

## M1: 管理者模式 P0-P1 [已完成]

### P0: 异步决策流
- DecisionRequest 实体 + DecisionHub 统一决策入口
- 决策请求卡片（推荐方案 + 理由 + 操作按钮）
- 决策详情 Drawer 面板
- 紧急度四级标识 + 时效管理
- 决策树分支可视化

### P1: 目标驱动对话
- UserGoal 实体 + 里程碑状态管理
- Composer 目标设定 + AI 自动拆解
- 目标追踪 Drawer 面板
- 里程碑完成→决策触发（MilestoneTrigger）
- 跨渠道通知聚合

**交付物**: 完整异步决策 + 目标驱动闭环。

## M2: 管理者模式 P2 + Mock 演示 [进行中]

- 项目看板四栏面板（任务/目标/决策/协作）
- Agent 工作台 + 协作链路可视化
- CollaborationChain 跨 Agent 任务委托
- CoT 推理链工具调用/知识引用丰富化
- 应用构建器 + 文档编辑器面板
- MockOpenClawDataSource 全量演示数据
- DDD 依赖方向修复（3 处 domain→application 违规解除）
- 1000 行红线合规（openclawStore 1797→4 文件、MockOpenClawDataSource 1376→3 文件）

**交付物**: 全功能演示模式，管理者模式 P2 核心交付。

## M3: 管理者模式 P3 + 后端对接 [规划中]

### P3: 上下文空间
- ContextSpace 实体
- 决策历史自动记录
- AI 业务知识积累
- 跨会话上下文关联

### 后端对接
- MockOpenClawDataSource → DCF API 客户端切换
- Matrix RealMatrixClient 联调（解决 crypto-wasm 兼容）
- 认证对接（authStore → DCF JWT）
- 实时通知推送

**交付物**: 完整上下文空间，后端数据打通。

## M4: 生产化 + 测试补全 [规划中]

- application 层测试覆盖（当前 0 个测试）
- presentation 层交互测试
- 性能优化（懒加载/虚拟列表/缓存）
- 国际化（i18n）
- 无障碍审查（a11y）
- 桌面端 Electron 打包

**交付物**: 生产就绪的客户端。
