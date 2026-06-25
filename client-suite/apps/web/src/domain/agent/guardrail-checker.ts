import type { GuardrailCheckResult, GuardrailRule } from './AgentRuntimePort';

/**
 * GuardrailChecker — 拒答规则匹配(纯逻辑,domain 层,零外部依赖)。
 *
 * 复刻后端 server/src/contexts/agent-core/domain/guardrail-checker.ts 语义,
 * 供 useAgentChat 在 openclaw 对话路径前端轻量拦截(#1);后端实例路径由 harness 兜底(T3)。
 *
 * 匹配规则:
 *   - keyword: prompt 包含关键词(大小写不敏感) → 命中
 *   - regex:   prompt 匹配正则(大小写不敏感) → 命中
 *   - intent:  意图描述,纯逻辑不直接匹配(需 LLM 判定,前端不处理)
 *
 * action:
 *   - block:  blocked=true, needReview=false → 直接拒答(不调 runtime)
 *   - review: blocked=false, needReview=true  → 转 LLM 复核(前端放行,后端兜底)
 *
 * 多规则按数组顺序匹配,block 优先于 review:
 *   - 任一 block 命中 → 立即返回 blocked(不继续)
 *   - 无 block 但有 review 命中 → 返回首个 review 规则 + needReview
 *
 * 非法正则 catch 不抛(容错,记 warn),该规则视为不匹配——绝不因规则配置错误阻断主链路。
 */
export const NO_GUARDRAIL_BLOCK: GuardrailCheckResult = {
  blocked: false,
  matchedRule: null,
  needReview: false,
};

export function checkGuardrails(
  prompt: string,
  guardrails: GuardrailRule[],
  logger?: { warn: (msg: string) => void }
): GuardrailCheckResult {
  if (!guardrails || guardrails.length === 0) return NO_GUARDRAIL_BLOCK;
  const text = prompt ?? '';

  let reviewMatch: GuardrailRule | null = null;
  for (const rule of guardrails) {
    if (matchRule(text, rule, logger)) {
      if (rule.action === 'block') {
        return { blocked: true, matchedRule: rule, needReview: false };
      }
      // review: 记下首个,继续找是否有 block(block 优先)
      if (!reviewMatch) reviewMatch = rule;
    }
  }

  if (reviewMatch) {
    return { blocked: false, matchedRule: reviewMatch, needReview: true };
  }
  return NO_GUARDRAIL_BLOCK;
}

function matchRule(
  text: string,
  rule: GuardrailRule,
  logger?: { warn: (msg: string) => void }
): boolean {
  switch (rule.type) {
    case 'keyword':
      return text.toLowerCase().includes(rule.pattern.toLowerCase());
    case 'regex':
      try {
        return new RegExp(rule.pattern, 'i').test(text);
      } catch (err) {
        logger?.warn(
          `guardrail invalid regex "${rule.pattern}": ${err instanceof Error ? err.message : String(err)}`
        );
        return false;
      }
    case 'intent':
      // intent 需 LLM 判定,纯逻辑不匹配
      return false;
    default:
      return false;
  }
}
