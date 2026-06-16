/**
 * PreviewChat — 右栏预览对话 + 调试模式（暗色主题）
 *
 * 完整功能：
 * - 多会话支持（新建 / 历史列表 / 切换 / 删除）
 * - 调试模式（Agent Loop Trace 执行链路可视化）
 * - 预设问题快捷入口
 */
import { useState, useRef, useEffect } from 'react';
import { useOrchestrationStore } from '../../../../application/stores/orchestrationStore';
import { useToastStore } from '../../../../application/stores/toastStore';

interface ChatMessage {
  role: 'user' | 'bot';
  content: string;
}

interface TraceStep {
  type: 'prompt' | 'retrieval' | 'thinking' | 'action' | 'observation' | 'response';
  label: string;
  detail: string;
  duration: number;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  traces: { input: string; steps: TraceStep[]; totalMs: number }[];
}

function simulateTrace(input: string, promptLen: number, mcpCount: number): TraceStep[] {
  const steps: TraceStep[] = [];
  const tokens = Math.floor(promptLen / 4) + Math.floor(input.length / 4);

  steps.push({
    type: 'prompt',
    label: 'Prompt 组装',
    detail: `system(${promptLen}c) + history + user → ${tokens + 320} tokens`,
    duration: 15,
  });

  if (mcpCount > 0) {
    steps.push({
      type: 'retrieval',
      label: 'RAG 检索',
      detail: `向量检索 → 命中 ${Math.floor(Math.random() * 3) + 2} 段落`,
      duration: Math.floor(Math.random() * 150) + 80,
    });
  }

  steps.push({
    type: 'thinking',
    label: '[Loop 1] Agent 思考',
    detail: '分析意图，决定调用工具',
    duration: Math.floor(Math.random() * 800) + 600,
  });
  steps.push({
    type: 'action',
    label: '[Loop 1] Action: Tool Call',
    detail: `执行工具调用`,
    duration: Math.floor(Math.random() * 400) + 200,
  });
  steps.push({
    type: 'observation',
    label: '[Loop 1] Observation',
    detail: `返回结果，准备生成回复`,
    duration: Math.floor(Math.random() * 200) + 80,
  });
  steps.push({
    type: 'thinking',
    label: '[Loop 2] Agent 思考',
    detail: '信息充足，生成结构化回复',
    duration: Math.floor(Math.random() * 500) + 300,
  });
  steps.push({
    type: 'response',
    label: '[Finish] 生成回复',
    detail: `Agent Loop 完成 (2 轮) | output_tokens: ${Math.floor(Math.random() * 300) + 200}`,
    duration: Math.floor(Math.random() * 200) + 100,
  });

  return steps;
}

const TRACE_ICONS: Record<TraceStep['type'], string> = {
  prompt: '📋',
  retrieval: '🔍',
  thinking: '🧠',
  action: '⚡',
  observation: '👁️',
  response: '✅',
};

export function PreviewChat() {
  const openingMessage = useOrchestrationStore((s) => s.openingMessage);
  const presetQuestions = useOrchestrationStore((s) => s.presetQuestions);
  const systemPrompt = useOrchestrationStore((s) => s.systemPrompt);
  const mcpRefs = useOrchestrationStore((s) => s.mcpRefs);
  const toast = useToastStore((s) => s.addToast);

  // 多会话
  const [sessions, setSessions] = useState<ChatSession[]>([
    {
      id: 's1',
      title: '会话 1',
      messages: [{ role: 'bot', content: openingMessage || '你好！我是你的 AI 助手。' }],
      traces: [],
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
              messages: [{ role: 'bot', content: openingMessage || '你好！我是你的 AI 助手。' }],
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
      messages: [{ role: 'bot', content: openingMessage || '你好！' }],
      traces: [],
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

  const sendMessage = () => {
    if (!input.trim() || running) return;
    const userMsg = input.trim();
    setInput('');

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? { ...s, messages: [...s.messages, { role: 'user', content: userMsg }] }
          : s
      )
    );

    if (debugMode) {
      setRunning(true);
      const steps = simulateTrace(userMsg, systemPrompt.length, mcpRefs.length);
      const totalMs = steps.reduce((sum, st) => sum + st.duration, 0);
      setTimeout(() => {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId
              ? {
                  ...s,
                  messages: [
                    ...s.messages,
                    {
                      role: 'bot',
                      content: `针对「${userMsg}」的分析完成。\n\n**结论：** 已生成优化建议。\n\n_耗时 ${totalMs}ms_`,
                    },
                  ],
                  traces: [...s.traces, { input: userMsg, steps, totalMs }],
                }
              : s
          )
        );
        setRunning(false);
      }, 800);
    } else {
      setTimeout(() => {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId
              ? {
                  ...s,
                  messages: [
                    ...s.messages,
                    {
                      role: 'bot',
                      content: `针对「${userMsg}」，我来分析一下...\n\n基于系统提示词(${systemPrompt.length}字符)的设定，这是一个典型的处理场景。`,
                    },
                  ],
                }
              : s
          )
        );
      }, 600);
    }
  };

  // 计算 trace 索引
  const getTraceForMsg = (
    msgIdx: number
  ): { input: string; steps: TraceStep[]; totalMs: number } | null => {
    const userMsgs = activeSession.messages.slice(0, msgIdx + 1).filter((m) => m.role === 'user');
    const traceIdx = userMsgs.length - 1;
    return activeSession.traces[traceIdx] ?? null;
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
      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 dcf-scrollbar">
        {activeSession.messages.map((msg, i) =>
          msg.role === 'bot' ? (
            <div key={i} className="flex gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-sky-600 flex items-center justify-center text-white text-[9px] shrink-0">
                AI
              </div>
              <div className="border border-white/[0.1] bg-white/[0.04] rounded-[12px] rounded-bl-[3px] px-3 py-2 text-[12px] leading-[1.6] max-w-[90%] whitespace-pre-wrap text-slate-200">
                {msg.content}
              </div>
            </div>
          ) : (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex justify-end">
                <div className="bg-primary text-white rounded-[12px] rounded-br-[3px] px-3 py-2 text-[12px] max-w-[85%]">
                  {msg.content}
                </div>
              </div>
              {/* Debug trace inline */}
              {debugMode && getTraceForMsg(i) && <TraceCard trace={getTraceForMsg(i)!} />}
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
            执行中，追踪链路...
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
          placeholder={debugMode ? '输入消息查看执行链路...' : '输入测试消息...'}
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

/** Inline trace card shown below user messages in debug mode */
function TraceCard({ trace }: { trace: { input: string; steps: TraceStep[]; totalMs: number } }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="ml-8 mt-1 bg-primary/[0.03] border border-primary/20 rounded-xl overflow-hidden text-[10px]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-primary/[0.04] transition-colors"
      >
        <span className="font-medium text-primary">{expanded ? '▾' : '▸'} 执行链路</span>
        <span className="text-[9px] text-slate-500 font-mono">{trace.totalMs}ms</span>
      </button>
      {expanded && (
        <div className="px-3 pb-2 flex flex-col gap-1">
          {trace.steps.map((step, si) => (
            <div key={si} className="flex items-start gap-1.5 relative">
              {si < trace.steps.length - 1 && (
                <div className="absolute left-[7px] top-4 bottom-0 w-px bg-primary/10" />
              )}
              <span className="text-[10px] shrink-0 relative z-10">{TRACE_ICONS[step.type]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-300">{step.label}</span>
                  <span className="text-[9px] text-slate-500 font-mono">{step.duration}ms</span>
                </div>
                <div className="text-[9px] text-slate-500 truncate">{step.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
