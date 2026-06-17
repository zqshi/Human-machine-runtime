# HMR Light Bot — 工程宪章 v2

> 本文档是所有 Agent、大模型、开发者在本项目中的**强制执行标准**。
> 每次会话自动注入，任何代码变更必须遵守以下原则。违反即回退。

---

## 一、架构纪律：DDD 严格分层

### 1.1 层级定义与依赖方向

```
domain/  →  infrastructure/  →  application/  →  presentation/
（纯逻辑）   （外部适配器）       （用例编排）       （渲染/交互）
```

- **依赖方向单向向右**，禁止反向引用。
- domain 层**零外部依赖**：不引入 HTTP 客户端、SDK、数据库驱动、UI 框架。
- infrastructure 层通过**接口适配**连接外部世界，domain 只依赖接口定义。
- application 层编排用例，调用 domain + infrastructure，不含渲染逻辑。
- presentation 层只做 UI 渲染和用户交互，业务判断下沉到 application/domain。

### 1.2 违规判定

| 违规行为                             | 判定标准                                        |
| ------------------------------------ | ----------------------------------------------- |
| domain 引入外部包                    | import 路径包含 node_modules 或 infrastructure/ |
| presentation 直接调用 infrastructure | 跳过 application 层                             |
| application 包含 DOM 操作            | 出现 document/window/React.createElement        |
| 循环依赖                             | 任意两个模块互相 import                         |

### 1.3 后端分层（server/）

后端按 **DDD 限界上下文** 组织（非顶层四层目录）。业务逻辑按 context 聚合，每个 context 内部按职责划分 `domain`（纯逻辑、零外部依赖）/ `application`（用例编排）/ `adapters`（外部适配）等子目录（按需，非强制）。路由层只做参数校验与转发。

```
src/
  contexts/            # 限界上下文 ×28（agent-core/、runtime-engine/、channel/、tenant-management/…）
  routes/              # 路由层（薄层）：参数提取 → 校验 → 调用服务 → 返回
  app/                 # 启动入口、中间件链、依赖组装
  db/                  # Drizzle schema + migrations + seed
  middleware/          # auth、cors、rate-limit、audit-trail
  shared/              # 共享工具（newId、AppError、event-bus）
  integrations/        # 外部集成（Matrix 等）
```

- 路由文件只做：参数提取 → 校验 → 调用服务 → 返回结果。
- 业务逻辑禁止写在路由处理函数中，必须下沉到对应 context 的 domain/application 层。

---

## 二、质量纪律：TDD 强制执行

### 2.1 测试优先级

| 层级                  | 覆盖要求 | 测试类型               |
| --------------------- | -------- | ---------------------- |
| domain                | **100%** | 纯单元测试，无 mock    |
| infrastructure 适配器 | 关键路径 | 集成测试，可 mock 外部 |
| application 用例      | 核心流程 | 用例级测试             |
| presentation          | 交互逻辑 | 组件测试（非快照）     |

### 2.2 测试规范

- 框架：**vitest**
- 文件位置：与源文件同目录，命名 `*.test.ts` / `*.test.tsx`
- 新功能：**先写失败测试 → 实现至通过 → 重构**
- 修 bug：**先写复现测试 → 修复至通过**
- 禁止：测试中硬编码时间戳、随机数种子未固定、依赖执行顺序

### 2.3 质量门禁（提交前必须全过）

```bash
# 三重验证，任一失败则禁止提交
lint       → eslint / tsc --noEmit
type-check → tsc --strict（client-suite）
test       → vitest run
```

> **eslint 规则裁剪说明**：`react-hooks/set-state-in-effect` 已在 `client-suite/apps/web/eslint.config.mjs` 显式关闭。项目采用 effect + fetch 数据加载模式（未引入 React Query/Suspense 数据层），该 React Compiler 规则会把全部 mount/依赖加载 effect 标为 warning，与架构根本冲突；强行消除需引入数据层（超范围）或 `setTimeout` 包 setState（hack 埋雷）。**引入数据加载抽象层后应重新开启。** 其余 react-hooks 规则（purity/refs/exhaustive-deps）与 react-refresh/only-export-components 保持开启。

