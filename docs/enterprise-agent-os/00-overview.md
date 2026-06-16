# Enterprise Agent OS — 企业智能体操作系统

## 核心定位

一套新一代企业基础设施，管理的不是硬件资源和软件进程，而是 Agent 资源和组织任务流。谁先把"战略→Agent执行→人类判断→反馈修正"这个闭环跑通并产品化，谁就是 Agent 时代的 Salesforce 或 SAP。

## 产品本质

不是一个 SaaS 工具，不是一个平台，是一个**操作系统级别的运行环境**。

类比操作系统的本质：管理资源、调度进程、提供抽象层、让上层应用不需要关心底层细节。把"进程"换成"Agent"，把"用户"换成"组织中的人"，逻辑完全成立。

## 组织模型

```
老板：战略方向 + 资源分配决策
    ↕（双向反馈，不是单向拆解）
少量关键人才：感知、判断、纠偏、创新
    ↕（任务编排 + 质量审计）
大量 Agent：高效执行结构化任务
```

核心区别：中间层不是被压缩掉了，而是角色彻底变了——从"执行管理者"变成"Agent 编排者 + 判断者 + 创新者"。人数会大幅减少，但留下来的人的能力要求反而大幅提升。

## 文档索引

| 文件 | 内容 |
|------|------|
| [01-org-model.md](./01-org-model.md) | 组织模型分析：三层结构与核心判断 |
| [02-system-architecture.md](./02-system-architecture.md) | 系统架构：五大核心子系统 |
| [03-cold-start.md](./03-cold-start.md) | 冷启动策略：战略解码与信息采集 |
| [04-competitive-landscape.md](./04-competitive-landscape.md) | 竞品对比与品类定位 |
| [05-go-to-market.md](./05-go-to-market.md) | 落地路径与切入点 |
| [06-agent-pluggable.md](./06-agent-pluggable.md) | Agent 可插拔架构与任务契约 |
| [07-objective-framework.md](./07-objective-framework.md) | 目标管理体系：从 OKR 到分层目标 |
| [08-human-agent-division.md](./08-human-agent-division.md) | 人机分工模型：动态分工机制 |
| [09-evaluation-system.md](./09-evaluation-system.md) | 考核体系：人与 Agent 的双轨评价 |
| [10-tech-stack-overview.md](./10-tech-stack-overview.md) | 技术栈全景：五层架构设计 |
| [11-data-integration-layer.md](./11-data-integration-layer.md) | 数据接入层：连接器集合 |
| [12-agent-runtime-layer.md](./12-agent-runtime-layer.md) | Agent 运行层：容器化环境 |
| [13-core-runtime.md](./13-core-runtime.md) | 核心运行时：编排引擎 + 抽象层 + 信号总线 |
| [14-user-interfaces.md](./14-user-interfaces.md) | 用户触点层：驾驶舱 / 工作台 / 看板 |
| [15-deployment-and-build.md](./15-deployment-and-build.md) | 部署模型与构建策略（自建 vs 复用） |
