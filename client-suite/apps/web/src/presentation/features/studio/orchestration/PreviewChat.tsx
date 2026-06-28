/**
 * PreviewChat — 右栏预览对话 + 调试模式(暗色主题)
 *
 * 完整功能:
 * - 多会话支持(新建 / 历史列表 / 切换 / 删除)
 * - 调试模式(展示真实调用信息: 模型 / token 用量 / 耗时,不伪造执行链路)
 * - 预设问题快捷入口
 *
 * 数据来源: 调用真实 /api/cockpit/chat 端点(ChatService 真调 LiteLLM)。
 * Studio 编排预览场景无 instanceId,后端用 body.systemPrompt 作为 system prompt。
 * LiteLLM 未配置/失败时后端返 503/502,UI 诚实暴露错误,不伪装回复。
 */
import { useState, useRef, useEffect } from 'react';
import { useOrchestrationStore } from '../../../../application/stores/orchestrationStore';
import { useToastStore } from '../../../../application/stores/toastStore';
import { studioApi, PreviewChatError } from '../../../../application/services/studioApi';

interface ChatMessage {
  role: 'user' | 'bot';
  content: string;
  /** 关联的调用信息(仅 bot 回复有,调试模式展示用);出错时为错误信息 */
  trace?: CallTrace;
}

/** 真实调用信息 — 全部来自后端返回,无伪造 */
interface CallTrace {
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  elapsedMs: number;
  blocked?: boolean;
  error?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
}

