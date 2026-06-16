/**
 * CronExpressionCalculator —— cron-parser 适配器（context 内 infrastructure adapter）
 *
 * 实现 domain/ICronCalculator，委托 cron-parser v5（CronExpressionParser）。
 * domain 不直接依赖 cron-parser（宪章：domain 零外部依赖），由本适配器桥接。
 */

import { CronExpressionParser } from 'cron-parser';
import type { ICronCalculator, CronValidationResult } from './domain/cron.js';

const DEFAULT_TZ = 'Asia/Shanghai';

export class CronExpressionCalculator implements ICronCalculator {
  validate(expr: string, tz: string = DEFAULT_TZ): CronValidationResult {
    try {
      CronExpressionParser.parse(expr, { tz });
      return { valid: true };
    } catch (e) {
      return { valid: false, error: (e as Error).message };
    }
  }

  nextRunAt(expr: string, tz: string, from: Date = new Date()): Date {
    return CronExpressionParser.parse(expr, { tz, currentDate: from }).next().toDate();
  }

  nextOccurrences(expr: string, tz: string, n: number, from: Date = new Date()): Date[] {
    const iter = CronExpressionParser.parse(expr, { tz, currentDate: from });
    const out: Date[] = [];
    for (let i = 0; i < n; i++) {
      try {
        out.push(iter.next().toDate());
      } catch {
        // 表达式已无更多触发（如固定结束日期），停止
        break;
      }
    }
    return out;
  }
}
