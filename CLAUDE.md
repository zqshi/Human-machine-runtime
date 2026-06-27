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
  contexts/            # 限界上下文 ×29（agent-core/、runtime-engine/、channel/、tenant-management/、billing/…）
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
- 豁免：纯类型/常量文件（仅 `export type`/`interface`/`const`，无 `export function`/`class`）不强制单测；含可执行逻辑（函数/类/计算）的 domain 文件仍须 100% 覆盖。

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

### 6.3 文档分类与状态标注

**三分法**:

| 类别 | 位置 | 规则 |
| ---- | ---- | ---- |
| 自动生成类 | API 文档（OpenAPI）、前端 `types/api.ts` | 不手写，由 schema 驱动 |
| 设计态文档 | `docs/` 目录（PRD、愿景、模块拆解、版本规划） | 允许超前于代码，但**必须标注实现状态** |
| 实现态文档 | README、CLAUDE.md、`.env.example`、docker-compose | 必须与代码同步，过期即修正 |

**设计态文档的状态标注**（每节/每条顶部）:

- `[IMPLEMENTED]` — 已在代码中实现
- `[PLANNED]` — 尚未实现，属于规划中
- `[DEPRECATED]` — 设计已废弃，代码已移除或方向已变

### 6.4 PR 文档对齐必检清单

| 变动路径 | 必须同步更新 |
| -------- | ------------ |
| `server/src/contexts/*/domain/` | 对应设计态文档标注 + 若新增 context 更新 §8 文件组织清单 |
| `server/src/routes/` | README 如涉及新 API 模块 |
| `server/src/config/` 新增字段 | `.env.example` 添加对应变量和注释 |
| `server/src/db/schema.ts` 加表/加列 | 新增 Drizzle migration 文件（见 §7.2.1 第 3 条） |
| `client-suite/.../types/api.ts` | 与后端 schema 字段名/类型完全对齐 |
| `package.json` / `pyproject.toml` 依赖变动 | README 前置要求章节 |
| `docker-compose.yml` / `Dockerfile` | README 部署章节 |
| 合并到 main 的功能性变更 | `CHANGELOG.md` Unreleased 区域（若存在 CHANGELOG） |

---

## 七、技术栈约束

### 7.1 前端（client-suite/）

| 项       | 选型                                  | 约束                         |
| -------- | ------------------------------------- | ---------------------------- |
| 框架     | React + TypeScript                    | 严格模式，no any             |
| 样式     | Tailwind CSS 3.4                      | 通过 `@hmr/ui-tokens` preset |
| 状态     | zustand                               | 一个 store 一个文件          |
| 设计语言 | Apple HIG glass morphism              | 主色 `#007AFF`               |
| 暗色模式 | `[data-mode="cockpit"]` CSS 变量覆盖 | —                            |
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

### 7.2.1 后端 API 四条硬规则

任何新增 API 必须满足:

1. **新路由必须挂 auth 中间件** — 除非显式属于公开端点（登录/健康检查/ webhook 回调），且公开端点须在 PR 中说明理由。
2. **列表 API 必须支持分页** — `skip`/`limit` 或游标分页，默认非空，禁止无限制全量返回。
3. **DB schema 变更必须有 Drizzle migration** — 加列改列必须同步到 `server/src/db/migrations/*.ts`，仅改 `schema.ts` 不够（见 memory: `migrate.ts 不跑 .sql`）。`tsc`/`vitest` 测不出缺列，只有真请求暴露。
4. **新表必须添加必要索引** — 外键字段、常用于 `where`/`orderBy` 的字段、唯一约束字段。migration review 必检。

