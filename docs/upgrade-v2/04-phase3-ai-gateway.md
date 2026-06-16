> ⚠️ **历史文档快照**（非当前实现）：本文档为早期架构/规划/PRD 记录，部分内容已被后续演进取代。当前实现以 `server/src` + `client-suite/apps/web/src` 代码为准（28 个限界上下文 · Hono/TS/Drizzle · PostgreSQL@5432）。

# Phase 3：AI Gateway 迁移

## 目标
将 HMR 旧 Node.js 后端的 AI 能力全量迁移到 Python FastAPI，保留所有业务逻辑。

## 3.1 hmr-ai-gateway 服务设计

### 目录结构
```
service/hmr-ai-gateway/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config/
│   │   └── settings.py
│   ├── api/v1/
│   │   ├── router.py
│   │   ├── gateway.py             # 模型代理 + 风控拦截
│   │   ├── runtime.py             # 运行时管理
│   │   ├── analytics.py           # Token/成本统计
│   │   ├── models.py              # 模型发现
│   │   ├── openclaw.py            # OpenClaw 实例管理
│   │   ├── objectives.py          # 目标/判断/决策
│   │   ├── knowledge.py           # 知识管理 API
│   │   ├── collaboration.py       # 协作 API
│   │   └── websocket.py           # WebSocket 通道
│   ├── agent/
│   │   ├── __init__.py
│   │   ├── executor.py            # ← AgentExecutor.js
│   │   ├── intent_router.py       # ← IntentRouter.js
│   │   ├── escalation.py          # ← EscalationEngine.js
│   │   ├── correction.py          # ← CorrectionExecutor.js
│   │   ├── task_contract.py       # ← TaskContract.js
│   │   ├── strategic_decoder.py   # ← StrategicDecoder.js
│   │   ├── simulator.py           # ← AgentSimulator.js
│   │   └── performance.py         # ← AgentPerformanceStore.js
│   ├── llm/
│   │   ├── __init__.py
│   │   ├── client.py              # ← LLMClient.js（支持直连+LiteLLM）
│   │   ├── risk_scanner.py        # 风控扫描引擎
│   │   └── cost_calculator.py     # 成本计算
│   ├── k8s/
│   │   ├── __init__.py
│   │   └── provisioner.py         # ← OpenClawProvisioner.js
│   ├── integrations/
│   │   ├── __init__.py
│   │   ├── matrix_relay.py        # ← MatrixRelay.js
│   │   └── weknora.py             # ← WeKnoraService.js
│   ├── models/
│   │   ├── __init__.py
│   │   ├── trace.py
│   │   ├── objective.py
│   │   └── collaboration.py
│   └── deps.py
├── tests/
│   ├── conftest.py
│   ├── test_executor.py           # ← AgentExecutor.test.js
│   ├── test_simulator.py          # ← AgentSimulator.test.js
│   └── test_llm_client.py         # ← LLMClient.test.js
├── pyproject.toml
└── Dockerfile
```

## 3.2 模块迁移详表

### Domain 层（src/domain/ → app/agent/）

| 旧模块 | 新模块 | 核心逻辑 |
|--------|--------|---------|
| AgentExecutor.js | executor.py | ReAct 循环、tool_call 执行、结果收集 |
| IntentRouter.js | intent_router.py | 意图分类、路由策略、优先级排序 |
| EscalationEngine.js | escalation.py | 升级判断、阈值检测、人工介入触发 |
| CorrectionExecutor.js | correction.py | 纠偏指令解析、执行、确认 |
| TaskContract.js | task_contract.py | 任务定义、状态机、完成判定 |
| StrategicDecoder.js | strategic_decoder.py | 战略目标解码、分解、对齐 |
| AgentSimulator.js | simulator.py | 模拟执行、性能预测、测试 |
| AgentPerformanceStore.js | performance.py | 性能指标采集、存储、查询 |

### Infrastructure 层（src/infrastructure/ → app/llm/ + app/k8s/）

