# 私有化部署 LLM 执行路径选择(v1.2.1 T3 产出)

> 状态:[IMPLEMENTED] 双路径已落地
> 用途:指导私有化(内网无 Anthropic 出口)场景选择 claude-worker 执行路径。

## 背景

claude-worker 在 Docker 沙箱内运行 Claude Agent SDK,SDK 默认直连 `api.anthropic.com`。私有化部署(央国企内网)通常无 Anthropic 出口,直连必失败。v1.2.1 提供双路径,环境自选。

## 路径 A:claude-worker + ANTHROPIC_BASE_URL(企业代理转发)

**原理**:向 worker 容器注入 `ANTHROPIC_BASE_URL`,SDK 经企业 Anthropic 兼容代理(LiteLLM `/v1/messages` 或自建代理)转发到国产模型。

**保留能力**:Claude Agent SDK 完整能力(沙箱执行/工具编排/computer use)。

**配置**:
- `ANTHROPIC_API_KEY` — 必填,启用 claude-worker 主路径(留空则不注册 adapter)
- `ANTHROPIC_BASE_URL` — 企业代理地址(留空则 SDK 直连,需 Anthropic 出口)
- `CLAUDE_WORKER_IMAGE` — worker 镜像(默认 `claude-worker:latest`,需先 `docker build`)

**数据流**:`bootstrap.ts` 读 config.claude → `ClaudeAgentSdkAdapter` → `DockerWorkerRunner` 写 env file(含 `ANTHROPIC_BASE_URL`)→ `docker run --env-file` → 容器内 SDK 读 env → 经代理转发。

**限制**:
- 国产模型经 LiteLLM 能否支撑 Agent SDK 完整功能(工具调用/computer use)需实测;不支持则降级路径 B。
- hmr-server 容器化部署时,容器内需调 `docker run` 起 claude-worker → 需挂载 `/var/run/docker.sock` 并装 docker CLI,或 hmr-server 本机运行(非容器)。

## 路径 B:LiteLLM + AgentExecutor(降级,推荐纯内网默认)

**原理**:`bootstrap.ts` 已就绪的 `LiteLlmClientAdapter`,server 直接经 LiteLLM `/v1/chat/completions` 调企业模型,不依赖 claude-worker/Docker。

**配置**:
- `LITELLM_BASE_URL` — LiteLLM 地址(默认 `http://litellm:4000`,docker-compose 已编排 litellm 服务,`--profile litellm` 启用)
- `AGENT_LLM_MODEL` — 模型别名(如 `qwen-plus`/`deepseek-chat`,见 `docker/litellm/config.yaml`);留空则 AgentExecutor 走关键词降级

**放弃能力**:Claude Agent SDK 的高级沙箱执行/工具编排;改用 AgentExecutor 的轻量 LLM 编排。

**优势**:纯内网确定可用,不依赖 Docker/Anthropic 协议,国产模型 OpenAI 兼容端点即可。

## 选择规则

| 场景 | 推荐路径 | 理由 |
|---|---|---|
| 纯内网无 Anthropic 出口 | 路径 B | 确定可用,不赌 SDK 对国产模型的兼容 |
| 有 Anthropic 出口 / 自建 Anthropic 兼容代理 | 路径 A | 保留 SDK 完整能力 |
| 内部推广(不计费、快速可用) | 路径 B | 部署简单,无需 Docker 挂载 |

## 降级链(ANTHROPIC_API_KEY 未配时)

`bootstrap.ts:346` 判断 `config.claude.apiKey`:
- 有值 → 注册 `ClaudeAgentSdkAdapter`(路径 A),主路径
- 无值 → 不注册,系统降级到 `OpenClawAdapter`(**注意:OpenClawAdapter 是模拟桩**,`simulateProgress` 5s 后硬编码返回"任务执行完成",非真实执行)

> OpenClawAdapter 仅作"系统不崩"兜底,**不可作为生产降级**。真实降级应配 `AGENT_LLM_MODEL` 走路径 B,或配 `ANTHROPIC_API_KEY`+`ANTHROPIC_BASE_URL` 走路径 A。

## docker-compose 部署

```bash
# 构建 claude-worker 镜像(路径 A 需要)
bash scripts/build-claude-worker.sh

# 路径 B(纯内网,推荐内部推广)
docker-compose --profile litellm up
# 配 .env: AGENT_LLM_MODEL=qwen-plus, LITELLM_BASE_URL=http://litellm:4000

# 路径 A(需 Anthropic 代理 + hmr-server 能调 docker)
# 配 .env: ANTHROPIC_API_KEY=..., ANTHROPIC_BASE_URL=http://litellm:4000
# 注意:hmr-server 容器需挂载 /var/run/docker.sock(见下方说明)
```

**hmr-server 容器化跑路径 A 的约束**:`DockerWorkerRunner` 调 `spawn('docker', ...)` 起 claude-worker 容器,hmr-server 容器内默认无 docker CLI/daemon。需:
- 挂载 `-v /var/run/docker.sock:/var/run/docker.sock`
- hmr-server 镜像装 docker CLI