> 违反任一条 = PR 不予合并。这是 §12 信号 6（route 逻辑泄漏）之外的硬性纪律。

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
      contexts/                       # 29 个限界上下文（§1.3：内部按需划分 domain/application/adapters）
        identity-access/              # 认证鉴权 + RBAC
        tenant-management/            # 租户生命周期 + 套餐
        tenant-instance/              # 数字员工实例
        audit-observability/          # 审计日志
        observability/                # 可观测性（指标/追踪）
        analytics/                    # 数据分析/统计
        agent-core/                   # Agent 核心（执行器/模拟器/运行时领域）
        runtime-engine/               # 运行时引擎
        scheduler/                    # 定时任务调度
        shared-agent/                 # 共享 Agent
        shared-assets/                # 技能/资产共享
        tool-management/              # 工具管理（MCP executor）
        mcp-management/               # MCP 服务管理
        credential-vault/             # 凭证保险库（加密存储）
        employee-memory/              # 数字员工记忆（mem0）
        knowledge/                    # 知识库管理
        document/                     # 文档
        department/                   # 部门组织
        notification/                 # 通知（邮件等）
        push-channel/                 # 推送通道
        channel/                      # 通道抽象（IM/WebSocket）
        quota-management/             # 配额管理
        billing/                      # 计费骨架（事件 + 账户累加；invoice/对账/充值待 v1.3+）
        system-config/                # 系统配置
        eval-benchmark/               # 评测基准
        gateway/                      # API 网关 → 外部服务（clawhub/portal/xspace/claw-farm/LiteLLM，均可替换为企业自有同类系统）
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

---

## 十、上下文加载协议

> **每次新会话开始开发任务前，必须执行以下步骤。** 这是 §1-§9 静态纪律之外的动态纪律——确保 Agent 拿到正确的"当前版本上下文"再动手。

### 10.1 会话启动三步

1. **读当前版本**: 读取 `docs/versions/` 目录下以 `-current.md` 结尾的文件（**有且仅有一个**），了解当前版本的目标、范围、约束、任务依赖图、进行中的任务。
2. **检查任务依赖**: 在 current.md 的任务依赖表中定位要做的工作，确认状态不是 `blocked`；若 `blocked`，先列出未完成的前置依赖，建议执行顺序。
3. **范围校验**: 如果用户要求做的功能不在当前版本范围，主动提示并建议查看 `backlog.md` 或将其加入当前版本（经用户确认）。

### 10.2 依赖检查规则

| 任务状态 | 处理方式 |
| -------- | -------- |
| `pending` + 无依赖 | 可直接开始 |
| `pending` + 依赖已 `done` | 可开始（依赖图自动解锁） |
| `blocked`（依赖未完成） | 列出前置，建议先做前置；前置 < 30min 则同会话内先做完前置 |
| 不在任务表 | 评估是否属于当前版本；不属于 → 提示用户看 backlog |

### 10.3 并行任务识别

- 检查依赖图中是否有互不依赖且都 `pending` 的任务 → 主动建议并行: "T1 和 T3 互不依赖，可在本次会话一起完成"。
- 标注**关键路径**（最长依赖链）上的任务，优先推进关键路径。

### 10.4 任务完成与状态更新

- 完成一个任务 → **立即** 把 current.md 中该任务状态改为 `done`。
- 检查是否有因此解锁的下游任务，把状态从 `blocked` 改为 `pending`。
- 若所有任务完成 → 提醒用户执行版本切换（见 §11）。

### 10.5 计划外工作

开发中发现需要新增任务（如发现前置 bug）:
1. 加入 current.md 任务表
2. 分配 ID（现有最大 ID 递增）
3. 评估对依赖图的影响，更新关键路径

---

## 十一、版本管理协议

### 11.1 版本文件四态

| 后缀 | 含义 | 数量约束 |
| ---- | ---- | -------- |
| `vX.Y.Z-current.md` | 当前活跃版本 | **有且仅有一个** |
| `vX.Y.Z-next.md` | 下一版本规划（可选） | 0 或 1 个 |
| `vX.Y.Z-snapshot.md` | 已完成版本决策存档 | 任意 |
| `backlog.md` | 未排期版本与长期债务 | 唯一 |

模板见 `docs/versions/TEMPLATE.md`。

### 11.2 版本切换流程

