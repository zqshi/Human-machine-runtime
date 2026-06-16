import { sql, gte, lte, eq, and, desc } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import type { AiGatewayRepository } from '../../db/repositories/ai-gateway-repository.js';
import type { InstanceService } from '../tenant-instance/instance-service.js';
import { aiTraces, costRecords } from '../../db/schema/ai-gateway.js';

interface TimeSeriesResult {
  days: string[];
  values: number[];
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface UserAnalysisRow {
  userId: string;
  department: string;
  messages: number;
  tokens: number;
  estimatedCost: number;
}

interface Alert {
  level: string;
  message: string;
  timestamp: string;
}

export class AnalyticsService {
  constructor(
    private db: Database,
    private aiRepo: AiGatewayRepository,
    private instanceSvc: InstanceService
  ) {}

  async getHealthMetrics() {
    const instances = await this.instanceSvc.list();
    const running = instances.filter((i) => i.state === 'running').length;
    const total = instances.length;
    const score = total > 0 ? Math.round((running / total) * 100) : 100;
    const traceStats = await this.aiRepo.getTraceStats();

    return {
      score,
      metrics: [
        { label: '运行实例', value: `${running}/${total}`, status: running > 0 ? 'ok' : 'warn' },
        { label: '系统健康', value: `${score}%`, status: score >= 80 ? 'ok' : 'warn' },
        {
          label: 'AI 错误率',
          value: `${traceStats.errorRate.toFixed(1)}%`,
          status: traceStats.errorRate < 5 ? 'ok' : 'warn',
        },
        {
          label: 'AI 平均延迟',
          value: `${traceStats.avgLatency}ms`,
          status: traceStats.avgLatency < 3000 ? 'ok' : 'warn',
        },
      ],
    };
  }

  async getAgentPerformance() {
    const instances = await this.instanceSvc.list();
    const running = instances.filter((i) => i.state === 'running');
    const total = instances.length;
    const score = total > 0 ? Math.round((running.length / total) * 100) : 0;

    const topAgents = await Promise.all(
      running.slice(0, 10).map(async (inst) => {
        const [row] = await this.db
          .select({
            requests: sql<number>`count(*)::int`,
            avgLatency: sql<number>`coalesce(avg(latency_ms), 0)::int`,
          })
          .from(aiTraces)
          .where(eq(aiTraces.instanceId, inst.id));
        return {
          id: inst.id,
          name: inst.name,
          department: inst.department,
          requests: row?.requests ?? 0,
          avgLatency: row?.avgLatency ?? 0,
          state: inst.state,
        };
      })
    );

    topAgents.sort((a, b) => b.requests - a.requests);
    return { score, topAgents };
  }

  async getAlerts(): Promise<{ activeAlerts: number; alerts: Alert[] }> {
    const instances = await this.instanceSvc.list();
    const failed = instances.filter((i) => i.state === 'failed');
    const traceStats = await this.aiRepo.getTraceStats();

    const alerts: Alert[] = [];

    for (const inst of failed) {
      alerts.push({
        level: 'error',
        message: `实例 ${inst.name} 运行失败: ${inst.lastError || '未知错误'}`,
        timestamp: inst.updatedAt,
      });
    }

    if (traceStats.errorRate > 10) {
      alerts.push({
        level: 'warning',
        message: `AI 调用错误率 ${traceStats.errorRate.toFixed(1)}% 超过阈值`,
        timestamp: new Date().toISOString(),
      });
    }

    return { activeAlerts: alerts.length, alerts };
  }

  async getLogStats() {
    const stats = await this.aiRepo.getTraceStats();
    return {
      totalRequests24h: stats.totalCalls,
      avgLatency: stats.avgLatency,
      errorRate: stats.errorRate,
      totalTokens: stats.totalTokens,
    };
  }

  async getDauTrend(days: number, dateRange?: DateRange): Promise<TimeSeriesResult> {
    const { since, until, dayCount } = this.resolveDateParams(days, dateRange);

    const conditions = [gte(aiTraces.createdAt, since)];
    if (until) conditions.push(lte(aiTraces.createdAt, until));

    const rows = await this.db
      .select({
        day: sql<string>`date_trunc('day', created_at)::date::text`,
        count: sql<number>`count(distinct user_id)::int`,
      })
      .from(aiTraces)
      .where(and(...conditions))
      .groupBy(sql`date_trunc('day', created_at)`)
      .orderBy(sql`date_trunc('day', created_at)`);

    return this.buildTimeSeriesRange(rows, since, dayCount);
  }

