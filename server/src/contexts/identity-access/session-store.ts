import { eq, and, gt, isNull } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { sessions } from '../../db/schema/identity.js';
import type { ISessionStore } from './auth-service.js';

export class DrizzleSessionStore implements ISessionStore {
  constructor(private db: Database) {}

  async create(data: {
    userId: number;
    providerType: string;
    externalId?: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
    upstreamToken?: string;
  }): Promise<string> {
    const [row] = await this.db
      .insert(sessions)
      .values({
        userId: data.userId,
        providerType: data.providerType,
        externalId: data.externalId ?? null,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
        upstreamToken: data.upstreamToken ?? null,
        expiresAt: data.expiresAt,
      })
      .returning({ id: sessions.id });
    return row.id;
  }

  async findValid(sessionId: string): Promise<{
    userId: number;
    providerType: string;
    externalId?: string;
    upstreamToken?: string;
  } | null> {
    const [row] = await this.db
      .select({
        userId: sessions.userId,
        providerType: sessions.providerType,
        externalId: sessions.externalId,
        upstreamToken: sessions.upstreamToken,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.id, sessionId),
          gt(sessions.expiresAt, new Date()),
          isNull(sessions.revokedAt)
        )
      )
      .limit(1);

    if (!row) return null;
    return {
      userId: row.userId,
      providerType: row.providerType,
      externalId: row.externalId ?? undefined,
      upstreamToken: row.upstreamToken ?? undefined,
    };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId));
  }
}
