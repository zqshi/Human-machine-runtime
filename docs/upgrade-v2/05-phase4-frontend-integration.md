> ⚠️ **历史文档快照**（非当前实现）：本文档为早期架构/规划/PRD 记录，部分内容已被后续演进取代。当前实现以 `server/src` + `client-suite/apps/web/src` 代码为准（28 个限界上下文 · Hono/TS/Drizzle · PostgreSQL@5432）。

# Phase 4：用户端集成升级

## 目标
将前端从 Mock 数据切换到真实 API，IM 模式对接 WPS 通道，决策中心对接生产服务。

## 4.1 认证层升级

### authStore 改造
```typescript
// apps/web/src/application/stores/authStore.ts
interface AuthState {
  user: PlatformUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // 新增 OAuth 流程
  login(): void;           // 跳转 OAuth
  logout(): Promise<void>; // 清除 session
  checkSession(): Promise<void>; // 验证 cookie
}

interface PlatformUser {
  id: number;
  userUid: string;
  name: string;
  email: string;
  avatar?: string;
  tenantId?: string;
  role: 'admin' | 'member' | 'viewer';
}
```

### 路由守卫
```typescript
// apps/web/src/presentation/routing/AuthGuard.tsx
// 未登录 → 重定向 /api/v1/auth/login
// 已登录 → 注入 user context
```

## 4.2 IM 模式 — 通道层升级

### IMatrixClient 适配器体系保留
```typescript
// apps/web/src/infrastructure/matrix/MatrixClientAdapter.ts
// 接口不变，新增实现

export interface IMatrixClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendMessage(roomId: string, content: string): Promise<void>;
  getRooms(): ChatRoom[];
  onMessage(callback: (msg: ChatMessage) => void): void;
  // ...
}
```

### 新增 HMR WebSocket 适配器
```typescript
// apps/web/src/infrastructure/matrix/HmrWebSocketClient.ts
export class HmrWebSocketClient implements IMatrixClient {
  private ws: WebSocket | null = null;
  private userId: string;
  
  async connect(): Promise<void> {
    // 连接 hmr-ai-gateway WebSocket
    this.ws = new WebSocket(`/ws/${this.userId}`);
    // 注册事件监听
  }
  
  async sendMessage(roomId: string, content: string): Promise<void> {
    // 通过 WebSocket 发送到 OpenClaw Agent
    this.ws?.send(JSON.stringify({
      type: 'message',
      data: { roomId, content, timestamp: Date.now() }
    }));
  }
  
  getRooms(): ChatRoom[] {
    // 从 API 获取会话列表
    // 每个 Agent 实例 = 一个 Room
  }
}
```

### 适配器工厂
```typescript
// apps/web/src/infrastructure/matrix/createMatrixClient.ts
export function createMatrixClient(config: AppConfig): IMatrixClient {
  switch (config.channelMode) {
    case 'hmr':    return new HmrWebSocketClient(config);
    case 'matrix': return new RealMatrixClient(config);
    case 'mock':   return new MockMatrixClient();
    default:       return new MockMatrixClient();
  }
}
```

## 4.3 决策中心 — 真实数据对接

### apiGateway 升级
```typescript
// apps/web/src/application/services/apiGateway.ts
// 从 Mock 切换到真实 API

export class ApiGateway {
  // Agent 实例状态 → claw-farm (通过 hmr-admin-be 代理)
  async getAgentInstances(): Promise<Instance[]> {
    return this.http.get('/api/v1/admin/instances');
  }
  
  // Agent 档案 → portal-backend (通过 inrouter 代理)
  async getAgentProfile(userUid: string): Promise<AgentProfile> {
    return this.http.get(`/portal/api/v1/profile/${userUid}`);
  }
  
  // Agent 成长日记 → portal-backend
  async getAgentJourney(userUid: string): Promise<JourneyEntry[]> {
    return this.http.get(`/portal/api/v1/journey/${userUid}`);
  }
  
  // 技能列表 → clawhub (通过 inrouter 代理)
  async getSkills(params?: SkillQuery): Promise<Skill[]> {
    return this.http.get('/clawhub/api/v1/skills', { params });
  }
  
  // Agent 列表 → clawhub
  async getAgents(params?: AgentQuery): Promise<Agent[]> {
    return this.http.get('/clawhub/api/v1/agents', { params });
  }
  
  // 目标/判断 → hmr-ai-gateway
  async getObjectives(): Promise<Objective[]> {
    return this.http.get('/api/v1/gateway/objectives');
  }
  
  // 协作 → hmr-ai-gateway
  async getCollaborationSessions(): Promise<CollaborationSession[]> {
    return this.http.get('/api/v1/gateway/collaboration/sessions');
  }
}
```

