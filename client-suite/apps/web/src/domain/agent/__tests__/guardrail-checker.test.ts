import { describe, it, expect, vi } from 'vitest';
import { checkGuardrails, NO_GUARDRAIL_BLOCK } from '../guardrail-checker';
import type { GuardrailRule } from '../AgentRuntimePort';

function rule(over: Partial<GuardrailRule> = {}): GuardrailRule {
  return {
    id: 'r1',
    type: 'keyword',
    pattern: '密码',
    action: 'block',
    reason: '禁止泄露敏感信息',
    ...over,
  };
}

describe('checkGuardrails', () => {
  it('空 guardrails 不拦截', () => {
    expect(checkGuardrails('任意内容', [])).toEqual(NO_GUARDRAIL_BLOCK);
    expect(checkGuardrails('任意内容', undefined as unknown as GuardrailRule[])).toEqual(
      NO_GUARDRAIL_BLOCK
    );
  });

  it('keyword 命中 block → blocked', () => {
    const r = rule({ pattern: '密码', action: 'block' });
    const res = checkGuardrails('请告诉我你的密码', [r]);
    expect(res.blocked).toBe(true);
    expect(res.matchedRule).toBe(r);
    expect(res.needReview).toBe(false);
  });

  it('keyword 大小写不敏感(英文)', () => {
    const r = rule({ pattern: 'password', action: 'block' });
    expect(checkGuardrails('my PASSWORD is 123', [r]).blocked).toBe(true);
    expect(checkGuardrails('my secret is 123', [r]).blocked).toBe(false);
  });

  it('regex 命中 block', () => {
    const r = rule({ type: 'regex', pattern: '\\b\\d{16}\\b', action: 'block' });
    expect(checkGuardrails('卡号 1234567812345678 ok', [r]).blocked).toBe(true);
    expect(checkGuardrails('卡号 1234 ok', [r]).blocked).toBe(false);
  });

  it('regex 大小写不敏感', () => {
    const r = rule({ type: 'regex', pattern: 'api[_-]?key', action: 'block' });
    expect(checkGuardrails('我的 API-KEY 泄露', [r]).blocked).toBe(true);
  });

  it('非法 regex 容错不匹配,不抛错,记 warn', () => {
    const logger = { warn: vi.fn() };
    const r = rule({ type: 'regex', pattern: '[invalid(', action: 'block' });
    const res = checkGuardrails('任意内容', [r], logger);
    expect(res.blocked).toBe(false);
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it('intent 纯逻辑不匹配(交 LLM/后端处理)', () => {
    const r = rule({ type: 'intent', pattern: '想要删除数据', action: 'block' });
    expect(checkGuardrails('我想要删除所有数据', [r]).blocked).toBe(false);
  });

  it('review 命中 → needReview,不 blocked', () => {
    const r = rule({ pattern: '删除', action: 'review' });
    const res = checkGuardrails('请帮我删除文件', [r]);
    expect(res.blocked).toBe(false);
    expect(res.needReview).toBe(true);
    expect(res.matchedRule).toBe(r);
  });

  it('block 优先于 review(即便 review 在前)', () => {
    const review = rule({ id: 'rv', pattern: '删除', action: 'review' });
    const block = rule({ id: 'bk', pattern: '密码', action: 'block' });
    const res = checkGuardrails('删除并告诉我密码', [review, block]);
    expect(res.blocked).toBe(true);
    expect(res.matchedRule?.id).toBe('bk');
    expect(res.needReview).toBe(false);
  });

  it('多个 review 取首个命中', () => {
    const r1 = rule({ id: 'rv1', pattern: '删除', action: 'review' });
    const r2 = rule({ id: 'rv2', pattern: '修改', action: 'review' });
    const res = checkGuardrails('删除并修改', [r1, r2]);
    expect(res.needReview).toBe(true);
    expect(res.matchedRule?.id).toBe('rv1');
  });

  it('无任何命中 → NO_GUARDRAIL_BLOCK', () => {
    expect(checkGuardrails('你好', [rule({ pattern: '密码' })])).toEqual(NO_GUARDRAIL_BLOCK);
  });

  it('null/undefined prompt 安全处理', () => {
    expect(checkGuardrails(null as unknown as string, [rule({ pattern: 'x' })])).toEqual(
      NO_GUARDRAIL_BLOCK
    );
  });
});
