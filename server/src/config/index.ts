const env = process.env;

function optional(key: string, fallback: string): string {
  return env[key] || fallback;
}

function optionalInt(key: string, fallback: number): number {
  const v = env[key];
  return v ? parseInt(v, 10) : fallback;
}

function optionalFloat(key: string, fallback: number): number {
  const v = env[key];
  return v ? parseFloat(v) : fallback;
}

export const config = {
  env: optional('NODE_ENV', 'development'),
  port: optionalInt('PORT', 3002),

  db: {
    url: optional('DATABASE_URL', 'postgresql://hmr:hmr@localhost:5435/hmr'),
    maxConnections: optionalInt('DB_MAX_CONNECTIONS', 20),
  },

  jwt: {
    secret: optional('JWT_SECRET', 'hmr-dev-secret-change-in-production'),
    expiresIn: optional('JWT_EXPIRES_IN', '24h'),
  },

  cors: {
    origins: optional('CORS_ORIGINS', 'http://localhost:5173,http://localhost:3000').split(','),
  },

  rateLimit: {
    windowMs: optionalInt('RATE_LIMIT_WINDOW_MS', 60_000),
    max: optionalInt('RATE_LIMIT_MAX', 200),
  },

  // Redis：仅当显式配置 REDIS_URL 时启用（用于 rate-limit 等共享计数场景）。
  // 未配置时各中间件 fallback 到进程内内存，单实例行为不变。
  redis: {
    url: optional('REDIS_URL', 'redis://localhost:6379'),
    enabled: Boolean(env.REDIS_URL),
  },

  auth: {
    defaultProvider: optional('AUTH_DEFAULT_PROVIDER', 'local') as
      | 'local'
      | 'oidc'
      | 'platform-be-proxy'
      | 'wps-oauth',
    allowLocalFallback: optional('AUTH_ALLOW_LOCAL_FALLBACK', 'true') === 'true',
    autoRegister: optional('AUTH_AUTO_REGISTER', 'true') === 'true',
    session: {
      secret: optional('SESSION_SECRET', 'hmr-session-secret-change-in-production'),
      maxAgeSec: optionalInt('SESSION_MAX_AGE_SEC', 86_400),
      cookieName: optional('SESSION_COOKIE_NAME', 'hmr_session'),
    },
    oidc: {
      issuer: optional('OIDC_ISSUER', ''),
      clientId: optional('OIDC_CLIENT_ID', ''),
      clientSecret: optional('OIDC_CLIENT_SECRET', ''),
      redirectUri: optional('OIDC_REDIRECT_URI', ''),
      scopes: optional('OIDC_SCOPES', 'openid profile email').split(' '),
    },
    platformBe: {
      baseUrl: optional('PLATFORM_BE_AUTH_URL', optional('PLATFORM_BE_API_URL', '')),
      clientId: optional('PLATFORM_BE_CLIENT_ID', ''),
      clientSecret: optional('PLATFORM_BE_CLIENT_SECRET', ''),
      callbackUrl: optional('PLATFORM_BE_CALLBACK_URL', ''),
    },
    wpsOAuth: {
      clientId: optional('WPS_OAUTH_CLIENT_ID', ''),
      clientSecret: optional('WPS_OAUTH_CLIENT_SECRET', ''),
      redirectUri: optional('WPS_OAUTH_REDIRECT_URI', ''),
      scopes: optional('WPS_OAUTH_SCOPES', 'openid profile email').split(' '),
    },
  },

  credential: {
    encryptionKey: optional('CREDENTIAL_ENCRYPTION_KEY', 'hmr-dev-encryption-key-change-me!!'),
    leaseDefaultTtlSec: optionalInt('CREDENTIAL_LEASE_TTL_SEC', 3600),
  },

  matrix: {
    homeserverUrl: optional('MATRIX_HOMESERVER_URL', 'http://localhost:6167'),
    botUserId: optional('MATRIX_BOT_USER_ID', '@hmr-bot:localhost'),
    botAccessToken: optional('MATRIX_BOT_ACCESS_TOKEN', ''),
  },

  litellm: {
    baseUrl: optional('LITELLM_BASE_URL', 'http://localhost:4000'),
    apiKey: optional('LITELLM_API_KEY', ''),
  },

  upload: {
    dir: optional('UPLOAD_DIR', './uploads'),
    maxSizeMb: optionalInt('UPLOAD_MAX_SIZE_MB', 50),
  },

  // OpenSandbox 代码执行沙箱(alibaba/OpenSandbox,Apache-2.0 开源自托管)。
  // 配置 domain 即启用容器隔离(替代 node-fs 非隔离版,投产 P0 安全升级)。
  // 未配 domain → 降级 node-fs SandboxExecutor(仅开发,非隔离)。
  // 服务端:uvx opensandbox-server(默认 8080),数据不出企业(自托管)。
  opensandbox: {
    domain: optional('OPENSANDBOX_DOMAIN', ''),
    apiKey: optional('OPENSANDBOX_API_KEY', ''),
    image: optional('OPENSANDBOX_IMAGE', 'node:22-alpine'),
  },

  mail: {
    host: optional('MAIL_HOST', ''),
    port: optionalInt('MAIL_PORT', 25),
    secure: optional('MAIL_SECURE', 'false') === 'true',
    from: optional('MAIL_FROM', 'noreply@example.com'),
    user: optional('MAIL_USER', ''),
    pass: optional('MAIL_PASS', ''),
  },

  seed: {
    profile: optional('SEED_PROFILE', 'showcase'),
  },

  agent: {
    /** Agent 默认 LLM 模型别名（经 LiteLLM 路由）。留空 → ILLMClient.isAvailable=false → AgentExecutor 走关键词降级；配真实模型后走 LLM。 */
    llmModel: optional('AGENT_LLM_MODEL', ''),
  },

  // Claude Agent SDK 配置。apiKey 留空时 bootstrap 不注册 ClaudeAgentSdkAdapter,系统降级到 OpenClaw。
  claude: {
    apiKey: optional('ANTHROPIC_API_KEY', ''),
    // 私有化:经此 URL 转发企业 Anthropic 兼容代理(LiteLLM /v1/messages 或自建代理)。
    // 留空则 claude-worker 容器内 SDK 直连 api.anthropic.com(需 Anthropic 出口);
    // 配值则注入容器 ANTHROPIC_BASE_URL,SDK 经代理转发(内网无出口场景可用)。
    anthropicBaseUrl: optional('ANTHROPIC_BASE_URL', ''),
    workerImage: optional('CLAUDE_WORKER_IMAGE', 'claude-worker:latest'),
    workerTimeoutMs: optionalInt('CLAUDE_WORKER_TIMEOUT_MS', 120_000),
    workspaceRoot: optional('CLAUDE_WORKSPACE_ROOT', '/tmp/hmr-tasks'),
    defaultModel: optional('CLAUDE_DEFAULT_MODEL', 'claude-sonnet-4-6'),
    defaultMaxTurns: optionalInt('CLAUDE_DEFAULT_MAX_TURNS', 20),
    defaultBudgetUsd: optionalFloat('CLAUDE_DEFAULT_BUDGET_USD', 5),
    // T18b-A:worker↔server 工具调用 RPC。internalToolSecret 为内部认证共享密钥
    // (worker 容器调 /api/internal/* 的 X-Internal-Secret);未配则 internal 路由 503 拒绝(防误开)。
    // workerCallbackBaseUrl 是 worker 容器回连 server 的地址(容器内经 host.docker.internal 访问宿主)。
    internalToolSecret: optional('CLAUDE_INTERNAL_TOOL_SECRET', ''),
    workerCallbackBaseUrl: optional(
      'CLAUDE_WORKER_CALLBACK_URL',
      'http://host.docker.internal:3002'
    ),
  },

  weknora: {
    apiUrl: optional('WEKNORA_API_URL', 'http://localhost:8088'),
    enabled: Boolean(env.WEKNORA_ENABLED || env.WEKNORA_API_URL),
    adminApiKey: optional('WEKNORA_ADMIN_API_KEY', ''),
    encryptionKey: optional(
      'WEKNORA_ENCRYPTION_KEY',
      optional('CREDENTIAL_ENCRYPTION_KEY', 'hmr-dev-encryption-key-change-me!!')
    ),
  },

  mem0: {
    apiKey: optional('MEM0_API_KEY', ''),
    // 根域名，勿含版本路径——mem0-client 内含 /v1 前缀；此处追加 /v3 会拼出 /v3/v1/memories（404）。
    baseUrl: optional('MEM0_BASE_URL', 'https://api.mem0.ai'),
    enabled: Boolean(env.MEM0_API_KEY),
  },

  gateway: {
    marketplaceUrl: optional('MARKETPLACE_API_URL', ''),
    marketplaceHmacSecret: optional('MARKETPLACE_HMAC_SECRET', ''),
    marketplaceApiKey: optional('MARKETPLACE_API_KEY', ''),
    profileServiceUrl: optional('PROFILE_SERVICE_API_URL', ''),
    profileServiceApiToken: optional('PROFILE_SERVICE_API_TOKEN', ''),
    platformBeUrl: optional('PLATFORM_BE_API_URL', ''),
    workspaceBackendUrl: optional('WORKSPACE_BACKEND_API_URL', ''),
    workspaceBackendAppId: optional('WORKSPACE_BACKEND_APP_ID', ''),
    workspaceBackendSupabaseUrl: optional('WORKSPACE_BACKEND_SUPABASE_URL', ''),
    workspaceBackendSupabaseAnonKey: optional('WORKSPACE_BACKEND_SUPABASE_ANON_KEY', ''),
    workspaceBackendSupabaseEmail: optional('WORKSPACE_BACKEND_SUPABASE_EMAIL', ''),
    workspaceBackendSupabasePassword: optional('WORKSPACE_BACKEND_SUPABASE_PASSWORD', ''),
    workspaceBackendStreamTimeoutMs: optionalInt('WORKSPACE_BACKEND_STREAM_TIMEOUT_MS', 120_000),
    containerOrchestratorUrl: optional('CONTAINER_ORCHESTRATOR_API_URL', ''),
    containerOrchestratorWsUrl: optional('CONTAINER_ORCHESTRATOR_WS_URL', ''),
    containerOrchestratorApiToken: optional('CONTAINER_ORCHESTRATOR_API_TOKEN', ''),
    clusterInstanceUrl: optional('CLUSTER_INSTANCE_API_URL', ''),
    clusterInstanceAuthToken: optional('CLUSTER_INSTANCE_AUTH_TOKEN', ''),
    retryCount: optionalInt('GATEWAY_RETRY_COUNT', 3),
    circuitBreakerThreshold: optionalInt('GATEWAY_CB_THRESHOLD', 5),
    timeoutMs: optionalInt('GATEWAY_TIMEOUT_MS', 10_000),
    readTimeoutMs: optionalInt('GATEWAY_READ_TIMEOUT_MS', 5_000),
    writeTimeoutMs: optionalInt('GATEWAY_WRITE_TIMEOUT_MS', 10_000),
  },
} as const;

