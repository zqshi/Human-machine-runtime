import type { Hono } from 'hono';
import { z } from 'zod';
import type { AiGatewayRepository } from '../../../db/repositories/ai-gateway-repository.js';
import { newId } from '../../../shared/utils.js';
import { parseBody, badRequest } from '../../../shared/validation.js';

const createRiskRuleSchema = z.object({
  ruleId: z.string().optional(),
  displayName: z.string().min(1).optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  pattern: z.string().optional(),
  ruleType: z.string().optional(),
  severity: z.string().optional(),
  priority: z.number().optional(),
  action: z.string().optional(),
  category: z.string().optional(),
  isEnabled: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

/**
 * 注册 AI Gateway 风控规则路由（资源域：risk-rules）。
 *
 * 含 CRUD + 启停 + 试配 + 导入导出。路径互不冲突，相对顺序不敏感。
 */
export function registerRiskRuleRoutes(app: Hono, repo: AiGatewayRepository): void {
  app.get('/risk-rules', async (c) => {
    const rules = await repo.listRiskRules();
    return c.json({ rules, rows: rules });
  });

  app.post('/risk-rules', async (c) => {
    const parsed = await parseBody(c, createRiskRuleSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const body = parsed.data;
    const ruleId = body.ruleId || newId('rule');
    const rule = await repo.createRiskRule({
      ruleId,
      displayName: body.displayName || body.name || '未命名规则',
      description: body.description,
      pattern: body.pattern || body.ruleType || 'keyword',
      severity: body.severity || body.priority?.toString() || 'medium',
      action: body.action || 'block',
      category: body.category,
      isEnabled: body.isEnabled ?? body.isActive ?? true,
      sortOrder: body.sortOrder ?? body.priority,
    });
    return c.json(rule, 201);
  });

  app.put('/risk-rules/:id', async (c) => {
    const ruleId = decodeURIComponent(c.req.param('id'));
    const parsed = await parseBody(c, createRiskRuleSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const rule = await repo.updateRiskRule(ruleId, parsed.data);
    if (!rule) return c.json({ error: 'rule not found' }, 404);
    return c.json(rule);
  });

  app.delete('/risk-rules/:id', async (c) => {
    const ruleId = decodeURIComponent(c.req.param('id'));
    const ok = await repo.deleteRiskRule(ruleId);
    return c.json({ success: ok });
  });

  app.post('/risk-rules/:id/toggle', async (c) => {
    const ruleId = decodeURIComponent(c.req.param('id'));
    const rule = await repo.toggleRiskRule(ruleId);
    if (!rule) return c.json({ error: 'rule not found' }, 404);
    return c.json({ success: true });
  });

  app.post('/risk-rules/test', async (c) => {
    const { text } = await c.req.json<{ text: string }>();
    const rules = await repo.listRiskRules();
    const hits = rules
      .filter((r) => r.isEnabled && text.includes(r.pattern))
      .map((r) => ({
        ruleId: r.ruleId,
        displayName: r.displayName,
        severity: r.severity,
        action: r.action,
      }));
    return c.json({ hits, tested: text.length });
  });

  app.get('/risk-rules/export', async (c) => {
    const rules = await repo.listRiskRules();
    return c.json({ rules });
  });

  app.post('/risk-rules/import', async (c) => {
    const { rules, mode } = await c.req.json<{
      rules: {
        displayName?: string;
        pattern?: string;
        severity?: string;
        action?: string;
        category?: string;
      }[];
      mode: string;
    }>();
    if (!Array.isArray(rules)) return c.json({ error: 'rules must be array' }, 400);

    let imported = 0;
    for (const r of rules) {
      if (!r.displayName || !r.pattern) continue;
      const ruleId = newId('rule');
      await repo.createRiskRule({
        ruleId,
        displayName: r.displayName,
        pattern: r.pattern,
        severity: r.severity || 'medium',
        action: r.action || 'block',
        category: r.category || 'imported',
        isEnabled: true,
      });
      imported++;
    }
    return c.json({ success: true, imported, mode });
  });
}
