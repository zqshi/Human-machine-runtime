/**
 * oauth-state-cleanup:定期清理已过期的 oauth_states 记录。
 *
 * 由 SystemJobHandler 路由,handlerKey = 'oauth-state-cleanup'。
 * 调度器每 30 分钟跑一次(可在 scheduled_tasks 配置)。
 */

import type { IOAuthStateStore } from '../../identity-access/oauth-state-store.js';
import type { SystemJobHandler } from './system-handler.js';

export function registerOAuthStateCleanup(
  handler: SystemJobHandler,
  store: IOAuthStateStore
): void {
  handler.register('oauth-state-cleanup', async () => {
    const deleted = await store.deleteExpired();
    return {
      conclusion: `已清理 ${deleted} 条过期 oauth_states 记录`,
      outputPayload: { deleted },
      metadata: { deleted },
    };
  });
}
