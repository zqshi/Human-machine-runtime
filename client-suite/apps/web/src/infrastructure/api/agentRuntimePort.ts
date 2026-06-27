/**
 * AgentRuntimePort 实现(治本 D8) — infrastructure 层。
 *
 * 把对话后端(weKnoraApi / /api/cockpit/chat)封装为 IAgentRuntimePort,
 * useAgentChat 经此 port 调用,不再硬绑 weKnoraApi。运行时按
 * AgentDefinition.runtime.runtimeType 路由(cockpit→CockpitRuntimePort,默认→WeKnoraRuntimePort)。
 *
 * persona.systemPrompt 作为软约束注入 prompt 前置(与原 useAgentChat systemHint 语义一致)。
 */
import type {
  AgentChatCallbacks,
  AgentChatInput,
  IAgentRuntimePort,
} from '../../domain/agent/AgentRuntimePort';
import { weKnoraApi } from './weKnoraClient';

/** 把 persona.systemPrompt 软约束注入 prompt 前置 */
function injectPersona(prompt: string, systemPrompt?: string): string {
  return systemPrompt && systemPrompt.trim() ? `${systemPrompt.trim()}\n\n${prompt}` : prompt;
}

/**
 * WeKnoraRuntimePort — WeKnora RAG 流式对话(默认运行时)。
 * 包装 weKnoraApi.chat(SSE 流式)/ask(非流式 fallback)。
 */
class WeKnoraRuntimePort implements IAgentRuntimePort {
  async chat(input: AgentChatInput, cb: AgentChatCallbacks): Promise<void> {
    const prompt = injectPersona(input.prompt, input.persona?.systemPrompt);
    await weKnoraApi.chat(input.sessionId, prompt, {
      onChunk: cb.onChunk,
      onSources: cb.onSources,
      onDone: cb.onDone,
      onError: cb.onError,
      signal: cb.signal,
    });
  }

  async ask(prompt: string): Promise<{ answer: string; sources: { title: string; id: string }[] }> {
    return weKnoraApi.ask(prompt);
  }
}

/**
 * CockpitRuntimePort — Cockpit 直答(/api/cockpit/chat,非流式一次性返回)。
 * 用作 cockpit runtimeType 主路径,或 weKnora 失败时的 fallback。
 */
class CockpitRuntimePort implements IAgentRuntimePort {
  async chat(input: AgentChatInput, cb: AgentChatCallbacks): Promise<void> {
    try {
      const prompt = injectPersona(input.prompt, input.persona?.systemPrompt);
      const res = await fetch('/api/cockpit/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          sessionId: input.sessionId,
          instanceId: input.instanceId ?? undefined,
          history: input.history ?? [],
        }),
        signal: cb.signal,
      });
      if (!res.ok) {
        throw new Error(`cockpit chat ${res.status} ${res.statusText}`);
      }
      const data = (await res.json()) as { reply?: string };
      if (data.reply) cb.onChunk(data.reply);
      cb.onDone();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      cb.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }
}

export const weKnoraRuntimePort = new WeKnoraRuntimePort();
export const cockpitRuntimePort = new CockpitRuntimePort();

/**
 * 按 runtimeType 选 runtime port(治本 D8:运行时可替换)。
 * - cockpit → CockpitRuntimePort
 * - claude/hermes/缺省 → WeKnoraRuntimePort(前端对话主路径,RAG 流式)
 *
 * 注:claude 运行时实际经后端 harness(claude-worker),前端 useAgentChat 是 IM 对话,
 * 仍走 weKnora/cockpit 流式;claude 实例路径的 persona/guardrail 由后端 harness 注入(T3)。
 */
export function getAgentRuntimePort(runtimeType?: string): IAgentRuntimePort {
  if (runtimeType === 'cockpit') return cockpitRuntimePort;
  return weKnoraRuntimePort;
}