| 旧模块 | 新模块 | 核心逻辑 |
|--------|--------|---------|
| LLMClient.js | llm/client.py | 多 provider 适配、流式响应、重试 |
| LLMClient.test.js | tests/test_llm_client.py | 单元测试 |
| OpenClawProvisioner.js | k8s/provisioner.py | K8s Pod/PVC/Service 编排 |
| SqliteStore.js | (删除) | 功能转移到 Prisma |
| PostgresStore.js | (保留引用) | 配置中心（portal）已有 |
| FileStore.js | (评估) | 如需文件存储改用 S3 兼容对象存储 |

### Integrations 层（src/integrations/ → app/integrations/）

| 旧模块 | 新模块 | 核心逻辑 |
|--------|--------|---------|
| MatrixBot.js | (删除) | HMR 不再自建 Matrix |
| MatrixRelay.js | matrix_relay.py | 保留接口，后端改为 WebSocket |
| WeKnoraService.js | weknora.py | 外部集成保留 |

### Routes 层（src/interfaces/http/routes/ → app/api/v1/）

| 旧路由 | 新路由 | 功能 |
|--------|--------|------|
| adminCompatAIGateway (拆分的12子模块) | gateway.py | AI 代理全链路 |
| adminCompatRuntime | runtime.py | 运行时管理 |
| adminCompatSkills | (移到 admin-be) | 技能管理 |
| adminCompatTools | (移到 admin-be) | 工具管理 |
| adminModelDiscovery | models.py | 模型发现 |
| adminAnalytics | analytics.py | 分析统计 |
| openclawRoutes | openclaw.py | OpenClaw 管理 |
| openclawObjectiveRoutes | objectives.py | 目标管理 |
| knowledgeAudits | knowledge.py | 知识审计 |
| matrix | websocket.py | 消息通道 |
| auth | (移到共享认证) | |
| health | health.py | 健康检查 |
| documents | knowledge.py | 文档管理 |
| instances | openclaw.py | 实例管理 |
| runtime | runtime.py | 运行时 |
| categories | (移到 admin-be) | |
| weknora | collaboration.py | 外部集成 |
| audits | (移到 ops-be) | |
| platformAuth | (移到共享认证) | |
| platformConfig | (移到 ops-be) | |
| platformTenants | (移到 ops-be) | |

## 3.3 LLM Client 升级设计

```python
# app/llm/client.py
class LLMClient:
    """统一 LLM 调用客户端
    
    支持两种模式：
    1. 直连模式：直接调用 provider API（保留 HMR 原有逻辑）
    2. LiteLLM 代理模式：通过 LiteLLM 统一路由
    """
    
    def __init__(self, settings: Settings):
        self.mode = settings.LLM_MODE  # "direct" | "litellm"
        self.litellm_url = settings.LITELLM_BASE_URL
        
    async def chat_completion(
        self,
        model: str,
        messages: list[dict],
        *,
        stream: bool = False,
        tools: list[dict] | None = None,
        tenant_id: str | None = None,
    ) -> AsyncGenerator[str, None] | dict:
        # 1. 风控扫描（RiskScanner）
        # 2. 路由决策（根据 model + tenant 配置）
        # 3. 调用 provider / LiteLLM
        # 4. 追踪记录（AiTrace）
        # 5. 成本计算（CostRecord）
```

## 3.4 WebSocket 通道设计

```python
# app/api/v1/websocket.py
class ConnectionManager:
    """管理 HMR 用户端的 WebSocket 连接
    
    消息流：
    HMR Web Client ←WebSocket→ hmr-ai-gateway ←HTTP/WS→ OpenClaw Pod
    """
    
    async def connect(self, ws: WebSocket, user_id: str):
        """用户连接：验证 session → 注册连接 → 查找/启动实例"""
        
    async def send_to_agent(self, user_id: str, message: AgentMessage):
        """发送消息到用户的 OpenClaw 实例"""
        
    async def receive_from_agent(self, user_id: str, reply: AgentReply):
        """接收 Agent 回复 → 推送到 WebSocket"""
```

## 3.5 验证标准
- [ ] AgentExecutor 测试用例全部通过（pytest）
- [ ] AgentSimulator 测试用例全部通过
- [ ] LLMClient 直连模式 + LiteLLM 模式均可调用
- [ ] 风控扫描正确拦截/路由
- [ ] AI Trace 记录写入 MySQL
- [ ] 成本计算正确
- [ ] WebSocket 通道可建立连接
- [ ] OpenClaw Provisioner 可查询 K8s Pod 状态