当 current.md 所有任务标记 `done` 时:

0. **先执行版本完成质量门禁**（见 §14），全部必修项通过后才能归档。
1. 把 `vX.Y.Z-current.md` 精简为 snapshot 格式（删除执行细节，只保留: 目标 / 交付摘要 / 决策表 / 遗留 / 约束 / 质量检测摘要）。
2. 重命名为 `vX.Y.Z-snapshot.md`。
3. 把 `vNext-next.md` 重命名为 `vNext-current.md`（激活下一版本）；若不存在，从 `backlog.md` 取下一版本规划基于 `TEMPLATE.md` 创建。
4. 更新 `CHANGELOG.md`（若存在）和 `backlog.md`（移除已启动的版本）。
5. 为再下一个版本创建 `vX.Y.Z-next.md`（可选，有规划时提前建）。

### 11.3 snapshot 不可改

归档后的 snapshot 文件**只读**。发现历史决策错误 → 在当前版本的任务中处置，不回改 snapshot（git 有历史）。

---

## 十二、领域模型健康度审计

> HMR 有 29 个限界上下文（§8），是贫血模型与 Service 膨胀的高发区。本节定义 6 个腐烂信号，用于周期性巡检（§13）与版本完成门禁（§14）。

### 12.1 六大腐烂信号

| # | 信号 | 判定标准 | 优先级 |
| - | ---- | -------- | ------ |
| 1 | **贫血模型** | `server/src/contexts/*/domain/` 下的 entity 只有数据字段，行为方法挂在 application service | P1 |
| 2 | **Service 膨胀** | application service 单文件 > 500 行，或单方法 > 80 行 | P1 |
| 3 | **接口漂移** | domain 定义的 repository 接口方法，在 `adapters/` 缺少对应实现 | P2 |
| 4 | **值对象缺失** | 应为值对象（带不变式）的字段用了裸 `string` / `number` / `Record<...>` | P2 |
| 5 | **跨聚合直接访问** | application service 直接操作**其他 context** 的 repository（绕过本聚合边界） | P1 |
| 6 | **route 逻辑泄漏** | `routes/` 文件出现业务判断（`if/for` 含领域语义），而非纯参数校验+转发 | P3 |

### 12.2 处置规则

- **P1**（贫血模型 / Service 膨胀 / 跨聚合访问）→ 下一版本必修，记入当前 snapshot 的 `## 遗留`。
- **P2**（接口漂移 / 值对象缺失）→ 两版本内修复。
- **P3**（route 轻微逻辑）→ 顺手修复，不单独立任务。

### 12.3 检测方法

```bash
# 信号 1 贫血模型: domain 下只有 type/interface 无 function 的文件
grep -rL "function\|method" server/src/contexts/*/domain/*.ts

# 信号 2 Service 膨胀: 超限文件清单
find server/src/contexts/*/application -name "*.ts" | xargs wc -l | sort -rn | head

# 信号 5 跨聚合访问: service 引用其他 context 的 repository
grep -rn "from.*contexts/[^/]*/domain.*repository" server/src/contexts/*/application/

# 信号 6 route 逻辑泄漏: routes 下含业务语义的分支
grep -rn "if.*status\|if.*quota\|if.*role" server/src/routes/
```

> 检测脚本非权威，是发现起点。命中后人工判定真伪腐烂（false positive 常见于合法的参数分支）。

---

## 十三、周期性质量巡检

> 防止领域模型腐烂、架构约束被渐进侵蚀、技术债务无声积累。不依赖版本完成这一个时间点，在日常开发中持续守护。

### 13.1 会话级巡检（每次会话启动，§10 之后追加）

| # | 检测项 | 方法 | 耗时 |
| - | ------ | ---- | ---- |
| 1 | DDD 层级依赖 | 扫描 `server/src/contexts/*/domain/` 下 import，验证无 application/adapters/routes 依赖 | < 10s |
| 2 | 循环依赖 | 检测模块间 import 环（madge 或等效工具） | < 10s |
| 3 | 文件超限 | 扫描所有源文件行数，报告 > 800 行的文件 | < 10s |

