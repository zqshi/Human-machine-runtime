/**
 * SkillCreateFlow — Skill 对话式 Workspace 开发
 *
 * 设计源模式：借鉴 skill-creator 工程模型
 * - 左栏: 对话（与 AI 协作开发 Skill）
 * - 右栏: 两Tab — 结构（文件树 + 内容查看） / 测试&验证
 *
 * Skill 文件结构:
 *   SKILL.md → prompt + metadata
 *   scripts/ → 可执行脚本
 *   references/ → 知识文档
 *   assets/ → 模板/素材
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

interface SkillFile {
  name: string;
  type: 'file' | 'folder';
  indent: number;
  content?: string;
}

type RightTab = 'structure' | 'test';
type TestStatus = 'idle' | 'validating' | 'running' | 'pass' | 'fail';

/** 预置测试用例 */
interface TestCase {
  id: string;
  label: string;
  input: string;
  expected?: string;
}

const DEFAULT_TEST_CASES: TestCase[] = [
  {
    id: 'tc-1',
    label: '基础功能',
    input: '{"query": "SELECT * FROM users WHERE id = 1"}',
    expected: '返回优化建议',
  },
  { id: 'tc-2', label: '边界测试', input: '{"query": ""}', expected: '输入校验错误' },
  {
    id: 'tc-3',
    label: '复杂场景',
    input:
      '{"query": "SELECT u.*, o.* FROM users u JOIN orders o ON u.id = o.user_id WHERE o.amount > 100 ORDER BY o.created_at DESC LIMIT 50"}',
    expected: '索引优化建议',
  },
];

const INITIAL_FILES: SkillFile[] = [
  {
    name: 'SKILL.md',
    type: 'file',
    indent: 0,
    content:
      '---\nname: my-skill\ndescription: 描述你的技能\ntriggers:\n  - 触发词\n---\n\n# My Skill\n\n## Overview\n...',
  },
  { name: 'scripts/', type: 'folder', indent: 0 },
  {
    name: 'main.py',
    type: 'file',
    indent: 1,
    content:
      '# 主脚本入口\nimport json\n\ndef execute(params):\n    return {"success": True, "data": params}',
  },
  { name: 'references/', type: 'folder', indent: 0 },
  { name: 'assets/', type: 'folder', indent: 0 },
];

