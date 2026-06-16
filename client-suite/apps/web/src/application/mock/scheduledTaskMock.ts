/**
 * scheduledTaskMock —— 演示数据（显式 demo 模式，非静默降级）
 *
 * 仅当用户在页面显式开启「演示数据」开关时使用（ScheduledTasksSection 内 demoMode）。
 * 后端 weekly-report / employee-cleanup / trace-cleanup handler 未实现前，
 * 用这些数据展示列表与详情页效果。真实模式始终走 scheduledTaskApi。
 */

import type { ScheduledTask, ScheduledTaskRun } from '../services/adminApi';

const now = Date.now();
const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString();

export const MOCK_TASKS: ScheduledTask[] = [
  {
    id: 'scht_demo_echo',
    name: '调度链路自检',
    description: '每 5 分钟回显一次，验证调度器存活',
    jobType: 'system',
    jobPayload: { handlerKey: 'echo', params: { source: 'healthcheck' } },
    scheduleType: 'interval',
    cronExpr: null,
    intervalSeconds: 300,
    timezone: 'Asia/Shanghai',
    isEnabled: true,
    nextRunAt: iso(120_000),
    lastRunAt: iso(-180_000),
    lastRunStatus: 'completed',
    lastError: null,
    createdBy: 'admin',
    createdAt: iso(-7 * 86400_000),
    updatedAt: iso(-180_000),
  },
  {
    id: 'scht_demo_weekly',
    name: '用户对话分析周报',
    description: '每周一早 9 点，生成上周对话分析周报存档（通知渠道待统一接入）',
    jobType: 'system',
    jobPayload: {
      handlerKey: 'weekly-report',
      range: 'last-week',
      dimensions: ['overview', 'dau', 'tokens', 'retention', 'skills', 'departments'],
    },
    scheduleType: 'cron',
    cronExpr: '0 9 * * 1',
    intervalSeconds: null,
    timezone: 'Asia/Shanghai',
    isEnabled: true,
    nextRunAt: iso(3 * 86400_000),
    lastRunAt: iso(-4 * 86400_000),
    lastRunStatus: 'completed',
    lastError: null,
    createdBy: 'admin',
    createdAt: iso(-30 * 86400_000),
    updatedAt: iso(-4 * 86400_000),
  },
  {
    id: 'scht_demo_resign',
    name: '离职员工监测与清理',
    description: '每天凌晨检测离职/长期未活跃员工，仅检测模式',
    jobType: 'system',
    jobPayload: {
      handlerKey: 'employee-cleanup',
      criteria: 'inactive',
      inactiveDays: 30,
      mode: 'detect-only',
    },
    scheduleType: 'cron',
    cronExpr: '0 2 * * *',
    intervalSeconds: null,
    timezone: 'Asia/Shanghai',
    isEnabled: true,
    nextRunAt: iso(14 * 3600_000),
    lastRunAt: iso(-10 * 3600_000),
    lastRunStatus: 'completed',
    lastError: null,
    createdBy: 'admin',
    createdAt: iso(-14 * 86400_000),
    updatedAt: iso(-10 * 3600_000),
  },
  {
    id: 'scht_demo_agent',
    name: '每日舆情早报（数字员工）',
    description: '每天 8:30 触发数字员工汇总舆情',
    jobType: 'agent',
    jobPayload: { instanceId: 'inst_demo_001', prompt: '汇总昨日舆情并生成早报' },
    scheduleType: 'cron',
    cronExpr: '30 8 * * *',
    intervalSeconds: null,
    timezone: 'Asia/Shanghai',
    isEnabled: false,
    nextRunAt: null,
    lastRunAt: iso(-2 * 86400_000),
    lastRunStatus: 'failed',
    lastError: 'LiteLLM 未配置（localhost:14000 不可达）',
    createdBy: 'admin',
    createdAt: iso(-20 * 86400_000),
    updatedAt: iso(-2 * 86400_000),
  },
  {
    id: 'scht_demo_cleanup',
    name: '调用追踪清理',
    description: '每月 1 号清理 90 天前的 ai_traces',
    jobType: 'system',
    jobPayload: { handlerKey: 'trace-cleanup', olderThanDays: 90 },
    scheduleType: 'cron',
    cronExpr: '0 3 1 * *',
    intervalSeconds: null,
    timezone: 'Asia/Shanghai',
    isEnabled: true,
    nextRunAt: iso(15 * 86400_000),
    lastRunAt: null,
    lastRunStatus: null,
    lastError: null,
    createdBy: 'admin',
    createdAt: iso(-60 * 86400_000),
    updatedAt: iso(-60 * 86400_000),
  },
];

