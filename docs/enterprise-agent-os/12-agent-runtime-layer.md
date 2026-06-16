# 12 — Agent 运行层：Agent 的容器环境

## 定位

Agent 需要一个隔离的、可管理的运行环境，就像容器之于微服务。

## 核心组件

| 组件 | 职责 | 技术类比 |
|------|------|---------|
| Agent 沙箱 | 每个 Agent 在隔离环境中运行，防止互相干扰 | Docker container |
| 任务契约接口 | 统一的输入/输出标准，Agent 框架无关 | OCI 容器标准 |
| 资源配额 | 控制每个 Agent 的 Token 消耗、API 调用、时间上限 | K8s resource limits |
| Agent 市场 | 企业内部的 Agent 注册与发现 | Docker Hub / Helm Chart |

## 与 Agent 抽象层的关系

Agent 运行层提供**物理运行环境**，Agent 抽象层（在核心运行时中）提供**逻辑接口标准**。

```
逻辑层：Agent 抽象层定义任务契约标准（输入/输出/验收/约束/上报）
         ↓
物理层：Agent 运行层提供沙箱、配额、生命周期管理
         ↓
实际执行：OpenClaw / Harness / LangGraph / 自研 Agent
```

## 构建策略

**自建抽象层 + 适配各框架。** 这是核心差异化，必须自己控制。运行沙箱可基于现有容器技术（Docker / K8s）构建。
