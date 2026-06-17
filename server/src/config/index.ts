const env = process.env;

function optional(key: string, fallback: string): string {
  return env[key] || fallback;
}

function optionalInt(key: string, fallback: number): number {
  const v = env[key];
  return v ? parseInt(v, 10) : fallback;
}

export const config = {
  env: optional('NODE_ENV', 'development'),
  port: optionalInt('PORT', 3002),

  db: {
    url: optional('DATABASE_URL', 'postgresql://hmr:hmr@localhost:5432/hmr'),
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
    simulatorEnabled: env.AGENT_SIMULATOR_ENABLED === 'true',
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
    clawhubUrl: optional('CLAWHUB_API_URL', ''),
    clawhubHmacSecret: optional('CLAWHUB_HMAC_SECRET', ''),
    clawhubApiKey: optional('CLAWHUB_API_KEY', ''),
    portalUrl: optional('PORTAL_API_URL', ''),
    portalApiToken: optional('PORTAL_API_TOKEN', ''),
    platformBeUrl: optional('PLATFORM_BE_API_URL', ''),
    xspaceUrl: optional('XSPACE_API_URL', ''),
    xspaceAppId: optional('XSPACE_APP_ID', ''),
    xspaceSupabaseUrl: optional('XSPACE_SUPABASE_URL', ''),
    xspaceSupabaseAnonKey: optional('XSPACE_SUPABASE_ANON_KEY', ''),
    xspaceSupabaseEmail: optional('XSPACE_SUPABASE_EMAIL', ''),
    xspaceSupabasePassword: optional('XSPACE_SUPABASE_PASSWORD', ''),
    xspaceStreamTimeoutMs: optionalInt('XSPACE_STREAM_TIMEOUT_MS', 120_000),
    clawFarmUrl: optional('CLAW_FARM_API_URL', ''),
    clawFarmWsUrl: optional('CLAW_FARM_WS_URL', ''),
    clawFarmApiToken: optional('CLAW_FARM_API_TOKEN', ''),
    clawManagerUrl: optional('CLAW_MANAGER_API_URL', ''),
    clawManagerAuthToken: optional('CLAW_MANAGER_AUTH_TOKEN', ''),
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
  if (failures.length > 0) {
    throw new Error(
      `[FATAL] Production security check failed:\n  - ${failures.join('\n  - ')}\nSet real secrets before starting in production.`
    );
  }
}
