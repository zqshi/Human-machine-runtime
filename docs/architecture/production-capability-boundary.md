# 投产能力边界(2026-06-26 实测确认)

> 基于真实业务场景端到端实测(curl + 真实 LLM 调用),非文档判断。
> 回答"当前系统能真实投产做什么,不能做什么"。

## ✅ 真实可用能力(端到端实测验证)

| 能力 | 实测证据 | 涉及任务 |
|------|----------|----------|
| 多轮对话(记忆上下文) | 用户自报工号→追问→Agent 准确回忆"工号F001,名字张秋实" | T49 |
| 多轮工具任务(tool-loop) | dispatch → turns=2(调工具+总结)→ 工具真执行+落库 | T42 |
| 调用业务工具 | check_system_health 真调 /health 返回 JSON | T39 |
| 统计对账 | tool-loop 任务 LLM 用量真实入账 token_usage + billing | T48 |
| **真实创建应用代码** | LLM 经 write_file 真实创建 src/App.tsx(完整 React Todo 组件) | T51/T52 |
| 管理后台功能 | 4 Section(Credential/FeatureFlag/RuntimeTemplates/ToolApprovals)接入 AdminShell | T44 |

## ⚠️ 部分可用 / 需完善

| 能力 | 现状 | 差距 |
|------|------|------|
| 应用预览 | 文件真实创建,但无构建运行(npm install + vite dev) | 需沙箱构建环境(后续) |
| sandbox 文件树 | 单层展示(根+一级) | 多级目录递归展示(后续) |
| sandbox 隔离 | server 进程内 node fs(已做路径逃逸防护) | 投产需 docker 容器隔离(防逃逸) |
| chat 路径用量 | 单轮 chat 不写统计 | 归 A/B 方向:chat 是否归户 instance 用量 |

## ❌ 不可用 / 架构缺失

| 能力 | 原因 | 解决方向 |
|------|------|----------|
| OpenAPI/Gateway 假向导 | McpOpenApiFlow/McpGatewayFlow 是 setTimeout 假表演(已标注未接真实后端) | 真实 MCP 创建链路(后续) |
| worker 路径 A(claude-agent-sdk) | glm-4-flash 扛不住 SDK 强制 19 工具噪声(T43);路径 B 已替代 | 路径 B 已覆盖,路径 A 需强模型时启用 |
| sessionId resume | adapter 传历史 sessionId 给 --rm worker 必 exit1 | 路径 A 启用前在 adapter 端修(不传无效 sessionId) |
| 真实支付网关 | 计费骨架(事件+账户累加),无扣款 | v1.3+ |

## 关键发现(推翻 T43 错误结论)

**T43 原结论**:glm-4-flash 在大工具集下失焦,不能调业务工具。

**实测纠正**:glm-4-flash function calling 单工具 8/8、5 工具 6/6(100% 成功率)。真因是 claude-agent-sdk **强制暴露 19 个内置工具 schema** 致 glm 失焦,合理工具数下 glm 完全正常。

**结论**:路径 B(tool-loop + glm + 可控业务/coding 工具)可行且已验证——**无需 OpenHands、无需真 Anthropic key** 即可真实创建应用。当前架构正确,缺失的只是 coding 工具集(已补 T51)。

## 投产阻断项(上线前必修)

1. ~~**sandbox 改 docker 隔离**(P0)~~ ✅ **T53 已解决**:接入 OpenSandbox 容器隔离,LLM 生成代码在独立 docker 容器执行,与宿主文件系统隔离。生产可配 Firecracker/Kata microVM 增强(改服务端配置,代码零改动)
2. **浏览器实测**(用户侧):T9 流式 / D10 对话自举 / admin 4 功能可见性 / AppCreateFlow 真实创建
3. **生产密钥**(用户侧):替换 dev 默认(JWT_SECRET / CREDENTIAL_ENCRYPTION_KEY / SESSION_SECRET / OPENSANDBOX_API_KEY)
4. **OpenSandbox 服务端部署**(投产):生产用 K8s runtime 部署 OpenSandbox server(开发用 uvx 本地起),配 api_key + allowed_host_paths 白名单
5. **§14 版本门禁归档**:T44 已检测,需全量审计后归档 snapshot

## 与用户诉求的对齐

用户要求"真实投产应用,应对企业内部各种场景,多轮对话,调用 AI 编程工具,真实创建应用":

- ✅ 多轮对话:T49 已修+实测
- ✅ 调用 AI 编程工具:T51 sandbox(write_file/read_file/list_files)+ tool-loop,glm 真实调用
- ✅ 真实创建应用:T51/T52 已验证 LLM 真实创建 App.tsx/Todo 组件,前端 AppCreateFlow 接真实链路
- ⚠️ 应对各种场景:基础能力就绪,具体业务场景需配置对应工具/Agent(管理后台可配)
