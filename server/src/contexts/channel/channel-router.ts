import type { ChannelType, InboundMessage, ChannelMessage } from './channel-adapter.js';
import type { ChannelService } from './channel-service.js';
import type { IChannelRoutingRepository, RoutingRule } from './channel-routing-repository.js';

export type { RoutingRule } from './channel-routing-repository.js';

const DEFAULT_FALLBACK: ChannelType = 'websocket';

export class ChannelRouter {
  constructor(
    private channelService: ChannelService,
    private repo: IChannelRoutingRepository
  ) {}

  async resolveTargetChannels(msg: InboundMessage): Promise<ChannelType[]> {
    const rules = await this.repo.listRules();
    const sorted = rules.sort((a, b) => b.priority - a.priority);

    for (const rule of sorted) {
      if (this.matchesCondition(rule, msg)) {
        return rule.targetChannels;
      }
    }

    const pref = await this.repo.getUserPreference(msg.sender.id);
    if (pref.length > 0) return pref;

    return [DEFAULT_FALLBACK];
  }

  async routeOutbound(userId: string, _message: ChannelMessage): Promise<ChannelType[]> {
    const pref = await this.repo.getUserPreference(userId);
    if (pref.length > 0) {
      const reachable = await this.filterReachable(pref);
      if (reachable.length > 0) return reachable;
    }
    return [DEFAULT_FALLBACK];
  }

  async getUserPreference(userId: string): Promise<ChannelType[]> {
    return this.repo.getUserPreference(userId);
  }

  async setUserPreference(userId: string, channels: ChannelType[]): Promise<void> {
    await this.repo.setUserPreference(userId, channels);
  }

  async listRules(): Promise<RoutingRule[]> {
    return this.repo.listRules();
  }

  async upsertRule(rule: RoutingRule): Promise<void> {
    await this.repo.upsertRule(rule);
  }

  async removeRule(ruleId: string): Promise<void> {
    await this.repo.removeRule(ruleId);
  }

  private matchesCondition(rule: RoutingRule, msg: InboundMessage): boolean {
    const { condition } = rule;
    if (condition.messageType && condition.messageType !== msg.contentType) return false;
    if (condition.channelType && condition.channelType !== msg.channelType) return false;
    if (condition.userId && condition.userId !== msg.sender.id) return false;
    return true;
  }

  private async filterReachable(channels: ChannelType[]): Promise<ChannelType[]> {
    const reachable: ChannelType[] = [];
    for (const ch of channels) {
      const adapter = this.channelService.getAdapter(ch);
      if (!adapter) continue;
      try {
        const status = await adapter.getStatus();
        if (status.connected) reachable.push(ch);
      } catch {
        // unreachable
      }
    }
    return reachable;
  }
}
