import { useCallback, useEffect, useRef } from 'react';
import { useOpenClawStore } from '../stores/openclawStore';
import { useAgentStore } from '../stores/agentStore';
import { AgentRoutingService } from '../../domain/agent/AgentRoutingService';
import { weKnoraApi } from '../../infrastructure/api/weKnoraClient';
import { openclawApiAdapter } from '../../infrastructure/api/openclawApiAdapter';
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
 * useAgentChat — Primary Agent 统一对话 hook
 *
 * 用户始终与 Primary Agent 对话，AgentRoutingService
 * 自动检测意图并路由到对应能力 Agent。
 *
 * Artifact 创建（task/app/doc/board）由后端 AgentExecutor 通过 LLM 判断，
 * 前端通过 SSE artifact:* 事件接收更新。
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
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

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

      const activeSharedAgentId = useOpenClawStore.getState().activeSharedAgentId;
      let systemHint = '';
      let routedCapName = '';

      if (activeSharedAgentId) {
        const sharedAgent = useAgentStore
          .getState()
          .sharedAgents.find((a) => a.id === activeSharedAgentId);
        if (sharedAgent) {
          const templateId = `cap-${sharedAgent.category}`;
          const registry = useAgentStore.getState().capabilityRegistry;
          const template = registry.findTemplate(templateId);
          if (template) {
            systemHint = template.systemPrompt;
            routedCapName = template.name;
          }
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
            systemHint = routeResult.template.systemPrompt;
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
      const queryText = (systemHint ? `${systemHint}\n\n${text}` : text) + attachmentHint;

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

      try {
        let streamFailed = false;
        let accumulated = '';

        await weKnoraApi.chat(sessionId, queryText, {
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
            const result = await weKnoraApi.ask(text);
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
            // WeKnora 全部失败 → Fallback 到 LiteLLM 直接对话
            try {
              updateLastMessage((m) =>
                m
                  .withText('')
                  .withSteps([{ ...thinkingStep, detail: '知识库不可用，切换到 AI 直接对话...' }])
              );
              const llmRes = await fetch('/api/openclaw/chat', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  message: text,
                  sessionId,
                  instanceId: useOpenClawStore.getState().activeInstanceId,
                }),
                signal: controller.signal,
              });
              if (!llmRes.ok) throw new Error(`LLM ${llmRes.status}`);
              const llmData = (await llmRes.json()) as { reply: string };
              const studioBlock = detectStudioIntent(text);
              updateLastMessage((m) => {
                let updated = m.withText(llmData.reply).withSteps([
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
              triggerAgentExecution(text, llmData.reply);
            } catch {
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
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // aborted — noop
        } else {
          // 最外层异常也 fallback 到 LiteLLM
          const showLlmFailure = () => {
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
          };
          try {
            updateLastMessage((m) =>
              m.withText('').withSteps([{ ...thinkingStep, detail: '切换到 AI 直接对话...' }])
            );
            const llmRes = await fetch('/api/openclaw/chat', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: text,
                sessionId,
                instanceId: useOpenClawStore.getState().activeInstanceId,
              }),
            });
            if (!llmRes.ok) {
              console.error(
                '[useAgentChat] LLM 直答失败',
                `HTTP ${llmRes.status} ${llmRes.statusText}`
              );
              showLlmFailure();
            } else {
              const llmData = (await llmRes.json()) as { reply: string };
              updateLastMessage((m) =>
                m.withText(llmData.reply).withSteps([
                  {
                    ...thinkingStep,
                    status: 'done' as const,
                    label: 'AI 直接回答',
                    detail: '未使用知识库检索',
                  },
                ])
              );
              triggerAgentExecution(text, llmData.reply);
            }
          } catch (err) {
            console.error('[useAgentChat] LLM 直答失败', err);
            showLlmFailure();
          }
        }
      } finally {
        setIsSending(false);
      }
    },
    [
      sessionId,
      isSending,
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
