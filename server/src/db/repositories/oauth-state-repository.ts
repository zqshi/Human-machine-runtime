import { eq, lt } from 'drizzle-orm';
import type { Database } from '../client.js';
import { oauthStates } from '../schema/credential.js';
import type {
  IOAuthStateStore,
  OAuthStateRecord,
} from '../../contexts/identity-access/oauth-state-store.js';

/**
 * oauth_states 表的 DB 实现。
 *
 * user_id 列在 schema 中是 NOT NULL,但 SSO 登录流(state 由 /sso/authorize 下发时)
 * 用户尚未登录 → 使用 0 作为 "pre-auth" sentinel。
 *
 * state 一次性消费:consume 先 DELETE RETURNING,确保原子性 + 防 race。
 */
export class DbOAuthStateRepository implements IOAuthStateStore {
  constructor(private db: Database) {}

  async save(record: OAuthStateRecord): Promise<void> {
    await this.db.insert(oauthStates).values({
      state: record.state,
      userId: 0, // pre-auth sentinel(SSO 登录流尚未识别用户)
      providerCode: record.providerCode,
      redirectUri: record.redirectUri,
      codeVerifier: record.codeVerifier ?? null,
      expiresAt: record.expiresAt,
    });
  }

  async consume(state: string): Promise<OAuthStateRecord | null> {
    // DELETE ... RETURNING:原子消费 + 防并发双用
    const deleted = await this.db
      .delete(oauthStates)
      .where(eq(oauthStates.state, state))
      .returning();
    const row = deleted[0];
    if (!row) return null;
    if (Date.now() > row.expiresAt.getTime()) return null;
    return {
      state: row.state,
      providerCode: row.providerCode,
      redirectUri: row.redirectUri,
      ...(row.codeVerifier ? { codeVerifier: row.codeVerifier } : {}),
      expiresAt: row.expiresAt,
    };
  }

  async deleteExpired(): Promise<number> {
    const now = new Date();
    const deleted = await this.db
      .delete(oauthStates)
      .where(lt(oauthStates.expiresAt, now))
      .returning({ id: oauthStates.id });
    return deleted.length;
  }
}
