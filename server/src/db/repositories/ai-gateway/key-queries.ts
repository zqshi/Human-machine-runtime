import { eq } from 'drizzle-orm';
import type { Database } from '../../client.js';
import { instanceLlmKeys } from '../../schema/ai-gateway.js';

export async function getInstanceKey(db: Database, instanceId: string) {
  const [row] = await db
    .select()
    .from(instanceLlmKeys)
    .where(eq(instanceLlmKeys.instanceId, instanceId))
    .limit(1);
  return row ?? null;
}

export async function listInstanceKeys(
  db: Database
): Promise<
  {
    instanceId: string;
    tenantId: string;
    litellmKey: string;
    litellmKeyId: string | null;
    allowedModels: string[];
    syncStatus: string;
    lastError: string | null;
    syncedAt: Date;
  }[]
> {
  return db.select().from(instanceLlmKeys);
}

export async function upsertInstanceKey(
  db: Database,
  data: {
    instanceId: string;
    tenantId: string;
    litellmKey: string;
    litellmKeyId?: string | null;
    allowedModels: string[];
    syncStatus?: string;
    lastError?: string | null;
  }
) {
  const [row] = await db
    .insert(instanceLlmKeys)
    .values({
      instanceId: data.instanceId,
      tenantId: data.tenantId,
      litellmKey: data.litellmKey,
      litellmKeyId: data.litellmKeyId ?? null,
      allowedModels: data.allowedModels,
      syncStatus: data.syncStatus ?? 'synced',
      lastError: data.lastError ?? null,
      syncedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: instanceLlmKeys.instanceId,
      set: {
        litellmKey: data.litellmKey,
        litellmKeyId: data.litellmKeyId ?? null,
        allowedModels: data.allowedModels,
        syncStatus: data.syncStatus ?? 'synced',
        lastError: data.lastError ?? null,
        syncedAt: new Date(),
      },
    })
    .returning();
  return row!;
}

export async function deleteInstanceKey(db: Database, instanceId: string) {
  const [row] = await db
    .delete(instanceLlmKeys)
    .where(eq(instanceLlmKeys.instanceId, instanceId))
    .returning();
  return !!row;
}
