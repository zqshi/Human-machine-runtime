/**
 * PersonaProvider 装配(v1.9,#1)。
 *
 * 复用 assembly-provider bundle 的 adaptInstanceLookup + adaptAgentDefinition
 * (同一 instance→agentDefinition 链路),注入 PersonaProvider。
 * 模式同 rag-provider.ts / assembly-provider.ts(port 适配 + logger)。
 */
import { logger } from '../logger.js';
import { PersonaProvider } from '../../contexts/agent-core/domain/persona-provider.js';
import type { IPersonaProvider } from '../../contexts/agent-core/domain/persona-provider.js';
import { adaptInstanceLookup, adaptAgentDefinition } from './assembly-provider.js';
import type { InstanceRepository } from '../../db/repositories/instance-repository.js';
import type { AgentDefinitionRepository } from '../../db/repositories/agent-definition-repository.js';

export function buildPersonaProvider(
  instanceRepo: InstanceRepository,
  agentDefinitionRepo: AgentDefinitionRepository
): IPersonaProvider {
  return new PersonaProvider(
    adaptInstanceLookup(instanceRepo),
    adaptAgentDefinition(agentDefinitionRepo),
    { warn: (msg) => logger.warn({ component: 'persona-provider' }, msg) }
  );
}
