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
  getAuthorizationUrl?(state: string, redirectUri: string): string;
  handleCallback?(code: string, state: string, redirectUri: string): Promise<AuthResult>;
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