或 hmr-server 本机运行(`npm run dev`/`npm start`,非容器),`docker-compose` 仅起 postgres/conduit/redis/litellm 等依赖。

## 端到端验证状态(v1.2.1 实测)

路径 A 已端到端实测验证通过(2026-06-23):

- **SDK 读 `ANTHROPIC_BASE_URL` 已证实**:claude-worker 容器经 `host.docker.internal` 命中 fake Anthropic server 10 次(`/v1/messages/count_tokens` + 多次 `/v1/messages`),worker 输出 `session_id` + `done` 事件并正常退出。证明 SDK 不直连 api.anthropic.com,而是转发到 BASE_URL 指定的代理。
- **集成测试跨平台**:原 `--network host` + fake server 监听 `127.0.0.1` 在 mac docker desktop 上 timeout(host 网络不能访问 mac loopback)。改为 bridge + `--add-host=host.docker.internal:host-gateway` + fake server 监听 `0.0.0.0`,mac + linux CI 均可跑(`CLAUDE_WORKER_E2E=1 npm run test:integration`,3 passed)。
- **CI 保障**:`.github/workflows/ci.yml` integration job 在 ubuntu-latest 跑该套件(fake-anthropic-server,不需真实 Anthropic key)。

**仍未实测**(私有化真实场景):国产模型(qwen/deepseek)经 LiteLLM 的 `/v1/messages` Anthropic 兼容端点能否支撑 Claude Agent SDK 完整能力(工具调用/computer use)。fake server 只验证协议链路,不验证模型能力。纯内网建议默认走路径 B(LiteLLM+AgentExecutor),路径 A 需按企业模型实测后启用。

## T43 实测结论(2026-06-26,路径 A + glm-4-flash)

> 来源:T43 worker externalTools 容器 E2E 深度排查。结论:**glm-4-flash 在路径 A 架构上不可用**,但根因是 SDK 架构限制非模型 bug。

### 已修的基础设施缺陷(3 项,对路径 B 无害,路径 A 启用必需)

1. **LiteLLM 路由墙**:`/v1/messages` 对 `openai/*` 兼容模型默认走 Responses API(`/v4/responses`),glm 只支持 chat/completions → 404。修:`docker/litellm/config.yaml` 加 `use_chat_completions_url_for_anthropic_messages: true`,让 `/v1/messages` 经 chat/completions 转发。
2. **worker 镜像滞后**:T29 的 externalTools 注入(`createSdkMcpServer`)代码在 git 但镜像未重建 → boundTools 不生效。修:重建 `claude-worker:latest`(验证 worker.js 含 createSdkMcpServer)。
3. **worker 容器网络**:`docker-worker-runner.ts` buildArgs 缺 `--add-host host.docker.internal:host-gateway`,bridge 网络内 worker 解析不到宿主 → 访问 LiteLLM/server exit 1。修:buildArgs 加 `--add-host`(集成测试 test 代码本有,生产 runner 漏)。

### 已验证通过(代码侧)

- LiteLLM `/v1/messages` 返回 anthropic 格式 + tool_use(含 `mcp__hmr-external-tools__` MCP 长名)——协议层 glm 可行
- worker 集成测试(`CLAUDE_WORKER_E2E=1`)4 项通过——协议链路 + externalTools 注入 SDK(tools 含 `mcp__hmr-external-tools__check_system_health`)
- /tool-check 对 mcp custom tool 返回 allow(enforce off)

### 未达成真 E2E——2 个卡点

1. **glm-4-flash 在大工具集下不调业务工具**(LLM 能力限制,代码不可绕):claude-agent-sdk **强制向 LLM 暴露 19 个内置工具 schema**(Task/Bash/Grep/Edit 等大 schema),`allowedTools` 仅控制执行权限不控制 schema 暴露。glm-4-flash 在 19 工具集下决策失焦返回 text 不调 mcp 工具;**只留 mcp 工具(去掉 18 内置)时 glm 立刻返回 tool_use**(curl 实测)。即 glm 能调工具,但扛不住 SDK 的内置工具噪声。**此为 claude-agent-sdk 架构限制,非 worker 代码可绕过。**
2. **sessionId resume bug**(adapter bug,可修):adapter 从 instance session store 取历史 sessionId 传给 worker,worker.ts `options.resume=sessionId` 让 SDK resume,但 worker 容器 `--rm` 无历史会话状态 → Claude Code 子进程 exit 1。验证:含 sessionId exit 1(emit error);去 sessionId exit 0(emit result+done)。

### 结论与处置

- **路径 A 用 glm-4-flash 不可用**:glm 弱模型 + SDK 强制内置工具噪声不兼容。换强模型(glm-4-plus/真 Anthropic)或走路径 B。
- **路径 B(tool-loop + glm)已通过(T42)**:自研 `ToolLoopExecutor` 只把业务工具传 LLM,不强制内置工具,glm 正常工作。
- **投产走路径 B**(免费先上线,不被厂商绑定);路径 A 标"需强模型"遗留,3 项基础设施修复已提交(启用路径 A 时必需)。
- **遗留**:sessionId resume bug(adapter 不应传无效 sessionId 给 `--rm` worker,或 resume 失败容错)记入 backlog。
