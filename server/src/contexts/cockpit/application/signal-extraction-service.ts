/**
 * SignalExtractionService — ④dispatch trace→涌现信号自动提取（v2.1 EAOS 感知神经系统）。
 *
 * 设计文档 02-system-architecture.md：感知是神经系统，没它上面三层全断裂。
 * 当前涌现信号仅手动录入（C20 诚实化）；本服务从已持久化的 aiTraces/distributedTraces
 * 自动提取弱信号（非 LLM 编造，避免另一种假智能）。
 *
 * 弱信号源（trace-recorder 已写库，AiGatewayRepository 查询）：
 * - status='error'/'failed' 的 span（执行失败）
 * - 按 operationName 聚合反复失败（模式识别：同操作 N 次失败 = 涌现信号）
 * - severity 基于 count（2=medium, 3-4=high, 5+=critical）
 *
 * 去重：同 pattern 近时段已有信号则跳过（避免重复灌入）。
 * 触发：route POST /signals/emergent/extract 手动触发（定时调度留后续）。
 */
import type { AiGatewayRepository } from '../../../db/repositories/ai-gateway-repository.js';
import type { EmergentSignalRepository } from '../../../db/repositories/emergent-signal-repository.js';
import { EmergentSignal, type SignalSeverity } from '../domain/sensing/emergent-signal.js';
import type { EventBusPort } from './event-bus-port.js';

export interface ExtractionOptions {
  /** 回溯分钟数（默认 30） */
  sinceMinutes?: number;
  /** 同 operationName 失败次数达阈值才生成信号（默认 2，单次失败不告警） */
  failureThreshold?: number;
}

const DEFAULT_SINCE_MINUTES = 30;
const DEFAULT_FAILURE_THRESHOLD = 2;
const FAILURE_STATUSES = ['error', 'failed'];

export class SignalExtractionService {
  constructor(
    private aiGatewayRepo: AiGatewayRepository,
    private emergentSignalRepo: EmergentSignalRepository,
    private eventBus: EventBusPort
  ) {}

  /** 从近时段 dispatch trace 提取涌现信号。返回新生成的信号（已写库 + 发事件）。 */
  async extract(opts: ExtractionOptions = {}): Promise<EmergentSignal[]> {
    const sinceMinutes = opts.sinceMinutes ?? DEFAULT_SINCE_MINUTES;
    const threshold = opts.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
    const since = new Date(Date.now() - sinceMinutes * 60 * 1000);
    const dateFrom = since.toISOString();

    // 查近时段 error + failed trace（listTraces status 单值，查两次合并）
    const results = await Promise.all(
      FAILURE_STATUSES.map((status) =>
        this.aiGatewayRepo.listTraces({ status, dateFrom, limit: 200 })
      )
    );
    const failedTraces = results.flatMap((r) => r.items);

    if (failedTraces.length === 0) return [];

    // 按 operationName 聚合（反复失败 = 模式信号）
    const byOp = new Map<string, typeof failedTraces>();
    for (const trace of failedTraces) {
      const op = trace.operationName || 'unknown';
      const list = byOp.get(op);
      if (list) list.push(trace);
      else byOp.set(op, [trace]);
    }

    // 近时段已有信号（去重比对）
    const existing = await this.emergentSignalRepo.list({ limit: 100 });
    const existingPatterns = new Set(existing.map((s) => s.pattern));

    const signals: EmergentSignal[] = [];
    for (const [op, traces] of byOp) {
      if (traces.length < threshold) continue;
      const pattern = `操作「${op}」近 ${sinceMinutes} 分钟失败 ${traces.length} 次`;
      if (existingPatterns.has(pattern)) continue; // 去重

      const severity = this.severityForCount(traces.length);
      const sig = EmergentSignal.create({
        pattern,
        severity,
        suggestedAction: `检查「${op}」相关 Agent/工具配置（近 ${sinceMinutes} 分钟 ${traces.length} 次失败）`,
        correlatedSignalIds: traces.slice(0, 10).map((t) => t.traceId),
      });
      await this.emergentSignalRepo.save(sig);
      this.eventBus.publish('emergent-signal:detected', sig.toProps());
      signals.push(sig);
    }
    return signals;
  }

  private severityForCount(count: number): SignalSeverity {
    if (count >= 5) return 'critical';
    if (count >= 3) return 'high';
    return 'medium';
  }
}
