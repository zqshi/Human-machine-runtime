/**
 * AgentJobHandler —— agent 类型任务：委托 AgentInvoker 主动触发数字员工执行
 */

import type { JobHandler, JobExecutionContext, JobResult } from '../domain/job-handler.js';
import type { AgentInvoker } from '../agent-invoker.js';

export class AgentJobHandler implements JobHandler {
  readonly type = 'agent' as const;

  constructor(private invoker: AgentInvoker) {}

  async run(ctx: JobExecutionContext): Promise<JobResult> {
    const instanceId = ctx.jobPayload.instanceId as string | undefined;
    const prompt = ctx.jobPayload.prompt as string | undefined;
    if (!instanceId || !prompt) {
      throw new Error('agent jobPayload 缺少 instanceId 或 prompt');
    }
    const out = await this.invoker.invoke({
      instanceId,
      prompt,
      sessionId: ctx.jobPayload.sessionId as string | undefined,
      modelId: ctx.jobPayload.modelId as string | undefined,
    });
    return {
      conclusion: out.conclusion,
      outputPayload: out.outputPayload,
      metadata: out.metadata,
    };
  }
}
