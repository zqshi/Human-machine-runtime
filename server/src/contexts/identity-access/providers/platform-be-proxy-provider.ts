import type { IAuthProvider, AuthResult, PlatformBeProxyConfig } from '../auth-provider.js';

interface PlatformBeUser {
  id: number;
  username?: string;
  name?: string;
  email?: string;
  avatar_url?: string;
  ksc_subject?: string;
  external_subject?: string;
  roles?: string[];
  permissions?: string[];
}

interface PlatformBeLoginResponse {
  token: string;
  refresh_token?: string;
  expires_in?: number;
  user: PlatformBeUser;
}

interface PlatformBeTokenResponse {
  token: string;
  refresh_token?: string;
  expires_in?: number;
}

export interface PlatformBeCredentials {
  username?: string;
  password?: string;
  sessionToken?: string;
}

export interface PlatformBeAuthResult extends AuthResult {
  upstreamToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  roles?: string[];
  permissions?: string[];
}

const PLATFORM_BE_ROLE_TO_HMR: Record<string, string> = {
  admin: 'platform_admin',
  operator: 'tenant_ops',
  user: 'tenant_ops',
  auditor: 'tenant_auditor',
};

export class PlatformBeProxyProvider implements IAuthProvider {
  readonly type = 'platform-be-proxy';
  private baseUrl: string;
  private timeout: number;
  private clientId: string;
  private clientSecret: string;
  private callbackUrl: string;

  constructor(
    config: PlatformBeProxyConfig & {
      clientId?: string;
      clientSecret?: string;
      callbackUrl?: string;
    }
  ) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.timeout = config.timeout ?? 10_000;
    this.clientId = config.clientId ?? '';
    this.clientSecret = config.clientSecret ?? '';
    this.callbackUrl = config.callbackUrl ?? '';
  }

  async authenticate(credentials: unknown): Promise<PlatformBeAuthResult> {
    const creds = credentials as PlatformBeCredentials;

    if (creds?.sessionToken) {
      return this.validateBySessionToken(creds.sessionToken);
    }

    if (creds?.username && creds?.password) {
      return this.loginViaProxy(creds.username, creds.password);
    }

    throw new Error('platform-be-proxy requires username/password or sessionToken');
  }

  async validateSession(sessionToken: string): Promise<PlatformBeAuthResult | null> {
    try {
      return await this.validateBySessionToken(sessionToken);
    } catch {
      return null;
    }
  }

  getAuthorizationUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      state,
      redirect_uri: redirectUri || this.callbackUrl,
    });
    if (this.clientId) params.set('client_id', this.clientId);
    return `${this.baseUrl}/api/v1/auth/sso/authorize?${params.toString()}`;
  }

  async handleCallback(
    code: string,
    _state: string,
    redirectUri: string
  ): Promise<PlatformBeAuthResult> {
    const body: Record<string, string> = { code };
    if (this.clientId) body.client_id = this.clientId;
    if (this.clientSecret) body.client_secret = this.clientSecret;
    if (redirectUri || this.callbackUrl) body.redirect_uri = redirectUri || this.callbackUrl;

    const res = await fetch(`${this.baseUrl}/api/v1/auth/sso/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!res.ok) {
      throw new Error(`platform-be SSO callback failed: ${res.status}`);
    }

    const data = (await res.json()) as PlatformBeLoginResponse;
    return this.mapLoginResponse(data);
  }

  async refreshToken(refreshToken: string): Promise<PlatformBeTokenResponse> {
    const body: Record<string, string> = {
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    };
    if (this.clientId) body.client_id = this.clientId;
    if (this.clientSecret) body.client_secret = this.clientSecret;

    const res = await fetch(`${this.baseUrl}/api/v1/auth/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!res.ok) {
      throw new Error(`platform-be token refresh failed: ${res.status}`);
    }

    return (await res.json()) as PlatformBeTokenResponse;
  }

  resolveHmrRole(platformBeRoles?: string[]): string {
    if (!platformBeRoles?.length) return 'tenant_ops';
    for (const role of platformBeRoles) {
      const mapped = PLATFORM_BE_ROLE_TO_HMR[role];
      if (mapped) return mapped;
    }
    return 'tenant_ops';
  }

  private async loginViaProxy(username: string, password: string): Promise<PlatformBeAuthResult> {
    const res = await fetch(`${this.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!res.ok) {
      if (res.status === 401) throw new Error('invalid username or password');
      throw new Error(`platform-be login failed: ${res.status}`);
    }

    const data = (await res.json()) as PlatformBeLoginResponse;
    return this.mapLoginResponse(data);
  }

  private async validateBySessionToken(token: string): Promise<PlatformBeAuthResult> {
    const res = await fetch(`${this.baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!res.ok) {
      throw new Error(`platform-be session validation failed: ${res.status}`);
    }

    const user = (await res.json()) as PlatformBeUser;
    const result = this.mapUser(user);
    result.upstreamToken = token;
    return result;
  }

  private mapLoginResponse(data: PlatformBeLoginResponse): PlatformBeAuthResult {
    const result = this.mapUser(data.user);
    result.upstreamToken = data.token;
    result.refreshToken = data.refresh_token;
    result.expiresIn = data.expires_in;
    return result;
  }

  private mapUser(user: PlatformBeUser): PlatformBeAuthResult {
    return {
      externalId: String(user.ksc_subject ?? user.id),
      username: user.username ?? user.name ?? String(user.id),
      email: user.email,
      displayName: user.name,
      avatarUrl: user.avatar_url,
      rawClaims: user as unknown as Record<string, unknown>,
      roles: user.roles,
      permissions: user.permissions,
    };
  }
}
