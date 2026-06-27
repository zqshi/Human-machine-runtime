/**
 * AppCreateFlow — 轻应用对话式 Workspace 开发(真实链路,路径B)。
 *
 * 设计源模式：
 * - 左栏: 对话（与 AI 协作开发应用）
 * - 右栏: 三Tab — 文件树 / 创建日志 / 预览
 *
 * T52:接真实 tool-loop dispatch(LLM 经 write_file 真实创建文件),替换原 MOCK_TERMINAL 假表演。
 * 文件从 sandbox 读取端点 GET /agent/sandbox/:instanceId/files 真实展示(search 递归子树 → buildFileTree 构建嵌套树)。
 * 预览:POST /agent/sandbox/:instanceId/preview 在 sandbox 内 npm install + vite dev,返回 URL → iframe 展示。
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useToastStore } from '../../../../application/stores/toastStore';
import { Icon } from '../../../components/ui/Icon';
import { buildFileTree, type FileNode, type SandboxEntry } from './fileTree';

interface Props {
  onBack: () => void;
}

interface ChatMsg {
  id: number;
  role: 'user' | 'bot';
  content: string;
}

type RightTab = 'files' | 'terminal' | 'preview';

/** studio 专用 sandbox instance(隔离目录 app-studio,不依赖业务 instance 选择) */
const STUDIO_INSTANCE = 'app-studio';