export type Config = typeof config;

const INSECURE_DEFAULTS = [
  'hmr-dev-secret-change-in-production',
  'hmr-dev-encryption-key-change-me!!',
  'hmr-session-secret-change-in-production',
];

export function validateProductionConfig(): void {
  if (config.env !== 'production') return;

  const failures: string[] = [];
  if (INSECURE_DEFAULTS.includes(config.jwt.secret)) {
    failures.push('JWT_SECRET is using the insecure development default');
  }
  if (INSECURE_DEFAULTS.includes(config.credential.encryptionKey)) {
    failures.push('CREDENTIAL_ENCRYPTION_KEY is using the insecure development default');
  }
  if (INSECURE_DEFAULTS.includes(config.auth.session.secret)) {
    failures.push('SESSION_SECRET is using the insecure development default');
  }
  // T18b-A:生产用 claude-agent-sdk(ANTHROPIC_API_KEY 配置)时,worker↔server 工具 RPC
  // 内部认证密钥必填(防 worker 容器无认证调 /api/internal/*)
  if (config.claude.apiKey && !config.claude.internalToolSecret) {
    failures.push(
      'CLAUDE_INTERNAL_TOOL_SECRET is required in production when ANTHROPIC_API_KEY is set (T18b-A worker tool RPC)'
    );
  }
  if (failures.length > 0) {
    throw new Error(
      `[FATAL] Production security check failed:\n  - ${failures.join('\n  - ')}\nSet real secrets before starting in production.`
    );
  }
}