export function PreviewChat() {
  const openingMessage = useOrchestrationStore((s) => s.openingMessage);
  const presetQuestions = useOrchestrationStore((s) => s.presetQuestions);
  const systemPrompt = useOrchestrationStore((s) => s.systemPrompt);
  const toast = useToastStore((s) => s.addToast);

  // 多会话
  const [sessions, setSessions] = useState<ChatSession[]>([
    {
      id: 's1',
      title: '会话 1',
      messages: [{ role: 'bot', content: openingMessage || '你好!我是你的 AI 助手。' }],
    },
  ]);
  const [activeSessionId, setActiveSessionId] = useState('s1');
  const [showSessionList, setShowSessionList] = useState(false);
  const sessionListRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId)!;

  const [input, setInput] = useState('');
  const [debugMode, setDebugMode] = useState(false);
  const [running, setRunning] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession.messages]);

  useEffect(() => {
    // 更新开场白
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId && s.messages.length === 1 && s.messages[0].role === 'bot'
          ? {
              ...s,
              messages: [{ role: 'bot', content: openingMessage || '你好!我是你的 AI 助手。' }],
            }
          : s
      )
    );
  }, [openingMessage, activeSessionId]);

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sessionListRef.current && !sessionListRef.current.contains(e.target as Node))
        setShowSessionList(false);
    };
    if (showSessionList) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSessionList]);

  const createSession = () => {
    const id = `s${Date.now()}`;
    const session: ChatSession = {
      id,
      title: `会话 ${sessions.length + 1}`,
      messages: [{ role: 'bot', content: openingMessage || '你好!' }],
    };
    setSessions((prev) => [...prev, session]);
    setActiveSessionId(id);
    setShowSessionList(false);
    toast('新建会话', 'info');
  };

  const deleteSession = (id: string) => {
    if (sessions.length <= 1) {
      toast('至少保留一个会话', 'error');
      return;
    }
    const remaining = sessions.filter((s) => s.id !== id);
    setSessions(remaining);
    if (activeSessionId === id) setActiveSessionId(remaining[0].id);
  };

  /**
   * 发送消息 — 调用真实 /api/cockpit/chat,传入当前编排的 systemPrompt。
   * 历史消息取当前会话已有对话(转成 user/assistant),供后端多轮上下文。
   */
  const sendMessage = async () => {
    if (!input.trim() || running) return;
    const userMsg = input.trim();
    setInput('');

    // 构造历史(排除开场白 bot 消息,只取真实多轮)
    const history = activeSession.messages
      .filter((_, i) => i > 0 || activeSession.messages[0].role !== 'bot')
      .map((m) => ({
        role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      }));

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? { ...s, messages: [...s.messages, { role: 'user', content: userMsg }] }
          : s
      )
    );
    setRunning(true);

    try {
      const result = await studioApi.previewChat(userMsg, systemPrompt, history);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? {
                ...s,
                messages: [
                  ...s.messages,
                  {
                    role: 'bot',
                    content: result.reply || '(空回复)',
                    trace: {
                      model: result.model,
                      promptTokens: result.usage?.prompt_tokens,
                      completionTokens: result.usage?.completion_tokens,
                      elapsedMs: result.elapsedMs,
                      blocked: result.blocked,
                    },
                  },
                ],
              }
            : s
        )
      );
    } catch (err) {
      // 诚实暴露错误: 503 LiteLLM 未配置 / 502 调用失败 / 403 模型未授权 / 网络错误
      const isPreviewErr = err instanceof PreviewChatError;
      const status = isPreviewErr ? err.status : 0;
      const hint =
        status === 503
          ? 'LiteLLM 未配置,无法进行预览对话(后端不 mock 兜底)'
          : status === 502
            ? '对话服务调用失败,请稍后重试'
            : status === 403
              ? '当前模型未授权'
              : '预览对话请求失败';
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? {
                ...s,
                messages: [
                  ...s.messages,
                  {
                    role: 'bot',
                    content: `[预览失败] ${hint}`,
                    trace: { elapsedMs: 0, error: true },
                  },
                ],
              }
            : s
        )
      );
      toast(hint, 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white/[0.01]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.08] bg-white/[0.02] backdrop-blur-[8px] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-300">对话预览</span>
          <span className="text-[10px] text-slate-500">· {activeSession.title}</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Session controls */}
          <div className="relative" ref={sessionListRef}>
            <button
              onClick={() => setShowSessionList(!showSessionList)}
              className="text-[10px] text-slate-400 hover:text-primary transition-colors"
              title="会话记录"
            >
              📋 {sessions.length}
            </button>
            {showSessionList && (
              <div className="absolute top-full right-0 mt-1 w-52 bg-[#1e1e2e] rounded-xl shadow-lg border border-white/[0.1] overflow-hidden z-50">
                <div className="px-3 py-2 border-b border-white/[0.06]">
                  <span className="text-[10px] font-semibold text-slate-300">会话记录</span>
                </div>
                <div className="max-h-[180px] overflow-y-auto">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => {
                        setActiveSessionId(s.id);
                        setShowSessionList(false);
                      }}
                      className={`group flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${s.id === activeSessionId ? 'bg-primary/10' : 'hover:bg-white/[0.04]'}`}
                    >
                      <div>
                        <div
                          className={`text-[10px] truncate ${s.id === activeSessionId ? 'text-primary font-medium' : 'text-slate-300'}`}
                        >
                          {s.title}
                        </div>
                        <div className="text-[9px] text-slate-500">
                          {s.messages.length - 1} 条消息
                        </div>
                      </div>
                      {sessions.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSession(s.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-red-400 text-[8px]"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={createSession}
            className="text-[10px] text-primary font-medium hover:underline"
          >
            + 新建
          </button>

          {/* Debug toggle */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-white/[0.08]">
            <span className="text-[10px] text-slate-500">调试</span>
            <button
              onClick={() => setDebugMode(!debugMode)}
              className={`w-[30px] h-[16px] rounded-full relative transition-colors ${debugMode ? 'bg-primary' : 'bg-slate-600'}`}
            >
              <div
                className={`w-[14px] h-[14px] rounded-full bg-white shadow-sm absolute top-[1px] transition-transform ${debugMode ? 'translate-x-[14px]' : 'translate-x-[1px]'}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 hmr-scrollbar">
        {activeSession.messages.map((msg, i) =>
          msg.role === 'bot' ? (
            <div key={i} className="flex gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-sky-600 flex items-center justify-center text-white text-[9px] shrink-0">
                AI
              </div>
              <div className="border border-white/[0.1] bg-white/[0.04] rounded-[12px] rounded-bl-[3px] px-3 py-2 text-[12px] leading-[1.6] max-w-[90%] whitespace-pre-wrap text-slate-200">
                {msg.content}
              </div>
              {/* 调试信息: 真实调用元数据(model/usage/耗时),仅 bot 回复且有 trace 时展示 */}
              {debugMode && msg.trace && <TraceCard trace={msg.trace} />}
            </div>
          ) : (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex justify-end">
                <div className="bg-primary text-white rounded-[12px] rounded-br-[3px] px-3 py-2 text-[12px] max-w-[85%]">
                  {msg.content}
                </div>
              </div>
            </div>
          )
        )}
        {activeSession.messages.length <= 1 && presetQuestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 ml-8">
            {presetQuestions.map((q) => (
              <button
                key={q}
                onClick={() => setInput(q)}
                className="px-2.5 py-1 border border-white/[0.1] bg-white/[0.03] rounded-lg text-[10px] text-slate-400 hover:border-primary/50 hover:text-primary transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        {running && (
          <div className="flex items-center gap-2 ml-8 text-[11px] text-slate-500">
            <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            调用对话服务...
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/[0.08] flex items-center gap-2 shrink-0">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          className="flex-1 h-8 border border-white/[0.1] bg-white/[0.03] rounded-lg px-3 text-[12px] outline-none text-slate-200 placeholder:text-slate-500 focus:border-primary/50 focus:ring-[3px] focus:ring-primary/10"
          placeholder={debugMode ? '输入消息查看调用信息...' : '输入测试消息...'}
        />
        <button
          onClick={sendMessage}
          disabled={running}
          className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs disabled:opacity-50"
        >
          ↑
        </button>
      </div>
    </div>
  );
}

/** 调试信息卡片 — 展示真实调用元数据(model/token 用量/耗时),不伪造执行链路 */
function TraceCard({ trace }: { trace: CallTrace }) {
  const [expanded, setExpanded] = useState(true);

  const items: { label: string; value: string }[] = [];
  if (trace.error) {
    items.push({ label: '状态', value: '调用失败' });
  } else {
    if (trace.model) items.push({ label: '模型', value: trace.model });
    if (trace.promptTokens !== undefined)
      items.push({ label: '输入 tokens', value: String(trace.promptTokens) });
    if (trace.completionTokens !== undefined)
      items.push({ label: '输出 tokens', value: String(trace.completionTokens) });
    if (trace.blocked) items.push({ label: 'guardrail', value: '已拦截' });
    items.push({ label: '耗时', value: `${trace.elapsedMs}ms` });
  }

  return (
    <div className="ml-8 mt-1 bg-primary/[0.03] border border-primary/20 rounded-xl overflow-hidden text-[10px] w-fit max-w-[90%]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-primary/[0.04] transition-colors"
      >
        <span className="font-medium text-primary">{expanded ? '▾' : '▸'} 调用信息</span>
        {!trace.error && (
          <span className="text-[9px] text-slate-500 font-mono">{trace.elapsedMs}ms</span>
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-2 flex flex-col gap-1">
          {items.map((item, si) => (
            <div key={si} className="flex items-center gap-3">
              <span className="text-[9px] text-slate-500 w-16 shrink-0">{item.label}</span>
              <span className="text-[10px] text-slate-300 font-mono truncate">{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
