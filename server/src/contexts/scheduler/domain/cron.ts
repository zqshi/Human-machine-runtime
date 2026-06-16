/**
 * Cron 领域契约（纯类型 + 接口 + 纯逻辑，零外部依赖）
 *
 * cron-parser 属 node_modules 依赖，不进 domain（宪章：domain 零外部依赖）。
 * 故本文件只定义 ICronCalculator 接口与 describeCron 纯函数；
 * cron-parser 适配见 ../cron-calculator.ts（context 内 adapter）。
 */

export type ScheduleType = 'cron' | 'interval';

export interface CronValidationResult {
  valid: boolean;
  /** 校验失败原因（valid=false 时） */
  error?: string;
}

/**
 * Cron 计算器接口 —— 封装 cron 表达式的校验与下次触发时间计算。
 * 实现方（CronExpressionCalculator）委托 cron-parser。
 */
export interface ICronCalculator {
  validate(expr: string, tz?: string): CronValidationResult;
  /** 下一次触发时间（from 之后） */
  nextRunAt(expr: string, tz: string, from?: Date): Date;
  /** 下 N 次触发时间 */
  nextOccurrences(expr: string, tz: string, n: number, from?: Date): Date[];
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const isAny = (p: string): boolean => p === '*';
const isEvery = (p: string): boolean => /^\*\/(\d+)$/.test(p);
const everyOf = (p: string): number => parseInt(p.slice(2), 10);
const isNum = (p: string): boolean => /^\d+$/.test(p);
const num = (p: string): number => parseInt(p, 10);

/**
 * describeCron —— 将标准 5 段 cron 表达式转中文可读描述（纯逻辑，不依赖库）。
 * 覆盖常见模式：每分钟 / 每 N 分钟 / 每天 H:M / 每周X H:M / 每月D H:M。
 * 复杂表达式（列表/范围）fallback 返回原表达式。
 */
export function describeCron(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;
  const [min, hour, dom, month, dow] = parts;

  // 全 *：每分钟
  if ([min, hour, dom, month, dow].every(isAny)) return '每分钟执行';

  // 每 N 分钟（分位 */N，其余任意）
  if (isEvery(min) && [hour, dom, month, dow].every(isAny)) {
    return `每 ${everyOf(min)} 分钟执行`;
  }

  // 单点时间：分与时为具体数字
  if (isNum(min) && isNum(hour)) {
    const hh = String(num(hour)).padStart(2, '0');
    const mm = String(num(min)).padStart(2, '0');
    const hm = `${hh}:${mm}`;
    if ([dom, month, dow].every(isAny)) return `每天 ${hm} 执行`;
    if (isNum(dow) && [dom, month].every(isAny)) {
      return `每${WEEKDAYS[num(dow) % 7]} ${hm} 执行`;
    }
    if (isNum(dom) && [month, dow].every(isAny)) {
      return `每月 ${num(dom)} 日 ${hm} 执行`;
    }
  }

  return expr;
}