export function SkillCreateFlow({ onBack }: Props) {
  const toast = useToastStore((s) => s.addToast);

  // 对话
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: 0,
      role: 'bot',
      content:
        '你好！我是 Skill 开发助手。\n\n描述你想创建的技能，我会帮你生成完整的 Skill 工程结构：\n\n- SKILL.md（定义/触发词/描述）\n- scripts/（可执行逻辑）\n- references/（知识文档）\n\n你想创建什么样的技能？',
    },
  ]);
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 右栏
  const [rightTab, setRightTab] = useState<RightTab>('structure');
  const [files, setFiles] = useState<SkillFile[]>(INITIAL_FILES);
  const [selectedFile, setSelectedFile] = useState<string | null>('SKILL.md');
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testOutput, setTestOutput] = useState('');
  const [skillReady, setSkillReady] = useState(false);

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

    // 模拟 AI 生成 Skill
    setTimeout(() => {
      const updatedFiles: SkillFile[] = [
        {
          name: 'SKILL.md',
          type: 'file',
          indent: 0,
          content: `---\nname: ${userMsg.slice(0, 20).replace(/\s/g, '-').toLowerCase()}\ndescription: >\n  ${userMsg}\ntriggers:\n  - ${userMsg.split(' ').slice(0, 2).join(' ')}\n---\n\n# ${userMsg.slice(0, 30)}\n\n## Overview\n基于用户描述自动生成的 Skill。\n\n## Workflow\n1. 解析输入参数\n2. 执行核心逻辑\n3. 格式化输出`,
        },
        { name: 'scripts/', type: 'folder', indent: 0 },
        {
          name: 'main.py',
          type: 'file',
          indent: 1,
          content: `"""${userMsg.slice(0, 40)} — 主脚本"""\nimport json\nfrom typing import Any\n\ndef execute(params: dict[str, Any]) -> dict:\n    """Skill 执行入口"""\n    # TODO: 实现核心逻辑\n    result = process(params)\n    return {"success": True, "data": result}\n\ndef process(params: dict) -> dict:\n    return {"message": f"处理完成: {json.dumps(params)}"}\n`,
        },
        {
          name: 'analyze.py',
          type: 'file',
          indent: 1,
          content: `"""分析模块"""\ndef analyze(data: str) -> dict:\n    return {"tokens": len(data.split()), "chars": len(data)}`,
        },
        { name: 'references/', type: 'folder', indent: 0 },
        {
          name: 'schema.md',
          type: 'file',
          indent: 1,
          content: `# 接口定义\n\n## 输入\n- params: object\n\n## 输出\n- success: boolean\n- data: object`,
        },
        { name: 'assets/', type: 'folder', indent: 0 },
      ];
      setFiles(updatedFiles);
      setSkillReady(true);
      addBot(
        `已生成 Skill 工程结构 ✓\n\n- \`SKILL.md\` — 定义和触发词\n- \`scripts/main.py\` — 主执行入口\n- \`scripts/analyze.py\` — 分析模块\n- \`references/schema.md\` — 接口文档\n\n你可以在右侧「结构」Tab 查看文件内容，或切换到「测试」Tab 运行验证。\n\n有什么需要调整的吗？`
      );
      setProcessing(false);
    }, 1200);
  };

  const runTest = (testInput?: string) => {
    const userInput = testInput || '{"test": true}';
    setTestStatus('validating');
    setTestOutput('');
    setRightTab('test');
    setTimeout(() => {
      setTestStatus('running');
      setTestOutput(
        `✓ SKILL.md 格式验证通过\n✓ triggers 配置有效\n✓ scripts/main.py 语法正确\n\n─── 执行 main.py ───\n输入: ${userInput}\n`
      );
      setTimeout(() => {
        // 模拟根据输入生成不同结果
        const isEmptyInput =
          userInput === '{}' || userInput === '' || userInput === '{"query": ""}';
        if (isEmptyInput) {
          setTestOutput(
            (prev) =>
              prev +
              `\n❌ 错误: 输入参数为空\n   → execute() raised ValueError: 输入不能为空\n\n✕ 执行失败 (45ms)`
          );
          setTestStatus('fail');
        } else {
          try {
            const parsed = JSON.parse(userInput);
            setTestOutput(
              (prev) =>
                prev +
                `\n输出: ${JSON.stringify({ success: true, data: { message: `处理完成`, input_keys: Object.keys(parsed), token_count: JSON.stringify(parsed).length } }, null, 2)}\n\n✓ 执行通过 (${Math.floor(Math.random() * 200) + 80}ms)`
            );
            setTestStatus('pass');
          } catch {
            setTestOutput(
              (prev) =>
                prev +
                `\n输出: ${JSON.stringify({ success: true, data: { message: `处理完成: ${userInput.slice(0, 50)}`, chars: userInput.length } }, null, 2)}\n\n✓ 执行通过 (${Math.floor(Math.random() * 200) + 80}ms)`
            );
            setTestStatus('pass');
          }
        }
      }, 800);
    }, 600);
  };

  const handlePublish = () => {
    toast('Skill 已发布', 'success');
    onBack();
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
          <h2 className="text-[13px] font-semibold text-slate-100">Skill Workspace</h2>
        </div>
        <div className="flex items-center gap-2">
          {skillReady && (
            <>
              <button
                onClick={() => runTest()}
                className="h-7 px-3 rounded-lg text-[11px] font-medium border border-white/[0.15] text-slate-300 hover:bg-white/[0.06]"
              >
                ▶ 测试
              </button>
              <button
                onClick={handlePublish}
                className="h-7 px-3 rounded-lg text-[11px] font-medium bg-emerald-600 text-white hover:opacity-90"
              >
                发布
              </button>
            </>
          )}
        </div>
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
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-[9px] shrink-0">
                      AI
                    </div>
                  )}
                  <div
                    className={`rounded-[12px] px-3 py-2 text-[12px] leading-[1.6] max-w-[85%] whitespace-pre-wrap ${m.role === 'user' ? 'bg-primary text-white rounded-br-[3px]' : 'border border-white/[0.1] bg-white/[0.04] text-slate-200 rounded-bl-[3px]'}`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {processing && (
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0">
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
              placeholder="描述你想创建的技能..."
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

        {/* Right: Structure / Test */}
        <div className="w-[45%] min-w-[320px] flex flex-col">
          <div className="flex px-4 pt-2 gap-0 border-b border-white/[0.06]">
            <button
              onClick={() => setRightTab('structure')}
              className={`px-3.5 py-2.5 text-[10px] font-medium border-b-2 transition-colors ${rightTab === 'structure' ? 'text-primary border-primary' : 'text-slate-500 border-transparent'}`}
            >
              📁 结构
            </button>
            <button
              onClick={() => setRightTab('test')}
              className={`px-3.5 py-2.5 text-[10px] font-medium border-b-2 transition-colors ${rightTab === 'test' ? 'text-primary border-primary' : 'text-slate-500 border-transparent'}`}
            >
              ▶ 测试 & 验证
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {rightTab === 'structure' ? (
              <div className="flex h-full">
                {/* File tree */}
                <div className="w-40 border-r border-white/[0.06] p-2 overflow-y-auto hmr-scrollbar">
                  {files.map((f) => (
                    <button
                      key={f.name}
                      onClick={() => f.type === 'file' && setSelectedFile(f.name)}
                      className={`w-full text-left px-2 py-1 rounded text-[10px] transition-colors ${
                        selectedFile === f.name
                          ? 'bg-primary/10 text-primary'
                          : 'text-slate-400 hover:bg-white/[0.04]'
                      }`}
                      style={{ paddingLeft: `${f.indent * 12 + 8}px` }}
                    >
                      <span className="mr-1">{f.type === 'folder' ? '📁' : '📄'}</span>
                      {f.name}
                    </button>
                  ))}
                </div>
                {/* File content */}
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
            ) : (
              <TestPanel
                skillReady={skillReady}
                testStatus={testStatus}
                testOutput={testOutput}
                onRun={runTest}
                onAutoFix={() => setInput('请修复测试中发现的问题')}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── TestPanel: 用户可输入真实场景数据做测试 ─── */

function TestPanel({
  skillReady,
  testStatus,
  testOutput,
  onRun,
  onAutoFix,
}: {
  skillReady: boolean;
  testStatus: TestStatus;
  testOutput: string;
  onRun: (input?: string) => void;
  onAutoFix: () => void;
}) {
  const [customInput, setCustomInput] = useState('');
  const [activeCase, setActiveCase] = useState<string | null>(null);

  const handleRunCustom = () => {
    onRun(customInput || '{"test": true}');
  };

  const handleRunCase = (tc: TestCase) => {
    setActiveCase(tc.id);
    setCustomInput(tc.input);
    onRun(tc.input);
  };

  return (
    <div className="p-4 space-y-3 overflow-y-auto hmr-scrollbar h-full">
      {/* 状态提示 */}
      {!skillReady && (
        <div className="flex items-center justify-center h-[120px] text-[11px] text-slate-500">
          先在对话中描述 Skill，生成后可测试
        </div>
      )}

      {skillReady && (
        <>
          {/* 自定义输入区 */}
          <div className="border border-white/[0.08] bg-white/[0.03] rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-slate-200">📝 测试输入</span>
              <span className="text-[9px] text-slate-500">JSON 或纯文本</span>
            </div>
            <textarea
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder='输入测试数据，如：{"query": "SELECT * FROM users"}'
              className="w-full h-20 p-2.5 bg-[#0d1117] border border-white/[0.06] rounded-lg text-[11px] font-mono text-emerald-300 outline-none resize-none placeholder:text-slate-600 focus:border-primary/40"
            />
            <button
              onClick={handleRunCustom}
              disabled={testStatus === 'validating' || testStatus === 'running'}
              className="mt-2 h-7 px-4 rounded-lg text-[10px] font-medium bg-emerald-600 text-white hover:opacity-90 disabled:opacity-40 flex items-center gap-1.5"
            >
              {testStatus === 'validating' || testStatus === 'running' ? (
                <>
                  <span className="w-3 h-3 border-[1.5px] border-white/40 border-t-white rounded-full animate-spin" />{' '}
                  执行中...
                </>
              ) : (
                <>▶ 运行测试</>
              )}
            </button>
          </div>

          {/* 预置测试用例 */}
          <div className="border border-white/[0.08] bg-white/[0.03] rounded-xl p-3">
            <span className="text-[11px] font-medium text-slate-200 mb-2 block">🧪 预置用例</span>
            <div className="space-y-1.5">
              {DEFAULT_TEST_CASES.map((tc) => (
                <button
                  key={tc.id}
                  onClick={() => handleRunCase(tc)}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-all ${
                    activeCase === tc.id
                      ? 'bg-primary/10 border border-primary/30'
                      : 'border border-white/[0.06] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-medium text-slate-200">{tc.label}</div>
                    <div className="text-[9px] text-slate-500 font-mono truncate">{tc.input}</div>
                  </div>
                  {tc.expected && (
                    <span className="text-[8px] text-slate-500 shrink-0">期望: {tc.expected}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 输出结果 */}
          {testStatus !== 'idle' && (
            <div
              className={`rounded-xl border p-3 ${
                testStatus === 'pass'
                  ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
                  : testStatus === 'fail'
                    ? 'border-red-500/20 bg-red-500/[0.04]'
                    : 'border-white/[0.08] bg-white/[0.03]'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {testStatus === 'pass' && (
                  <span className="text-[11px] font-medium text-emerald-400">✓ 测试通过</span>
                )}
                {testStatus === 'fail' && (
                  <span className="text-[11px] font-medium text-red-400">✕ 测试失败</span>
                )}
                {(testStatus === 'validating' || testStatus === 'running') && (
                  <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    {testStatus === 'validating' ? '验证中...' : '执行中...'}
                  </span>
                )}
              </div>
              <pre className="text-[10px] font-mono text-slate-300 whitespace-pre-wrap leading-[1.5]">
                {testOutput}
              </pre>
            </div>
          )}

          {/* 失败时的修复按钮 */}
          {testStatus === 'fail' && (
            <button
              onClick={onAutoFix}
              className="h-7 px-3 rounded-lg text-[10px] font-medium border border-primary/30 text-primary hover:bg-primary/[0.06] transition-colors"
            >
              ✨ AI 修复
            </button>
          )}
        </>
      )}
    </div>
  );
}
