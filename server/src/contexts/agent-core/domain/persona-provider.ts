import type { GuardrailRule } from './agent-definition.js';
import type { IInstanceLookupPort, IAgentDefinitionPort } from './assembly-provider.js';

/**
 * PersonaProvider — Agent 人设与拒答召回(#1)。
 *
 * 复刻 RagContextProvider/AssemblyProvider 模式:
 *   - port 接口解耦(IInstanceLookupPort/IAgentDefinitionPort,复用 assembly 已定义,守 §1.3)
 *   - setter 延后注入(bootstrap 中 repo 晚于 AgentHarness 实例化)
 *   - 容错不抛(任何失败返回 NO_PERSONA,不阻断主链路)
 *
 * 流程: instanceId → getAgentDefinitionId → AgentDefinition.getById → spec.persona。
 * 旧实例未关联 CRD 或 persona 全空(systemPrompt 空 + guardrails 空) → NO_PERSONA(兼容)。
 *
 * 与 AssemblyProvider 语义正交(§12 信号2):assembly 组装 tools/skills,persona 召回人设/拒答,
 * 各自查 instance→agentDefinition 链路,不合并(避免单 provider 膨胀)。
 */
export interface PersonaResult {
  /** 人设 system prompt(软约束,注入 worker prompt;空则不注入) */
  systemPrompt: string;
  /** 拒答规则(硬约束;空则不拦截) */
  guardrails: GuardrailRule[];
  /** 命中拒答时的回复话术(空则用调用方默认) */
  refusalResponse: string;
  /** 是否有有效人设(全空=false,调用方据此决定是否注入/拦截) */
  hasPersona: boolean;
}

const NO_PERSONA: PersonaResult = {
  systemPrompt: '',
  guardrails: [],
  refusalResponse: '',
  hasPersona: false,
};

export interface IPersonaProvider {
  /** 召回人设与拒答规则。失败/未配置返回 NO_PERSONA,绝不抛错。 */
  getPersona(instanceId: string): Promise<PersonaResult>;
}

export class PersonaProvider implements IPersonaProvider {
  constructor(
    private readonly instanceLookup: IInstanceLookupPort | null,
    private readonly agentDefinitionPort: IAgentDefinitionPort | null,
    private readonly logger: { warn: (msg: string) => void }
  ) {}

  async getPersona(instanceId: string): Promise<PersonaResult> {
    if (!this.instanceLookup || !this.agentDefinitionPort || !instanceId) {
      return NO_PERSONA;
    }
    try {
      const agentDefinitionId = await this.instanceLookup.getAgentDefinitionId(instanceId);
      if (!agentDefinitionId) return NO_PERSONA;
      const def = await this.agentDefinitionPort.getById(agentDefinitionId);
      if (!def) {
        this.logger.warn(`persona: agent definition not found: ${agentDefinitionId}`);
        return NO_PERSONA;
      }
      const persona = def.spec.persona;
      const hasPersona =
        (persona.systemPrompt && persona.systemPrompt.length > 0) ||
        (persona.guardrails && persona.guardrails.length > 0);
      if (!hasPersona) return NO_PERSONA;
      return {
        systemPrompt: persona.systemPrompt ?? '',
        guardrails: persona.guardrails ?? [],
        refusalResponse: persona.refusalResponse ?? '',
        hasPersona: true,
      };
    } catch (err) {
      this.logger.warn(
        `persona recall failed: ${err instanceof Error ? err.message : String(err)}`
      );
      return NO_PERSONA;
    }
  }
}