export const MOCK_RUNS: Record<string, ScheduledTaskRun[]> = {
  scht_demo_echo: [
    run('scht_demo_echo', 'completed', -180_000, 12, 'echo: {"source":"healthcheck"}', { echoed: { source: 'healthcheck' } }),
    run('scht_demo_echo', 'completed', -480_000, 9, 'echo: {"source":"healthcheck"}', { echoed: { source: 'healthcheck' } }),
    run('scht_demo_echo', 'completed', -780_000, 11, 'echo: {"source":"healthcheck"}', { echoed: { source: 'healthcheck' } }),
  ],
  scht_demo_weekly: [
    run(
      'scht_demo_weekly',
      'completed',
      -4 * 86400_000,
      8420,
      '已生成 2026-06-05~2026-06-11 报告：日均 DAU 6681 / 消息 3,884 / Token 1,052,061 / 留存 52%（通知渠道待统一接入，报告已存档）',
      {
        range: '2026-06-05~2026-06-11',
        metrics: {
          avgDau: 6681,
          peakDau: 8120,
          peakDay: '2026-06-09',
          totalMessages: 3884,
          totalTokens: 1052061,
          avgRetention: 52,
        },
        markdown:
          '# Report Statistics\n\n> 统计区间：2026-06-05 ~ 2026-06-11\n\n## 总览\n\n| 指标 | 数值 |\n|---|---|\n| 日均 DAU | 6681 |\n| 峰值 DAU | 8120（2026-06-09） |\n| 总消息量 | 3,884 |\n| 总 Token | 1,052,061 |\n| 平均留存率 | 52% |\n',
      },
      { avgDau: 6681, totalTokens: 1052061 }
    ),
  ],
  scht_demo_resign: [
    run(
      'scht_demo_resign',
      'completed',
      -10 * 3600_000,
      3210,
      '检测到 3 名疑似离职员工（最后活跃 >30 天），已生成名单，未执行清理（仅检测模式）',
      {
        mode: 'detect-only',
        detected: [
          { instanceId: 'inst_023', name: 'Alice (Sales Team 1)', lastActive: '2026-05-08' },
          { instanceId: 'inst_041', name: 'Bob (Support Team 2)', lastActive: '2026-05-01' },
          { instanceId: 'inst_058', name: 'Carol (Operations)', lastActive: '2026-04-22' },
        ],
      },
      { checkedInstances: 142 }
    ),
  ],
  scht_demo_agent: [
    run('scht_demo_agent', 'failed', -2 * 86400_000, 50_000, null, null, null, 'LiteLLM 未配置（localhost:14000 不可达）'),
  ],
  scht_demo_cleanup: [],
};

function run(
  taskId: string,
  status: string,
  startedOffsetMs: number,
  durationMs: number,
  conclusion: string | null,
  outputPayload: unknown,
  metadata?: unknown,
  errorMessage?: string
): ScheduledTaskRun {
  return {
    id: `str_mock_${Math.abs(startedOffsetMs)}`,
    taskId,
    status,
    triggerType: 'scheduled',
    startedAt: iso(startedOffsetMs),
    finishedAt: iso(startedOffsetMs + durationMs),
    durationMs,
    conclusion,
    outputPayload,
    errorMessage: errorMessage ?? null,
    metadata: metadata ?? null,
    createdAt: iso(startedOffsetMs),
  };
}
