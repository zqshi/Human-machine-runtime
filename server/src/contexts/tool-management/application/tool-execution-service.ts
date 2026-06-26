/**
 * ToolExecutionService — 工具执行代理 + 调用日志 + 调用计数。
 *
 * 从 ToolManagementService 拆出(委托模式,T45)。public 接口不变,
 * ToolManagementService 委托本 service。
 *
 * 凭证解密经共享 helper resolveCredential(credential-resolver.ts)。
 */
import { newId } from '../../../shared/utils.js';
import type {
  ToolDefinitionRepository,
  ToolSourceRepository,
  ToolCallLogRepository,
} from '../../../db/repositories/tool-registry-repository.js';
import type {
  ExecutionContext,
  ExecutionType,
  DecryptedCredential,
  CredentialSecretProvider,
} from '../types.js';
import { getExecutor } from '../executors/executor-factory.js';
import { resolveCredential } from './credential-resolver.js';
import type { ToolInvocationResult } from '../tool-registry.js';

export class ToolExecutionService {
  constructor(
    private definitionRepo: ToolDefinitionRepository,
    private sourceRepo: ToolSourceRepository,
    private callLogRepo: ToolCallLogRepository,
    private credentialSecretProvider: CredentialSecretProvider
  ) {}

  async executeTool(
    definitionId: string,
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolInvocationResult> {
    const definition = await this.definitionRepo.findById(definitionId);
    if (!definition) {
      return { success: false, error: 'tool definition not found', durationMs: 0, logId: '' };
    }

    if (!definition.enabled) {
      return { success: false, error: 'tool is disabled', durationMs: 0, logId: '' };
    }

    const executor = getExecutor(definition.executionType as ExecutionType);

    // 解密凭证(如有):definition.sourceId → source.credentialId → 端口解密。
    // 无 source 或 source 无 credentialId(如 openapi/mcp_native)时 credential=undefined,不影响无凭证工具。
    let credential: DecryptedCredential | undefined = undefined;
    if (definition.sourceId) {
      const source = await this.sourceRepo.findById(definition.sourceId);
      if (source?.credentialId) {
        credential = await resolveCredential(this.credentialSecretProvider, source.credentialId);
      }
    }

    const result = await executor.execute(
      definition.executionConfig as Record<string, unknown>,
      params,
      credential
    );

    // 记录调用日志（logId 回传给调用方，便于全链路追踪）
    const logId = newId('tclog');
    await this.callLogRepo.create({
      id: logId,
      definitionId,
      instanceId: context.instanceId ?? null,
      tenantId: context.tenantId,
      callerId: context.callerId ?? null,
      inputParams: params,
      outputResult: result.data ? (result.data as Record<string, unknown>) : null,
      durationMs: result.durationMs,
      status: result.success ? 'success' : 'error',
      errorMessage: result.error ?? null,
    });

    // 更新调用计数
    await this.definitionRepo.incrementCallCount(definitionId);

    return { ...result, logId };
  }
}
