/**
 * 审计 port(守 §1.3,agent-core 不依赖 audit-observability context)。
 *
 * AgentDefinitionService 通过此 port 留痕,不直接 import AuditService(原 T47 跨聚合违规)。
 * 仿 assembly-provider.ts 的 port 模式,bootstrap 由 audit-observability 适配注入
 * (adaptAuditPort,见 app/bootstrap.ts)。
 *
 * 仅暴露 AgentDefinitionService 用到的 log(action, payload, { actor }) 子集;
 * AuditService.log 的完整签名(requestId/traceId/...)更宽,适配层直接转发兼容。
 */
export interface IAuditPort {
  log(
    type: string,
    payload: Record<string, unknown>,
    metadata?: { actor?: { username: string; role: string } }
  ): Promise<void>;
}
