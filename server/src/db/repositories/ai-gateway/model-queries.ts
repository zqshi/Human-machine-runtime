import { eq, asc } from 'drizzle-orm';
import type { Database } from '../../client.js';
import { llmModels } from '../../schema/ai-gateway.js';

export async function listModels(db: Database) {
  return db.select().from(llmModels).orderBy(asc(llmModels.id));
}

export async function getModel(db: Database, id: number) {
  const [row] = await db.select().from(llmModels).where(eq(llmModels.id, id)).limit(1);
  return row ?? null;
}

export async function createModel(
  db: Database,
  data: {
    displayName: string;
    description?: string;
    providerType: string;
    protocolType: string;
    baseUrl: string;
    providerModelName?: string;
    modelName?: string;
    apiKey?: string;
    apiKeySecretRef?: string;
    isSecure?: boolean;
    isActive?: boolean;
    inputPrice?: number;
    outputPrice?: number;
    cacheReadCost?: number;
    cacheCreationCost?: number;
    currency?: string;
    maxTokens?: number;
    timeout?: number;
    streamTimeout?: number;
    rateLimitPerMin?: number;
  }
) {
  const [row] = await db
    .insert(llmModels)
    .values({
      displayName: data.displayName,
      description: data.description ?? null,
      providerType: data.providerType,
      protocolType: data.protocolType,
      baseUrl: data.baseUrl,
      providerModelName: data.providerModelName ?? null,
      modelName: data.modelName ?? null,
      apiKey: data.apiKey ?? null,
      apiKeySecretRef: data.apiKeySecretRef ?? null,
      isSecure: data.isSecure ?? false,
      isActive: data.isActive ?? true,
      inputPrice: data.inputPrice ?? 0,
      outputPrice: data.outputPrice ?? 0,
      cacheReadCost: data.cacheReadCost ?? null,
      cacheCreationCost: data.cacheCreationCost ?? null,
      currency: data.currency ?? 'USD',
      maxTokens: data.maxTokens ?? null,
      timeout: data.timeout ?? null,
      streamTimeout: data.streamTimeout ?? null,
      rateLimitPerMin: data.rateLimitPerMin ?? null,
    })
    .returning();
  return row!;
}

export async function updateModel(
  db: Database,
  id: number,
  patch: Partial<{
    displayName: string;
    description: string;
    providerType: string;
    protocolType: string;
    baseUrl: string;
    providerModelName: string;
    modelName: string;
    apiKey: string;
    apiKeySecretRef: string;
    isSecure: boolean;
    isActive: boolean;
    healthStatus: string;
    lastHealthCheckAt: Date;
    inputPrice: number;
    outputPrice: number;
    cacheReadCost: number;
    cacheCreationCost: number;
    currency: string;
    maxTokens: number;
    timeout: number;
    streamTimeout: number;
    rateLimitPerMin: number;
  }>
) {
  const [row] = await db
    .update(llmModels)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(llmModels.id, id))
    .returning();
  return row ?? null;
}

export async function deleteModel(db: Database, id: number) {
  const [row] = await db.delete(llmModels).where(eq(llmModels.id, id)).returning();
  return !!row;
}

export async function toggleModel(db: Database, id: number) {
  const model = await getModel(db, id);
  if (!model) return null;
  const [row] = await db
    .update(llmModels)
    .set({ isActive: !model.isActive, updatedAt: new Date() })
    .where(eq(llmModels.id, id))
    .returning();
  return row ?? null;
}