- 发现违规 → 在开始任务前先修复，或记入 current.md 任务表。
- 未发现问题 → 静默通过，不输出。

### 13.2 任务级巡检（每个任务完成、更新 current.md 状态前）

| # | 检测项 | 方法 |
| - | ------ | ---- |
| 1 | 本次变更文件是否超限 | 检查本次修改/新增文件行数 |
| 2 | 本次变更是否引入层级违规 | 检查本次修改文件的 import |
| 3 | 本次新增代码是否有配套测试 | 按 §2.2 测试规范核查 |
| 4 | 本次变更是否影响配置一致性 | 改了 `config/` → 检查 `.env.example`；改了 DB schema → 检查 migration（见 memory: migrate.ts 不跑 .sql） |

- 发现问题 → **当场修复后再标记任务 done**。不通过不得标记完成。

### 13.3 月度/每 3 版本深度审计

执行 §12 领域模型健康度 6 项完整审计，发现腐烂信号按 §12.2 处置规则记入 `backlog.md` 长期技术债务表。

---

## 十四、版本完成质量门禁

> **触发时机**: current.md 所有任务标记 `done` → 执行检测 → 全部必修项通过后才归档 snapshot（§11.2 步骤 0）。
> 这是 §2.3"提交前三重验证"的升级版——提交门禁是**每次 commit** 的，版本门禁是**版本归档前**的全量审计。

### 14.1 必修项（全部通过才能归档）

| # | 类别 | 检测对象 | 方法 | 不通过 = |
| - | ---- | -------- | ---- | -------- |
| 1 | 死代码 | 前端组件/hooks/脚本 | 检查是否被 import 或有 npm script 入口 | 删除 |
| 2 | 死代码 | 后端模块 | 检查是否在 routes/service/app 调用链上 | 删除 |
| 3 | 依赖卫生 | `package.json` dependencies | 每个包在 src/ 中有 import | 移除 |
| 4 | 配置一致性 | `config/` ↔ `.env.example` | Settings 字段与 env key 双向对齐 | 补齐 |
| 5 | 配置一致性 | `docker-compose` ↔ `Dockerfile` | 端口/镜像名/环境变量一致 | 修正 |
| 6 | 文档对齐 | CLAUDE.md 文档索引路径 | 验证路径实际存在 | 更新索引 |
| 7 | 文档对齐 | `docs/versions/` | 有且仅有一个 `*-current.md` | 修正 |
| 8 | 架构合规 | DDD 层级依赖 | 扫描 import 验证不违反 §1 分层方向 | 立即修复 |
| 9 | 架构合规 | 循环依赖 | 检测模块间 import 环 | 立即修复 |
| 10 | 架构合规 | 文件行数 | 扫描所有源文件 | > 1000 行本版本必修；800-1000 行记入技术债务 |
| 11 | 仓库卫生 | `.gitignore` 完备性 | untracked 不应有构建产物/缓存 | 补 gitignore |
| 12 | 仓库卫生 | 敏感文件 | `.env` / credentials 不被 git track | 从历史移除 |

### 14.2 记录项（不阻断归档，记入 backlog）

| # | 检测对象 | 方法 | 不通过 = |
| - | -------- | ---- | -------- |
| 1 | domain 层各 context | 检查 `*.test.ts` 是否存在 | 记入下版本技术债务 |
| 2 | application 层各 context | 检查 `*.test.ts` 是否存在 | 记入下版本技术债务 |
| 3 | 本版本新增 entity/service/endpoint | 是否有测试覆盖 | 记入下版本技术债务 |
| 4 | §12 领域模型健康度 P2 项 | 接口漂移 / 值对象缺失 | 记入两版本内修复 |

### 14.3 执行产出

在 snapshot 文件中新增 `## 质量检测` 小节，记录本次检测结果摘要（通过项数 / 未通过处置 / 记入债务数）。
