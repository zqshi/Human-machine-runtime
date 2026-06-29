/**
 * llm-analysis — EAOS 五子系统的真实 LLM 分析用例。
 *
 * 战略解码 /decode 与评估洞察 generateInsights 的智能内核:
 * 构造 prompt → 调 LiteLLM → 解析结构化 JSON → 容错降级。
 *
 * 设计:
 * - 从 route handler 抽离,守 §12 信号6(route 不堆业务逻辑)。route 薄层只做参数校验+转发。
 * - 依赖 LiteLLMClient 接口(零外部 SDK),可注入 mock 单测(§2.2)。
 * - 故障暴露:llm 未配置/模型空 → 503;LLM 输出不可解析/调用失败 → 502(不回退硬编码,同 chat-service 模式)。
 * - 国产模型(glm-4-flash)JSON 遵循度容错:支持裸 JSON / ```json 代码块 / 花括号截取三种提取。
 */
import type { LiteLLMClient } from '../../contexts/gateway/clients/litellm-client.js';

/** 战略解码结构化结果(与前端 DecodedStrategyDTO 对齐,接真后 DTO 不变) */
export interface DecodedStrategy {
  questions: Array<{ id: string; question: string; purpose: string }>;
  hypotheses: Array<{
    id: string;
    statement: string;
    baselineValue: number;
    targetValue: number;
  }>;
  constraints: string[];
  suggestedL1Objectives: Array<{ title: string; keyQuestion: string }>;
}

export type DecodeResult =
  | { ok: true; data: DecodedStrategy }
  | { ok: false; status: 503 | 502; reason: string };

/** LiteLLM 是否就绪(已配置 + 模型非空) */
function llmReady(llm: LiteLLMClient | null, model: string): llm is LiteLLMClient {
  return !!llm && llm.isConfigured() && model.trim().length > 0;
}

/**
 * 从 LLM 自由文本响应中安全提取 JSON 对象。
 * 三级降级:① 直接 parse ② ```json 代码块 ③ 首个 { 到末个 }。
 * 任一成功返回对象,全失败返回 null。
 */
export function extractJsonObject(content: string | null | undefined): unknown | null {
  if (!content || typeof content !== 'string') return null;
  const trimmed = content.trim();

  // ① 直接 parse
  try {
    return JSON.parse(trimmed);
  } catch {
    /* 降级 */
  }

  // ② ```json ... ``` 或 ``` ... ``` 代码块
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* 降级 */
    }
  }

  // ③ 首个 { 到末个 }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      /* 降级 */
    }
  }
  return null;
}

/** 从 LLM 响应中安全提取 JSON 字符串数组(insights 用) */
export function extractJsonStringArray(content: string | null | undefined): string[] {
  const parsed = extractJsonObject(content);
  if (Array.isArray(parsed)) {
    return parsed.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
  }
  // 兜底:对象里的数组字段
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    for (const key of ['insights', 'items', 'data', 'result']) {
      if (Array.isArray(obj[key])) {
        return (obj[key] as unknown[]).filter(
          (s): s is string => typeof s === 'string' && s.trim().length > 0
        );
      }
    }
  }
  return [];
}

function decodePrompt(intent: string): { system: string; user: string } {
  const system = `你是企业级战略解码引擎。将用户输入的模糊战略意图拆解为结构化的战略分析。
严格输出一个 JSON 对象,不要任何解释文字、不要 markdown 代码块。JSON schema:
{
  "questions": [{"id":"q1","question":"...","purpose":"clarify|metrics|constraint|assumption"}],
  "hypotheses": [{"id":"h1","statement":"...","baselineValue":50,"targetValue":80}],
  "constraints": ["..."],
  "suggestedL1Objectives": [{"title":"...","keyQuestion":"..."}]
}
要求:2-4 个问题、1-3 个假设、2-4 个约束、2-3 个 L1 目标。baselineValue/targetValue 必须是数字。purpose 只能是 clarify/metrics/constraint/assumption 之一。`;
  const user = `战略意图:${intent}`;
  return { system, user };
}

/**
 * 战略解码用例:调 LLM 把模糊 intent 拆解为结构化 DecodedStrategy。
 * - llm 未配置/模型空 → 503(故障暴露,不 mock)
 * - LLM 返回非合法 JSON / 调用抛错 → 502(不回退硬编码)
 * - 成功 → {ok:true, data}
 */
export async function decodeStrategy(
  intent: string,
  llm: LiteLLMClient | null,
  model: string
): Promise<DecodeResult> {
  if (!llmReady(llm, model)) {
    return { ok: false, status: 503, reason: '战略解码服务未配置(LLM 未就绪)' };
  }

  const { system, user } = decodePrompt(intent);
  let raw: unknown;
  try {
    raw = await llm.chatCompletion({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.4,
      max_tokens: 1024,
    });
  } catch {
    return { ok: false, status: 502, reason: '战略解码调用失败' };
  }

  const content = extractContent(raw);
  const parsed = extractJsonObject(content);
  const data = normalizeDecoded(parsed);
  if (!data) {
    return { ok: false, status: 502, reason: '战略解码输出不可解析' };
  }
  return { ok: true, data };
}

