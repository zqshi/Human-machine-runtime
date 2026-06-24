# HMR 版本积压（Backlog）

> 已规划但未启动的版本与长期技术债务。当前活跃版本见 `*-current.md`。

## 版本路线

| 版本 | 主题 | 状态 | 备注 |
|------|------|------|------|
| v1.0.x | 投产工程 4 阶段 | done | 见 `memory/MEMORY.md` 与 git log |
| v1.1.x | 流程可用性补强（Conduit/配额/调度重试/实例自愈） | done | 见 `memory/MEMORY.md` |
| v1.2.1 | 投产外部契约收尾 + 私有化前置 | done | snapshot 已归档；claude-worker 双路径 + 配置修复 + credential 后端 + 集成测试端到端实测通过 |
| v1.2.2 | 商业模式闭环（计费/套餐/用量报表） | current 待启动 | v1.8 归档后激活为下一版本;内部推广暂不计费,择机开工;T4/T6/T7/T8/T10/T11 |
| v1.3-v1.7 | 云原生声明式 Agent 平台（声明/组装/trace/eval） | done | snapshot 已归档（v1.3-v1.7-snapshot.md）；4 版连续完成，架构总纲 `docs/architecture/cloud-native-platform-design.md` |
| v1.8 | 声明/运行 reconcile 解耦 | done | snapshot 已归档(v1.8-snapshot.md);desiredState+generation+spec-diff 调和,云原生收官;遗留:Container 扩容限制 + bootstrap.ts 832 行技术债 |

## 长期技术债务

> 来源: 版本完成质量门禁的"记录项"（CLAUDE.md §14）、领域模型健康度审计（§12）发现的问题。

| ID | 债务 | 来源版本 | 优先级 | 处置版本 |
|----|------|---------|--------|---------|
| D1 | eval-benchmark 是 STUB（actualOutput 占位），需接真实 Agent | v1.2.1 | P2 | v1.3+ |
| D2 | knowledge + employee-memory 检索能力未进 agent 决策回路（仅 Matrix 命令手动查） | v1.2.1 | P1 | v1.3+ |
| D3 | tool-management executor 与 claude-agent-sdk 主链路脱节 | v1.2.1 | P2 | v1.3+ |
| D4 | credential-vault 前端管理面（后端 API 已就绪，T10） | v1.2.1 | P2 | v1.3+ |
| D5 | tool-management db 连接解锁接入（credentialManagementService.getCredentialSecret 已提供，需注入 ToolManagementService） | v1.2.1 | P2 | v1.3+ |
| D6 | credential-repository 集成测试（DB 层，mock Database） | v1.2.1 | P3 | v1.3+ |
| D7 | bootstrap.ts 832 行装配 god-file（§14.1 第 10 项 800-1000 行技术债） | v1.8 质量检测 | P2 | ✅ 已清 2026-06-24：拆 8 个 bundle 到 `app/bootstrap/`，832→542 行；type-check + 1455 单测 + 真实 dev 启动验证全过 |

## 候选方向（未排期）

- **SSO (OIDC/SAML)**: `system_configs` 已预留开关，待企业客户需求触发
- **数据层抽象**: 引入后可重新开启 `react-hooks/set-state-in-effect` 规则（见 CLAUDE.md §2.3）
- **DB 死列清理**: `xspace_app_id` 等遗留字段（见 `memory/MEMORY.md` ghost-client 治理条目）
- **openclaw 子系统**: 不在 HMR 主路径，独立处置
- **MCP 客户端**: 当前 `tool-management` 只做 executor，双向集成待评估
