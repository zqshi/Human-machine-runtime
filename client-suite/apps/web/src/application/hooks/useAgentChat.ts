import { useCallback, useEffect, useRef } from 'react';
import { useOpenClawStore } from '../stores/openclawStore';
import { useAgentStore } from '../stores/agentStore';
import { AgentRoutingService } from '../../domain/agent/AgentRoutingService';
import { openclawApiAdapter } from '../../infrastructure/api/openclawApiAdapter';
import {
  weKnoraRuntimePort,
  openclawRuntimePort,
  getAgentRuntimePort,
} from '../../infrastructure/api/agentRuntimePort';
import { instanceApi } from '../../infrastructure/api/adminApiClient';
import { agentDefinitionApi } from '../../infrastructure/api/agentDefinitionApi';
import { checkGuardrails } from '../../domain/agent/guardrail-checker';
import type { PersonaSpec } from '../../domain/agent/AgentRuntimePort';
import { CoTMessage } from '../../domain/agent/CoTMessage';
import type { CoTStep, Attachment } from '../../domain/agent/CoTMessage';
import type { MessageBlock } from '../../domain/agent/MessageBlock';
import { useToastStore } from '../stores/toastStore';

/** Stable empty array to avoid new-reference re-renders */
const EMPTY_MESSAGES: CoTMessage[] = [];

/**
 * detectStudioIntent — 检测用户消息中的 Studio 创建意图
 * 匹配到时返回对应的 studio-intent block，否则 null。
 * 由后端 LLM 响应驱动时此函数不参与；仅在前端 fallback 场景补充演示。
 */
function detectStudioIntent(text: string): MessageBlock | null {
  const lower = text.toLowerCase();

  // Agent 创建
  if (/创建.*(agent|助手|机器人|数字员工)/i.test(lower) || /create.*agent/i.test(lower)) {
    const nameMatch = text.match(/(?:创建|新建|搭建)(?:一个)?[「"']?([^「"'，,。\s]{2,10})[」"']?/);
    return {
      type: 'studio-intent',
      intent: 'create-agent',
      agentName: nameMatch?.[1] || undefined,
      description: text,
    };
  }

  // Skill 创建
  if (/创建.*(skill|技能|能力)/i.test(lower) || /create.*skill/i.test(lower)) {
    const nameMatch = text.match(
      /(?:创建|新建)(?:一个)?[「"']?([^「"'，,。\s]{2,10})[」"']?\s*(?:技能|skill)/i
    );
    return {
      type: 'studio-intent',
      intent: 'create-skill',
      agentName: nameMatch?.[1] || undefined,
      description: text,
    };
  }

  // App 创建
  if (/创建.*(app|应用|看板|系统)/i.test(lower) || /create.*app/i.test(lower)) {
    const nameMatch = text.match(
      /(?:创建|搭建|新建)(?:一个)?[「"']?([^「"'，,。\s]{2,10})[」"']?\s*(?:应用|app|看板|系统)/i
    );
    return {
      type: 'studio-intent',
      intent: 'create-app',
      agentName: nameMatch?.[1] || undefined,
      description: text,
    };
  }

  // MCP 创建
  if (
    /创建.*(mcp|工具|接入|api|数据库连接)/i.test(lower) ||
    /(?:接入|连接).*(api|数据库|gateway)/i.test(lower)
  ) {
    let mcpMode: 'openapi' | 'database' | 'gateway' | undefined;
    if (/openapi|swagger|api.*文档/i.test(lower)) mcpMode = 'openapi';
    else if (/数据库|database|db/i.test(lower)) mcpMode = 'database';
    else if (/gateway|网关/i.test(lower)) mcpMode = 'gateway';
    return {
      type: 'studio-intent',
      intent: 'create-mcp',
      agentName: undefined,
      description: text,
      mcpMode,
    };
  }

  return null;
}

