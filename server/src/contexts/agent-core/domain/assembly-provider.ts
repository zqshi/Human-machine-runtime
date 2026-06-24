import type { AgentDefinition } from './agent-definition.js';

/**
 * 组装层(v1.4)— 按 Agent 定义自动组装 allowedTools + skillsContext。
 *
 * 与 D2 RagContextProvider 并存(方案 B):RAG 是检索召回 + LLM 判断,组装是声明态映射无判断。
 * 语义正交,合并违反 §12 信号 2。复刻 RagContextProvider 模式:port 接口解耦 + setter 延后注入 + 容错不抛。
 *
 * 边界严格限定 tools + skills 两维,sandboxTemplate 不纳入(v1.3 resources 通道已消费)。
 */

/** 实例→Agent 定义 关联查询 port(守 §1.3,agent-core 不依赖 tenant-instance context) */
export interface IInstanceLookupPort {
  getAgentDefinitionId(instanceId: string): Promise<string | null>;
}

/** Agent 定义查询 port */
export interface IAgentDefinitionPort {
  getById(id: string): Promise<AgentDefinition | null>;
}

/** 工具定义批查 port(返回 name/enabled/status/tenantId) */
export interface IBoundToolsPort {
  findByIds(
    ids: string[]
  ): Promise<
    Array<{ id: string; name: string; enabled: boolean; status: string; tenantId: string }>
  >;
}

/** skill 内容 store port */
export interface IContentStorePort {
  /** 批量查 skill 元数据 + content(组装 skillsContext) */
  getByIds(
    ids: string[]
  ): Promise<
    Array<{
      id: string;
      name: string;
      description: string;
      content: string | null;
      contentRef: string | null;
    }>
  >;
}

export interface AssemblyRequest {
  tenantId: string;
  instanceId?: string;
  prompt: string;
}

export interface AssemblyResult {
  /** 映射后的 SDK 工具名;undefined = 不覆盖(走 adapter 默认);空数组语义见下方陷阱 */
  allowedTools?: string[];
  /** skill 内容拼成的 <skills> 块内容;undefined = 无 skill */
  skillsContext?: string;
  sources: {
    tools: { bound: number; resolved: number; skipped: number };
    skills: { bound: number; resolved: number; skipped: number };
  };
  skipped: boolean;
  /** 全失效降级标记(boundTools 非空但无有效工具,运维感知) */
  degraded: boolean;
}

const NO_ASSEMBLY: AssemblyResult = {
  sources: {
    tools: { bound: 0, resolved: 0, skipped: 0 },
    skills: { bound: 0, resolved: 0, skipped: 0 },
  },
  skipped: true,
  degraded: false,
};

export interface IAssemblyProvider {
  /** 组装 allowedTools + skillsContext。失败/无绑定返回 skipped,绝不抛错。 */
  assemble(req: AssemblyRequest): Promise<AssemblyResult>;
}

/**
 * 组装器实现。
 *
 * 流程:instanceId → getAgentDefinitionId → AgentDefinition.getById → boundTools/boundSkills
 *   → 并行批查 tools + skills → 映射 + 兜底 → 组装 result。
 *
 * 空数组语义陷阱(最大风险):parseAllowedTools 对空数组返回全工具。
 *   - boundTools 本就空 → allowedTools = undefined(不覆盖,走默认)
 *   - boundTools 非空但全失效 → allowedTools = undefined + degraded=true(运维感知,不静默放开全工具)
 *   - boundTools 非空且至少一有效 → allowedTools = name[](SDK 只开放这些工具)
 */
export class AssemblyProvider implements IAssemblyProvider {
  constructor(
    private readonly instanceLookup: IInstanceLookupPort | null,
    private readonly agentDefinitionPort: IAgentDefinitionPort | null,
    private readonly boundToolsPort: IBoundToolsPort | null,
    private readonly contentStorePort: IContentStorePort | null,
    private readonly logger: { warn: (msg: string) => void }
  ) {}

