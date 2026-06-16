/**
 * AppCreateFlow — 轻应用对话式 Workspace 开发
 *
 * 设计源模式：
 * - 左栏: 对话（与 AI 协作开发应用）
 * - 右栏: 三Tab — 文件树 / 终端 / 预览
 *
 * AI 自动生成应用代码，用户可在右侧实时查看文件、终端输出和预览效果。
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

interface AppFile {
  name: string;
  type: 'file' | 'folder';
  indent: number;
  content?: string;
}

type RightTab = 'files' | 'terminal' | 'preview';

const INITIAL_FILES: AppFile[] = [
  { name: 'src/', type: 'folder', indent: 0 },
  { name: 'App.tsx', type: 'file', indent: 1, content: '// 等待生成...' },
  {
    name: 'main.tsx',
    type: 'file',
    indent: 1,
    content:
      'import { createRoot } from "react-dom/client"\nimport App from "./App"\n\ncreateRoot(document.getElementById("root")!).render(<App />)',
  },
  { name: 'index.css', type: 'file', indent: 1, content: '/* 全局样式 */' },
  {
    name: 'package.json',
    type: 'file',
    indent: 0,
    content: '{\n  "name": "my-app",\n  "private": true,\n  "version": "0.0.1"\n}',
  },
];

const MOCK_TERMINAL = [
  '$ npm install',
  'added 1423 packages in 12s',
  '',
  '$ npm run dev',
  '',
  '  VITE v5.4.1  ready in 312 ms',
  '  ➜  Local:   http://localhost:5173/',
];

export function AppCreateFlow({ onBack }: Props) {
  const toast = useToastStore((s) => s.addToast);

  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: 0,
      role: 'bot',
      content:
        '你好！我是应用开发助手。\n\n描述你想创建的应用，我会帮你：\n1. 生成项目结构和代码\n2. 安装依赖并启动开发服务器\n3. 实时预览应用效果\n\n你想创建什么样的应用？',
    },
  ]);
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [rightTab, setRightTab] = useState<RightTab>('files');
  const [files, setFiles] = useState<AppFile[]>(INITIAL_FILES);
  const [selectedFile, setSelectedFile] = useState<string | null>('App.tsx');
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addBot = (content: string) =>
    setMessages((prev) => [...prev, { id: Date.now() + Math.random(), role: 'bot', content }]);

  const handleSend = () => {
    if (!input.trim() || processing) return;
    const userMsg = input.trim();
    setMessages((prev) => [...prev, { id: Date.now(), role: 'user', content: userMsg }]);
    setInput('');
    setProcessing(true);

    // Phase 1: 生成代码
    setTimeout(() => {
      addBot('好的，正在生成应用代码...');
      setRightTab('files');

      setTimeout(() => {
        const genFiles: AppFile[] = [
          { name: 'src/', type: 'folder', indent: 0 },
          {
            name: 'App.tsx',
            type: 'file',
            indent: 1,
            content: `import { useState } from 'react'\n\nexport default function App() {\n  const [count, setCount] = useState(0)\n\n  return (\n    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">\n      <div className="text-center">\n        <h1 className="text-3xl font-bold text-white mb-4">${userMsg.slice(0, 30)}</h1>\n        <p className="text-slate-400 mb-6">由 AI 自动生成的轻应用</p>\n        <button\n          onClick={() => setCount(c => c + 1)}\n          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"\n        >\n          点击计数: {count}\n        </button>\n      </div>\n    </div>\n  )\n}`,
          },
          {
            name: 'main.tsx',
            type: 'file',
            indent: 1,
            content:
              'import { createRoot } from "react-dom/client"\nimport App from "./App"\nimport "./index.css"\n\ncreateRoot(document.getElementById("root")!).render(<App />)',
          },
          {
            name: 'index.css',
            type: 'file',
            indent: 1,
            content: '@tailwind base;\n@tailwind components;\n@tailwind utilities;',
          },
          { name: 'components/', type: 'folder', indent: 1 },
          {
            name: 'package.json',
            type: 'file',
            indent: 0,
            content: `{\n  "name": "${userMsg.slice(0, 20).replace(/\s/g, '-').toLowerCase()}",\n  "private": true,\n  "version": "0.0.1",\n  "dependencies": {\n    "react": "^19.0.0",\n    "react-dom": "^19.0.0"\n  }\n}`,
          },
          {
            name: 'vite.config.ts',
            type: 'file',
            indent: 0,
            content:
              'import { defineConfig } from "vite"\nimport react from "@vitejs/plugin-react"\n\nexport default defineConfig({\n  plugins: [react()]\n})',
          },
        ];
        setFiles(genFiles);
        addBot('代码生成完毕 ✓ 正在安装依赖...');

        // Phase 2: 安装依赖 + 启动
        setRightTab('terminal');
        let lineIdx = 0;
        const addLine = () => {
          if (lineIdx < MOCK_TERMINAL.length) {
            setTerminalLines((prev) => [...prev, MOCK_TERMINAL[lineIdx]]);
            lineIdx++;
            setTimeout(addLine, lineIdx === 1 ? 800 : 200);
          } else {
            setAppReady(true);
            setRightTab('preview');
            addBot(
              '🎉 **应用已就绪！**\n\n- 代码在「文件」Tab 中查看/编辑\n- 终端输出在「终端」Tab\n- 应用预览在「预览」Tab\n\n需要调整什么吗？'
            );
            setProcessing(false);
          }
        };
        setTimeout(addLine, 500);
      }, 1000);
    }, 800);
  };

  const selectedFileContent = files.find((f) => f.name === selectedFile)?.content || '';

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
        </div>
        {appReady && (
          <button
            onClick={() => {
              toast('应用已发布', 'success');
              onBack();
            }}
            className="h-7 px-3 rounded-lg text-[11px] font-medium bg-emerald-600 text-white hover:opacity-90"
          >
            发布
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
                    生成中...
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
              ⬛ 终端
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
                <div className="w-40 border-r border-white/[0.06] p-2 overflow-y-auto hmr-scrollbar">
                  {files.map((f) => (
                    <button
                      key={f.name}
                      onClick={() => f.type === 'file' && setSelectedFile(f.name)}
                      className={`w-full text-left px-2 py-1 rounded text-[10px] transition-colors ${selectedFile === f.name ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:bg-white/[0.04]'}`}
                      style={{ paddingLeft: `${f.indent * 12 + 8}px` }}
                    >
                      <span className="mr-1">{f.type === 'folder' ? '📁' : '📄'}</span>
                      {f.name}
                    </button>
                  ))}
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
                  {terminalLines.length === 0 ? (
                    <span className="text-slate-500">等待安装和启动...</span>
                  ) : (
                    terminalLines.map((line, i) => (
                      <div
                        key={i}
                        className={
                          line.startsWith('$')
                            ? 'text-emerald-400'
                            : line.includes('ready') || line.includes('VITE')
                              ? 'text-emerald-300 font-semibold'
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
              <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
                {appReady ? (
                  <div className="text-center">
                    <div className="text-[14px] font-bold text-white mb-2">应用预览</div>
                    <div className="text-[11px] text-slate-400 mb-4">沙箱环境正在运行中</div>
                    <div className="w-72 h-48 bg-white/[0.06] border border-white/[0.1] rounded-xl flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-white mb-2">Hello App</div>
                        <button className="px-4 py-1.5 bg-blue-500 text-white text-[11px] rounded-lg">
                          点击计数: 0
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500">等待应用启动...</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function renderContent(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    return <span key={i}>{part}</span>;
  });
}
