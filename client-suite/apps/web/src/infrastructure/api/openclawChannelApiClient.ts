/**
 * OpenClaw Channel API Client
 *
 * Wraps the /api/openclaw/channels/* endpoints for the Decision Console.
 */

import { handleSessionExpired } from './sessionHandler';

class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body?: unknown
  ) {
    super(`API ${status}: ${statusText}`);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(path, {
      credentials: 'include',
      signal: controller.signal,
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
    if (res.status === 401) {
      handleSessionExpired();
      throw new ApiError(401, 'Session expired');
    }
    if (!res.ok) {
      const body = await res.json().catch(() => undefined);
      throw new ApiError(res.status, res.statusText, body);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : (undefined as T);
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Types ─────────────────────────────────────────────────────────

export interface ChannelHealthDTO {
  channelType: string;
  connected: boolean;
  error?: string;
  checkedAt: string;
}

export interface ChannelListResult {
  channels: ChannelHealthDTO[];
  available: string[];
}

export interface ConversationDTO {
  id: string;
  channelType: string;
  name: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
}

export interface AggregatedViewResult {
  conversations: ConversationDTO[];
  channels: { type: string; connected: boolean }[];
}

export interface TimelineEntryDTO {
  id: string;
  channelType: string;
  conversationId: string;
  conversationName: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
}

export interface TimelineResult {
  entries: TimelineEntryDTO[];
  hasMore: boolean;
  channels: string[];
}

export interface DispatchResult {
  successes: string[];
  failures: { channel: string; error: string }[];
}

export interface ChannelSwitchResult {
  success: boolean;
  fromChannel: string;
  toChannel: string;
  conversationId: string;
  error?: string;
}

// ─── API ───────────────────────────────────────────────────────────

export const channelApi = {
  list(): Promise<ChannelListResult> {
    return request('/api/openclaw/channels');
  },

  getView(): Promise<AggregatedViewResult> {
    return request('/api/openclaw/channels/view');
  },

  getTimeline(options?: {
    limit?: number;
    before?: string;
    channels?: string[];
  }): Promise<TimelineResult> {
    const qs = new URLSearchParams();
    if (options?.limit) qs.set('limit', String(options.limit));
    if (options?.before) qs.set('before', options.before);
    if (options?.channels?.length) qs.set('channels', options.channels.join(','));
    const q = qs.toString();
    return request(`/api/openclaw/channels/timeline${q ? `?${q}` : ''}`);
  },

  dispatch(data: {
    targetChannels: string[];
    roomId: string;
    message: { type: 'text' | 'rich_text' | 'card' | 'file'; content: string };
  }): Promise<DispatchResult> {
    return request('/api/openclaw/channels/dispatch', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  switchChannel(data: {
    conversationId: string;
    fromChannel: string;
    toChannel: string;
    notifyMessage?: string;
  }): Promise<ChannelSwitchResult> {
    return request('/api/openclaw/channels/switch', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