  async getLatencyTrend(days: number): Promise<TimeSeriesResult> {
    const clamped = Math.min(90, Math.max(1, days));
    const since = new Date(Date.now() - clamped * 86_400_000);

    const rows = await this.db
      .select({
        day: sql<string>`date_trunc('day', created_at)::date::text`,
        count: sql<number>`coalesce(avg(latency_ms), 0)::int`,
      })
      .from(aiTraces)
      .where(gte(aiTraces.createdAt, since))
      .groupBy(sql`date_trunc('day', created_at)`)
      .orderBy(sql`date_trunc('day', created_at)`);

    return this.buildTimeSeries(rows, clamped);
  }

  async getMessagesTrend(days: number, dateRange?: DateRange): Promise<TimeSeriesResult> {
    const { since, until, dayCount } = this.resolveDateParams(days, dateRange);

    const conditions = [gte(aiTraces.createdAt, since)];
    if (until) conditions.push(lte(aiTraces.createdAt, until));

    const rows = await this.db
      .select({
        day: sql<string>`date_trunc('day', created_at)::date::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(aiTraces)
      .where(and(...conditions))
      .groupBy(sql`date_trunc('day', created_at)`)
      .orderBy(sql`date_trunc('day', created_at)`);

    return this.buildTimeSeriesRange(rows, since, dayCount);
  }

  async getRetentionTrend(days: number, dateRange?: DateRange): Promise<TimeSeriesResult> {
    const { since, until, dayCount } = this.resolveDateParams(days, dateRange);

    const conditions = [gte(aiTraces.createdAt, since)];
    if (until) conditions.push(lte(aiTraces.createdAt, until));

    const rows = await this.db
      .select({
        day: sql<string>`date_trunc('day', created_at)::date::text`,
        dau: sql<number>`count(distinct user_id)::int`,
      })
      .from(aiTraces)
      .where(and(...conditions))
      .groupBy(sql`date_trunc('day', created_at)`)
      .orderBy(sql`date_trunc('day', created_at)`);

    const dauMap = new Map(rows.map((r) => [r.day, r.dau]));
    const allDays: string[] = [];
    const values: number[] = [];
    let maxDau = 1;
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(since.getTime() + i * 86_400_000);
      const key = this.formatLocalDate(d);
      allDays.push(key);
      const dau = dauMap.get(key) ?? 0;
      if (dau > maxDau) maxDau = dau;
    }
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(since.getTime() + i * 86_400_000);
      const key = this.formatLocalDate(d);
      const dau = dauMap.get(key) ?? 0;
      values.push(maxDau > 0 ? Math.round((dau / maxDau) * 100) : 0);
    }

    return { days: allDays, values };
  }

  async getDeptTokens() {
    const instances = await this.instanceSvc.list();
    const deptInstanceMap = new Map<string, string[]>();
    for (const inst of instances) {
      const dept = inst.department || 'unknown';
      const ids = deptInstanceMap.get(dept) || [];
      ids.push(inst.id);
      deptInstanceMap.set(dept, ids);
    }

    const departments: { name: string; tokens: number }[] = [];
    for (const [dept, ids] of deptInstanceMap) {
      if (!ids.length) {
        departments.push({ name: dept, tokens: 0 });
        continue;
      }
      const placeholders = ids.map((id) => sql`${id}`);
      const [row] = await this.db
        .select({
          tokens: sql<number>`coalesce(sum(prompt_tokens + completion_tokens), 0)::int`,
        })
        .from(aiTraces)
        .where(sql`${aiTraces.instanceId} in (${sql.join(placeholders, sql`, `)})`);
      departments.push({ name: dept, tokens: row?.tokens ?? 0 });
    }

    departments.sort((a, b) => b.tokens - a.tokens);
    return { departments };
  }

  async getTopUsers(limit: number) {
    const clamped = Math.min(50, Math.max(1, limit));

    const rows = await this.db
      .select({
        userId: aiTraces.userId,
        messages: sql<number>`count(*)::int`,
        tokens: sql<number>`coalesce(sum(prompt_tokens + completion_tokens), 0)::int`,
      })
      .from(aiTraces)
      .where(sql`${aiTraces.userId} is not null`)
      .groupBy(aiTraces.userId)
      .orderBy(sql`count(*) desc`)
      .limit(clamped);

    const users = rows.map((r) => ({
      id: r.userId,
      name: r.userId,
      messages: r.messages,
      tokens: r.tokens,
    }));

    return { users };
  }

  async getTopUserSpend(limit: number) {
    const clamped = Math.min(50, Math.max(1, limit));

    const rows = await this.db
      .select({
        userId: costRecords.userId,
        count: sql<number>`count(*)::int`,
        totalTokens: sql<number>`(coalesce(sum(prompt_tokens),0)+coalesce(sum(completion_tokens),0))::int`,
        estimatedCost: sql<number>`coalesce(sum(cost_cny),0)::real`,
      })
      .from(costRecords)
      .where(sql`${costRecords.userId} is not null`)
      .groupBy(costRecords.userId)
      .orderBy(desc(sql`sum(cost_cny)`))
      .limit(clamped);

    return {
      users: rows.map((r) => ({
        userId: r.userId,
        count: r.count,
        totalTokens: r.totalTokens,
        estimatedCost: Math.round(r.estimatedCost * 100) / 100,
      })),
    };
  }

  async getLatencyPercentiles(days: number) {
    const clamped = Math.min(90, Math.max(1, days));
    const since = new Date(Date.now() - clamped * 86_400_000);

    const rows = await this.db
      .select({
        day: sql<string>`date_trunc('day', created_at)::date::text`,
        avg: sql<number>`coalesce(avg(latency_ms), 0)::int`,
        p50: sql<number>`coalesce(percentile_cont(0.5) within group (order by latency_ms), 0)::int`,
        p95: sql<number>`coalesce(percentile_cont(0.95) within group (order by latency_ms), 0)::int`,
      })
      .from(aiTraces)
      .where(gte(aiTraces.createdAt, since))
      .groupBy(sql`date_trunc('day', created_at)`)
      .orderBy(sql`date_trunc('day', created_at)`);

    const dayMap = new Map(rows.map((r) => [r.day, r]));
    const allDays: string[] = [];
    const avgValues: number[] = [];
    const p50Values: number[] = [];
    const p95Values: number[] = [];

    for (let i = clamped - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      const key = this.formatLocalDate(d);
      allDays.push(key);
      const row = dayMap.get(key);
      avgValues.push(row?.avg ?? 0);
      p50Values.push(row?.p50 ?? 0);
      p95Values.push(row?.p95 ?? 0);
    }

    return { days: allDays, p50: p50Values, p95: p95Values, avg: avgValues };
  }

  async getErrorRateTrend(days: number): Promise<TimeSeriesResult> {
    const clamped = Math.min(90, Math.max(1, days));
    const since = new Date(Date.now() - clamped * 86_400_000);

    const rows = await this.db
      .select({
        day: sql<string>`date_trunc('day', created_at)::date::text`,
        total: sql<number>`count(*)::int`,
        errors: sql<number>`count(*) filter (where status = 'error')::int`,
      })
      .from(aiTraces)
      .where(gte(aiTraces.createdAt, since))
      .groupBy(sql`date_trunc('day', created_at)`)
      .orderBy(sql`date_trunc('day', created_at)`);

    const mapped = rows.map((r) => ({
      day: r.day,
      count: r.total > 0 ? Math.round((r.errors / r.total) * 10000) / 100 : 0,
    }));

    return this.buildTimeSeries(mapped, clamped);
  }

  async getTokensTrend(days: number, dateRange?: DateRange): Promise<TimeSeriesResult> {
    const { since, until, dayCount } = this.resolveDateParams(days, dateRange);

    const conditions = [gte(aiTraces.createdAt, since)];
    if (until) conditions.push(lte(aiTraces.createdAt, until));

    const rows = await this.db
      .select({
        day: sql<string>`date_trunc('day', created_at)::date::text`,
        count: sql<number>`coalesce(sum(prompt_tokens + completion_tokens), 0)::int`,
      })
      .from(aiTraces)
      .where(and(...conditions))
      .groupBy(sql`date_trunc('day', created_at)`)
      .orderBy(sql`date_trunc('day', created_at)`);

    return this.buildTimeSeriesRange(rows, since, dayCount);
  }

  async getCostSummary() {
    const cost = await this.aiRepo.getCostSummary();
    return {
      totalCostCny: cost.totalCostCny,
      dailyAvg:
        cost.recordCount > 0
          ? Math.round((cost.totalCostCny / Math.max(1, cost.recordCount)) * 100) / 100
          : 0,
      trend: 'stable',
    };
  }

  async getSlaMetrics() {
    const stats = await this.aiRepo.getTraceStats();
    const uptime = stats.totalCalls > 0 ? (1 - stats.errorRate / 100) * 100 : 99.9;

    const [p95Row] = await this.db
      .select({
        p95: sql<number>`coalesce(percentile_cont(0.95) within group (order by latency_ms), 0)::int`,
      })
      .from(aiTraces);

    return {
      uptime: Math.round(uptime * 100) / 100,
      avgResponseMs: stats.avgLatency,
      p95ResponseMs: p95Row?.p95 ?? 0,
    };
  }

  async getMonitorAlerts() {
    const { alerts } = await this.getAlerts();

    const since = new Date(Date.now() - 24 * 3600_000);
    const [recentErrors] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiTraces)
      .where(and(eq(aiTraces.status, 'error'), gte(aiTraces.createdAt, since)));

    if ((recentErrors?.count ?? 0) > 50) {
      alerts.push({
        level: 'warning',
        message: `过去 24h 有 ${recentErrors!.count} 次 AI 调用错误`,
        timestamp: new Date().toISOString(),
      });
    }

    return { alerts, activeAlerts: alerts.length };
  }

  async getPerformanceSummary() {
    const stats = await this.aiRepo.getTraceStats();
    return {
      totalCalls: stats.totalCalls,
      avgLatency: stats.avgLatency,
      errorRate: stats.errorRate,
      throughput: Math.round(stats.totalCalls / 24),
    };
  }

  async checkDbHealth(): Promise<'healthy' | 'unhealthy'> {
    try {
      await this.db.execute(sql`SELECT 1`);
      return 'healthy';
    } catch {
      return 'unhealthy';
    }
  }

  private resolveDateParams(
    days: number,
    dateRange?: DateRange
  ): { since: Date; until: Date | null; dayCount: number } {
    if (dateRange) {
      const since = new Date(dateRange.start);
      since.setHours(0, 0, 0, 0);
      const untilDay = new Date(dateRange.end);
      untilDay.setHours(0, 0, 0, 0);
      const dayCount = Math.round((untilDay.getTime() - since.getTime()) / 86_400_000) + 1;
      const until = new Date(dateRange.end);
      until.setHours(23, 59, 59, 999);
      return { since, until, dayCount: Math.min(90, dayCount) };
    }
    const clamped = Math.min(90, Math.max(1, days));
    const since = new Date(Date.now() - (clamped - 1) * 86_400_000);
    since.setHours(0, 0, 0, 0);
    return { since, until: null, dayCount: clamped };
  }

  private formatLocalDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private buildTimeSeriesRange(
    rows: { day: string; count: number }[],
    since: Date,
    dayCount: number
  ): TimeSeriesResult {
    const dayMap = new Map(rows.map((r) => [r.day, r.count]));
    const allDays: string[] = [];
    const values: number[] = [];
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(since.getTime() + i * 86_400_000);
      const key = this.formatLocalDate(d);
      allDays.push(key);
      values.push(dayMap.get(key) ?? 0);
    }
    return { days: allDays, values };
  }

  private buildTimeSeries(rows: { day: string; count: number }[], days: number): TimeSeriesResult {
    return this.buildTimeSeriesRange(rows, new Date(Date.now() - (days - 1) * 86_400_000), days);
  }

  async getUserAnalysis(opts: {
    startDate: Date;
    endDate: Date;
    department?: string;
    userId?: string;
    limit?: number;
  }): Promise<{ users: UserAnalysisRow[]; departments: string[] }> {
    const limit = Math.min(100, Math.max(1, opts.limit ?? 50));
    const start = new Date(opts.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(opts.endDate);
    end.setHours(23, 59, 59, 999);

    const allInstances = await this.instanceSvc.list();
    const deptList = [...new Set(allInstances.map((i) => i.department || 'unknown'))].sort();
    const instanceDeptMap = new Map(allInstances.map((i) => [i.id, i.department || 'unknown']));

    const conditions = [gte(aiTraces.createdAt, start), lte(aiTraces.createdAt, end)];
    if (opts.userId) {
      conditions.push(sql`${aiTraces.userId} ilike ${`%${opts.userId}%`}`);
    }
    if (opts.department) {
      const deptInstIds = allInstances
        .filter((i) => (i.department || 'unknown') === opts.department)
        .map((i) => i.id);
      if (deptInstIds.length === 0) return { users: [], departments: deptList };
      const placeholders = deptInstIds.map((id) => sql`${id}`);
      conditions.push(sql`${aiTraces.instanceId} in (${sql.join(placeholders, sql`, `)})`);
    }

    const rows = await this.db
      .select({
        userId: aiTraces.userId,
        instanceId: aiTraces.instanceId,
        messages: sql<number>`count(*)::int`,
        tokens: sql<number>`coalesce(sum(prompt_tokens + completion_tokens), 0)::int`,
        estimatedCost: sql<number>`coalesce(sum(estimated_cost), 0)::real`,
      })
      .from(aiTraces)
      .where(and(...conditions))
      .groupBy(aiTraces.userId, aiTraces.instanceId)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);

    const users: UserAnalysisRow[] = rows.map((r) => ({
      userId: r.userId || 'anonymous',
      department: instanceDeptMap.get(r.instanceId || '') || 'unknown',
      messages: r.messages,
      tokens: r.tokens,
      estimatedCost: Math.round(r.estimatedCost * 100) / 100,
    }));

    return { users, departments: deptList };
  }
}
