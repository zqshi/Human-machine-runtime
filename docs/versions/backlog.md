# HMR 版本积压（Backlog）

> 已规划但未启动的版本与长期技术债务。当前活跃版本见 `*-current.md`。

## 版本路线

| 版本 | 主题 | 状态 | 备注 |
|------|------|------|------|
| v1.0.x | 投产工程 4 阶段 | done | 见 `memory/MEMORY.md` 与 git log |
| v1.1.x | 流程可用性补强（Conduit/配额/调度重试/实例自愈） | done | 见 `memory/MEMORY.md` |
| v1.2.1 | 投产外部契约收尾 | current | T1/T2/T3/T5：claude-agent-sdk 接回 gateway clients |
| v1.2.2 | 商业模式闭环（计费/套餐/用量报表） | next | T4/T6/T7/T8/T10/T11：quota↔analytics↔billing 写侧贯通 |
| v1.3.x | （待规划） | backlog | 候选: SSO 接入、真实支付网关、可观测性增强、知识库 RAG 深化 |

## 长期技术债务

> 来源: 版本完成质量门禁的"记录项"（CLAUDE.md §14）、领域模型健康度审计（§12）发现的问题。

| ID | 债务 | 来源版本 | 优先级 | 处置版本 |
|----|------|---------|--------|---------|
| - | （首次审计后填充） | - | - | - |

## 候选方向（未排期）

- **SSO (OIDC/SAML)**: `system_configs` 已预留开关，待企业客户需求触发
- **数据层抽象**: 引入后可重新开启 `react-hooks/set-state-in-effect` 规则（见 CLAUDE.md §2.3）
- **DB 死列清理**: `xspace_app_id` 等遗留字段（见 `memory/MEMORY.md` ghost-client 治理条目）
- **openclaw 子系统**: 不在 HMR 主路径，独立处置
- **MCP 客户端**: 当前 `tool-management` 只做 executor，双向集成待评估
