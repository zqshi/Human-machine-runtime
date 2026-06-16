/**
 * 报告统计作业（weekly-report）
 *
 * 1) 按 range 解析日期范围 → AnalyticsService 算指标（DAU/消息/Token/留存/部门）。
 *    range 由前端按调度频次推导后写入 payload（weekly→last-week，monthly→last-month），
 *    后端不再感知调度细节，只按 range 算窗口。
 * 2) 渲染：优先用户 templateMd（占位符替换），否则默认 markdown 模板；prompt 作为报告备注。
 * 3) 仅产出报告（存档/供查看）。通知渠道（邮件等）后期统一接入，本 handler 不直接发送。
 */

import type { AnalyticsService, DateRange } from '../../analytics/analytics-service.js';
import type { SystemJobHandler } from './system-handler.js';

interface WeeklyReportParams {
  range?: 'last-week' | 'last-month';
  dimensions?: string[];
  prompt?: string;
  templateMd?: string;
}

function resolveDateRange(range: string): DateRange {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  if (range === 'last-month') {
    const start = new Date(now);
    start.setDate(now.getDate() - 30);
    start.setHours(0, 0, 0, 0);
    return { start, end: now };
  }
  // last-week（默认）
  const day = now.getDay();
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  thisMonday.setHours(0, 0, 0, 0);
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);
  const lastSunday = new Date(thisMonday);
  lastSunday.setDate(thisMonday.getDate() - 1);
  return { start: lastMonday, end: lastSunday };
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function avg(values: number[]): number {
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
}

function renderDefault(opts: {
  range: string;
  dateRange: DateRange;
  prompt?: string;
  metrics: {
    avgDau: number;
    peakDau: number;
    peakDay: string;
    totalMessages: number;
    totalTokens: number;
    avgRetention: number;
    days: string[];
  };
}): string {
  const { dateRange, prompt, metrics: m } = opts;
  const lines: string[] = [];
  lines.push(`# Report Statistics`);
  lines.push('');
  lines.push(`> 统计区间：${fmtDate(dateRange.start)} ~ ${fmtDate(dateRange.end)}`);
  lines.push('');
  lines.push(`## 总览`);
  lines.push('');
  lines.push(`| 指标 | 数值 |`);
  lines.push(`|---|---|`);
  lines.push(`| 日均 DAU | ${m.avgDau} |`);
  lines.push(`| 峰值 DAU | ${m.peakDau}（${m.peakDay}） |`);
  lines.push(`| 总消息量 | ${m.totalMessages.toLocaleString()} |`);
  lines.push(`| 总 Token | ${m.totalTokens.toLocaleString()} |`);
  lines.push(`| 平均留存率 | ${m.avgRetention}% |`);
  lines.push('');
  if (prompt?.trim()) {
    lines.push(`## 报告说明`);
    lines.push('');
    lines.push(prompt.trim());
    lines.push('');
  }
  lines.push(`_由定时任务自动生成_`);
  return lines.join('\n');
}

function applyTemplate(templateMd: string, vars: Record<string, string | number>): string {
  return templateMd.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? `{{${k}}}`));
}

/** 注册 weekly-report 作业 */
export function registerWeeklyReport(
  handler: SystemJobHandler,
  analytics: AnalyticsService
): void {
  handler.register('weekly-report', async (raw) => {
    const params = (raw as WeeklyReportParams) ?? {};
    const range = params.range ?? 'last-week';
    const dateRange = resolveDateRange(range);
    const days = Math.max(
      1,
      Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / 86400_000)
    );

    // 并行拉取指标
    const [dauTrend, msgTrend, tokenTrend, retentionTrend] = await Promise.all([
      analytics.getDauTrend(days, dateRange),
      analytics.getMessagesTrend(days, dateRange),
      analytics.getTokensTrend(days, dateRange),
      analytics.getRetentionTrend(days, dateRange),
    ]);

    const peakDau = Math.max(...dauTrend.values, 0);
    const peakIdx = dauTrend.values.indexOf(peakDau);
    const metrics = {
      avgDau: avg(dauTrend.values),
      peakDau,
      peakDay: dauTrend.days[peakIdx] ?? '—',
      totalMessages: msgTrend.values.reduce((a, b) => a + b, 0),
      totalTokens: tokenTrend.values.reduce((a, b) => a + b, 0),
      avgRetention: avg(retentionTrend.values),
      days: dauTrend.days,
    };

    // 渲染
    const vars = {
      avgDau: metrics.avgDau,
      peakDau: metrics.peakDau,
      peakDay: metrics.peakDay,
      totalMessages: metrics.totalMessages,
      totalTokens: metrics.totalTokens,
      avgRetention: metrics.avgRetention,
      range: fmtDate(dateRange.start) + '~' + fmtDate(dateRange.end),
    };
    const markdown = params.templateMd?.trim()
      ? applyTemplate(params.templateMd, vars)
      : renderDefault({ range, dateRange, prompt: params.prompt, metrics });

    const conclusion =
      `已生成 ${fmtDate(dateRange.start)}~${fmtDate(dateRange.end)} 报告：` +
      `日均 DAU ${metrics.avgDau} / 消息 ${metrics.totalMessages.toLocaleString()} / ` +
      `Token ${metrics.totalTokens.toLocaleString()} / 留存 ${metrics.avgRetention}%` +
      `（通知渠道待统一接入，报告已存档）`;

    return {
      conclusion,
      outputPayload: {
        range: fmtDate(dateRange.start) + '~' + fmtDate(dateRange.end),
        metrics,
        markdown,
      },
      metadata: { avgDau: metrics.avgDau, totalTokens: metrics.totalTokens },
    };
  });
}
