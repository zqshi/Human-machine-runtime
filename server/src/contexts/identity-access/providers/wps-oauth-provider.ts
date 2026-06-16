import type { IAuthProvider, AuthResult } from '../auth-provider.js';

const WPS_AUTHORIZE_URL = 'https://openapi.wps.cn/oauth2/auth';
const WPS_TOKEN_URL = 'https://openapi.wps.cn/oauth2/token';
const WPS_USERINFO_URL = 'https://openapi.wps.cn/oauth2/userinfo';

interface WpsTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
}

interface WpsUserInfo {
  sub?: string;
  name?: string;
  email?: string;
  picture?: string;
  [key: string]: unknown;
}

export interface WpsOAuthConfig {
  clientId: string;
  clientSecret: string;
  scopes: string[];
  redirectUri?: string;
}

export class WpsOAuthProvider implements IAuthProvider {
  readonly type = 'wps-oauth';
  private config: WpsOAuthConfig;

  constructor(config: WpsOAuthConfig) {
    this.config = config;
  }

  async authenticate(_credentials: unknown): Promise<AuthResult> {
    throw new Error(
      'WPS OAuth does not support direct authentication — use authorization URL flow'
    );
  }

  getAuthorizationUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: redirectUri || this.config.redirectUri || '',
      scope: this.config.scopes.join(' '),
      state,
    });
    return `${WPS_AUTHORIZE_URL}?${params.toString()}`;
  }

  async handleCallback(code: string, _state: string, redirectUri: string): Promise<AuthResult> {
    const tokenData = await this.exchangeCode(code, redirectUri);
    const userInfo = await this.fetchUserInfo(tokenData.access_token);

    return {
      externalId: String(userInfo.sub ?? ''),
      username: String(userInfo.email?.split('@')[0] ?? userInfo.name ?? userInfo.sub ?? ''),
      email: userInfo.email ? String(userInfo.email) : undefined,
      displayName: userInfo.name ? String(userInfo.name) : undefined,
      avatarUrl: userInfo.picture ? String(userInfo.picture) : undefined,
      rawClaims: userInfo as Record<string, unknown>,
      upstreamToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
    };
  }

  async refreshAccessToken(
    refreshToken: string
  ): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    const res = await fetch(WPS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      throw new Error(`WPS token refresh failed: ${res.status}`);
    }

    const data = (await res.json()) as WpsTokenResponse;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  private async exchangeCode(code: string, redirectUri: string): Promise<WpsTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: redirectUri || this.config.redirectUri || '',
    });

    const res = await fetch(WPS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`WPS token exchange failed: ${res.status} — ${text}`);
    }

    return (await res.json()) as WpsTokenResponse;
  }

  private async fetchUserInfo(accessToken: string): Promise<WpsUserInfo> {
    const res = await fetch(WPS_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      throw new Error(`WPS userinfo failed: ${res.status}`);
    }

    return (await res.json()) as WpsUserInfo;
  }
}
