/**
 * 推荐引擎 LLM 提示词构造与响应解析。
 *
 * 设计目标:
 *   - 纯函数,易测试
 *   - 输出 JSON 严格 schema(降低解析失败率)
 *   - 容错:模型偶尔加 markdown 围栏 / 前后噪声也能解析
 */

import type { NormalizedMessage } from './message-normalizer.js';
import type {
  HistoricalDecision,
  Recommendation,
  AlternativeAction,
} from './recommendation-engine.js';

/**
 * 构造给 LLM 的 chat 消息序列。
 *
 * system:职责 + 输出格式约束
 * user:消息上下文 + 历史决策
 */
export function buildPrompt(
  msg: NormalizedMessage,
  historicalDecisions: HistoricalDecision[]
): Array<{ role: 'system' | 'user'; content: string }> {
  const system = [
    '你是企业消息决策助手。给定一条业务消息(可能来自 IM/邮件/告警),给出 1-3 条可行的下一步行动建议。',
    '',
    '输出必须是严格 JSON,不带 markdown 围栏,格式如下:',
    '{',
    '  "recommendations": [',
    '    {',
    '      "action": "具体动作描述(动宾结构,不超过 30 字)",',
    '      "confidence": 0.0~1.0 的浮点,',
    '      "reasoning": "推荐理由(不超过 80 字)",',
    '      "risks": ["风险点 1", "风险点 2"],',
    '      "alternatives": [{"action": "替代动作", "tradeoff": "代价/取舍"}],',
    '      "estimatedImpact": "high" | "medium" | "low"',
    '    }',
    '  ]',
    '}',
    '',
    '约束:',
    '- 只输出 JSON,不输出解释或前后缀',
    '- confidence 反映把握程度,低质量上下文时给 0.4~0.6',
    '- risks 至少 1 条,无风险时填 ["无明显风险"]',
    '- alternatives 可为空数组',
  ].join('\n');

  const historyText =
    historicalDecisions.length === 0
      ? '(无历史决策)'
      : historicalDecisions
          .slice(0, 10)
          .map(
            (h, i) => `${i + 1}. ${h.summary} [结果:${h.outcome} 相似度:${h.similarity.toFixed(2)}]`
          )
          .join('\n');

  const user = [
    '当前消息:',
    `- 来源:${msg.channelType}`,
    `- 发送者:${msg.sender.name ?? msg.sender.id}`,
    `- 紧急度:${msg.urgency}`,
    `- 意图:${msg.intent}`,
    `- 主题:${msg.subject ?? '(无)'}`,
    `- 内容:${truncate(msg.body, 500)}`,
    '',
    '相关历史决策:',
    historyText,
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/**
 * 解析 LLM 响应,容错处理常见污染:
 *   - ```json ... ``` 围栏
 *   - 前后噪声文本
 *   - 多余字段
 *   - 缺失 risks/alternatives 字段
 *
 * 解析失败返回空数组(降级到规则推荐)。
 */
export function parseLlmResponse(text: string | null | undefined): Recommendation[] {
  if (!text || typeof text !== 'string') return [];

  const json = extractJson(text);
  if (!json) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }

  if (!parsed || typeof parsed !== 'object') return [];
  const recs = (parsed as { recommendations?: unknown }).recommendations;
  if (!Array.isArray(recs)) return [];

  const result: Recommendation[] = [];
  for (let i = 0; i < recs.length; i++) {
    const rec = normalizeRecommendation(recs[i], i);
    if (rec) result.push(rec);
  }
  return result;
}

function extractJson(text: string): string | null {
  const trimmed = text.trim();
  // 1. 直接 try
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
  // 2. 剥 ```json ... ``` 围栏
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1]!.trim();
  // 3. 找第一个 { 到最后一个 }(贪婪)
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return null;
}

function normalizeRecommendation(raw: unknown, index: number): Recommendation | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const action = typeof r.action === 'string' ? r.action : '';
  if (!action) return null;

  const confidence = clamp01(typeof r.confidence === 'number' ? r.confidence : 0.5);
  const reasoning = typeof r.reasoning === 'string' ? r.reasoning : '';
  const risks = Array.isArray(r.risks)
    ? r.risks.filter((x): x is string => typeof x === 'string')
    : [];
  const alternatives = Array.isArray(r.alternatives)
    ? r.alternatives
        .map((x) => normalizeAlternative(x))
        .filter((x): x is AlternativeAction => x !== null)
    : [];
  const impactRaw = typeof r.estimatedImpact === 'string' ? r.estimatedImpact : 'medium';
  const estimatedImpact: Recommendation['estimatedImpact'] =
    impactRaw === 'high' || impactRaw === 'low' ? impactRaw : 'medium';

  return {
    id: `rec_llm_${Date.now()}_${index}`,
    action,
    confidence,
    reasoning,
    risks,
    alternatives,
    estimatedImpact,
  };
}

function normalizeAlternative(raw: unknown): AlternativeAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const action = typeof r.action === 'string' ? r.action : '';
  const tradeoff = typeof r.tradeoff === 'string' ? r.tradeoff : '';
  if (!action) return null;
  return { action, tradeoff };
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + '...';
}
