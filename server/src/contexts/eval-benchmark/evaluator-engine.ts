/**
 * 评估器引擎 — 根据评估器类型分发执行评分逻辑
 *
 * 支持三种评估器类型:
 * - rule_based: 基于预定义规则（精确匹配/包含/正则）评判
 * - llm_judge:  使用 LLM 作为裁判进行语义评分
 * - hybrid:     规则快筛 + LLM 深评，兼顾效率和深度
 */

import type { LiteLLMClient } from '../gateway/clients/litellm-client.js';
import { logger } from '../../app/logger.js';
import { execFile } from 'node:child_process';
import type {
  EvalEvaluator,
  EvaluatorType,
  RuleConfigItem,
  JudgeConfig,
  EvalDimension,
} from './eval-types.js';

/* ──── 输入输出类型 ──── */

export interface EvaluatorInput {
  taskDescription: string;
  expectedBehavior?: string;
  expectedOutput?: Record<string, unknown>;
  actualOutput: string;
  toolCallsLog?: unknown[];
  context?: Record<string, unknown>;
}

export interface EvaluatorOutput {
  score: number;
  dimensionScores: Record<string, number>;
  passed: boolean;
  detail?: string;
  tokenUsage?: number;
}

/* ──── 引擎主体 ──── */

export class EvaluatorEngine {
  constructor(private litellmClient?: LiteLLMClient) {}

  async evaluate(evaluator: EvalEvaluator, input: EvaluatorInput): Promise<EvaluatorOutput> {
    switch (evaluator.type as EvaluatorType) {
      case 'rule_based':
        return this.evaluateByRules(evaluator, input);
      case 'llm_judge':
        return this.evaluateByJudge(evaluator, input);
      case 'hybrid':
        return this.evaluateHybrid(evaluator, input);
      default:
        return this.createFallbackResult(`Unknown evaluator type: ${evaluator.type}`);
    }
  }

  /* ──── Rule-based 评估 ──── */

  private async evaluateByRules(evaluator: EvalEvaluator, input: EvaluatorInput): Promise<EvaluatorOutput> {
    const rules = (evaluator.ruleConfig as RuleConfigItem[] | null) ?? [];
    if (rules.length === 0) {
      return this.createFallbackResult('No rule config provided, using default score');
    }

    const dimensionScores: Record<string, number> = {};

    for (const dim of evaluator.dimensions as EvalDimension[]) {
      let dimScore = 0;
      let dimWeight = 0;

      // 规则可能包含脚本，需串行执行避免并发安全风险
      for (const rule of rules) {
        if (rule.weight <= 0) continue;
        const matched = await this.matchRule(rule, input);
        dimScore += matched ? rule.weight : 0;
        dimWeight += rule.weight;
      }

      dimensionScores[dim.key] = dimWeight > 0 ? dimScore / dimWeight : 0.5;
    }

    const score = this.weightedScore(dimensionScores, evaluator.dimensions as EvalDimension[]);
    return {
      score,
      dimensionScores,
      passed: score >= evaluator.threshold,
      detail: `Rule-based evaluation with ${rules.length} rules`,
    };
  }

  private matchRule(rule: RuleConfigItem, input: EvaluatorInput): boolean | Promise<boolean> {
    const target = rule.field === 'output' ? input.actualOutput : '';

    switch (rule.type) {
      case 'exact_match':
        return target === rule.value;
      case 'contains':
        if (!rule.value) return true; // 空 value 视为通配
        return target.includes(rule.value);
      case 'regex':
        try {
          return new RegExp(rule.value, 'i').test(target);
        } catch {
          return false;
        }
      case 'json_path_match':
        // 简化实现：检查 actualOutput 中是否包含特定 JSON 路径值
        try {
          const parsed = JSON.parse(target);
          const keys = rule.jsonPath?.split('.') ?? [];
          let current: unknown = parsed;
          for (const key of keys) {
            if (current == null || typeof current !== 'object') return false;
            current = (current as Record<string, unknown>)[key];
          }
          return String(current) === rule.value;
        } catch {
          return false;
        }
      case 'script':
        return this.executeScript(rule, input);
      default:
        return false;
    }
  }