  async assemble(req: AssemblyRequest): Promise<AssemblyResult> {
    if (!this.instanceLookup || !this.agentDefinitionPort) {
      return NO_ASSEMBLY;
    }
    if (!req.instanceId) {
      return NO_ASSEMBLY;
    }

    // instanceId → agentDefinitionId → AgentDefinition
    const agentDefinitionId = await this.instanceLookup
      .getAgentDefinitionId(req.instanceId)
      .catch(() => null);
    if (!agentDefinitionId) {
      return NO_ASSEMBLY; // 实例未关联定义,走默认
    }
    const def = await this.agentDefinitionPort.getById(agentDefinitionId).catch(() => null);
    if (!def) {
      this.logger.warn(`agent definition not found: ${agentDefinitionId}`);
      return NO_ASSEMBLY;
    }

    const boundTools = def.spec.boundTools ?? [];
    const boundSkills = def.spec.boundSkills ?? [];

    // 并行组装 tools + skills(各自容错)
    const [toolsResult, skillsResult] = await Promise.all([
      this.assembleTools(req, boundTools).catch(() => ({
        allowedTools: undefined,
        bound: boundTools.length,
        resolved: 0,
        skipped: boundTools.length,
      })),
      this.assembleSkills(boundSkills).catch(() => ({
        skillsContext: undefined,
        bound: boundSkills.length,
        resolved: 0,
        skipped: boundSkills.length,
      })),
    ]);

    // 空数组语义:boundTools 非空但全失效 → degraded
    const degraded = boundTools.length > 0 && toolsResult.resolved === 0;

    return {
      allowedTools: toolsResult.allowedTools,
      skillsContext: skillsResult.skillsContext,
      sources: {
        tools: {
          bound: toolsResult.bound,
          resolved: toolsResult.resolved,
          skipped: toolsResult.skipped,
        },
        skills: {
          bound: skillsResult.bound,
          resolved: skillsResult.resolved,
          skipped: skillsResult.skipped,
        },
      },
      skipped: false,
      degraded,
    };
  }

  private async assembleTools(
    req: AssemblyRequest,
    boundTools: string[]
  ): Promise<{
    allowedTools: string[] | undefined;
    bound: number;
    resolved: number;
    skipped: number;
  }> {
    if (boundTools.length === 0 || !this.boundToolsPort) {
      return { allowedTools: undefined, bound: boundTools.length, resolved: 0, skipped: 0 };
    }

    const rows = await this.boundToolsPort.findByIds(boundTools);
    const names = new Set<string>();
    let skipped = 0;
    for (const r of rows) {
      // 跨租户安全:防绑别租户工具
      if (r.tenantId !== req.tenantId) {
        skipped++;
        this.logger.warn(`tool ${r.id} tenant mismatch, skipped`);
        continue;
      }
      // 禁用/非 active 跳过
      if (!r.enabled || r.status !== 'active') {
        skipped++;
        this.logger.warn(`tool ${r.id} disabled/inactive, skipped`);
        continue;
      }
      names.add(r.name);
    }
    // 不存在的 id 也算 skipped
    skipped += boundTools.length - rows.length;

    // 空数组陷阱:resolved 为 0 → 返回 undefined(不覆盖,走默认),由 assemble 标 degraded
    return {
      allowedTools: names.size > 0 ? Array.from(names) : undefined,
      bound: boundTools.length,
      resolved: names.size,
      skipped,
    };
  }

  private async assembleSkills(boundSkills: string[]): Promise<{
    skillsContext: string | undefined;
    bound: number;
    resolved: number;
    skipped: number;
  }> {
    if (boundSkills.length === 0 || !this.contentStorePort) {
      return { skillsContext: undefined, bound: boundSkills.length, resolved: 0, skipped: 0 };
    }

    const rows = await this.contentStorePort.getByIds(boundSkills);
    const lines: string[] = [];
    let resolved = 0;
    let skipped = 0;
    for (const r of rows) {
      // content 优先,contentRef 次之(contentRef 若是 url 当前无解析器 → 跳过)
      const content = r.content ?? this.resolveContentRef(r.contentRef);
      if (!content) {
        skipped++;
        this.logger.warn(`skill ${r.id} no content, skipped`);
        continue;
      }
      resolved++;
      lines.push(`## ${r.name}\n${r.description}\n${content}`);
    }
    skipped += boundSkills.length - rows.length;

    return {
      skillsContext: lines.length > 0 ? lines.join('\n\n') : undefined,
      bound: boundSkills.length,
      resolved,
      skipped,
    };
  }

  /** contentRef 解析:当前仅支持纯文本 contentRef(直接当内容);url/path 暂不支持 → null */
  private resolveContentRef(contentRef: string | null): string | null {
    if (!contentRef) return null;
    // url/http 开头的不解析(无解析器)
    if (/^https?:\/\//i.test(contentRef) || /^\//.test(contentRef)) return null;
    // 纯文本 contentRef 当内容用(向后兼容历史数据)
    return contentRef;
  }
}
