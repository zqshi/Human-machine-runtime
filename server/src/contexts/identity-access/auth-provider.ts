export interface AuthResult {
  externalId: string;
  username: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  rawClaims?: Record<string, unknown>;
  upstreamToken?: string;
  refreshToken?: string;
}

export interface IAuthProvider {
  readonly type: string;
  authenticate(credentials: unknown): Promise<AuthResult>;
  validateSession?(sessionId: string): Promise<AuthResult | null>;
  /**
   * 构造 SSO 授权 URL。
   * - state: CSRF token(由调用方生成 + 持久化)
   * - redirectUri: OIDC 回调 URI
   * - codeChallenge: PKCE S256 的 base64url(SHA256(code_verifier)),可选(若 IdP 支持)
   */
  getAuthorizationUrl?(state: string, redirectUri: string, codeChallenge?: string): string;
  /**
   * 处理 SSO 回调。
   * - code: 授权码
   * - state: CSRF token(调用方负责校验)
   * - redirectUri: 与 authorize 一致的回调 URI
   * - codeVerifier: PKCE code_verifier(若 authorize 时下发了 code_challenge)
   */
  handleCallback?(
    code: string,
    state: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<AuthResult>;
}

export interface OIDCProviderConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  claimMapping?: {
    username?: string;
    email?: string;
    displayName?: string;
    avatarUrl?: string;
  };
}

export interface PlatformBeProxyConfig {
  baseUrl: string;
  timeout?: number;
}

export interface LocalProviderConfig {
  allowPlainPassword?: boolean;
}
