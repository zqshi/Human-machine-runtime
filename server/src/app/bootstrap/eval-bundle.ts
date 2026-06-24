/**
 * Eval 评测依赖组装。
 *
 * 从 `bootstrap.ts` 拆出:EvalBenchmarkRepository / EvalEvaluatorRepository(持久化)
 * + EvalAgentInvoker(v1.7 真实 Agent 执行,litellm + toolMgmt + toolDefRepo 多轮工具循环)
 * + EvalService(编排)。toolMgmt / litellmClient 早实例化,此处注入。
 */
import { Database } from '../../db/client.js';
import { EvalBenchmarkRepository } from '../../db/repositories/eval-benchmark-repository.js';
import { EvalEvaluatorRepository } from '../../db/repositories/eval-evaluator-repository.js';
import { EvalService } from '../../contexts/eval-benchmark/eval-service.js';
import { EvalAgentInvoker } from './eval-agent-invoker.js';
import { ToolDefinitionRepository } from '../../db/repositories/tool-registry-repository.js';
import type { LiteLLMClient } from '../../contexts/gateway/clients/litellm-client.js';
import type { ToolManagementService } from '../../contexts/tool-management/tool-management-service.js';

export interface EvalBundle {
  evalService: EvalService;
  evalBenchmarkRepo: EvalBenchmarkRepository;
  evalEvaluatorRepo: EvalEvaluatorRepository;
}

export function buildEvalBundle(
  db: Database,
  litellmClient: LiteLLMClient,
  toolManagementService: ToolManagementService
): EvalBundle {
  const evalBenchmarkRepo = new EvalBenchmarkRepository(db);
  const evalEvaluatorRepo = new EvalEvaluatorRepository(db);
  const evalAgentPort = new EvalAgentInvoker(
    litellmClient,
    toolManagementService,
    new ToolDefinitionRepository(db)
  );
  const evalService = new EvalService(
    evalBenchmarkRepo,
    evalEvaluatorRepo,
    litellmClient,
    evalAgentPort
  );
  return { evalService, evalBenchmarkRepo, evalEvaluatorRepo };
}