### 各 Store 数据源升级

| Store | 旧数据源 | 新数据源 |
|-------|---------|---------|
| agentStore | 硬编码 Mock | clawhub agents API |
| chatStore | MockMatrixClient | HmrWebSocketClient |
| callStore | WebRTC 本地 | 保留不变 |
| authStore | 本地密码 | OAuth + platform-be |

## 4.4 应用中心 — XSpace 对接

### XSpace API 客户端
```typescript
// apps/web/src/application/services/xspaceApi.ts
export class XSpaceApiClient {
  private baseUrl = '/xspace/api/v1';
  
  // Workspace 管理
  async createWorkspace(params: {
    name: string;
    type: 'APP' | 'SKILL' | 'AGENT' | 'NORMAL';
  }): Promise<Workspace> {
    return this.http.post('/workspace', params);
  }
  
  async listWorkspaces(): Promise<Workspace[]> {
    return this.http.get('/workspace');
  }
  
  // SSE 流式对话（AI 应用生成核心）
  async *generate(workspaceId: string, message: string): AsyncGenerator<SSEEvent> {
    const response = await fetch(`${this.baseUrl}/generate`, {
      method: 'POST',
      body: JSON.stringify({ workspace_id: workspaceId, message }),
      headers: { 'Content-Type': 'application/json' },
    });
    // 解析 SSE 流
    const reader = response.body!.getReader();
    // ...yield events
  }
  
  // 应用管理
  async listApps(): Promise<App[]> {
    return this.http.get('/app');
  }
  
  async getApp(appId: string): Promise<AppDetail> {
    return this.http.get(`/app/${appId}`);
  }
}
```

### 前端页面对接

| 页面 | 对接方式 |
|------|---------|
| AppCenterPage.tsx | xspaceApi.listApps() 获取应用列表 |
| AICreationPanel.tsx | xspaceApi.generate() SSE 流式对话 |
| AIAppGeneratorPreview.tsx | iframe 加载部署后的 app URL |
| AppsGrid.tsx | 展示应用卡片列表 |

## 4.5 知识管理 — 后端对接

知识管理是 HMR 独有功能，后端 API 迁移到 hmr-ai-gateway：

```typescript
// 知识管理 API (hmr-ai-gateway /api/v1/gateway/knowledge/)
POST   /documents          # 创建文档
GET    /documents          # 文档列表
GET    /documents/{id}     # 文档详情
PUT    /documents/{id}     # 更新文档
DELETE /documents/{id}     # 删除文档
POST   /documents/search   # AI 语义搜索
GET    /folders            # 文件夹结构
POST   /folders            # 创建文件夹
```

## 4.6 Mock 开关保留

```typescript
// apps/web/src/config.ts
export const APP_CONFIG = {
  channelMode: import.meta.env.VITE_CHANNEL_MODE || 'mock',  // hmr | matrix | mock
  apiMode: import.meta.env.VITE_API_MODE || 'mock',          // real | mock
  authMode: import.meta.env.VITE_AUTH_MODE || 'mock',        // oauth | mock
};
```

确保开发环境仍可使用 Mock 模式快速开发和演示。

## 4.7 验证标准
- [ ] OAuth 登录流程完整（登录→回调→进入首页）
- [ ] WebSocket 连接建立 + 消息收发（至少 mock agent 端）
- [ ] Agent 列表从 clawhub API 加载
- [ ] 技能中心从 clawhub API 加载
- [ ] 应用中心从 xspace API 加载
- [ ] 知识管理文档 CRUD
- [ ] 决策中心各面板数据渲染
- [ ] Mock 模式仍可正常工作