---

## 三、文件纪律：1000 行红线

### 3.1 硬性约束

- 单文件**不超过 1000 行**（含注释和空行）。
- 接近 800 行时必须主动评估拆分策略。
- 拆分原则：按**职责边界**拆，不按行数机械切割。

### 3.2 拆分策略

| 场景         | 拆分方式                                                            |
| ------------ | ------------------------------------------------------------------- |
| 路由文件过长 | 按资源域拆分：`modelRoutes.js` / `traceRoutes.js` / `riskRoutes.js` |
| 组件文件过长 | 提取子组件、hooks、工具函数                                         |
| 服务文件过长 | 按聚合根拆分子服务                                                  |
| CSS 过长     | 按功能模块拆分：`layout-base.css` / `layout-drawer.css`             |

### 3.3 命名规范

- 文件名：kebab-case（`model-management.js`）
- 组件名：PascalCase（`ModelCard.tsx`）
- 函数/变量：camelCase
- 常量：UPPER_SNAKE_CASE
- 接口：`I` 前缀（`IMatrixClient`）

---

## 四、变更纪律：影响范围评估

### 4.1 变更前必做

每次修改代码前，回答以下问题：

1. **接口影响**：是否改变了函数签名、API 契约、数据结构？→ 所有调用方必须同步更新。
2. **文档影响**：是否影响 CLAUDE.md、README、MEMORY.md、API 文档？→ 同步更新。
3. **配置影响**：是否需要更新 ALLOWED_FILES、路由注册、环境变量？→ 同步更新。
4. **测试影响**：是否有测试覆盖了被修改的逻辑？→ 更新测试，不删测试。
5. **删除影响**：删除文件前确认无其他文件引用（grep 确认）。

### 4.2 变更清单模板

每次非平凡变更，脑中或注释中过一遍：

```
变更：[描述]
影响文件：[列表]
接口变化：[有/无，描述]
需同步：[文档/配置/测试]
回滚方案：[git revert / 手动步骤]
```

### 4.3 禁止行为

- 禁止"顺手"改不相关的代码（scope creep）。
- 禁止添加未使用的导入、未调用的函数、注释掉的代码块。
- 禁止引入新依赖而不说明理由。

---

## 五、清理纪律：持续整洁

### 5.1 死代码清理

- 删除的功能：文件直接删除，不注释保留（git 有历史）。
- 未使用的变量/函数/导入：当场清理，不留 `_unused` 前缀。
- 废弃的页面/路由：从 ALLOWED_FILES、侧栏导航、文档中同步移除。

### 5.2 冗余判定标准

| 判定维度   | 冗余标准                                |
| ---------- | --------------------------------------- |
| 无入口     | 无侧栏链接 + 不在 ALLOWED_FILES         |
| 功能重叠   | 与另一页面 >70% 功能重合                |
| 跳转桩     | 只含 `location.href` 重定向，无独立逻辑 |
| 不完整原型 | 有 HTML 无对应 JS，或 JS 中全是 TODO    |

### 5.3 清理流程

```
1. grep 确认无引用
2. 从配置/导航中移除
3. 删除文件
4. 更新文档
5. 验证启动无报错
```

---

## 六、文档纪律：代码与文档同步

### 6.1 必须维护的文档

| 文档                  | 职责                         | 更新时机        |
| --------------------- | ---------------------------- | --------------- |
| `CLAUDE.md`（本文件） | 工程宪章，Agent 强制执行标准 | 规范变化时      |
| `memory/MEMORY.md`    | 项目记忆索引                 | 学到新信息时    |
| `README.md`           | 项目说明、启动指南           | 功能/架构变化时 |

### 6.2 文档原则

- 文档是**给未来的自己和新成员看的**，不是给当前对话看的。
- 只记录**不能从代码推断的信息**：决策原因、架构约束、外部依赖关系。
- 禁止在文档中写过程性内容（"今天修了 xxx"）——这是 git log 的事。

---

## 七、技术栈约束

### 7.1 前端（client-suite/）

