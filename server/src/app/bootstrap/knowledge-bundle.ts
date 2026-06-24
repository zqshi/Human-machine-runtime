/**
 * Knowledge(WeKnora RAG)依赖组装。
 *
 * 从 `bootstrap.ts` 拆出:WeKnoraClient(条件启用)+ WkMappingRepository / KnowledgeBaseRepository
 * / KnowledgeEntryRepository(持久化)+ KnowledgeService(domain)+ TenantService(依赖 knowledgeService)。
 * config.weknora.enabled 关闭时 knowledgeService=null,TenantService 传 undefined。
 */
import { config } from '../../config/index.js';
import { Database } from '../../db/client.js';
import { encrypt, decrypt } from '../../contexts/credential-vault/crypto.js';
import { WeKnoraClient } from '../../contexts/gateway/clients/weknora-client.js';
import { WkMappingRepository } from '../../db/repositories/weknora-mapping-repository.js';
import { KnowledgeBaseRepository } from '../../db/repositories/knowledge-base-repository.js';
import { KnowledgeEntryRepository } from '../../db/repositories/knowledge-entry-repository.js';
import { KnowledgeService } from '../../contexts/knowledge/knowledge-service.js';
import { TenantService } from '../../contexts/tenant-management/tenant-service.js';
import type { TenantRepository } from '../../db/repositories/tenant-repository.js';

export interface KnowledgeBundle {
  knowledgeService: KnowledgeService | null;
  wkMappingRepo: WkMappingRepository;
  weKnoraClient: WeKnoraClient | null;
  tenantService: TenantService;
}

export function buildKnowledgeBundle(db: Database, tenantRepo: TenantRepository): KnowledgeBundle {
  const wkMappingRepo = new WkMappingRepository(db);
  const weKnoraClient = config.weknora.enabled ? new WeKnoraClient() : null;

  const wkEncryption = {
    encrypt: (s: string) => encrypt(s, config.weknora.encryptionKey),
    decrypt: (s: string) => decrypt(s, config.weknora.encryptionKey),
  };

  const kbRepo = new KnowledgeBaseRepository(db);
  const entryRepo = new KnowledgeEntryRepository(db);

  const knowledgeService = weKnoraClient
    ? new KnowledgeService({
        client: weKnoraClient,
        mappingRepo: wkMappingRepo,
        kbRepo,
        entryRepo,
        encryption: wkEncryption,
      })
    : null;

  const tenantService = new TenantService(tenantRepo, knowledgeService ?? undefined);

  return { knowledgeService, wkMappingRepo, weKnoraClient, tenantService };
}
