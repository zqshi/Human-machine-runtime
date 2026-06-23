/**
 * 模型计费单价表(USD per million tokens)。
 *
 * 数据来源:各模型官方定价页(2026-06)。Anthropic 模型在 Claude Agent SDK worker 内部
 * 由 SDK 上报 usage,宿主据此二次熔断(防 SDK 计数 bug 或 prompt 注入爆账单)。
 *
 * 单价变化时同步更新此表 + 对应测试。
 */
export const MODEL_PRICING_USD_PER_M: Record<string, { input: number; output: number }> = {
  'claude-opus-4-6': { input: 15, output: 75 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 0.8, output: 4 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4 },
  // 兜底未知模型:按 sonnet 4.6 估算(中等价位,宁可早熔断)
};

const FALLBACK_MODEL = 'claude-sonnet-4-6';

/**
 * 估算单次任务 USD 成本(仅用量 × 单价,不含税费/折扣)。
 *
 * - model 未登记表则按 FALLBACK_MODEL 单价估算(防御性)
 * - 入参支持 snake_case (input_tokens) 与 camelCase 两种
 */
export function estimateCostUsd(
  model: string | undefined,
  inputTokens: number,
  outputTokens: number
): number {
  const entry =
    (model ? MODEL_PRICING_USD_PER_M[model] : undefined) ??
    MODEL_PRICING_USD_PER_M[FALLBACK_MODEL]!;
  const inputCost = (inputTokens / 1_000_000) * entry.input;
  const outputCost = (outputTokens / 1_000_000) * entry.output;
  return inputCost + outputCost;
}
