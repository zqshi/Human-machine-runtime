/**
 * 操作日志页筛选参数构造。
 */

/**
 * 将起止日期拼成后端 timeRange（from,to）。
 * dateTo 补到当天 23:59:59，避免按"天"筛选时漏掉结束日当天的数据。
 */
export function buildTimeRange(dateFrom: string, dateTo: string): string | undefined {
  const from = dateFrom ? `${dateFrom}T00:00:00` : '';
  const to = dateTo ? `${dateTo}T23:59:59` : '';
  if (!from && !to) return undefined;
  return `${from},${to}`;
}