/** 校验+规整 LLM 输出为 DecodedStrategy(字段缺失/类型错 → null) */
function normalizeDecoded(parsed: unknown): DecodedStrategy | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  const questions = normalizeArray(
    obj.questions,
    (q) =>
      typeof q === 'object' &&
      q !== null &&
      typeof (q as Record<string, unknown>).question === 'string',
    (q) => {
      const r = q as Record<string, unknown>;
      return {
        id: typeof r.id === 'string' ? r.id : `q${Math.random().toString(36).slice(2, 6)}`,
        question: String(r.question),
        purpose: typeof r.purpose === 'string' ? r.purpose : 'clarify',
      };
    }
  );
  const hypotheses = normalizeArray(
    obj.hypotheses,
    (h) =>
      typeof h === 'object' && h !== null && typeof (h as Record<string, unknown>).statement === 'string',
    (h) => {
      const r = h as Record<string, unknown>;
      return {
        id: typeof r.id === 'string' ? r.id : `h${Math.random().toString(36).slice(2, 6)}`,
        statement: String(r.statement),
        baselineValue: typeof r.baselineValue === 'number' ? r.baselineValue : 0,
        targetValue: typeof r.targetValue === 'number' ? r.targetValue : 0,
      };
    }
  );
  const constraints = Array.isArray(obj.constraints)
    ? obj.constraints.filter((c): c is string => typeof c === 'string')
    : [];
  const suggestedL1Objectives = normalizeArray(
    obj.suggestedL1Objectives,
    (o) =>
      typeof o === 'object' && o !== null && typeof (o as Record<string, unknown>).title === 'string',
    (o) => {
      const r = o as Record<string, unknown>;
      return {
        title: String(r.title),
        keyQuestion: typeof r.keyQuestion === 'string' ? r.keyQuestion : '',
      };
    }
  );
  // 至少有一类有效产出才算解码成功(全空 → 视为不可解析)
  if (
    questions.length === 0 &&
    hypotheses.length === 0 &&
    constraints.length === 0 &&
    suggestedL1Objectives.length === 0
  ) {
    return null;
  }
  return { questions, hypotheses, constraints, suggestedL1Objectives };
}

function normalizeArray<T>(
  raw: unknown,
  guard: (item: unknown) => boolean,
  map: (item: unknown) => T
): T[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(guard).map(map);
}

/** 从 OpenAI 兼容响应提取 choices[0].message.content(同 chat-service:222 模式) */
function extractContent(res: unknown): string | null {
  if (!res || typeof res !== 'object') return null;
  const choices = (res as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = (choices[0] as { message?: { content?: unknown } } | undefined)?.message;
  const content = message?.content;
  return typeof content === 'string' ? content : null;
}

function insightsPrompt(
  humanAvg: number,
  humanCount: number,
  aiAvg: number,
  aiCount: number
): { system: string; user: string } {
  const system = `你是组织效能分析助手。基于人机协同评估指标生成简练洞察。
严格输出一个 JSON 字符串数组,如 ["洞察1","洞察2"],不要解释文字、不要 markdown 代码块。`;
  const user = `评估指标:人工指标平均 ${humanAvg} 分(共 ${humanCount} 项),Agent 指标平均 ${aiAvg} 分(共 ${aiCount} 项)。生成 2-4 条对比洞察,每条不超过 30 字。`;
  return { system, user };
}

/**
 * 评估洞察用例:基于 human/agent 指标调 LLM 生成洞察文本数组。
 * - llm 未配置/模型空/调用失败/无可分析数据 → 返回空数组 [](诚实,不回退 if/else 文案伪装)
 * - 无指标数据(双方都 0 项)时也返回 [](无可洞察内容)
 */
export async function generateInsights(
  humanMetrics: Array<Record<string, unknown>>,
  aiMetrics: Array<Record<string, unknown>>,
  llm: LiteLLMClient | null,
  model: string
): Promise<string[]> {
  if (!llmReady(llm, model)) return [];
  if (humanMetrics.length === 0 && aiMetrics.length === 0) return [];

  const humanAvg = avgScore(humanMetrics);
  const aiAvg = avgScore(aiMetrics);
  const { system, user } = insightsPrompt(humanAvg, humanMetrics.length, aiAvg, aiMetrics.length);

  let raw: unknown;
  try {
    raw = await llm.chatCompletion({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.5,
      max_tokens: 512,
    });
  } catch {
    return [];
  }

  const content = extractContent(raw);
  const insights = extractJsonStringArray(content);
  return insights.slice(0, 4);
}

function avgScore(metrics: Array<Record<string, unknown>>): number {
  if (metrics.length === 0) return 0;
  const sum = metrics.reduce((s, m) => s + (typeof m.score === 'number' ? m.score : 0), 0);
  return Math.round(sum / metrics.length);
}
