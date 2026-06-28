import type { GuardrailRule } from './agent-definition.js';

/**
 * RuntimeManifest — 编译固化产物(v2.0 Layer 2)。
 *
 * AgentDefinition 发布时经 BakingService.bake() 固化为不可变 manifest,运行时 harness 读 manifest
 * 拿声明态产物(systemPrompt/guardrails/tools/skills/quota/route),不再每次 dispatch 动态查 DB
 * 拼装(消除运行时漂移 + DB 查询开销 + 线上 Agent 行为不可锁定问题,见设计文档 §0)。
 *
 * 边界原则(设计文档 §1):声明态产物 = 固化(本 manifest,不可变);运行时上下文 = 动态组装
 * (凭证/session/实时配额/输入,每次 dispatch 实时,不固化)。两者正交。
 *
 * 纯逻辑(domain,零外部依赖):sealManifest 不可变保证 + status 流转校验。
 */

/** 固化的工具定义(含 worker 路径 externalTools 所需的完整字段,与 AssemblyResult.externalTools 同构) */
export interface CompiledTool {
  toolId: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/**
 * Sandbox 执行后端策略(bake 时从 sandboxTemplate 固化,运行时 SandboxRouter 据此路由)。
 * - 'opensandbox' / 'node-fs':当前可用后端
 * - 'cubesandbox':KVM MicroVM,留 v2.0 C8(本批不实现,仅枚举占位)
 */
export type SandboxStrategy = 'opensandbox' | 'cubesandbox' | 'node-fs';

/** Manifest status 状态机:pending(固化中占位)→ baked(固化完成只读)| failed(固化失败)。 */
export type ManifestStatus = 'pending' | 'baked' | 'failed' | 'expired';

/** 允许的 status 流转(设计文档 §3.2:baked 后只允许 status 变更,manifest 字段不可变) */
const ALLOWED_TRANSITIONS: Record<ManifestStatus, ManifestStatus[]> = {
  pending: ['baked', 'failed'],
  baked: ['expired'],
  failed: ['pending'],
  expired: [],
};

/** RuntimeManifest 固化产物(设计文档 §3.1) */
export interface RuntimeManifest {
  /** 元信息 */
  id: string;
  agentDefinitionId: string;
  generation: number;
  bakedAt: number;
  status: ManifestStatus;
  /** 声明态固化产物(运行时直接读,不再查 DB) */
  compiledSystemPrompt: string;
  compiledGuardrails: GuardrailRule[];
  compiledTools: CompiledTool[];
  compiledSkillsContext: string;
  /**
   * 配额快照(resourceLimits + modelConfig 的不可变快照)。
   * 用 jsonb 兼容结构(不跨 context import tenant-instance 的 ResourceConfig,守 §1.1 domain 零外部依赖)。
   * 运行时实时配额检查仍动态(当前余量),本字段是声明态配额固化(上限/模型配比)。
   */
  compiledQuota: Record<string, unknown>;
  /** 命中拒答时的回复话术(从 persona.refusalResponse 固化) */
  refusalResponse: string;
  /** 运行时路由(从 runtime.runtimeType 映射的 adapter framework,复用 runtime-registry.mapRuntimeType) */
  runtimeRoute: string;
  /** 沙箱执行后端策略(从 sandboxTemplate 映射) */
  sandboxStrategy: SandboxStrategy;
  /** failed 时的错误原因(仅 status=failed 有值) */
  errorMsg: string | null;
}

/** 待固化的 manifest 字段(bake 流程中填充,seal 前可写) */
export type ManifestDraft = Omit<RuntimeManifest, never> & { status: ManifestStatus };

/**
 * sealManifest — 固化 manifest 为不可变对象(bake 完成时调用)。
 * 递归 Object.freeze,固化后任何字段写入静默失败(strict mode 抛错)。
 * 返回原引用(Object.freeze 原地冻结)。
 */
export function sealManifest(manifest: ManifestDraft): RuntimeManifest {
  deepFreeze(manifest.compiledTools);
  deepFreeze(manifest.compiledGuardrails);
  deepFreeze(manifest.compiledQuota);
  return Object.freeze(manifest) as RuntimeManifest;
}

/** 校验 status 流转是否合法(设计文档 §3.2:只允许 status 变更,manifest 字段不可变) */
export function canTransition(from: ManifestStatus, to: ManifestStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/** 递归冻结(freeze 不深冻嵌套对象,需手动递归 compiledTools/compiledGuardrails/compiledQuota) */
function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) deepFreeze(item);
  } else {
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  Object.freeze(value);
}
