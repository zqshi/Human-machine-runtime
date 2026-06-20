import { BaseGatewayClient } from './base-client.js';
import { config } from '../../../config/index.js';

export interface WebhookPayload {
  type: string;
  from: string;
  content: string;
  channelId?: string;
  metadata?: Record<string, unknown>;
}

export interface FarmInstance {
  appKey: string;
  userID: string;
  empKey: string;
  podName: string;
  status: string;
  lastActive: string;
  employeeNumber: number;
  name: string;
  isActive: boolean;
  chatModel?: string;
}

export interface ActivityRecord {
  userID: string;
  lastMessageAt: string;
  messageCount: number;
}

/**
 * claw-farm uses `/api/portal/*` RPC-style routes — not REST CRUD.
 * Paths verified against claw-farm/internal/router/router.go.
 */
export class ClawFarmClient extends BaseGatewayClient {
  /* ──── Webhook ──── */

  async webhookReceive(payload: WebhookPayload, authToken?: string) {
    return this.request('/open/receive', {
      method: 'POST',
      body: payload,
      authToken,
      timeoutProfile: 'write',
    });
  }

  /* ──── Instance Management ──── */

  async listInstances(authToken?: string) {
    return this.request<{ instances: FarmInstance[] }>('/api/portal/provision-status', {
      authToken,
    });
  }

  async getInstanceStatus(instanceId: string, authToken?: string) {
    return this.request<FarmInstance>(
      `/api/portal/runtime-status?userID=${encodeURIComponent(instanceId)}`,
      { authToken }
    );
  }

  async createInstance(
    data: { appKey: string; userID: string; name?: string; chatModel?: string },
    authToken?: string
  ) {
    return this.request<FarmInstance>('/api/portal/new-workspace', {
      method: 'POST',
      body: data,
      authToken,
      timeoutProfile: 'write',
    });
  }

  async startInstance(instanceId: string, authToken?: string) {
    return this.request('/api/portal/start-all', {
      method: 'POST',
      body: { userIDs: [instanceId] },
      authToken,
      timeoutProfile: 'write',
    });
  }

  async stopInstance(instanceId: string, authToken?: string) {
    return this.request('/api/portal/reset-user', {
      method: 'POST',
      body: { userID: instanceId },
      authToken,
      timeoutProfile: 'write',
    });
  }

  async restartInstance(instanceId: string, authToken?: string) {
    return this.request('/api/portal/reset-user', {
      method: 'POST',
      body: { userID: instanceId },
      authToken,
      timeoutProfile: 'write',
    });
  }

  async deleteInstance(instanceId: string, authToken?: string) {
    return this.request('/api/portal/reset-user', {
      method: 'POST',
      body: { userID: instanceId },
      authToken,
      timeoutProfile: 'write',
    });
  }

  /* ──── Channel / Messaging ──── */

  async listChannels(authToken?: string) {
    return this.request('/api/portal/provision-status', { authToken });
  }

  async sendMessage(
    channelId: string,
    message: { content: string; type?: string; replyTo?: string },
    authToken?: string
  ) {
    return this.request('/open/receive', {
      method: 'POST',
      body: {
        type: message.type || 'text',
        from: channelId,
        content: message.content,
        metadata: { replyTo: message.replyTo },
      },
      authToken,
      timeoutProfile: 'write',
    });
  }

  /* ──── Activity ──── */

  async getUserActivity(userId: string, authToken?: string) {
    return this.request<ActivityRecord>(
      `/api/portal/activity?userID=${encodeURIComponent(userId)}`,
      { authToken }
    );
  }

  /* ──── WebSocket ──── */

  getWebSocketUrl(): string {
    const wsUrl = config.gateway.clawFarmWsUrl;
    if (wsUrl) return wsUrl;
    return this.baseUrl.replace(/^http/, 'ws') + '/ws';
  }

  /* ──── Health ──── */

  async healthCheck(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      await this.request('/health', { skipRetry: true });
      return true;
    } catch {
      return false;
    }
  }
}