  /* ──── 脚本执行 ──── */

  private async executeScript(rule: RuleConfigItem, input: EvaluatorInput): Promise<boolean> {
    const language = rule.language ?? 'javascript';
    const scriptCode = rule.value;
    if (!scriptCode.trim()) return false;

    // 构造注入给脚本的上下文变量
    const contextJson = JSON.stringify({
      taskDescription: input.taskDescription,
      expectedBehavior: input.expectedBehavior ?? '',
      expectedOutput: input.expectedOutput ?? null,
      actualOutput: input.actualOutput,
      toolCallsLog: input.toolCallsLog ?? [],
    });

    try {
      if (language === 'javascript') {
        return await this.executeJavaScript(scriptCode, contextJson);
      } else {
        return await this.executePython(scriptCode, contextJson);
      }
    } catch (err) {
      logger.warn({ err, language, ruleType: rule.type }, 'evaluator-engine: script execution failed');
      return false;
    }
  }

  /**
   * JavaScript 执行：使用 Node.js vm 模块沙箱
   *
   * 脚本可访问的变量：
   *   - ctx: { taskDescription, expectedBehavior, expectedOutput, actualOutput, toolCallsLog }
   *
   * 脚本必须定义 `evaluate(ctx)` 函数并返回布尔值。
   */
  private async executeJavaScript(scriptCode: string, contextJson: string): Promise<boolean> {
    const { runInNewContext } = await import('node:vm');

    const wrappedCode = `
      "use strict";
      ${scriptCode}
      typeof evaluate === 'function' ? evaluate(ctx) : false;
    `;

    const ctx = { ctx: JSON.parse(contextJson) };
    const sandbox = Object.create(null);
    Object.assign(sandbox, ctx);

    const result = runInNewContext(wrappedCode, sandbox, {
      timeout: 5000,
      filename: 'eval-rule-script.js',
    });

    return Boolean(result);
  }

  /**
   * Python 执行：子进程调用 python3
   *
   * 脚本可访问的变量：
   *   - ctx: dict（通过环境变量 EVAL_CTX 注入）
   *
   * 脚本必须定义 `evaluate(ctx)` 函数并返回布尔值。
   */
  private executePython(scriptCode: string, contextJson: string): Promise<boolean> {
    return new Promise((resolve) => {
      const wrappedCode = `
import json, os, sys
ctx = json.loads(os.environ.get("EVAL_CTX", "{}"))
${scriptCode}
if 'evaluate' in dir():
    result = evaluate(ctx)
    print("PASS" if result else "FAIL", end="")
else:
    print("FAIL", end="")
`;
      const args = ['-c', wrappedCode];
      const env = { ...process.env, EVAL_CTX: contextJson, PYTHONDONTWRITEBYTECODE: '1' };

      execFile('python3', args, { timeout: 10000, env, maxBuffer: 1024 * 1024 }, (err, stdout) => {
        if (err) {
          logger.warn({ err, stderr: (err as Error & { stderr?: string }).stderr }, 'evaluator-engine: python exec error');
          resolve(false);
          return;
        }
        resolve(stdout.trim() === 'PASS');
      });
    });
  }

  /* ──── LLM Judge 评估 ──── */