export function AppCreateFlow({ onBack }: Props) {
  const toast = useToastStore((s) => s.addToast);

  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: 0,
      role: 'bot',
      content:
        '你好！我是应用开发助手。\n\n描述你想创建的应用，我会真实生成项目文件（React/TS 代码）。\n\n你想创建什么样的应用？',
    },
  ]);
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [rightTab, setRightTab] = useState<RightTab>('files');
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string>('');
  const [logLines, setLogLines] = useState<string[]>([]);
  const [appReady, setAppReady] = useState(false);
  /** 展开的目录 path 集合(文件树递归展开/折叠) */
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  /** 应用预览:sandbox 内 vite dev 的可访问 URL(null=未启动) */
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLog, setPreviewLog] = useState<string | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addBot = useCallback(
    (content: string) =>
      setMessages((prev) => [...prev, { id: Date.now() + Math.random(), role: 'bot', content }]),
    []
  );
  const addLog = useCallback(
    (line: string) =>
      setLogLines((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${line}`]),
    []
  );

  /** 切换目录展开/折叠 */
  const toggleDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  /** 文件树加载后默认展开所有目录(小应用文件少,全展开便于浏览) */
  useEffect(() => {
    const collectDirs = (nodes: FileNode[]): string[] =>
      nodes.flatMap((n) => (n.type === 'dir' ? [n.path, ...collectDirs(n.children ?? [])] : []));
    setExpandedDirs(new Set(collectDirs(files)));
  }, [files]);

  /** 轮询任务状态直到 completed/failed */
  const pollTaskStatus = useCallback(
    async (
      taskId: string
    ): Promise<{ conclusion?: string; toolCallsLog?: unknown[]; error?: string }> => {
      for (let i = 0; i < 30; i++) {
        await sleep(1500);
        const res = await fetch(`/api/openclaw/agent/status/${taskId}`, {
          credentials: 'include',
        });
        const data = await res.json();
        const state = data.state ?? data.data?.state;
        if (state === 'completed') {
          const out = data.output ?? data.data?.output ?? {};
          return { conclusion: out.conclusion, toolCallsLog: out.toolCallsLog };
        }
        if (state === 'failed') {
          return { error: data.error ?? data.data?.error ?? '任务执行失败' };
        }
      }
      return { error: '任务超时(30 轮询未完成)' };
    },
    []
  );

  /** 从 sandbox 读取文件树(search 递归返回子树 → buildFileTree 按路径构建嵌套树) */
  const loadSandboxFiles = useCallback(async (): Promise<FileNode[]> => {
    const res = await fetch(`/api/openclaw/agent/sandbox/${STUDIO_INSTANCE}/files?path=.`, {
      credentials: 'include',
    });
    const data = await res.json();
    const entries: SandboxEntry[] = data?.data?.entries ?? [];
    return buildFileTree(entries);
  }, []);

  /** 读取 sandbox 单个文件内容 */
  const loadFileContent = useCallback(async (path: string): Promise<string> => {
    const res = await fetch(
      `/api/openclaw/agent/sandbox/${STUDIO_INSTANCE}/files?path=${encodeURIComponent(path)}`,
      { credentials: 'include' }
    );
    const data = await res.json();
    return data?.success ? String(data.data?.content ?? '') : '(读取失败)';
  }, []);

  const handleSend = useCallback(async () => {
    const userMsg = input.trim();
    if (!userMsg || processing) return;
    setInput('');
    setProcessing(true);
    setMessages((prev) => [...prev, { id: Date.now(), role: 'user', content: userMsg }]);
    addLog(`用户请求: ${userMsg.slice(0, 80)}`);

    try {
      addLog('→ dispatch tool-loop 任务(app-studio sandbox)');
      // 真实 dispatch:LLM 经 tool-loop 调 write_file 真实创建文件
      const dispatchRes = await fetch('/api/openclaw/agent/dispatch', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'studio-create-app',
          description: `创建应用: ${userMsg.slice(0, 60)}`,
          input: {
            prompt: `创建一个应用。需求: ${userMsg}\n\n用 write_file 工具在 src/ 目录下创建必要的代码文件(如 App.tsx)。用合理的项目结构。创建后用 read_file 确认。`,
            instanceId: STUDIO_INSTANCE,
          },
          framework: 'tool-loop',
        }),
      });
      const dispatchData = await dispatchRes.json();
      const taskId = dispatchData.taskId ?? dispatchData.data?.taskId;
      if (!taskId) {
        throw new Error(dispatchData.error ?? 'dispatch 失败');
      }
      addLog(`✓ 任务已派发 taskId=${taskId.slice(0, 16)}...`);

      setRightTab('terminal');
      const result = await pollTaskStatus(taskId);
      if (result.error) {
        addLog(`✗ 任务失败: ${result.error}`);
        addBot(`抱歉,创建失败: ${result.error}`);
        setProcessing(false);
        return;
      }

      const toolCount = result.toolCallsLog?.length ?? 0;
      addLog(`✓ 任务完成: 执行 ${toolCount} 次工具调用`);

      // 从 sandbox 读取真实创建的文件
      addLog('→ 读取 sandbox 创建的文件');
      const fileTree = await loadSandboxFiles();
      setFiles(fileTree);
      setAppReady(true);
      setRightTab('files');

      const conclusion = result.conclusion || '应用文件已创建';
      addBot(
        `✅ **应用已创建！**\n\n${conclusion}\n\n- 在「文件」Tab 查看真实创建的代码\n- 在「终端」Tab 查看创建日志\n\n需要调整或新增文件吗？`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`✗ 错误: ${msg}`);
      addBot(`抱歉,创建过程出错: ${msg}`);
      toast('创建失败,请检查服务', 'error');
    } finally {
      setProcessing(false);
    }
  }, [input, processing, addBot, addLog, pollTaskStatus, loadSandboxFiles, toast]);

  const onSelectFile = useCallback(
    async (node: FileNode) => {
      if (node.type !== 'file') return;
      setSelectedFile(node.path);
      setSelectedFileContent('(加载中...)');
      const content = await loadFileContent(node.path);
      setSelectedFileContent(content);
    },
    [loadFileContent]
  );

  /** 递归渲染文件树节点(目录可展开/折叠,深度缩进) */
  const renderFileNode = (node: FileNode, depth: number) => {
    const isDir = node.type === 'dir';
    const expanded = expandedDirs.has(node.path);
    return (
      <div key={node.path}>
        <button
          onClick={() => (isDir ? toggleDir(node.path) : onSelectFile(node))}
          style={{ paddingLeft: `${depth * 10 + 6}px` }}
          className={`w-full flex items-center gap-1 py-1 pr-2 rounded text-[10px] transition-colors ${!isDir && selectedFile === node.path ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:bg-white/[0.04]'}`}
        >
          <span className="shrink-0">{isDir ? (expanded ? '📂' : '📁') : '📄'}</span>
          <span className="truncate">{node.name}</span>
        </button>
        {isDir && expanded && (node.children ?? []).map((c) => renderFileNode(c, depth + 1))}
      </div>
    );
  };

  /** 启动应用预览:sandbox 内 npm install + vite dev,返回可访问 URL → iframe 展示 */
  const startPreview = useCallback(async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewUrl(null);
    setPreviewLog(null);
    addLog('→ 启动预览(sandbox 内 npm install + vite dev,首次较慢)');
    setRightTab('preview');
    try {
      // npm install 可能 120s + vite 8s,超时给 150s
      const res = await fetch(`/api/openclaw/agent/sandbox/${STUDIO_INSTANCE}/preview`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(150_000),
      });
      const data = await res.json();
      if (data?.success && data.url) {
        setPreviewUrl(data.url);
        if (data.installLog) setPreviewLog(String(data.installLog));
        addLog(`✓ 预览就绪: ${data.url}`);
      } else {
        const err = data?.error ?? '预览启动失败';
        setPreviewError(err);
        if (data?.installLog) setPreviewLog(String(data.installLog));
        addLog(`✗ 预览失败: ${err}`);
        toast('预览启动失败,请确认应用含 vite 依赖', 'error');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setPreviewError(`请求失败: ${msg}(可能 npm install 超时)`);
      addLog(`✗ 预览请求失败: ${msg}`);
    } finally {
      setPreviewLoading(false);
    }
  }, [addLog, toast]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-[48px] flex items-center justify-between px-5 border-b border-white/[0.08] bg-white/[0.02] shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-[11px] text-slate-400 hover:text-primary transition-colors flex items-center gap-1"
          >
            <Icon name="arrow_back" size={13} /> 返回
          </button>
          <h2 className="text-[13px] font-semibold text-slate-100">App Workspace</h2>
          <span className="text-[10px] text-emerald-400/70">真实创建(sandbox)</span>
        </div>
        {appReady && (
          <button
            onClick={() => {
              toast('应用文件已保存至 sandbox', 'success');
              onBack();
            }}
            className="h-7 px-3 rounded-lg text-[11px] font-medium bg-emerald-600 text-white hover:opacity-90"
          >
            完成
          </button>
        )}
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Chat */}
        <div className="flex-1 flex flex-col min-w-[320px] border-r border-white/[0.06]">
          <div className="flex-1 p-4 overflow-y-auto hmr-scrollbar">
            <div className="flex flex-col gap-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  {m.role === 'bot' && (
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-[9px] shrink-0">
                      AI
                    </div>
                  )}
                  <div
                    className={`rounded-[12px] px-3 py-2 text-[12px] leading-[1.6] max-w-[85%] whitespace-pre-wrap ${m.role === 'user' ? 'bg-primary text-white rounded-br-[3px]' : 'border border-white/[0.1] bg-white/[0.04] text-slate-200 rounded-bl-[3px]'}`}
                  >
                    {renderContent(m.content)}
                  </div>
                </div>
              ))}
              {processing && (
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
                    <div className="w-3 h-3 border-[1.5px] border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                  <div className="border border-white/[0.1] bg-white/[0.04] rounded-[12px] rounded-bl-[3px] px-3 py-2 text-[12px] text-slate-500">
                    AI 正在创建文件...
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
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="描述你想创建的应用..."
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

        {/* Right: Files / Terminal / Preview */}
        <div className="w-[45%] min-w-[340px] flex flex-col">
          <div className="flex px-4 pt-2 gap-0 border-b border-white/[0.06]">
            <button
              onClick={() => setRightTab('files')}
              className={`px-3.5 py-2.5 text-[10px] font-medium border-b-2 transition-colors ${rightTab === 'files' ? 'text-primary border-primary' : 'text-slate-500 border-transparent'}`}
            >
              📁 文件
            </button>
            <button
              onClick={() => setRightTab('terminal')}
              className={`px-3.5 py-2.5 text-[10px] font-medium border-b-2 transition-colors ${rightTab === 'terminal' ? 'text-primary border-primary' : 'text-slate-500 border-transparent'}`}
            >
              📋 创建日志
            </button>
            <button
              onClick={() => setRightTab('preview')}
              className={`px-3.5 py-2.5 text-[10px] font-medium border-b-2 transition-colors ${rightTab === 'preview' ? 'text-primary border-primary' : 'text-slate-500 border-transparent'}`}
            >
              👁️ 预览
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {rightTab === 'files' && (
              <div className="flex h-full">
                <div className="w-44 border-r border-white/[0.06] p-2 overflow-y-auto hmr-scrollbar">
                  {files.length === 0 ? (
                    <div className="text-[10px] text-slate-500 px-2 py-4 text-center">
                      尚未创建文件
                    </div>
                  ) : (
                    files.map((f) => renderFileNode(f, 0))
                  )}
                </div>
                <div className="flex-1 p-3 overflow-auto">
                  {selectedFileContent ? (
                    <pre className="text-[10px] font-mono text-emerald-300 leading-[1.6] whitespace-pre-wrap bg-[#0d1117] rounded-xl p-3">
                      {selectedFileContent}
                    </pre>
                  ) : (
                    <div className="flex items-center justify-center h-full text-[11px] text-slate-500">
                      选择文件查看内容
                    </div>
                  )}
                </div>
              </div>
            )}

            {rightTab === 'terminal' && (
              <div className="h-full bg-[#0d1117] p-4 overflow-auto">
                <pre className="text-[10px] font-mono leading-[1.7]">
                  {logLines.length === 0 ? (
                    <span className="text-slate-500">等待创建任务...</span>
                  ) : (
                    logLines.map((line, i) => (
                      <div
                        key={i}
                        className={
                          line.includes('✗')
                            ? 'text-red-400'
                            : line.includes('✓')
                              ? 'text-emerald-300'
                              : 'text-slate-400'
                        }
                      >
                        {line}
                      </div>
                    ))
                  )}
                </pre>
              </div>
            )}

            {rightTab === 'preview' && (
              <div className="h-full flex flex-col bg-gradient-to-br from-slate-900 to-slate-800">
                {!appReady ? (
                  <div className="flex-1 flex items-center justify-center text-[11px] text-slate-500">
                    等待应用创建...
                  </div>
                ) : previewLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
                    <div className="w-8 h-8 border-[1.5px] border-primary border-t-transparent rounded-full animate-spin mb-3" />
                    <div className="text-[12px] font-bold text-white mb-1">正在构建预览</div>
                    <div className="text-[10px] text-slate-400 leading-[1.6]">
                      sandbox 内 npm install + 启动 vite dev
                      <br />
                      首次构建较慢(可达 2 分钟),请勿离开...
                    </div>
                    {previewLog && (
                      <pre className="mt-3 max-h-32 overflow-auto text-[9px] font-mono text-slate-500 bg-[#0d1117] rounded-lg p-2 max-w-full">
                        {previewLog}
                      </pre>
                    )}
                  </div>
                ) : previewUrl ? (
                  <iframe
                    src={previewUrl}
                    title="应用预览"
                    className="flex-1 w-full bg-white"
                    sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
                    <div className="text-[14px] font-bold text-white mb-2">应用预览</div>
                    <p className="text-[11px] text-slate-400 leading-[1.6] mb-4">
                      在 sandbox 内安装依赖并启动 vite dev server,
                      <br />
                      实时预览 AI 生成的应用运行效果。
                    </p>
                    <button
                      onClick={startPreview}
                      className="h-8 px-4 rounded-lg text-[11px] font-medium bg-primary text-white hover:opacity-90"
                    >
                      ▶ 启动预览
                    </button>
                    {previewError && (
                      <div className="mt-4 max-w-full">
                        <pre className="text-[10px] font-mono text-red-400 bg-red-950/30 rounded-lg p-2 whitespace-pre-wrap">
                          {previewError}
                        </pre>
                        {previewLog && (
                          <pre className="mt-2 max-h-24 overflow-auto text-[9px] font-mono text-slate-500 bg-[#0d1117] rounded-lg p-2">
                            {previewLog}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function renderContent(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    return <span key={i}>{part}</span>;
  });
}
