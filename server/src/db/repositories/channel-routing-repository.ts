import { eq, like } from 'drizzle-orm';
import type { Database } from '../client.js';
import { systemConfigs } from '../schema/config.js';
import type { ChannelType } from '../../contexts/channel/channel-adapter.js';
import type {
  IChannelRoutingRepository,
  RoutingRule,
} from '../../contexts/channel/channel-routing-repository.js';

const RULE_PREFIX = 'channel_routing:';
const PREF_PREFIX = 'channel_preference:';

export class ChannelRoutingRepository implements IChannelRoutingRepository {
  constructor(private db: Database) {}

  async listRules(): Promise<RoutingRule[]> {
    const rows = await this.db
      .select()
      .from(systemConfigs)
      .where(like(systemConfigs.key, `${RULE_PREFIX}%`));

    return rows
      .map((r) => {
        try {
          return JSON.parse(r.value) as RoutingRule;
        } catch {
          return null;
        }
      })
      .filter((r): r is RoutingRule => r !== null);
  }

  async upsertRule(rule: RoutingRule): Promise<void> {
    const key = `${RULE_PREFIX}${rule.id}`;
    const value = JSON.stringify(rule);
    const now = new Date();
    const [existing] = await this.db
      .select({ key: systemConfigs.key })
      .from(systemConfigs)
      .where(eq(systemConfigs.key, key));

    if (existing) {
      await this.db
        .update(systemConfigs)
        .set({ value, updatedAt: now })
        .where(eq(systemConfigs.key, key));
    } else {
      await this.db.insert(systemConfigs).values({
        key,
        value,
        description: `Channel routing rule: ${rule.id}`,
        updatedAt: now,
      });
    }
  }

  async removeRule(ruleId: string): Promise<void> {
    const key = `${RULE_PREFIX}${ruleId}`;
    await this.db.delete(systemConfigs).where(eq(systemConfigs.key, key));
  }

  async getUserPreference(userId: string): Promise<ChannelType[]> {
    const key = `${PREF_PREFIX}${userId}`;
    const [row] = await this.db.select().from(systemConfigs).where(eq(systemConfigs.key, key));
    if (!row) return [];
    try {
      return JSON.parse(row.value) as ChannelType[];
    } catch {
      return [];
    }
  }

  async setUserPreference(userId: string, channels: ChannelType[]): Promise<void> {
    const key = `${PREF_PREFIX}${userId}`;
    const value = JSON.stringify(channels);
    const now = new Date();
    const [existing] = await this.db
      .select({ key: systemConfigs.key })
      .from(systemConfigs)
      .where(eq(systemConfigs.key, key));

    if (existing) {
      await this.db
        .update(systemConfigs)
        .set({ value, updatedAt: now })
        .where(eq(systemConfigs.key, key));
    } else {
      await this.db.insert(systemConfigs).values({
        key,
        value,
        description: `Channel preference for user ${userId}`,
        updatedAt: now,
      });
    }
  }
}
