import { describe, it, expect, vi } from 'vitest';
import { PersonaProvider } from './persona-provider.js';
import { defaultAgentDefinitionSpec } from './agent-definition.js';
import { createAgentDefinition } from './agent-definition.js';

const makeLogger = () => ({ warn: vi.fn() });

function makeDefWithPersona(persona: {
  systemPrompt: string;
  guardrails: { id: string; type: 'keyword'; pattern: string; action: 'block'; reason: string }[];
  refusalResponse: string;
}) {
  return createAgentDefinition({
    tenantId: 'tn',
    name: 'n',
    spec: { ...defaultAgentDefinitionSpec(), persona },
  });
}

describe('PersonaProvider', () => {
  it('ports 未注入 → NO_PERSONA', async () => {
    const p = new PersonaProvider(null, null, makeLogger());
    const r = await p.getPersona('inst_1');
    expect(r.hasPersona).toBe(false);
  });

  it('instanceId 空 → NO_PERSONA', async () => {
    const lookup = { getAgentDefinitionId: vi.fn() };
    const defPort = { getById: vi.fn() };
    const p = new PersonaProvider(lookup as never, defPort as never, makeLogger());
    const r = await p.getPersona('');
    expect(r.hasPersona).toBe(false);
    expect(lookup.getAgentDefinitionId).not.toHaveBeenCalled();
  });

  it('实例未关联 CRD(agentDefinitionId=null) → NO_PERSONA', async () => {
    const lookup = { getAgentDefinitionId: vi.fn(async () => null) };
    const defPort = { getById: vi.fn() };
    const p = new PersonaProvider(lookup as never, defPort as never, makeLogger());
    const r = await p.getPersona('inst_1');
    expect(r.hasPersona).toBe(false);
    expect(defPort.getById).not.toHaveBeenCalled();
  });

  it('agentDefinition 不存在 → NO_PERSONA + warn', async () => {
    const lookup = { getAgentDefinitionId: vi.fn(async () => 'adef_x') };
    const defPort = { getById: vi.fn(async () => null) };
    const logger = makeLogger();
    const p = new PersonaProvider(lookup as never, defPort as never, logger);
    const r = await p.getPersona('inst_1');
    expect(r.hasPersona).toBe(false);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('persona 全空(systemPrompt 空 + guardrails 空) → NO_PERSONA', async () => {
    const def = makeDefWithPersona({ systemPrompt: '', guardrails: [], refusalResponse: '' });
    const lookup = { getAgentDefinitionId: vi.fn(async () => 'adef_x') };
    const defPort = { getById: vi.fn(async () => def) };
    const p = new PersonaProvider(lookup as never, defPort as never, makeLogger());
    const r = await p.getPersona('inst_1');
    expect(r.hasPersona).toBe(false);
  });

  it('persona 有 systemPrompt → hasPersona=true + 字段完整', async () => {
    const def = makeDefWithPersona({
      systemPrompt: '你是客服助手',
      guardrails: [],
      refusalResponse: '抱歉越界',
    });
    const lookup = { getAgentDefinitionId: vi.fn(async () => 'adef_x') };
    const defPort = { getById: vi.fn(async () => def) };
    const p = new PersonaProvider(lookup as never, defPort as never, makeLogger());
    const r = await p.getPersona('inst_1');
    expect(r.hasPersona).toBe(true);
    expect(r.systemPrompt).toBe('你是客服助手');
    expect(r.refusalResponse).toBe('抱歉越界');
    expect(r.guardrails).toEqual([]);
  });

  it('persona 有 guardrails(无 systemPrompt) → hasPersona=true', async () => {
    const def = makeDefWithPersona({
      systemPrompt: '',
      guardrails: [{ id: 'g1', type: 'keyword', pattern: 'api key', action: 'block', reason: 'r' }],
      refusalResponse: '',
    });
    const lookup = { getAgentDefinitionId: vi.fn(async () => 'adef_x') };
    const defPort = { getById: vi.fn(async () => def) };
    const p = new PersonaProvider(lookup as never, defPort as never, makeLogger());
    const r = await p.getPersona('inst_1');
    expect(r.hasPersona).toBe(true);
    expect(r.guardrails).toHaveLength(1);
  });

  it('port 抛异常 → NO_PERSONA + warn(不阻断)', async () => {
    const lookup = {
      getAgentDefinitionId: vi.fn(async () => {
        throw new Error('db down');
      }),
    };
    const defPort = { getById: vi.fn() };
    const logger = makeLogger();
    const p = new PersonaProvider(lookup as never, defPort as never, logger);
    const r = await p.getPersona('inst_1');
    expect(r.hasPersona).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('persona recall failed'));
  });
});
