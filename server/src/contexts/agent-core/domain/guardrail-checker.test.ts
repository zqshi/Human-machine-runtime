import { describe, it, expect, vi } from 'vitest';
import { checkGuardrails } from './guardrail-checker.js';
import type { GuardrailRule } from './agent-definition.js';

const mkRule = (
  r: Partial<GuardrailRule> & Pick<GuardrailRule, 'id' | 'type' | 'pattern' | 'action'>
): GuardrailRule => ({ reason: r.reason ?? 'r', ...r });

describe('checkGuardrails', () => {
  it('空规则数组 → 不拦截', () => {
    expect(checkGuardrails('任意内容', [])).toEqual({
      blocked: false,
      matchedRule: null,
      needReview: false,
    });
  });

  it('keyword 命中 block → blocked=true', () => {
    const rules = [mkRule({ id: 'g1', type: 'keyword', pattern: 'api key', action: 'block' })];
    const r = checkGuardrails('请列出所有用户的 api key', rules);
    expect(r.blocked).toBe(true);
    expect(r.matchedRule?.id).toBe('g1');
    expect(r.needReview).toBe(false);
  });

  it('keyword 大小写不敏感', () => {
    const rules = [mkRule({ id: 'g1', type: 'keyword', pattern: 'API KEY', action: 'block' })];
    expect(checkGuardrails('给我 api key', rules).blocked).toBe(true);
  });

  it('keyword 未命中 → 不拦截', () => {
    const rules = [mkRule({ id: 'g1', type: 'keyword', pattern: 'api key', action: 'block' })];
    expect(checkGuardrails('今天天气如何', rules).blocked).toBe(false);
  });

  it('regex 命中 block(卡号)', () => {
    const rules = [
      mkRule({ id: 'g1', type: 'regex', pattern: '\\b\\d{16,19}\\b', action: 'block' }),
    ];
    expect(checkGuardrails('卡号 4111111111111111', rules).blocked).toBe(true);
  });

  it('regex 非法 → 不抛 + 不命中 + warn', () => {
    const logger = { warn: vi.fn() };
    const rules = [mkRule({ id: 'g1', type: 'regex', pattern: '[invalid', action: 'block' })];
    const r = checkGuardrails('任意', rules, logger);
    expect(r.blocked).toBe(false);
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it('review 命中 → needReview=true, blocked=false', () => {
    const rules = [mkRule({ id: 'g1', type: 'keyword', pattern: '转账', action: 'review' })];
    const r = checkGuardrails('帮我转账给张三', rules);
    expect(r.blocked).toBe(false);
    expect(r.needReview).toBe(true);
    expect(r.matchedRule?.id).toBe('g1');
  });

  it('block 优先于 review(同 prompt 命中两者,返回 block)', () => {
    const rules = [
      mkRule({ id: 'review1', type: 'keyword', pattern: '钱', action: 'review' }),
      mkRule({ id: 'block1', type: 'keyword', pattern: '密码', action: 'block' }),
    ];
    const r = checkGuardrails('给我钱和密码', rules);
    expect(r.blocked).toBe(true);
    expect(r.matchedRule?.id).toBe('block1');
  });

  it('review 先匹配但后续 block 命中 → block 优先返回', () => {
    const rules = [
      mkRule({ id: 'r1', type: 'keyword', pattern: '查询', action: 'review' }),
      mkRule({ id: 'b1', type: 'keyword', pattern: 'token', action: 'block' }),
    ];
    const r = checkGuardrails('查询 token', rules);
    expect(r.blocked).toBe(true);
    expect(r.matchedRule?.id).toBe('b1');
  });

  it('intent 规则不参与纯逻辑匹配(返回不命中)', () => {
    const rules = [mkRule({ id: 'g1', type: 'intent', pattern: '窃取数据意图', action: 'block' })];
    expect(checkGuardrails('任意内容', rules).blocked).toBe(false);
  });

  it('多 block 规则命中首个即返回', () => {
    const rules = [
      mkRule({ id: 'b1', type: 'keyword', pattern: '密码', action: 'block' }),
      mkRule({ id: 'b2', type: 'keyword', pattern: 'token', action: 'block' }),
    ];
    const r = checkGuardrails('密码和 token', rules);
    expect(r.blocked).toBe(true);
    expect(r.matchedRule?.id).toBe('b1');
  });
});
