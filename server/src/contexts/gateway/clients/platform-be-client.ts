import { BaseGatewayClient } from './base-client.js';

export interface PlatformBeUser {
  id: number;
  username?: string;
  name?: string;
  email?: string;
  avatar_url?: string;
  ksc_subject?: string;
  external_subject?: string;
  roles?: string[];
}

export interface AuthorizationRecord {
  id: number;
  userId: number;
  providerName: string;
  scope: string;
  status: string;
  createdAt: string;
}

export interface LLMBudgetInfo {
  userId?: number;
  totalBudget: number;
  usedBudget: number;
  remainingBudget: number;
  period: string;
}

export interface LLMModelInfo {
  id: string;
  name: string;
  provider: string;
  status: string;
  maxTokens?: number;
}

export class PlatformBeClient extends BaseGatewayClient {
  /* ──── Auth ──── */

  async login(username: string, password: string) {
    return this.request<{ token: string; user: PlatformBeUser }>('/api/v1/auth/login', {
      method: 'POST',
      body: { username, password },
      timeoutProfile: 'write',
    });
  }

  async getCurrentUser(sessionToken: string) {
    return this.request<PlatformBeUser>('/api/v1/auth/me', { authToken: sessionToken });
  }

  async ssoAuthorize(params: { state: string; redirectUri: string; clientId?: string }) {
    const query = new URLSearchParams({
      state: params.state,
      redirect_uri: params.redirectUri,
    });
    if (params.clientId) query.set('client_id', params.clientId);
    return this.request<{ authorize_url: string }>(
      `/api/v1/auth/sso/authorize?${query.toString()}`
    );
  }

  async ssoCallback(
    code: string,
    options?: { clientId?: string; clientSecret?: string; redirectUri?: string }
  ) {
    const body: Record<string, string> = { code };
    if (options?.clientId) body.client_id = options.clientId;
    if (options?.clientSecret) body.client_secret = options.clientSecret;
    if (options?.redirectUri) body.redirect_uri = options.redirectUri;
    return this.request<{ token: string; user: PlatformBeUser }>('/api/v1/auth/sso/callback', {
      method: 'POST',
      body,
      timeoutProfile: 'write',
    });
  }

  async listProviders(authToken?: string) {
    return this.request<{ providers: Array<{ id: number; name: string; type: string }> }>(
      '/api/v1/auth/providers',
      { authToken }
    );
  }

  /* ──── Authorizations ──── */

  async listAuthorizations(userId: number, authToken?: string) {
    return this.request<{ authorizations: AuthorizationRecord[] }>(
      `/api/v1/authorizations?userId=${userId}`,
      { authToken }
    );
  }

  async createAuthorization(
    data: { userId: number; providerName: string; scope: string },
    authToken?: string
  ) {
    return this.request<AuthorizationRecord>('/api/v1/authorizations', {
      method: 'POST',
      body: data,
      authToken,
      timeoutProfile: 'write',
    });
  }

  async revokeAuthorization(authorizationId: number, authToken?: string) {
    return this.request(`/api/v1/authorizations/${authorizationId}`, {
      method: 'DELETE',
      authToken,
      timeoutProfile: 'write',
    });
  }

  /* ──── LLM Budget ──── */

  async getLLMBudget(userId?: number, authToken?: string) {
    const query = userId ? `?userId=${userId}` : '';
    return this.request<LLMBudgetInfo>(`/api/v1/llm-budget${query}`, { authToken });
  }

  /* ──── Models ──── */

  async listModels(authToken?: string) {
    return this.request<{ models: LLMModelInfo[] }>('/api/v1/models', { authToken });
  }

  async listLLMHealth(authToken?: string) {
    return this.request('/api/v1/models/health', { authToken });
  }

  /* ──── Portal (Agent Profile) ──── */

  async getPortalProfile(userUid: string, authToken?: string) {
    return this.request(`/api/v1/portal/${userUid}/profile`, { authToken });
  }

  /* ──── User Management ──── */

  async listUsers(params?: { page?: number; pageSize?: number }, authToken?: string) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    const qs = query.toString();
    return this.request<{ users: PlatformBeUser[]; total: number }>(
      `/api/v1/users${qs ? `?${qs}` : ''}`,
      { authToken }
    );
  }

  async listOrganizations(authToken?: string) {
    return this.request<{
      organizations: Array<{
        id: number;
        name: string;
        slug: string;
        plan?: string;
        status: string;
      }>;
    }>('/api/v1/organizations', { authToken });
  }

  /* ──── Runtime Leases ──── */

  async requestLease(userId: number, providerId: number, scope: string, authToken?: string) {
    return this.request('/api/v1/runtime/leases', {
      method: 'POST',
      body: { userId, providerId, scope },
      authToken,
      timeoutProfile: 'write',
    });
  }

  async getCredential(leaseId: string, authToken?: string) {
    return this.request(`/api/v1/credentials/${leaseId}`, { authToken });
  }
}
