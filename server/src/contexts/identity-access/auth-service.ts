import * as jose from 'jose';
import { AppError } from '../../shared/utils.js';
import { config } from '../../config/index.js';
import type { AuthResult } from './auth-provider.js';
import { AuthProviderRegistry } from './auth-provider-registry.js';

const jwtSecret = new TextEncoder().encode(config.jwt.secret);

const PLATFORM_ROLE_PERMISSIONS: Record<string, string[]> = {
  platform_admin: ['platform:*'],
  platform_ops: [
    'platform:tenant:read',
    'platform:monitoring:read',
    'platform:config:read',
    'platform:audit:read',
  ],
};

const TENANT_ROLE_PERMISSIONS: Record<string, string[]> = {
  tenant_admin: [
    'tenant:instance:read',
    'tenant:instance:write',
    'tenant:asset:read',
    'tenant:asset:write',
    'tenant:asset:review',
    'tenant:skill:read',
    'tenant:skill:write',
    'tenant:skill:review',
    'tenant:user:read',
    'tenant:user:write',
    'tenant:audit:read',
    'tenant:gateway:read',
    'tenant:gateway:write',
    'control:instance:read',
    'control:instance:write',
    'control:instance:invoke',
    'control:skill:read',
    'control:skill:write',
    'control:skill:review',
    'control:asset:read',
    'control:asset:write',
    'control:asset:review',
    'control:asset:bind',
    'control:audit:read',
    'control:audit:export',
    'control:runtime:read',
    'control:runtime:write',
    'control:release:read',
  ],
  tenant_ops: [
    'tenant:instance:read',
    'tenant:instance:write',
    'tenant:asset:read',
    'tenant:skill:read',
    'control:instance:read',
    'control:instance:write',
    'control:instance:invoke',
    'control:skill:read',
    'control:asset:read',
    'control:asset:write',
    'control:asset:bind',
    'control:runtime:read',
    'control:runtime:write',
    'control:release:read',
  ],
  tenant_auditor: [
    'tenant:instance:read',
    'tenant:asset:read',
    'tenant:skill:read',
    'tenant:audit:read',
    'control:instance:read',
    'control:skill:read',
    'control:asset:read',
    'control:asset:review',
    'control:audit:read',
    'control:audit:export',
  ],
};

const LEGACY_ROLE_MAP: Record<string, { scope: string; role: string }> = {
  platform_admin: { scope: 'platform', role: 'platform_admin' },
  ops_admin: { scope: 'tenant', role: 'tenant_ops' },
  reviewer: { scope: 'tenant', role: 'tenant_admin' },
  auditor: { scope: 'tenant', role: 'tenant_auditor' },
};

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  ...PLATFORM_ROLE_PERMISSIONS,
  ...TENANT_ROLE_PERMISSIONS,
  ops_admin: TENANT_ROLE_PERMISSIONS.tenant_ops,
  reviewer: TENANT_ROLE_PERMISSIONS.tenant_admin,
  auditor: TENANT_ROLE_PERMISSIONS.tenant_auditor,
};

function resolveScope(role: string): string {
  if (PLATFORM_ROLE_PERMISSIONS[role]) return 'platform';
  if (TENANT_ROLE_PERMISSIONS[role]) return 'tenant';
  const mapped = LEGACY_ROLE_MAP[role];
  return mapped ? mapped.scope : 'tenant';
}

export interface Principal {
  username: string;
  scope: string;
  role: string;
  tenantId: string | null;
  permissions: string[];
}

export interface LoginResult {
  token: string;
  tokenType: string;
  expiresIn: string;
  user: Principal;
  sessionId?: string;
}

export interface IUserRepository {
  listPlatformUsers(): Promise<UserRecord[]>;
  findByExternalId?(providerType: string, externalId: string): Promise<UserRecord | null>;
  createFromExternal?(
    authResult: AuthResult,
    providerType: string,
    defaults: Partial<UserRecord>
  ): Promise<UserRecord>;
}

export interface UserRecord {
  id?: number;
  username: string;
  password: string;
  role: string;
  scope?: string;
  tenantId?: string;
  disabled?: boolean;
}

export interface ISessionStore {
  create(data: {
    userId: number;
    providerType: string;
    externalId?: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
    upstreamToken?: string;
  }): Promise<string>;
  findValid(sessionId: string): Promise<{
    userId: number;
    providerType: string;
    externalId?: string;
    upstreamToken?: string;
  } | null>;
  revoke(sessionId: string): Promise<void>;
}

export interface SessionLoginOptions {
  requiredScope?: string;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
  createSession?: boolean;
}

export class AuthService {
  private users: UserRecord[];
  private repo: IUserRepository | null;
  private registry: AuthProviderRegistry;
  private sessionStore: ISessionStore | null;

