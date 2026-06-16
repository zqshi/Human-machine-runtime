import { eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { systemConfigs, platformConfigs } from '../schema/config.js';

export class ConfigRepository {
  constructor(private db: Database) {}

  /* ──── System Configs ──── */

  async listSystemConfigs() {
    return this.db.select().from(systemConfigs);
  }

  async getSystemConfig(key: string) {
    const [row] = await this.db
      .select()
      .from(systemConfigs)
      .where(eq(systemConfigs.key, key))
      .limit(1);
    return row ?? null;
  }

  async setSystemConfig(key: string, value: string, description?: string) {
    const existing = await this.getSystemConfig(key);
    if (existing) {
      const [row] = await this.db
        .update(systemConfigs)
        .set({ value, description: description ?? existing.description, updatedAt: new Date() })
        .where(eq(systemConfigs.key, key))
        .returning();
      return row!;
    }
    const [row] = await this.db
      .insert(systemConfigs)
      .values({ key, value, description: description ?? null })
      .returning();
    return row!;
  }

  async deleteSystemConfig(key: string) {
    const [row] = await this.db.delete(systemConfigs).where(eq(systemConfigs.key, key)).returning();
    return !!row;
  }

  /* ──── Platform Configs (JSONB) ──── */

  async getPlatformConfig(key: string) {
    const [row] = await this.db
      .select()
      .from(platformConfigs)
      .where(eq(platformConfigs.key, key))
      .limit(1);
    return row ?? null;
  }

  async setPlatformConfig(key: string, value: unknown) {
    const existing = await this.getPlatformConfig(key);
    if (existing) {
      const [row] = await this.db
        .update(platformConfigs)
        .set({ value, updatedAt: new Date() })
        .where(eq(platformConfigs.key, key))
        .returning();
      return row!;
    }
    const [row] = await this.db.insert(platformConfigs).values({ key, value }).returning();
    return row!;
  }

  async deletePlatformConfig(key: string) {
    const [row] = await this.db
      .delete(platformConfigs)
      .where(eq(platformConfigs.key, key))
      .returning();
    return !!row;
  }

  async listPlatformConfigs() {
    return this.db.select().from(platformConfigs);
  }
}
