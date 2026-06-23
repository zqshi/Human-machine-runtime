import { eq, and } from 'drizzle-orm';
import type { Database } from '../client.js';
import { openclawEntities } from '../schema/operational.js';
import type { IMapStore } from '../../contexts/agent-core/session/domain/map-store.js';

export class DbMapStore<V> implements IMapStore<V> {
  private cache = new Map<string, V>();
  private loaded = false;

  constructor(
    private db: Database,
    private entityType: string
  ) {}

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    const rows = await this.db
      .select()
      .from(openclawEntities)
      .where(eq(openclawEntities.entityType, this.entityType));
    for (const row of rows) {
      this.cache.set(row.id, row.data as V);
    }
    this.loaded = true;
  }

  get(key: string): V | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: V): void {
    this.cache.set(key, value);
    this.db
      .insert(openclawEntities)
      .values({
        id: key,
        entityType: this.entityType,
        data: value as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: openclawEntities.id,
        set: {
          data: value as Record<string, unknown>,
          updatedAt: new Date(),
        },
      })
      .execute()
      .catch(() => {});
  }

  values(): IterableIterator<V> {
    return this.cache.values();
  }

  entries(): IterableIterator<[string, V]> {
    return this.cache.entries();
  }

  async load(): Promise<void> {
    await this.ensureLoaded();
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    await this.db
      .delete(openclawEntities)
      .where(and(eq(openclawEntities.id, key), eq(openclawEntities.entityType, this.entityType)));
  }
}
