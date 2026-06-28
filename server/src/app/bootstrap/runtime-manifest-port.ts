/**
 * RuntimeManifestPort 装配(v2.0 Layer 3)。
 *
 * 把 InstanceRepository + RuntimeManifestRepository 适配成 agent-core domain 的
 * IRuntimeManifestPort,注入 harness(setRuntimeManifestPort)。
 *
 * instance → manifest 链路(设计文档 §5.1):
 *   instanceId → InstanceRepository.findById(agentDefinitionId + agentGeneration)
 *   → RuntimeManifestRepository.findBakedManifest(defId, generation)
 *   → status=baked 返 RuntimeManifest,否则 null(harness 走降级老路径)
 *
 * 仿 adaptInstanceLookup(assembly-provider.ts)模式。
 */
import type { IRuntimeManifestPort } from '../../contexts/agent-core/domain/runtime-manifest-port.js';
import type { InstanceRepository } from '../../db/repositories/instance-repository.js';
import type { RuntimeManifestRepository } from '../../db/repositories/runtime-manifest-repository.js';
import { logger } from '../logger.js';

export function adaptRuntimeManifestPort(
  instanceRepo: InstanceRepository,
  manifestRepo: RuntimeManifestRepository
): IRuntimeManifestPort {
  return {
    async getManifest(instanceId) {
      try {
        const inst = await instanceRepo.findById(instanceId);
        if (!inst?.agentDefinitionId || inst.agentGeneration == null) {
          return null; // 实例未关联 AgentDefinition 或无 generation,走降级
        }
        return manifestRepo.findBakedManifest(inst.agentDefinitionId, inst.agentGeneration);
      } catch (err) {
        logger.warn(
          `runtimeManifestPort.getManifest failed: ${instanceId} ${err instanceof Error ? err.message : String(err)}`
        );
        return null; // 容错不抛,走降级(同 assembly-provider/personaProvider 模式)
      }
    },
  };
}