  constructor(
    users: UserRecord[],
    repo?: IUserRepository,
    registry?: AuthProviderRegistry,
    sessionStore?: ISessionStore
  ) {
    this.users = users;
    this.repo = repo || null;
    this.registry = registry || new AuthProviderRegistry();
    this.sessionStore = sessionStore || null;
  }

  getRegistry(): AuthProviderRegistry {
    return this.registry;
  }

  private async getMergedUsers(): Promise<(UserRecord & { source: string })[]> {
    const envUsers = this.users.map((u) => ({ ...u, source: 'env' }));
    if (!this.repo) return envUsers;
    const dynamicUsers = await this.repo.listPlatformUsers();
    const merged: (UserRecord & { source: string })[] = [];
    const seen = new Set<string>();
    for (const u of dynamicUsers) {
      merged.push({ ...u, source: 'dynamic' });
      seen.add(u.username);
    }
    for (const u of envUsers) {
      if (!seen.has(u.username)) merged.push(u);
    }
    return merged;
  }

  resolvePermissions(role: string): string[] {
    const list = ROLE_PERMISSIONS[String(role || '').trim()] || [];
    return Array.from(new Set(list));
  }

  async login(
    username: string,
    password: string,
    options: SessionLoginOptions = {}
  ): Promise<LoginResult> {
    const provider = this.registry.getProvider(options.tenantId);

    if (provider.type === 'local') {
      return this.loginLocal(username, password, options);
    }

    const isOAuthOnly =
      provider.type === 'oidc' ||
      provider.type === 'wps-oauth' ||
      provider.type === 'platform-be-proxy';

    if (isOAuthOnly && config.auth.allowLocalFallback) {
      const localProvider = this.registry.getProviderByType('local');
      if (localProvider) {
        return this.loginLocal(username, password, options);
      }
    }

    const authResult = await provider.authenticate({ username, password });
    return this.finalizeLogin(authResult, provider.type, options);
  }

  async handleSSOCallback(
    code: string,
    state: string,
    redirectUri: string,
    providerType: string,
    options: SessionLoginOptions = {}
  ): Promise<LoginResult> {
    const provider = this.registry.getProviderByType(providerType);
    if (!provider?.handleCallback) {
      throw new AppError('SSO not supported for this provider', 400, 'SSO_UNSUPPORTED');
    }

    const authResult = await provider.handleCallback(code, state, redirectUri);
    return this.finalizeLogin(authResult, providerType, options);
  }

  getSSOAuthorizationUrl(providerType: string, state: string, redirectUri: string): string {
    const provider = this.registry.getProviderByType(providerType);
    if (!provider?.getAuthorizationUrl) {
      throw new AppError('SSO not supported for this provider', 400, 'SSO_UNSUPPORTED');
    }
    return provider.getAuthorizationUrl(state, redirectUri);
  }

  async validateSession(
    sessionId: string
  ): Promise<(Principal & { upstreamToken?: string }) | null> {
    if (!this.sessionStore) return null;
    const session = await this.sessionStore.findValid(sessionId);
    if (!session) return null;

    const allUsers = await this.getMergedUsers();
    const user = allUsers.find((u) => u.id === session.userId);
    if (!user) return null;

    const role = String(user.role || '').trim();
    const scope = user.scope || resolveScope(role);
    const permissions = this.resolvePermissions(role);
    const tenantId = scope === 'tenant' ? user.tenantId || 'default' : null;

    return {
      username: user.username,
      scope,
      role,
      tenantId,
      permissions,
      upstreamToken: session.upstreamToken,
    };
  }

  async revokeSession(sessionId: string): Promise<void> {
    if (this.sessionStore) {
      await this.sessionStore.revoke(sessionId);
    }
  }

  private async loginLocal(
    username: string,
    password: string,
    options: SessionLoginOptions
  ): Promise<LoginResult> {
    const provider = this.registry.getProviderByType('local') ?? this.registry.getDefaultProvider();
    let authResult: AuthResult;
    try {
      authResult = await provider.authenticate({ username, password });
    } catch {
      throw new AppError('invalid username or password', 401, 'AUTH_LOGIN_FAILED');
    }
    return this.finalizeLogin(authResult, 'local', options);
  }

