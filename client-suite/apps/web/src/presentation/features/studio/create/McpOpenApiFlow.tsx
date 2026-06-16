/**
 * McpOpenApiFlow — OpenAPI 对话式接入
 *
 * 设计源模式：左对话 + 右4Tab实时面板（端点发现 → Swagger → Higress MCP → mcporter）
 * AI 自动完成全流程，用户只需提供文档链接或描述。
 */
import { useState, useRef, useEffect } from 'react';
import { useToastStore } from '../../../../application/stores/toastStore';
import { Icon } from '../../../components/ui/Icon';

interface Props {
  onBack: () => void;
}

interface ChatMsg {
  id: number;
  role: 'user' | 'bot';
  content: string;
}

const MOCK_ENDPOINTS = [
  { method: 'GET', path: '/api/v1/users', name: '获取用户列表' },
  { method: 'POST', path: '/api/v1/users', name: '创建用户' },
  { method: 'GET', path: '/api/v1/orders', name: '获取订单列表' },
];

type RightTab = 'endpoints' | 'swagger' | 'higress' | 'mcporter';

export function McpOpenApiFlow({ onBack }: Props) {
  const toast = useToastStore((s) => s.addToast);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: 0,
      role: 'bot',
      content:
        '你好！我是接入助手。提供 API 文档链接或描述你要接入的服务，我会自动完成：\n\n1. 抓取并解析文档内容\n2. 生成 OpenAPI (Swagger) 规范\n3. 通过 Higress 网关导入为 MCP 服务\n4. 生成 mcporter CLI 命令\n\n请开始吧！',
    },
  ]);
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState(0); // 0=waiting, 1=endpoints, 2=swagger, 3=higress, 4=mcporter, 5=done
  const [activeTab, setActiveTab] = useState<RightTab>('endpoints');
  const [processing, setProcessing] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addBot = (content: string) =>
    setMessages((prev) => [...prev, { id: Date.now() + Math.random(), role: 'bot', content }]);

  const runFlow = async () => {
    setProcessing(true);
    await delay(800);
    addBot('收到！正在连接并解析文档...');
    setPhase(1);
    setActiveTab('endpoints');
    await delay(1200);
    addBot('文档解析完成！发现 **3 个 API 端点**，请在右侧查看。\n\n接下来生成 OpenAPI 规范...');
    await delay(1200);
    setPhase(2);
    setActiveTab('swagger');
    addBot('OpenAPI 3.0 规范生成完毕！包含完整 Schema 和认证配置。\n\n正在导入 Higress 网关...');
    await delay(1200);
    setPhase(3);
    setActiveTab('higress');
    addBot('Higress 网关配置完成！MCP 服务已上线。\n\n生成 mcporter 配置...');
    await delay(1000);
    setPhase(4);
    setActiveTab('mcporter');
    addBot('🎉 **全部完成！** 服务已注册，可在 Agent 中通过工具调用。');
    setPhase(5);
    setProcessing(false);
  };

  const handleSend = () => {
    if (!input.trim() || processing) return;
    setMessages((prev) => [...prev, { id: Date.now(), role: 'user', content: input }]);
    setInput('');
    if (phase === 0) runFlow();
  };

  const TABS: { key: RightTab; label: string }[] = [
    { key: 'endpoints', label: '端点发现' },
    { key: 'swagger', label: 'Swagger' },
    { key: 'higress', label: 'Higress MCP' },
    { key: 'mcporter', label: 'mcporter' },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-[48px] flex items-center px-5 border-b border-white/[0.08] bg-white/[0.02] shrink-0">
        <button
          onClick={onBack}
          className="text-[11px] text-slate-400 hover:text-primary transition-colors flex items-center gap-1"
        >
          <Icon name="arrow_back" size={13} /> 返回
        </button>
        <div className="ml-3">
          <h2 className="text-[13px] font-semibold text-slate-100">OpenAPI 接入</h2>
          <p className="text-[9px] text-slate-500">通过对话快速将 API 文档转为 MCP 工具</p>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Chat */}
        <div className="flex-1 flex flex-col min-w-[340px] border-r border-white/[0.06]">
          <div className="flex-1 p-4 overflow-y-auto dcf-scrollbar">
            <div className="flex flex-col gap-3 max-w-[480px]">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  {m.role === 'bot' && (
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-[9px] shrink-0">
                      AI
                    </div>
                  )}
                  <div
                    className={`rounded-[12px] px-3 py-2 text-[12px] leading-[1.6] max-w-[85%] whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-primary text-white rounded-br-[3px]'
                        : 'border border-white/[0.1] bg-white/[0.04] text-slate-200 rounded-bl-[3px]'
                    }`}
                  >
                    {renderContent(m.content)}
                  </div>
                </div>
              ))}
              {processing && (
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0">
                    <div className="w-3 h-3 border-[1.5px] border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                  <div className="border border-white/[0.1] bg-white/[0.04] rounded-[12px] rounded-bl-[3px] px-3 py-2 text-[12px] text-slate-500">
                    处理中...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </div>
          <div className="px-4 pb-3 pt-2 border-t border-white/[0.08] flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())
              }
              placeholder={processing ? '处理中...' : '输入 API 文档链接或描述...'}
              disabled={processing}
              className="flex-1 h-8 border border-white/[0.1] bg-white/[0.03] rounded-lg px-3 text-[12px] outline-none text-slate-200 placeholder:text-slate-500 focus:border-primary/50 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || processing}
              className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs disabled:opacity-30"
            >
              ↑
            </button>
          </div>
        </div>

        {/* Right: Result Panel */}
        <div className="w-[45%] min-w-[340px] flex flex-col bg-white/[0.01]">
          <div className="flex px-4 pt-2 gap-0 border-b border-white/[0.06]">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3 py-2.5 text-[10px] font-medium border-b-2 transition-colors ${
                  activeTab === t.key
                    ? 'text-primary border-primary'
                    : 'text-slate-500 border-transparent'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex-1 p-4 overflow-y-auto dcf-scrollbar">
            {activeTab === 'endpoints' &&
              (phase >= 1 ? (
                <div className="space-y-2">
                  {MOCK_ENDPOINTS.map((ep) => (
                    <div
                      key={ep.path + ep.method}
                      className="border border-white/[0.1] bg-white/[0.03] rounded-xl p-3"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${ep.method === 'GET' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-sky-500/10 text-sky-400'}`}
                        >
                          {ep.method}
                        </span>
                        <span className="text-[11px] font-mono text-slate-300">{ep.path}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">{ep.name}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="等待输入 API 文档链接..." />
              ))}
            {activeTab === 'swagger' &&
              (phase >= 2 ? (
                <CodeBlock code={MOCK_SWAGGER} />
              ) : (
                <EmptyState text="等待端点解析完成..." />
              ))}
            {activeTab === 'higress' &&
              (phase >= 3 ? (
                <CodeBlock code={MOCK_HIGRESS} />
              ) : (
                <EmptyState text="等待 Swagger 生成..." />
              ))}
            {activeTab === 'mcporter' &&
              (phase >= 4 ? (
                <CodeBlock code={MOCK_MCPORTER} />
              ) : (
                <EmptyState text="等待 Higress 配置..." />
              ))}
          </div>
          {phase === 5 && (
            <div className="px-4 pb-3 pt-2 border-t border-white/[0.06] flex justify-end">
              <button
                onClick={() => {
                  toast('MCP 工具已创建', 'success');
                  onBack();
                }}
                className="h-7 px-4 rounded-lg text-[11px] font-medium bg-primary text-white hover:opacity-90"
              >
                完成
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center h-full text-[11px] text-slate-500">{text}</div>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="bg-[#0d1117] text-emerald-300 rounded-xl p-4 text-[10px] font-mono leading-[1.6] overflow-x-auto whitespace-pre-wrap">
      {code}
    </pre>
  );
}

function renderContent(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    return <span key={i}>{part}</span>;
  });
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const MOCK_SWAGGER = `openapi: "3.0.3"
info:
  title: 用户服务 API
  version: "1.0.0"
paths:
  /api/v1/users:
    get:
      summary: 获取用户列表
    post:
      summary: 创建用户
  /api/v1/orders:
    get:
      summary: 获取订单列表`;

const MOCK_HIGRESS = `{
  "apiVersion": "networking.higress.io/v1",
  "kind": "McpBridge",
  "spec": {
    "servers": [{
      "name": "user-service-mcp",
      "type": "openapi",
      "tools": [
        { "name": "listUsers" },
        { "name": "createUser" },
        { "name": "listOrders" }
      ]
    }]
  }
}`;

const MOCK_MCPORTER = `{
  "mcpServers": {
    "user-service-mcp": {
      "url": "https://mcp.clawmate.cn/user-service-mcp/sse",
      "headers": {
        "Authorization": "Bearer \${CLAWHUB_TOKEN}"
      }
    }
  }
}`;