| 项       | 选型                                  | 约束                         |
| -------- | ------------------------------------- | ---------------------------- |
| 框架     | React + TypeScript                    | 严格模式，no any             |
| 样式     | Tailwind CSS 3.4                      | 通过 `@hmr/ui-tokens` preset |
| 状态     | zustand                               | 一个 store 一个文件          |
| 设计语言 | Apple HIG glass morphism              | 主色 `#007AFF`               |
| 暗色模式 | `[data-mode="openclaw"]` CSS 变量覆盖 | —                            |
| 测试     | vitest                                | —                            |
| 包管理   | npm workspaces                        | —                            |

### 7.2 后端（server/）

| 项     | 选型                     | 约束                                     |
| ------ | ------------------------ | ---------------------------------------- |
| 运行时 | Node.js 20+             | ESM，TypeScript strict                   |
| 框架   | Hono                     | 路由薄层，中间件链式组合                 |
| ORM    | Drizzle                  | TypeScript-first，PostgreSQL             |
| 数据库 | PostgreSQL 16            | Docker Compose 本地（5435 端口），生产用托管实例 |
| IM     | Matrix (Conduit)         | 自有基础设施，Channel Bridge 可插拔      |
| 认证   | JWT + SSO 预留           | bcrypt 密码，SSO 开关在 system_configs   |
| 测试   | vitest                   | —                                        |

### 7.3 认证策略

| 阶段 | 方式 | 说明 |
|------|------|------|
| 当前 | JWT + 本地密码 | bcrypt 哈希，seed 数据4个账号 |
| 后续 | SSO (OIDC/SAML) | system_configs 预留配置项，开关式接入 |

---

## 八、文件组织

```
human-machine-runtime/
  server/                             # 新后端（Hono + TypeScript + Drizzle）
    src/
      app/                            # Hono app 入口 + 中间件链
      config/                         # 类型化配置（环境变量）
      db/                             # Drizzle schema + client + migrate
      shared/                         # 共享工具（newId, AppError）
      middleware/                      # auth, cors, rate-limit, error-handler
      routes/                         # Hono 路由注册
        platform/                     # L1 运管平台路由
        control/                      # L2 管理控制面路由
      contexts/
        identity-access/              # 认证鉴权 + RBAC
        tenant-management/            # 租户生命周期
        audit-observability/          # 审计日志
        shared-assets/                # 技能/资产共享
        tenant-instance/              # 数字员工实例
        document/                     # 文档/知识库
        agent-core/domain/            # Agent 核心领域逻辑
        gateway/                      # API 网关 → 外部服务（组件代号：clawhub/portal/xspace/claw-farm/LiteLLM，均可替换为企业自有同类系统）
          clients/                    # 各组件 HTTP 客户端
          routes/                     # 代理路由
        workspace/                    # Workspace 对接 AI 工作区（xspace）
        marketplace/                  # 市场对接技能市场（clawhub）
        agent-profile/                # Profile 对接配置中心（portal）
      integrations/
        matrix/                       # MatrixBot + MatrixRelay + ChannelBridge
        weknora/                      # WeKnora RAG 服务
  client-suite/
    apps/web/src/
      domain/                         # 纯业务逻辑，零依赖
      infrastructure/                 # 外部适配器
      application/                    # 用例编排 + zustand stores
      presentation/                   # React 组件 + 路由
    packages/
      ui-tokens/                      # 设计 token
```

---

## 九、Agent/LLM 行为约束

以下规则在每次会话中自动生效：

1. **先读后改**：修改任何文件前必须先 Read，理解上下文。
2. **先查后删**：删除任何文件/函数前必须 Grep 确认无引用。
3. **先测后交**：功能完成后必须验证（启动/测试/手动检查）。
4. **单一职责**：一次变更只做一件事，不夹带"顺手优化"。
5. **影响评估**：每次变更前列出影响范围，不遗漏配置/文档/测试。
6. **1000 行红线**：写入文件后检查行数，超出立即拆分。
7. **不造轮子**：已有类名/模式/组件能复用的，不重新发明。
8. **不留垃圾**：删除即彻底删除，不注释保留，不留 TODO 桩。
9. **中文回复**：所有对话输出使用中文。
10. **专业审视**：不谄媚，发现问题直说，给出专业建议。
