# 新会话接手待办清单

> **用途**：跨版本汇总所有尚未执行的任务/升级，供新会话接手时一站式定位执行入口。
> **配合 §10**：新会话先读 `v1.2.2-current.md`（current）+ 本清单。本清单不替代版本文件，只做跨版本待办汇总与执行顺序。
> **生成时间**：2026-06-27（T58/T59 done + v2.0 规划落库后）。最新状态以各版本文件为准。
> **提交状态**：main 已与 origin 同步（commit `3174793`），工作区干净。

---

## 待办总表

| 类别 | 项 | 版本归属 | 阻断条件 | 执行入口 |
|---|---|---|---|---|
| A 立即可执行 | 残留分支清理 | 杂项 | 无（已核查可安全删） | §A1 |
| A 立即可执行 | openclaw 聚合端点性能优化 | backlog D12 | 无（P3 低优） | §A2 |
| A 立即可执行 | JSONB filter 索引优化 | backlog D13 | 无（P3 低优） | §A2 |
| B 需用户决策 | v1.2.2 计费 T4-T11 | v1.2.2 current | 商业化时机 | §B1 |
| B 需用户决策 | v2.0 架构升级 C1-C15 激活 | v2.0 next | 启动确认+current唯一性 | §B2 |
| B 需用户决策 | v1.2.2 §14 版本归档 | v1.2.2 current | 判定范围内任务全done | §B3 |
| C 需外部条件 | Matrix 端到端实测 | v1.2.2 T57遗留 | 用户侧环境 | §C1 |
| C 需外部条件 | openclawStore 浏览器实测 | backlog D10 | 用户侧浏览器 | §C2 |
| C 需外部条件 | CubeSandbox KVM 宿主部署 | backlog D14 | 运维侧 KVM 宿主 | §C3 |

---

## A. 可立即执行（无阻断）

### A1 — 残留分支清理 ✅已核查
`fix/grey-zone-defects-t24-t26` 经核查（`git branch --merged main` 列出 + `git log main..branch` 空）：**已完全合并 main，无独有 commit，可安全删除**。
```
git branch -d fix/grey-zone-defects-t24-t26   # -d 因已合并不会拒绝
```
（`git diff` 显示 139 文件差异是因 main 后续发展远超该分支 tip，正常，不影响删除安全性。）

### A2 — openclaw 性能优化（D12/D13，P3 低优，可择机）
- **D12**：4 聚合统计端点（`/inbox`、`/judgment-analytics`、`/evaluation dual-track`、`/trends`）全量 reduce 性能优化。返回聚合指标非列表，不属 §7.2.1 分页管辖（T58 已判定不改分页），但全量读取是性能债。
- **D13**：带 filter 端点（objective.level/decision.status 等）当前 `list+filter+slice`，改 DB 层 JSONB where filter 消除全量读。实体 EAV+JSONB，需索引设计。
- 两者均非阻断，可并入任意会话顺手做或单独立任务。

---

## B. 需用户决策才能启动

### B1 — v1.2.2 计费 T4-T11（待商业化时机）
用户决策备注（current.md）：「内部推广暂不计费，待内部推广验证 + 商业化时机成熟后择机开工」。计费建在未实测主路径基座上风险高，启动前先做灰区实测（见 C1/C2）。

| ID | 任务 | P | 依赖 | 状态 |
|----|------|---|------|------|
| T4 | quota↔analytics 数据流贯通 | P0 | - | pending |
| T6 | 用量报表 API | P1 | T4 | blocked |
| T7 | 前端用量报表展示 | P1 | T6 | blocked |
| T8 | 用量异常告警 | P2 | T4 | blocked |
| T10 | billing 写侧补全（consume/deduct/reserve） | P0 | - | pending |
| T11 | 日终对账任务 | P1 | T10 | blocked |

关键路径：T4→T6→T7（用量报表 3 天）；并行：T10→T11（billing 写侧）。执行入口：读 `v1.2.2-current.md` 任务详情 + T4/T10 实施要点。

### B2 — v2.0 架构升级 C1-C15 激活（需用户确认启动）
设计文档：`docs/architecture/v2.0-declarative-baking-runtime.md`；任务图：`docs/versions/v2.0-next.md`（C1-C15 全 pending）。

**激活条件**（v2.0-next.md 激活条件）：
1. v1.2.2 计费商业化时机明确（归档 or 并行——需用户决策 current 唯一性，§11.1）
2. CubeSandbox KVM 宿主可获取（见 C3，否则 C8 无法实测）
3. 用户确认启动实施

