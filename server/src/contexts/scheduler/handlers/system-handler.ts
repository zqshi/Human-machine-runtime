/**
 * SystemJobHandler —— system 类型任务分发器
 *
 * 按 jobPayload.handlerKey 路由到注册的系统作业函数。
 * - echo：内置，调度链路自检。
 * - trace-cleanup：清理过期 ai_traces（依赖 AiGatewayRepository.deleteTracesBefore）。
 * 其余 handlerKey（如未注册）返回「未知系统作业」结论，不抛错（避免任务整体 failed）。
 */

import type { JobHandler, JobExecutionContext, JobResult } from '../domain/job-handler.js';
import type { AiGatewayRepository } from '../../../db/repositories/ai-gateway-repository.js';

export type SystemJobFn = (params: Record<string, unknown>) => Promise<JobResult>;

export class SystemJobHandler implements JobHandler {
  readonly type = 'system' as const;
  private jobs = new Map<string, SystemJobFn>();

  constructor() {
    // 内置：调度链路自检
    this.register('echo', async (params) => ({
      conclusion: `echo: ${JSON.stringify(params)}`,
      outputPayload: { echoed: params },
    }));
  }

  register(handlerKey: string, fn: SystemJobFn): void {
    this.jobs.set(handlerKey, fn);
  }

  /** 供外部查询已注册的 handlerKey（未来可用于前端选项同步） */
  listKeys(): string[] {
    return Array.from(this.jobs.keys());
  }

  async run(ctx: JobExecutionContext): Promise<JobResult> {
    const handlerKey = (ctx.jobPayload.handlerKey as string) ?? '';
    // payload 顶层字段（除 handlerKey）即为作业参数；兼容旧 {params:{}} 结构
    const params: Record<string, unknown> = { ...ctx.jobPayload };
    delete params.handlerKey;
    if (params.params && typeof params.params === 'object') {
      Object.assign(params, (params.params as Record<string, unknown>) ?? {});
      delete params.params;
    }
    const fn = this.jobs.get(handlerKey);
    if (!fn) {
      return {
        conclusion: `未知系统作业: ${handlerKey}`,
        outputPayload: { handlerKey, unknown: true },
        metadata: { warning: 'no registered handler for key' },
      };
    }
    return fn(params);
  }
}

/** 注册 trace-cleanup 作业（删除超过 N 天的 ai_traces） */
export function registerTraceCleanup(handler: SystemJobHandler, repo: AiGatewayRepository): void {
  handler.register('trace-cleanup', async (params) => {
    const days = Number(params.olderThanDays ?? 90);
    const before = new Date(Date.now() - days * 86400_000);
    const deleted = await repo.deleteTracesBefore(before);
    return {
      conclusion: `已清理 ${deleted} 条创建于 ${before.toISOString().slice(0, 10)} 之前的调用追踪`,
      outputPayload: { deleted, olderThanDays: days, before: before.toISOString() },
      metadata: { deleted },
    };
  });
}
