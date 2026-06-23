/**
 * credential-vault 依赖组装。
 *
 * 从 `bootstrap.ts` 拆出:CredentialService(domain 加解密)+ LeaseService(domain lease 计算)
 * + CredentialRepository(adapters 持久化)+ CredentialManagementService(application 组合)。
 * 实例化集中在此,避免 bootstrap.ts 膨胀。
 */
import { config } from '../../config/index.js';
import { Database } from '../../db/client.js';
import { CredentialService } from '../../contexts/credential-vault/credential-service.js';
import { LeaseService } from '../../contexts/credential-vault/lease-service.js';
import { CredentialRepository } from '../../db/repositories/credential-repository.js';
import { CredentialManagementService } from '../../contexts/credential-vault/credential-management-service.js';

export interface CredentialBundle {
  credentialService: CredentialService;
  leaseService: LeaseService;
  credentialManagementService: CredentialManagementService;
}

export function buildCredentialBundle(db: Database): CredentialBundle {
  const credentialService = new CredentialService(config.credential.encryptionKey);
  const leaseService = new LeaseService(config.credential.leaseDefaultTtlSec);
  const credentialRepository = new CredentialRepository(db);
  const credentialManagementService = new CredentialManagementService(
    credentialRepository,
    credentialService,
    leaseService
  );
  return { credentialService, leaseService, credentialManagementService };
}
