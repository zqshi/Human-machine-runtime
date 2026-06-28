import type { RuntimeManifest } from './runtime-manifest.js';

/**
 * IRuntimeManifestPort — 运行时读固化 manifest 的 port(v2.0 Layer 3)。
 *
 * 仿 IInstanceLookupPort(assembly-provider.ts:13)模式:消费方(harness)定义 port,
 * bootstrap 适配注入(由被依赖方 context 适配),守 §1.3 跨聚合纪律(同 T47 端口模式)。
 *
 * harness dispatchTask 优先 getManifest(instanceId):有 baked manifest → 用固化产物(跳过
 * assemble+getPersona);无 → 降级老路径(灰度兼容,设计文档 §5.2)。
 *
 * 实现(instance → manifest 链路,bootstrap 适配):
 *   instanceId → InstanceRepository.findById(agentDefinitionId + agentGeneration)
 *   → RuntimeManifestRepository.findBakedManifest(defId, generation)
 *   → 返回 RuntimeManifest(status=baked 才返,否则 null 走降级)
 */
export interface IRuntimeManifestPort {
  getManifest(instanceId: string): Promise<RuntimeManifest | null>;
}
