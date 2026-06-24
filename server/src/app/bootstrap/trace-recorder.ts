/**
 * trace 记录器装配(v1.6)。
 *
 * 把 AiGatewayRepository 适配成 agent-core domain 的 ITraceRecorder port。
 * insertSpan 填 insertTrace 的必填占位字段(sessionId/requestId/requestedModel/tokens 等,
 * agent 编排 span 非 LLM 调用,这些字段用占位值)。
 *
 * 从 bootstrap.ts 拆出(模式同 rag-provider / assembly-provider)。
 */
import { logger } from '../logger.js';
import type {
  ITraceRecorder,
  DistributedTraceInput,
  SpanWriteData,
  DistributedTraceUpdate,
} from '../../contexts/agent-core/domain/trace-recorder.js';
import type { AiGatewayRepository } from '../../db/repositories/ai-gateway-repository.js';

export function buildTraceRecorder(repo: AiGatewayRepository): ITraceRecorder {
  return {
    async insertDistributedTrace(data: DistributedTraceInput): Promise<void> {
      try {
        await repo.insertDistributedTrace(data);
      } catch (err) {
        logger.warn(
          { err: String(err), traceId: data.traceId },
          'trace insertDistributedTrace failed'
        );
      }
    },

    async insertSpan(data: SpanWriteData): Promise<void> {
      try {
        await repo.insertTrace({
          // span 自身 id(distTraceId 关联根,spanId 作 ai_traces.traceId 主键)
          traceId: data.spanId,
          distTraceId: data.distTraceId,
          parentSpanId: data.parentSpanId,
          operationName: data.operationName,
          spanKind: data.spanKind,
          startTime: data.startTime,
          // 必填占位(agent 编排 span 非 LLM 调用,无 session/request/model/tokens 语义)
          sessionId: (data.metadata?.sessionId as string) ?? 'agent-orchestration',
          requestId: (data.metadata?.taskId as string) ?? data.spanId,
          requestedModel: 'n/a',
          status: data.status,
          promptTokens: 0,
          completionTokens: 0,
          latencyMs: data.latencyMs,
          metadata: data.metadata,
        });
      } catch (err) {
        logger.warn({ err: String(err), spanId: data.spanId }, 'trace insertSpan failed');
      }
    },

    async updateDistributedTrace(traceId: string, patch: DistributedTraceUpdate): Promise<void> {
      try {
        await repo.updateDistributedTrace(traceId, patch);
      } catch (err) {
        logger.warn({ err: String(err), traceId }, 'trace updateDistributedTrace failed');
      }
    },
  };
}
