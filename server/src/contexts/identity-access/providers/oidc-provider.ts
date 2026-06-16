import * as jose from 'jose';
import type { IAuthProvider, AuthResult, OIDCProviderConfig } from '../auth-provider.js';

interface OIDCDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  issuer: string;
}

interface TokenResponse {
  access_token: string;
  id_token?: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
}

export class OIDCAuthProvider implements IAuthProvider {
  readonly type = 'oidc';
  private config: OIDCProviderConfig;
  private discovery: OIDCDiscovery | null = null;
  private jwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null;

  constructor(config: OIDCProviderConfig) {
    this.config = config;
  }

  async authenticate(_credentials: unknown): Promise<AuthResult> {
    throw new Error(
      'OIDC does not support direct authentication — use getAuthorizationUrl + handleCallback'
    );
  }

  getAuthorizationUrl(state: string, redirectUri: string): string {
    const disc = this.discovery;
    if (!disc) {
      throw new Error('OIDC discovery not loaded — call ensureDiscovery() first');
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      scope: this.config.scopes.join(' '),
      state,
    });

    return `${disc.authorization_endpoint}?${params.toString()}`;
  }

  async handleCallback(code: string, _state: string, redirectUri: string): Promise<AuthResult> {
    await this.ensureDiscovery();
    const disc = this.discovery!;

    const tokenRes = await this.exchangeCode(code, redirectUri, disc.token_endpoint);

    let claims: Record<string, unknown> = {};

    if (tokenRes.id_token) {
      claims = await this.verifyIdToken(tokenRes.id_token, disc);
    }

    if (disc.userinfo_endpoint && tokenRes.access_token) {
      const userInfo = await this.fetchUserInfo(tokenRes.access_token, disc.userinfo_endpoint);
      claims = { ...claims, ...userInfo };
    }

    return this.mapClaims(claims);
  }

  async ensureDiscovery(): Promise<OIDCDiscovery> {
    if (this.discovery) return this.discovery;

    const issuer = this.config.issuer.replace(/\/$/, '');
    const url = `${issuer}/.well-known/openid-configuration`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      throw new Error(`OIDC discovery failed: ${res.status} ${res.statusText}`);
    }
    this.discovery = (await res.json()) as OIDCDiscovery;
    return this.discovery;
  }

  private async exchangeCode(
    code: string,
    redirectUri: string,
    tokenEndpoint: string
  ): Promise<TokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    const res = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Token exchange failed: ${res.status} — ${text}`);
    }

    return (await res.json()) as TokenResponse;
  }

  private async verifyIdToken(
    idToken: string,
    disc: OIDCDiscovery
  ): Promise<Record<string, unknown>> {
    if (!this.jwks) {
      this.jwks = jose.createRemoteJWKSet(new URL(disc.jwks_uri));
    }
    const { payload } = await jose.jwtVerify(idToken, this.jwks, {
      issuer: disc.issuer,
      audience: this.config.clientId,
    });
    return payload as Record<string, unknown>;
  }

  private async fetchUserInfo(
    accessToken: string,
    endpoint: string
  ): Promise<Record<string, unknown>> {
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return {};
    return (await res.json()) as Record<string, unknown>;
  }

  private mapClaims(claims: Record<string, unknown>): AuthResult {
    const mapping = this.config.claimMapping ?? {};
    return {
      externalId: String(claims.sub ?? ''),
      username: String(claims[mapping.username ?? 'preferred_username'] ?? claims.sub ?? ''),
      email: String(claims[mapping.email ?? 'email'] ?? ''),
      displayName: String(claims[mapping.displayName ?? 'name'] ?? ''),
      avatarUrl: claims[mapping.avatarUrl ?? 'picture']
        ? String(claims[mapping.avatarUrl ?? 'picture'])
        : undefined,
      rawClaims: claims,
    };
  }
}
