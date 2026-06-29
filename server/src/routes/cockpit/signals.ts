import { Hono } from 'hono';
import type { SignalService } from '../../contexts/cockpit/application/signal-service.js';
import type {
  EmergentSignal,
  SignalSeverity,
  SignalStatus,
} from '../../contexts/cockpit/domain/sensing/emergent-signal.js';
import type { Pattern, PatternType } from '../../contexts/cockpit/domain/sensing/pattern.js';

/**
 * cockpit 感知子系统路由（v2.1 EAOS，route 下沉 application，守 §12信号6）。
 *
 * 薄层：参数提取 → 调 SignalService → 返回。业务逻辑（CRUD/状态机/聚合）在 service。
 * 前端 DTO 不变（emergent_signal/pattern 字段 camelCase + createdAt/updatedAt epoch ms）。
 */
function serializeSignal(sig: EmergentSignal) {
  const p = sig.toProps();
  return { ...p, createdAt: p.createdAt.getTime(), updatedAt: p.updatedAt.getTime() };
}

function serializePattern(p: Pattern) {
  const props = p.toProps();
  return { ...props, createdAt: props.createdAt.getTime() };
}

function parsePagedQuery(q: (k: string) => string | undefined) {
  const limit = q('limit');
  const offset = q('offset');
  return {
    limit: limit ? parseInt(limit, 10) : undefined,
    offset: offset ? parseInt(offset, 10) : undefined,
  };
}

export function createCockpitSignalRoutes(service: SignalService) {
  const app = new Hono();

  // signal（旧 EAV entityType，过渡保留，urgency filter + paged）
  app.get('/signals', async (c) => {
    const q = (k: string) => c.req.query(k);
    const { limit, offset } = parsePagedQuery(q);
    return c.json(await service.listSignals({ urgency: q('urgency'), limit, offset }));
  });

  // emergent signals（新实体表，paged，§7.2.1#2）
  app.get('/signals/emergent', async (c) => {
    const q = (k: string) => c.req.query(k);
    const { limit, offset } = parsePagedQuery(q);
    const result = await service.listEmergentPaged({
      severity: q('severity') as SignalSeverity | undefined,
      status: q('status') as SignalStatus | undefined,
      tenantId: q('tenantId'),
      limit,
      offset,
    });
    return c.json({
      items: result.items.map(serializeSignal),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  });

  app.post('/signals/emergent', async (c) => {
    const body = await c.req.json();
    const sig = await service.createEmergent(body);
    return c.json(serializeSignal(sig), 201);
  });

  // ④从 dispatch trace 自动提取涌现信号（感知神经系统，替代纯手动录入）
  app.post('/signals/emergent/extract', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as {
      sinceMinutes?: number;
      failureThreshold?: number;
    };
    const signals = await service.extractEmergentFromTrace(body);
    return c.json({ items: signals.map(serializeSignal), count: signals.length });
  });

  app.patch('/signals/emergent/:id', async (c) => {
    const patch = await c.req.json();
    const sig = await service.updateEmergent(c.req.param('id'), patch);
    if (!sig) return c.json({ error: 'signal not found' }, 404);
    return c.json(serializeSignal(sig));
  });

  // corrections/apply（E6 接 harness.dispatchTask 传播；当前 effective:false 诚实标注，守 C20）
  app.post('/corrections/apply', async (c) => {
    const body = await c.req.json<{ planId: string; actions: unknown[] }>();
    return c.json(await service.applyCorrections(body.planId ?? '', body.actions ?? []));
  });

  // patterns（新实体表，paged）
  app.get('/patterns', async (c) => {
    const q = (k: string) => c.req.query(k);
    const { limit, offset } = parsePagedQuery(q);
    const result = await service.listPatternsPaged({
      patternType: q('patternType') as PatternType | undefined,
      tenantId: q('tenantId'),
      limit,
      offset,
    });
    return c.json({
      items: result.items.map(serializePattern),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  });

  app.post('/patterns', async (c) => {
    const body = await c.req.json();
    const p = await service.createPattern(body);
    return c.json(serializePattern(p), 201);
  });

  return app;
}
