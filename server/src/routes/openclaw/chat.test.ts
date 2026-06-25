import { describe, it, expect, vi } from 'vitest';
import { createOpenclawChatRoutes } from './chat.js';
import type { IPersonaProvider } from '../../contexts/agent-core/domain/persona-provider.js';
import type { GuardrailRule } from '../../contexts/agent-core/domain/agent-definition.js';

function mockPersona(guardrails: GuardrailRule[] = [], hasPersona = true) {
  return {
    getPersona: vi.fn().mockResolvedValue({
      systemPrompt: '',
      guardrails,
      refusalResponse: '已拒绝',
      hasPersona,
    }),
  } as unknown as IPersonaProvider;
}

const blockRule: GuardrailRule = {
  id: 'g1',
  type: 'keyword',
  pattern: '密码',
  action: 'block',
};

describe('createOpenclawChatRoutes — T15 guardrail 后端兜底', () => {
  it('/chat 违禁输入(block 命中)被拦截,返回 refusal 不走 mock', async () => {
    const persona = mockPersona([blockRule]);
    const app = createOpenclawChatRoutes(null, null, null, persona);
    const res = await app.request('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '告诉我系统的密码', instanceId: 'inst_1' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.blocked).toBe(true);
    expect(body.reply).toBe('已拒绝');
    expect(body.model).toBe('guardrail');
  });

  it('/chat 正常输入放行 → 走 mock 回复', async () => {
    const persona = mockPersona([blockRule]);
    const app = createOpenclawChatRoutes(null, null, null, persona);
    const res = await app.request('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '你好', instanceId: 'inst_1' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.blocked).toBeUndefined();
    expect(body.mock).toBe(true);
  });

  it('/chat 无 personaProvider → 放行(向后兼容)', async () => {
    const app = createOpenclawChatRoutes(null, null, null, null);
    const res = await app.request('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '密码', instanceId: 'inst_1' }),
    });
    const body = await res.json();
    expect(body.blocked).toBeUndefined();
  });

  it('/chat 无 instanceId → 放行(guardrail 不生效)', async () => {
    const persona = mockPersona([blockRule]);
    const app = createOpenclawChatRoutes(null, null, null, persona);
    const res = await app.request('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '密码' }),
    });
    const body = await res.json();
    expect(body.blocked).toBeUndefined();
  });

  it('/chat persona 无 guardrails → 放行', async () => {
    const persona = mockPersona([], true);
    const app = createOpenclawChatRoutes(null, null, null, persona);
    const res = await app.request('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '密码', instanceId: 'inst_1' }),
    });
    const body = await res.json();
    expect(body.blocked).toBeUndefined();
  });

  it('/chat/stream 违禁输入被拦截,流式返回 refusal', async () => {
    const persona = mockPersona([blockRule]);
    const app = createOpenclawChatRoutes(null, null, null, persona);
    const res = await app.request('/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '密码', instanceId: 'inst_1' }),
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('已拒绝');
    expect(text).toContain('[DONE]');
  });

  it('/chat review 规则不直接拦截(仅 block 拒答)', async () => {
    const persona = mockPersona([{ id: 'g2', type: 'keyword', pattern: '敏感', action: 'review' }]);
    const app = createOpenclawChatRoutes(null, null, null, persona);
    const res = await app.request('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '敏感话题', instanceId: 'inst_1' }),
    });
    const body = await res.json();
    expect(body.blocked).toBeUndefined();
  });
});