/**
 * useAgentChat — Primary Agent 统一对话 hook(治本 D8:经 AgentRuntimePort 不硬绑 weKnoraApi)。
 *
 * persona 来源:activeInstanceId → instanceApi.get → agentDefinitionId → agentDefinitionApi.get → spec.persona
 * (替代原 capabilityRegistry template.systemPrompt)。persona.systemPrompt 由 runtime port 注入 prompt 前置。
 * guardrails 前端轻量拦截(block 直接拒答,不调 runtime;review 放行后端兜底)。
 * 运行时按 persona.runtime.runtimeType 路由(openclaw→OpenClawRuntimePort,默认→WeKnoraRuntimePort)。
 *
 * Artifact 创建由后端 AgentExecutor 判断,前端通过 SSE artifact:* 事件接收。
 */
export function useAgentChat() {
  const activeConversationId = useOpenClawStore((s) => s.activeConversationId);
  const conversations = useOpenClawStore((s) => s.conversations);
  const conversation = conversations[activeConversationId] ?? EMPTY_MESSAGES;
  const messages = conversation.length > 0 ? conversation : EMPTY_MESSAGES;
  const isSending = useOpenClawStore((s) => s.isSending);
  const appendMessage = useOpenClawStore((s) => s.appendMessage);
  const updateLastMessage = useOpenClawStore((s) => s.updateLastMessage);
  const setIsSending = useOpenClawStore((s) => s.setIsSending);
  const sessionId = useOpenClawStore((s) => s.sessionId);
  const activeInstanceId = useOpenClawStore((s) => s.activeInstanceId);
  const abortRef = useRef<AbortController | null>(null);

  /** persona 缓存(治本 D8 + #1:从后端 AgentDefinition 拉,替代 capabilityRegistry) */
  const personaRef = useRef<{ persona?: PersonaSpec; runtimeType?: string }>({});

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // 拉 persona:instance → agentDefinitionId → AgentDefinition.spec.persona(容错不抛,失败回空)
  useEffect(() => {
    if (!activeInstanceId) {
      personaRef.current = {};
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const inst = await instanceApi.get(activeInstanceId);
        const defId = inst.agentDefinitionId;
        if (!defId) {
          if (!cancelled) personaRef.current = {};
          return;
        }
        const def = await agentDefinitionApi.get(defId);
        if (cancelled) return;
        personaRef.current = {
          persona: def.spec.persona,
          runtimeType: def.spec.runtime.runtimeType,
        };
      } catch {
        if (!cancelled) personaRef.current = {};
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeInstanceId]);

  const getPrimaryAgentName = useCallback((): string => {
    const activeSharedAgentId = useOpenClawStore.getState().activeSharedAgentId;
    if (activeSharedAgentId) {
      const sharedAgent = useAgentStore
        .getState()
        .sharedAgents.find((a) => a.id === activeSharedAgentId);
      return sharedAgent?.name ?? 'AI 助手';
    }
    const agent = useAgentStore.getState().primaryAgent;
    return agent?.name ?? 'AI 助手';
  }, []);

  /** Trigger backend Agent execution (fire & forget) */
  const triggerAgentExecution = useCallback(
    (userText: string, responseText: string) => {
      if (!sessionId) return;
      openclawApiAdapter.executeAgent(userText, responseText, sessionId).catch(() => {
        useToastStore.getState().addToast('智能创建服务暂不可用，对话功能正常', 'info');
      });
    },
    [sessionId]
  );

  /** Detect goal intent in user message and create a UserGoal */
  const detectAndCreateGoal = useCallback((_userText: string) => {
    // Goal detection removed — goals are created via explicit API calls
  }, []);

  const sendMessage = useCallback(
    async (text: string, attachments?: Attachment[]) => {
      if (!sessionId || isSending) return;

      const { persona, runtimeType } = personaRef.current;

      // #1 guardrail 前端拦截:block 直接拒答(不调 runtime);review 放行(后端兜底)
      if (persona?.guardrails?.length) {
        const gr = checkGuardrails(text, persona.guardrails);
        if (gr.blocked) {
          const refusal =
            persona.refusalResponse?.trim() || '抱歉，这超出了我的职责范围，无法协助。';
          const userMsg = CoTMessage.create({
            id: `m-${Date.now()}`,
            agentId: 'primary',
            sessionId,
            role: 'user',
            text,
            timestamp: Date.now(),
            attachments,
          });
          appendMessage(userMsg);
          appendMessage(
            CoTMessage.create({
              id: `r-${Date.now()}`,
              agentId: 'primary',
              sessionId,
              role: 'agent',
              text: refusal,
              timestamp: Date.now(),
              cotSteps: [
                {
                  id: `g-${Date.now()}`,
                  label: '拒答拦截',
                  status: 'done',
                  detail: gr.matchedRule?.reason || '命中 guardrail 拒答规则',
                },
              ],
            })
          );
          triggerAgentExecution(text, refusal);
          return;
        }
      }

      // 能力路由(保留 routedCapName/invokeAgent 作 UI 提示与能力激活;
      // systemPrompt 不再取自 capabilityRegistry template,由 runtime port 注入 persona.systemPrompt)
      const activeSharedAgentId = useOpenClawStore.getState().activeSharedAgentId;
      let routedCapName = '';

      if (activeSharedAgentId) {
        const sharedAgent = useAgentStore
          .getState()
          .sharedAgents.find((a) => a.id === activeSharedAgentId);
        if (sharedAgent) {
          const templateId = `cap-${sharedAgent.category}`;
          const registry = useAgentStore.getState().capabilityRegistry;
          const template = registry.findTemplate(templateId);
          if (template) routedCapName = template.name;
        }
      } else {
        const detectedIntent = AgentRoutingService.detectIntent(text);
        if (detectedIntent) {
          const registry = useAgentStore.getState().capabilityRegistry;
          const routeResult = AgentRoutingService.route(detectedIntent, registry);
          if (routeResult) {
            if (routeResult.action === 'create') {
              useAgentStore.getState().activateCapability(detectedIntent.templateId);
            }
            routedCapName = routeResult.template.name;
            const category = detectedIntent.templateId.replace('cap-', '');
            useAgentStore.getState().invokeAgent(`sa-${category}`);
          }
        }
      }

      const attachmentHint = attachments?.length
        ? '\n\n' +
          attachments.map((a) => `[附件: ${a.name} (${formatFileSize(a.size)})]`).join('\n')
        : '';
      const prompt = text + attachmentHint;

      const userMsg = CoTMessage.create({
        id: `m-${Date.now()}`,
        agentId: 'primary',
        sessionId,
        role: 'user',
        text,
        timestamp: Date.now(),
        attachments,
      });
      appendMessage(userMsg);

      if (routedCapName) {
        const routingMsg = CoTMessage.create({
          id: `routing-${Date.now()}`,
          agentId: 'primary',
          sessionId,
          role: 'agent',
          text: `🔀 正在调用 **${routedCapName}** 处理您的请求...`,
          timestamp: Date.now(),
          cotSteps: [
            {
              id: `rt-${Date.now()}`,
              label: '意图识别',
              status: 'done',
              detail: `检测到 "${routedCapName}" 相关意图`,
            },
            {
              id: `rt2-${Date.now()}`,
              label: `路由到 ${routedCapName}`,
              status: 'running',
              detail: '正在调度能力 Agent...',
            },
          ],
        });
        appendMessage(routingMsg);
      }

      detectAndCreateGoal(text);

      const botMsgId = `r-${Date.now()}`;
      const thinkingStep: CoTStep = {
        id: `s-${Date.now()}-1`,
        label: routedCapName ? `调用 [${routedCapName}] 能力` : '检索知识库',
        status: 'running',
        detail: routedCapName ? `正在路由到 ${routedCapName}...` : '正在连接 WeKnora RAG...',
      };
      const botMsg = CoTMessage.create({
        id: botMsgId,
        agentId: 'primary',
        sessionId,
        role: 'agent',
        text: '',
        timestamp: Date.now(),
        cotSteps: [thinkingStep],
      });
      appendMessage(botMsg);
      setIsSending(true);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const openclawPrimary = runtimeType === 'openclaw';
      const primaryPort = getAgentRuntimePort(runtimeType);
      // 多轮记忆:从 store 实时取历史消息构造 OpenAI messages(history),修复"每轮失忆"缺陷。
      // 用 getState() 实时读而非闭包 messages,避免 messages 进 useCallback 依赖致每次重建(流式中断)。
      // 排除占位消息(routing/thinking 文本)与空内容,只取真实 user/agent 交替历史。
      // CoTMessage role 'agent' → 'assistant'。占位特征:文本以"正在"/"🔀"/"抱歉，AI 服务"开头。
      const PLACEHOLDER_RE = /^(正在|🔀|抱歉，AI 服务)/;
      const liveMessages =
        useOpenClawStore.getState().conversations[activeConversationId] ?? EMPTY_MESSAGES;
      const history = liveMessages
        .filter((m) => (m.role === 'user' || m.role === 'agent') && m.text.trim().length > 0)
        .filter((m) => !PLACEHOLDER_RE.test(m.text.trim()))
        .map((m) => ({
          role: (m.role === 'agent' ? 'assistant' : 'user') as 'user' | 'assistant',
          content: m.text,
        }));
      const chatInput = { sessionId, prompt, instanceId: activeInstanceId, persona, history };

      try {
        let streamFailed = false;
        let accumulated = '';

        if (openclawPrimary) {
          // openclaw runtime 主路径:直答(/api/openclaw/chat),失败错误提示
          await openclawRuntimePort.chat(chatInput, {
            signal: controller.signal,
            onChunk: (chunk) => {
              accumulated += chunk;
              updateLastMessage((m) =>
                m.withText(accumulated).withSteps([
                  {
                    ...thinkingStep,
                    status: 'done' as const,
                    label: 'AI 直接回答',
                    detail: 'openclaw 运行时',
                  },
                ])
              );
            },
            onDone: () => {
              const studioBlock = detectStudioIntent(text);
              updateLastMessage((m) => {
                let updated = m;
                if (studioBlock)
                  updated = updated.withBlocks([...(updated.blocks ?? []), studioBlock]);
                return updated;
              });
              triggerAgentExecution(text, accumulated);
            },
            onError: () => {
              streamFailed = true;
            },
          });
          if (streamFailed && !controller.signal.aborted) {
            updateLastMessage((m) =>
              m.withText('抱歉，AI 服务暂时不可用，请稍后重试。').withSteps([
                {
                  ...thinkingStep,
                  status: 'done' as const,
                  label: '服务暂不可用',
                  detail: 'openclaw 运行时不可用',
                },
              ])
            );
          }
        } else {
          // 默认(weKnora)主路径:RAG 流式 + fallback 链(经 port,不硬绑 weKnoraApi)
          await weKnoraRuntimePort.chat(chatInput, {
            signal: controller.signal,
            onChunk: (chunk) => {
              accumulated += chunk;
              updateLastMessage((m) =>
                m.withText(accumulated).withSteps(
                  (m.cotSteps ?? []).map((s) =>
                    s.id === thinkingStep.id
                      ? {
                          ...s,
                          status: 'done' as const,
                          label: routedCapName ? `${routedCapName} 检索完成` : '知识检索完成',
                          detail: '正在生成回答...',
                        }
                      : s
                  )
                )
              );
            },
            onSources: (sources) => {
              const sourceBlocks: MessageBlock[] = sources.slice(0, 3).map((src, i) => ({
                type: 'source-ref' as const,
                sourceId: src.id || `src-${Date.now()}-${i}`,
                title: src.title,
              }));

              updateLastMessage((m) => {
                let updated = m.withSteps([
                  ...(m.cotSteps ?? []),
                  {
                    id: `s-src-${Date.now()}`,
                    label: '引用来源',
                    status: 'done' as const,
                    detail: sources.map((s) => s.title).join('、') || '无引用',
                  },
                ]);
                if (sourceBlocks.length > 0) {
                  updated = updated.withBlocks([...(updated.blocks ?? []), ...sourceBlocks]);
                }
                return updated;
              });
            },
            onDone: () => {
              const studioBlock = detectStudioIntent(text);
              updateLastMessage((m) => {
                let updated = m.withSteps(
                  (m.cotSteps ?? []).map((s) =>
                    s.status === 'running' ? { ...s, status: 'done' as const, detail: '完成' } : s
                  )
                );
                if (studioBlock) {
                  updated = updated.withBlocks([...(updated.blocks ?? []), studioBlock]);
                }
                return updated;
              });
              triggerAgentExecution(text, accumulated);
            },
            onError: (err) => {
              console.warn('[useAgentChat] SSE error, trying fallback:', err.message);
              streamFailed = true;
            },
          });

          if (streamFailed && !controller.signal.aborted) {
            try {
              updateLastMessage((m) =>
                m
                  .withText('')
                  .withSteps([{ ...thinkingStep, detail: '流式连接失败，正在尝试非流式请求...' }])
              );
              const result = await primaryPort.ask!(text);
              updateLastMessage((m) =>
                m.withText(result.answer).withSteps([
                  {
                    ...thinkingStep,
                    status: 'done' as const,
                    label: '知识检索完成',
                    detail: '非流式回答',
                  },
                  ...(result.sources?.length
                    ? [
                        {
                          id: `s-src-${Date.now()}`,
                          label: '引用来源',
                          status: 'done' as const,
                          detail: result.sources.map((s) => s.title).join('、'),
                        },
                      ]
                    : []),
                ])
              );
              triggerAgentExecution(text, result.answer);
            } catch {
              // WeKnora 全部失败 → fallback 到 openclaw runtime 直答
              try {
                updateLastMessage((m) =>
                  m
                    .withText('')
                    .withSteps([{ ...thinkingStep, detail: '知识库不可用，切换到 AI 直接对话...' }])
                );
                let fallbackAcc = '';
                await openclawRuntimePort.chat(chatInput, {
                  signal: controller.signal,
                  onChunk: (chunk) => {
                    fallbackAcc += chunk;
                    updateLastMessage((m) => m.withText(fallbackAcc));
                  },
                  onDone: () => {
                    const studioBlock = detectStudioIntent(text);
                    updateLastMessage((m) => {
                      let updated = m.withSteps([
                        {
                          ...thinkingStep,
                          status: 'done' as const,
                          label: 'AI 直接回答',
                          detail: '未使用知识库检索',
                        },
                      ]);
                      if (studioBlock) {
                        updated = updated.withBlocks([...(updated.blocks ?? []), studioBlock]);
                      }
                      return updated;
                    });
                    triggerAgentExecution(text, fallbackAcc);
                  },
                  onError: () => {
                    updateLastMessage((m) =>
                      m.withText('抱歉，AI 服务暂时不可用，请稍后重试。').withSteps([
                        {
                          ...thinkingStep,
                          status: 'done' as const,
                          label: '服务暂不可用',
                          detail: '请检查 LiteLLM 和 WeKnora 服务是否启动',
                        },
                      ])
                    );
                  },
                });
              } catch {
                updateLastMessage((m) =>
                  m.withText('抱歉，AI 服务暂时不可用，请稍后重试。').withSteps([
                    {
                      ...thinkingStep,
                      status: 'done' as const,
                      label: '服务暂不可用',
                      detail: '请检查网络连接后重试',
                    },
                  ])
                );
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // aborted — noop
        } else {
          updateLastMessage((m) =>
            m.withText('抱歉，AI 服务暂时不可用，请稍后重试。').withSteps([
              {
                ...thinkingStep,
                status: 'done' as const,
                label: '服务暂不可用',
                detail: '请检查网络连接后重试',
              },
            ])
          );
        }
      } finally {
        setIsSending(false);
      }
    },
    [
      sessionId,
      isSending,
      activeInstanceId,
      activeConversationId,
      appendMessage,
      updateLastMessage,
      setIsSending,
      triggerAgentExecution,
      detectAndCreateGoal,
    ]
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, sendMessage, isSending, abort, getAgentName: getPrimaryAgentName };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
