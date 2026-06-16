import type { ChannelType } from './channel-adapter.js';

export interface RoutingRule {
  id: string;
  condition: {
    messageType?: string;
    channelType?: ChannelType;
    userId?: string;
  };
  targetChannels: ChannelType[];
  priority: number;
}

export interface IChannelRoutingRepository {
  listRules(): Promise<RoutingRule[]>;
  upsertRule(rule: RoutingRule): Promise<void>;
  removeRule(ruleId: string): Promise<void>;
  getUserPreference(userId: string): Promise<ChannelType[]>;
  setUserPreference(userId: string, channels: ChannelType[]): Promise<void>;
}
