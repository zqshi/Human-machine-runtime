import { newId } from '../../../shared/utils.js';
import type {
  IAgentDefinitionPort,
  IBoundToolsPort,
  IContentStorePort,
} from '../domain/assembly-provider.js';
import { assembleTools, assembleSkills } from '../domain/assembly-provider.js';
import { RuntimeRegistry } from '../domain/runtime-registry.js';
import type { AgentFramework } from '../sandbox/agent-runtime-adapter.js';
import {
  sealManifest,
  type SandboxStrategy,
  type ManifestDraft,
} from '../domain/runtime-manifest.js';
import type { RuntimeManifestRepository } from '../../../db/repositories/runtime-manifest-repository.js';

/**
 * BakingService — 编译固化编排(v2.0 Layer 2 application)。
 *
 * bake(agentDefinitionId, generation) 流程(设计文档 §3.3):
 * 1. 取 AgentDefinition(spec) — 经 IAgentDefinitionPort.getById
 * 2. 落 manifest status=pending(占位,防并发重复 bake)
 * 3. 复用 assembleTools/assembleSkills(C4 提纯纯函数)解析 boundTools/boundSkills
 *    + 取 persona.systemPrompt/guardrails(IPersonaProvider 复用 instance→def 链路,或直接 spec.persona)
 *    + 快照 quota(resourceLimits + modelConfig)+ 计算 runtimeRoute/sandboxStrategy
 * 4. sealManifest(固化)→ 落 DB status=baked
 * 5. 任一步失败 → status=failed + errorMsg(不污染 baked manifest)
 *
 * 复用而非重发明(§9.7):assembleTools/assembleSkills 与运行时 AssemblyProvider 共用同一份解析逻辑。
 * runtimeRoute 复用 RuntimeRegistry.mapRuntimeType。persona 经 IPersonaProvider 复用既有召回。
 *
 * 同步:首版 in-process 同步固化,返回终态(baked|failed),调用方无需轮询。
 * 规模大时再迁 scheduler 异步队列(远期方向不变)。
 */

/** bake 输入 */
export interface BakeRequest {
  agentDefinitionId: string;
  generation: number;
  /** 租户隔离(跨租户工具校验用,与 assembleTools 一致) */
  tenantId: string;
}

/** bake 输出 */
export interface BakeResult {
  manifestId: string;
  status: 'baked' | 'failed';
  errorMsg: string | null;
}

/** sandboxTemplate → SandboxStrategy 映射(bake 时固化,运行时 SandboxRouter 据此路由) */
function mapSandboxStrategy(sandboxTemplate: string): SandboxStrategy {
  // kvm-microvm → cubesandbox(C8 后实现,本批仅枚举占位);其余 → opensandbox(当前默认)
  if (sandboxTemplate === 'kvm-microvm') return 'cubesandbox';
  return 'opensandbox';
}

export class BakingService {
  constructor(
    private readonly agentDefinitionPort: IAgentDefinitionPort | null,
    private readonly boundToolsPort: IBoundToolsPort | null,
    private readonly contentStorePort: IContentStorePort | null,
    private readonly manifestRepo: RuntimeManifestRepository,
    private readonly runtimeRegistry: RuntimeRegistry,
    private readonly logger: { warn: (msg: string) => void; error: (msg: string) => void }
  ) {}

  /**
   * bake 一个 manifest(同步固化,返回终态 baked|failed)。失败不抛(落 status=failed),
   * 除非 manifest 已 baked(占位冲突)。
   */
  async bake(req: BakeRequest): Promise<BakeResult> {
    const manifestId = newId('rman');

    // 2. 落 pending 占位(防并发重复 bake;已 baked 抛错)
    try {
      await this.manifestRepo.upsertPending(manifestId, req.agentDefinitionId, req.generation);
    } catch (err) {
      // 已 baked:返回现有状态,不重建
      return {
        manifestId,
        status: 'failed',
        errorMsg: err instanceof Error ? err.message : String(err),
      };
    }

    // 同步固化:bake 是低频管理操作,assemble/persona 均本地 DB 查询(百毫秒级),
    // 同步返回终态(baked|failed)比异步轮询简单,且无 pending 卡死风险(server 重启 pending 永卡)。
    // 规模大时再迁 scheduler 异步队列(远期方向不变)。
    return this.doBake(manifestId, req);
  }

