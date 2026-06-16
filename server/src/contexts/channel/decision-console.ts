import type { ChannelService } from './channel-service.js';
import type {
  ChannelConversation,
  ChannelMessage,
  ChannelStatus,
  ChannelType,
} from './channel-adapter.js';
import type { ChannelRouter, RoutingRule } from './channel-router.js';

export interface DispatchCommand {
  targetChannels: ChannelType[];
  roomId: string;
  message: ChannelMessage;
}

export interface TimelineEntry {
  id: string;
  channelType: ChannelType;
  conversationId: string;
  conversationName: string;
  lastMessage?: string;
  lastMessageAt?: Date;
  unreadCount?: number;
}

export interface TimelineOptions {
  limit?: number;
  before?: Date;
  channelTypes?: ChannelType[];
}

export interface ChannelHealthInfo {
  channelType: ChannelType;
  connected: boolean;
  error?: string;
  checkedAt: string;
}

export interface ChannelMigrationResult {
  success: boolean;
  fromChannel: ChannelType;
  toChannel: ChannelType;
  conversationId: string;
  error?: string;
}

export class DecisionConsole {
  private channelService: ChannelService;
  private router?: ChannelRouter;

  constructor(channelService: ChannelService, router?: ChannelRouter) {
    this.channelService = channelService;
    this.router = router;
  }

  async getAggregatedView(userId: string): Promise<{
    conversations: ChannelConversation[];
    channels: { type: string; connected: boolean }[];
  }> {
    const [conversations, statuses] = await Promise.all([
      this.channelService.getAggregatedConversations(userId),
      this.channelService.getAllStatuses(),
    ]);
    return {
      conversations,
      channels: statuses.map((s) => ({ type: s.channelType, connected: s.connected })),
    };
  }

  async getUnifiedTimeline(
    userId: string,
    options: TimelineOptions = {}
  ): Promise<{
    entries: TimelineEntry[];
    hasMore: boolean;
    channels: string[];
  }> {
    const limit = options.limit ?? 50;
    const allowedTypes = options.channelTypes ?? this.channelService.listChannelTypes();

    const conversations = await this.channelService.getAggregatedConversations(userId);

    let filtered = conversations.filter((c) => allowedTypes.includes(c.channelType));
    if (options.before) {
      const cutoff = options.before.getTime();
      filtered = filtered.filter((c) => (c.lastMessageAt?.getTime() ?? 0) < cutoff);
    }

    const entries: TimelineEntry[] = filtered.slice(0, limit).map((c) => ({
      id: `${c.channelType}:${c.id}`,
      channelType: c.channelType,
      conversationId: c.id,
      conversationName: c.name,
      lastMessage: c.lastMessage,
      lastMessageAt: c.lastMessageAt,
      unreadCount: c.unreadCount,
    }));

    return {
      entries,
      hasMore: filtered.length > limit,
      channels: allowedTypes,
    };
  }

  async getChannelHealth(): Promise<ChannelHealthInfo[]> {
    const statuses: ChannelStatus[] = await this.channelService.getAllStatuses();
    const checkedAt = new Date().toISOString();
    return statuses.map((s) => ({
      channelType: s.channelType,
      connected: s.connected,
      error: s.error,
      checkedAt,
    }));
  }

  async switchChannel(
    userId: string,
    conversationId: string,
    fromChannel: ChannelType,
    toChannel: ChannelType,
    message?: ChannelMessage
  ): Promise<ChannelMigrationResult> {
    const toAdapter = this.channelService.getAdapter(toChannel);
    if (!toAdapter) {
      return {
        success: false,
        fromChannel,
        toChannel,
        conversationId,
        error: `target channel "${toChannel}" not registered`,
      };
    }

    const status = await toAdapter.getStatus();
    if (!status.connected) {
      return {
        success: false,
        fromChannel,
        toChannel,
        conversationId,
        error: `target channel "${toChannel}" not connected`,
      };
    }

    if (message) {
      await this.channelService.sendToChannel(
        { channelType: toChannel, roomId: conversationId, userId },
        message
      );
    }

    return { success: true, fromChannel, toChannel, conversationId };
  }

  async dispatch(
    command: DispatchCommand
  ): Promise<{ successes: ChannelType[]; failures: { channel: ChannelType; error: string }[] }> {
    const successes: ChannelType[] = [];
    const failures: { channel: ChannelType; error: string }[] = [];

    for (const channelType of command.targetChannels) {
      try {
        await this.channelService.sendToChannel(
          { channelType, roomId: command.roomId },
          command.message
        );
        successes.push(channelType);
      } catch (err) {
        failures.push({
          channel: channelType,
          error: err instanceof Error ? err.message : 'unknown',
        });
      }
    }

    return { successes, failures };
  }

  async routeMessage(
    userId: string,
    message: ChannelMessage
  ): Promise<{ successes: ChannelType[]; failures: { channel: ChannelType; error: string }[] }> {
    if (!this.router) {
      return this.dispatch({ targetChannels: ['websocket'], roomId: userId, message });
    }
    const targets = await this.router.routeOutbound(userId, message);
    return this.dispatch({ targetChannels: targets, roomId: userId, message });
  }

  async getRoutingRules(): Promise<RoutingRule[]> {
    if (!this.router) return [];
    return this.router.listRules();
  }

  async setRoutingRule(rule: RoutingRule): Promise<void> {
    if (!this.router) return;
    await this.router.upsertRule(rule);
  }

  async removeRoutingRule(ruleId: string): Promise<void> {
    if (!this.router) return;
    await this.router.removeRule(ruleId);
  }

  async getUserPreference(userId: string): Promise<ChannelType[]> {
    if (!this.router) return [];
    return this.router.getUserPreference(userId);
  }

  async setUserPreference(userId: string, channels: ChannelType[]): Promise<void> {
    if (!this.router) return;
    await this.router.setUserPreference(userId, channels);
  }
}