  private async finalizeLogin(
    authResult: AuthResult,
    providerType: string,
    options: SessionLoginOptions
  ): Promise<LoginResult> {
    const allUsers = await this.getMergedUsers();
    let user: UserRecord | undefined = allUsers.find((u) => u.username === authResult.username);

    if (!user && this.repo?.findByExternalId) {
      const extUser = await this.repo.findByExternalId(providerType, authResult.externalId);
      if (extUser) user = extUser;
    }

    if (!user && config.auth.autoRegister && this.repo?.createFromExternal) {
      user = await this.repo.createFromExternal(authResult, providerType, {
        role: 'tenant_ops',
        scope: 'tenant',
        tenantId: options.tenantId || 'default',
      });
    }

    if (!user) {
      throw new AppError(
        'user not found and auto-provisioning disabled',
        401,
        'AUTH_USER_NOT_FOUND'
      );
    }

    if (user.disabled) {
      throw new AppError('account disabled', 401, 'AUTH_ACCOUNT_DISABLED');
    }

    const role = String(user.role || '').trim();
    const scope = user.scope || resolveScope(role);
    const permissions = this.resolvePermissions(role);

    if (options.requiredScope && scope !== options.requiredScope) {
      throw new AppError('invalid credentials for this console', 401, 'AUTH_SCOPE_MISMATCH');
    }

    const defaultTenantId = 'default';
    const effectiveTenantId =
      scope === 'tenant' ? user.tenantId || options.tenantId || defaultTenantId : null;

    const payload = { sub: user.username, scope, role, tenantId: effectiveTenantId, permissions };
    const token = await new jose.SignJWT(payload as unknown as jose.JWTPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(config.jwt.expiresIn)
      .sign(jwtSecret);

    const result: LoginResult = {
      token,
      tokenType: 'Bearer',
      expiresIn: config.jwt.expiresIn,
      user: { username: user.username, scope, role, tenantId: effectiveTenantId, permissions },
    };

    if (options.createSession && this.sessionStore && user.id) {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const sessionId = await this.sessionStore.create({
        userId: user.id,
        providerType,
        externalId: authResult.externalId,
        expiresAt,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        upstreamToken: authResult.upstreamToken,
      });
      result.sessionId = sessionId;
    }

    return result;
  }

  async authenticateToken(authHeader: string): Promise<Principal> {
    const raw = String(authHeader || '').trim();
    if (!raw.startsWith('Bearer ')) {
      throw new AppError('bearer token required', 401, 'AUTH_REQUIRED');
    }
    const token = raw.slice(7).trim();
    if (!token) {
      throw new AppError('bearer token required', 401, 'AUTH_REQUIRED');
    }

    let decoded: jose.JWTPayload;
    try {
      const { payload } = await jose.jwtVerify(token, jwtSecret);
      decoded = payload;
    } catch {
      throw new AppError('invalid token', 403, 'AUTH_FORBIDDEN');
    }

    // 回查用户当前状态：防止降权/禁用/删除后旧 token 仍持有原权限
    const username = String(decoded.sub || '');
    const allUsers = await this.getMergedUsers();
    const user = allUsers.find((u) => u.username === username);
    if (!user) {
      throw new AppError('user not found', 401, 'AUTH_REQUIRED');
    }
    if (user.disabled === true) {
      throw new AppError('user disabled', 401, 'AUTH_DISABLED');
    }

    // 以 DB 当前状态为准构造 Principal，不信任 token 内的 role/scope/tenantId
    const role = String(user.role || '').trim();
    const scope = user.scope || resolveScope(role);
    const tenantId = scope === 'tenant' ? user.tenantId || 'default' : null;
    return {
      username: user.username,
      scope,
      role,
      tenantId,
      permissions: this.resolvePermissions(role),
    };
  }

  ensurePermission(principal: Principal, permission: string): true {
    const requested = String(permission || '').trim();
    if (!requested) return true;
    const perms = principal.permissions || [];
    if (perms.includes('platform:*') || perms.includes(requested) || perms.includes('*'))
      return true;
    throw new AppError(`permission denied: ${requested}`, 403, 'AUTHZ_DENIED');
  }

  async handleUpstreamToken(token: string): Promise<Principal | null> {
    if (!config.auth.platformBe.baseUrl) return null;
    try {
      const res = await fetch(`${config.auth.platformBe.baseUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return null;

      const upstream = (await res.json()) as {
        id: number;
        username?: string;
        name?: string;
        role?: string;
      };

      const username = upstream.username ?? upstream.name ?? String(upstream.id);

      const allUsers = await this.getMergedUsers();
      const existingUser = allUsers.find((u) => u.username === username);
      let user: UserRecord | undefined = existingUser;

      if (!user && config.auth.autoRegister && this.repo?.createFromExternal) {
        user = await this.repo.createFromExternal(
          {
            externalId: String(upstream.id),
            username,
          },
          'platform-be-proxy',
          { role: 'tenant_ops', scope: 'tenant', tenantId: 'default' }
        );
      }

      if (!user) {
        return {
          username,
          scope: 'tenant',
          role: 'tenant_ops',
          tenantId: 'default',
          permissions: this.resolvePermissions('tenant_ops'),
        };
      }

      const role = String(user.role || '').trim();
      const scope = user.scope || resolveScope(role);
      return {
        username: user.username,
        scope,
        role,
        tenantId: scope === 'tenant' ? user.tenantId || 'default' : null,
        permissions: this.resolvePermissions(role),
      };
    } catch {
      return null;
    }
  }
}