  private async evaluateByJudge(evaluator: EvalEvaluator, input: EvaluatorInput): Promise<EvaluatorOutput> {
    const judgeConfig = evaluator.judgeConfig as JudgeConfig | null;

    if (!judgeConfig || !this.litellmClient?.isConfigured()) {
      return this.createFallbackResult('LLM Judge unavailable — no judge config or LiteLLM not configured');
    }

    try {
      const prompt = this.buildPrompt(judgeConfig, input);
      const response = await this.litellmClient.chatCompletion({
        model: judgeConfig.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: judgeConfig.temperature,
        max_tokens: judgeConfig.maxTokens,
      });

      const content =
        (response as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message
          ?.content ?? '{}';

      const parsed = this.parseJudgeResponse(content, evaluator.dimensions as EvalDimension[]);

      return {
        score: parsed.score,
        dimensionScores: parsed.dimensionScores,
        passed: parsed.score >= evaluator.threshold,
        detail: parsed.comment ?? 'LLM Judge evaluation',
        tokenUsage: parsed.tokenUsage,
      };
    } catch (err) {
      logger.warn({ err, evaluatorId: evaluator.id }, 'evaluator-engine: judge call failed');
      return this.createFallbackResult(`Judge error: ${(err as Error).message}`);
    }
  }

  private buildPrompt(config: JudgeConfig, input: EvaluatorInput): string {
    return config.promptTemplate
      .replace(/\{taskDescription\}/g, input.taskDescription)
      .replace(/\{expectedBehavior\}/g, input.expectedBehavior ?? '（未提供）')
      .replace(/\{actualOutput\}/g, input.actualOutput)
      .replace(/\{rubric\}/g, '（见上方评分标准）');
  }

  private parseJudgeResponse(
    content: string,
    dimensions: EvalDimension[]
  ): { score: number; dimensionScores: Record<string, number>; comment?: string; tokenUsage?: number } {
    let parsed: Record<string, unknown>;
    try {
      // 尝试提取 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      parsed = {};
    }

    const dimensionScores: Record<string, number> = {};
    let totalWeight = 0;
    let weightedSum = 0;

    for (const dim of dimensions) {
      const rawValue = parsed[dim.key];
      if (typeof rawValue === 'number') {
        // 归一化到 0-1 范围
        // 假设 LLM 输出的分数范围是 1-5
        const normalized = Math.min(rawValue / 5, 1.0);
        dimensionScores[dim.key] = normalized;
        weightedSum += normalized * dim.weight;
        totalWeight += dim.weight;
      } else {
        dimensionScores[dim.key] = 0.5;
        weightedSum += 0.5 * dim.weight;
        totalWeight += dim.weight;
      }
    }

    const score = totalWeight > 0 ? weightedSum / totalWeight : 0.5;

    return {
      score,
      dimensionScores,
      comment: typeof parsed.comment === 'string' ? parsed.comment : undefined,
      tokenUsage: 500, // 估算值
    };
  }

  /* ──── Hybrid 评估 ──── */

  private async evaluateHybrid(evaluator: EvalEvaluator, input: EvaluatorInput): Promise<EvaluatorOutput> {
    // Phase 1: Rule-based 快筛
    const ruleResult = await this.evaluateByRules(evaluator, input);

    // 如果规则评分极低，直接否决（不浪费 LLM 调用）
    if (ruleResult.score < 0.3) {
      return {
        ...ruleResult,
        detail: `Hybrid: rule-based veto (score=${ruleResult.score.toFixed(2)})`,
      };
    }

    // Phase 2: LLM Judge 深评
    const judgeResult = await this.evaluateByJudge(evaluator, input);

    // 加权合并：规则 40%，LLM 60%
    const mergedScore = ruleResult.score * 0.4 + judgeResult.score * 0.6;
    const mergedDimensions: Record<string, number> = {};

    const allKeys = new Set([
      ...Object.keys(ruleResult.dimensionScores),
      ...Object.keys(judgeResult.dimensionScores),
    ]);
    for (const key of allKeys) {
      const r = ruleResult.dimensionScores[key] ?? 0;
      const j = judgeResult.dimensionScores[key] ?? 0;
      mergedDimensions[key] = r * 0.4 + j * 0.6;
    }

    return {
      score: mergedScore,
      dimensionScores: mergedDimensions,
      passed: mergedScore >= evaluator.threshold,
      detail: `Hybrid: rule=${ruleResult.score.toFixed(2)} judge=${judgeResult.score.toFixed(2)}`,
      tokenUsage: judgeResult.tokenUsage,
    };
  }

  /* ──── 工具方法 ──── */

  private weightedScore(dimensionScores: Record<string, number>, dimensions: EvalDimension[]): number {
    let totalWeight = 0;
    let weightedSum = 0;
    for (const dim of dimensions) {
      const score = dimensionScores[dim.key] ?? 0.5;
      weightedSum += score * dim.weight;
      totalWeight += dim.weight;
    }
    return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
  }

  private createFallbackResult(reason: string): EvaluatorOutput {
    return {
      score: 0.5,
      dimensionScores: {},
      passed: false,
      detail: reason,
    };
  }
}