关键路径：C1→C2→C3→C6（baking 3.5 天）与 C7→C8→C9（CubeSandbox 1.7 天）并行，总 ~9 天可拆多会话。**本阶段只出了设计文档+任务图，未实施任何代码**。

### B3 — v1.2.2 §14 版本归档
若判定 v1.2.2 范围内任务全 done（当前 T58/T59 done，但计费 T4-T11 待商业化未做），走 §11.2 归档流程：先过 §14 门禁 12 必修项 → current 精简为 snapshot。**是否归档需用户决策**——计费未做时归档会把计费踢到下版本。

---

## C. 需外部条件（用户侧/运维侧）

### C1 — Matrix 端到端实测（用户侧）
T57（Matrix bot 对话闭环）代码 done，端到端实测待用户。清单 `docs/architecture/matrix-bot-e2e-checklist.md`：
- Conduit IM 后端起（docker-compose 6167）
- 注册 `@hmr-bot` 拿 access token
- 前端 IM 对话验证：bot 回复 / 多轮记忆 / 人↔人不介入

### C2 — openclawStore 浏览器实测（用户侧，backlog D10）
IM 模式共享 Agent 对话真请求流式回包未经浏览器验证（tsc/vitest 测不出）。需 IM 模式实际发一条消息确认。类 `migrate.ts 不跑 .sql` 风险。

### C3 — CubeSandbox KVM 宿主部署（运维侧，backlog D14）
v2.0 C8（CubeSandboxExecutor）实测前置。需支持 KVM 的 x86_64 Linux PVM（腾讯云 CubeSandbox 要求）。代码只接 E2B SDK，宿主部署是运维侧。无 KVM 时 CubeSandboxExecutor 不可用，SandboxRouter 降级 OpenSandbox。

---

## D. 代码债（记 backlog，下版本处置）

> 均不阻断当前工作，按优先级在后续版本收敛。详见 `v1.2.2-current.md` 遗留区 + `backlog.md`。

| 债务 | 来源 | 优先级 | 处置 |
|---|---|---|---|
| 多轮记忆内存态→DB 升级 | T57 遗留 | P2 | 下版本（matrix_conversation_history 表） |
| Matrix bot tenantId 精确归户 | T59 遗留 | P3 | 下版本（从 instance 查） |
| sessionId resume bug | T43 遗留 | P2 | 路径A启用前修（当前路径A未启用不触发） |
| 评分决策路径失 Matrix 输入 | T57 遗留 | P3 | IM 闲聊不应落 Decision |
| /evaluation/scorecards 路径冲突 | 既有 bug | P3 | evaluation.ts:32 与 bootstrap.ts:270 都注册 GET |
| agent-executor.ts 824 行 | §14-10 | P2 | 拆分待评估（未超 1000 红线） |
| dispatch conclusion 内存态 | T42 遗留 | P3 | conclusion 落库 |
| §14-9 type-only 假环 | §14.2 记录项 | P3 | 清理类型归属打破静态环 |
| budget-guard.ts 预留未用 | T44 检测 | P3 | 下版本决策接线或删（用户决策保留） |
| McpOpenApiFlow/McpGatewayFlow 假向导 | 用户决策保留 | P2 | 真实 MCP 创建链路就绪后升级 |

---

## 推荐执行顺序（新会话接手）

1. **若用户要推进 v2.0 架构升级**：先确认激活条件（B2 三条）→ 激活 v2.0 为 current（处理与 v1.2.2 的 current 唯一性）→ 按 C1→C2→C3→C6 关键路径开做，C7→C8→C9 并行。
2. **若用户要推进 v1.2.2 计费**：先确认商业化时机（B1）→ 灰区实测 C1/C2（计费建在未实测基座风险高）→ T4→T6→T7 + T10→T11。
3. **随手可清**：A1 残留分支（已核查可删）+ A2 性能优化（低优择机）。
4. **不替用户定**：B1（商业化时机）、B2（v2.0 激活）、B3（归档）均需用户决策，Agent 不替定。

---

## 不在本清单（已完成，勿重复）

- T58/T59（openclaw 全量返回 + chat 用量入账）已 done 合并 main（commit `f15e138`）。
- v2.0 设计文档 + 任务图已落库（commit `3174793`），但 C1-C15 实施**未做**（属 B2）。
- T40-T57（投产收尾 + 架构债 T45/T46/T47 + Matrix bot 闭环）均 done。
