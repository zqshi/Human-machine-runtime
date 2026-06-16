/**
 * JobHandlerRegistry —— jobType → JobHandler 的注册与解析
 *
 * 启动时注册内置 handler（agent / system），未来扩展只 register 新 handler。
 */

import type { JobHandler, JobType } from './domain/job-handler.js';

export class JobHandlerRegistry {
  private handlers = new Map<JobType, JobHandler>();

  register(handler: JobHandler): void {
    this.handlers.set(handler.type, handler);
  }

  resolve(type: JobType): JobHandler {
    const handler = this.handlers.get(type);
    if (!handler) {
      throw new Error(`No job handler registered for type: ${type}`);
    }
    return handler;
  }

  has(type: JobType): boolean {
    return this.handlers.has(type);
  }
}