  /** 实际固化逻辑(同步执行,返回终态 baked|failed,失败落 status=failed)。 */
  private async doBake(manifestId: string, req: BakeRequest): Promise<BakeResult> {
    try {
      // 1. 取 AgentDefinition
      if (!this.agentDefinitionPort) {
        await this.manifestRepo.saveFailed(manifestId, 'agentDefinitionPort not configured');
        return { manifestId, status: 'failed', errorMsg: 'agentDefinitionPort not configured' };
      }
      const def = await this.agentDefinitionPort.getById(req.agentDefinitionId);
      if (!def) {
        const errorMsg = `agent definition not found: ${req.agentDefinitionId}`;
        await this.manifestRepo.saveFailed(manifestId, errorMsg);
        return { manifestId, status: 'failed', errorMsg };
      }

      const spec = def.spec;
      const boundTools = spec.boundTools ?? [];
      const boundSkills = spec.boundSkills ?? [];

      // 3. 复用纯函数解析 tools + skills(并行)
      const [toolsResult, skillsResult] = await Promise.all([
        assembleTools(req.tenantId, boundTools, this.boundToolsPort, this.logger).catch(() => ({
          allowedTools: undefined,
          externalTools: undefined,
          bound: boundTools.length,
          resolved: 0,
          skipped: boundTools.length,
        })),
        assembleSkills(boundSkills, this.contentStorePort, this.logger).catch(() => ({
          skillsContext: undefined,
          bound: boundSkills.length,
          resolved: 0,
          skipped: boundSkills.length,
        })),
      ]);

      // persona:声明态固化(spec.persona 直接快照)。
      // personaProvider 是运行时 instance→persona 召回(含动态 guardrails),bake 在 def 维度无 instance,
      // 用声明态 spec.persona 固化语义更准(发布时锁定,运行时不再动态查)。
      const persona = {
        systemPrompt: spec.persona.systemPrompt ?? '',
        guardrails: spec.persona.guardrails ?? [],
        refusalResponse: spec.persona.refusalResponse ?? '',
      };

      // runtimeRoute:复用 RuntimeRegistry.mapRuntimeType(声明态 runtimeType → adapter framework)
      const runtimeRoute: AgentFramework = this.runtimeRegistry.mapRuntimeType(
        spec.runtime.runtimeType
      );
      // sandboxStrategy:从 sandboxTemplate 映射
      const sandboxStrategy = mapSandboxStrategy(spec.sandboxTemplate);

      // 构建 manifest draft
      const draft: ManifestDraft = {
        id: manifestId,
        agentDefinitionId: req.agentDefinitionId,
        generation: req.generation,
        bakedAt: Date.now(),
        status: 'baked',
        compiledSystemPrompt: persona.systemPrompt,
        compiledGuardrails: persona.guardrails,
        compiledTools: toolsResult.externalTools ?? [],
        compiledSkillsContext: skillsResult.skillsContext ?? '',
        compiledQuota: {
          resourceLimits: spec.resourceLimits,
          modelConfig: spec.modelConfig,
        },
        refusalResponse: persona.refusalResponse,
        runtimeRoute,
        sandboxStrategy,
        errorMsg: null,
      };

      // 4. sealManifest(固化不可变)→ 落 DB status=baked
      const sealed = sealManifest(draft);
      await this.manifestRepo.saveBaked(manifestId, sealed);
      return { manifestId, status: 'baked', errorMsg: null };
    } catch (err) {
      // 5. 失败落 status=failed(不污染 baked manifest)
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`bake failed: ${manifestId} ${errorMsg}`);
      try {
        await this.manifestRepo.saveFailed(manifestId, errorMsg);
      } catch (saveErr) {
        this.logger.error(
          `saveFailed also failed: ${manifestId} ${saveErr instanceof Error ? saveErr.message : String(saveErr)}`
        );
      }
      return { manifestId, status: 'failed', errorMsg };
    }
  }
}
