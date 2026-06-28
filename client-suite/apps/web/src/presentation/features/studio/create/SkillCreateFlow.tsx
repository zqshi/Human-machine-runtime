/**
 * SkillCreateFlow — Skill 对话式 Workspace 开发
 *
 * 设计源模式：借鉴 skill-creator 工程模型
 * - 左栏: 对话（记录 Skill 需求，便于后续手动落地）
 * - 右栏: 两Tab — 结构（文件树 + 内容查看与编辑） / 测试&验证
 *
 * 投产诚实化说明（2026-06-28）：
 * 后端目前仅有「向 workspace 安装已有 skillId」的 installSkill 接口，
 * 不具备「AI 生成 skill 内容」「执行 skill 脚本测试」「发布 skill」的能力。
 * 因此本流程不伪造 AI 生成/测试/发布，改为：
 *   1. 对话仅作需求记录，不假装 AI 生成完整 Skill；
 *   2. 文件骨架为静态模板，明确标注需手动实现，由用户在右栏编辑；
 *   3. 测试入口诚实提示「需配置后端执行环境」；
 *   4. 发布入口改为「保存为本地草稿」，不谎称已发布到后端。
 * 待后端补齐 skill 创建/执行/发布 API 后，再接真实链路。
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

/** 预置测试用例（仅作输入参考，不执行） */
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

  // 对话（仅作需求记录，不调用 AI 生成）
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: 0,
      role: 'bot',
      content:
        '你好！这里是 Skill 需求记录区。\n\n请描述你想创建的技能，描述会作为需求保留在对话中，便于你在右侧「结构」Tab 手动编辑对应的工程文件：\n\n- SKILL.md（定义/触发词/描述）\n- scripts/（可执行逻辑，需手动实现）\n- references/（知识文档）\n\n注意：当前后端未提供「AI 生成 Skill 内容」的能力，右侧文件需由你手动编辑实现。',
    },
  ]);
  const [input, setInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 右栏
  const [rightTab, setRightTab] = useState<RightTab>('structure');
  const [files, setFiles] = useState<SkillFile[]>(INITIAL_FILES);
  const [selectedFile, setSelectedFile] = useState<string | null>('SKILL.md');
  const [hasRequirement, setHasRequirement] = useState(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addBot = (content: string) =>
    setMessages((prev) => [...prev, { id: Date.now() + Math.random(), role: 'bot', content }]);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setMessages((prev) => [...prev, { id: Date.now(), role: 'user', content: userMsg }]);
    setInput('');
    setHasRequirement(true);

    // 不伪造 AI 生成：仅确认需求已记录，提示用户在右栏手动编辑。
    // 基于需求更新 SKILL.md 的 description 占位，其余文件由用户手动实现。
    setFiles((prev) =>
      prev.map((f) =>
        f.name === 'SKILL.md'
          ? {
              ...f,
              content: `---\nname: my-skill\ndescription: ${userMsg}\ntriggers:\n  - 触发词\n---\n\n# My Skill\n\n## Overview\n${userMsg}\n\n## Workflow\n1. 解析输入参数\n2. 执行核心逻辑（需在 scripts/main.py 手动实现）\n3. 格式化输出`,
            }
          : f
      )
    );
    addBot(
      '需求已记录。\n\n请在右侧「结构」Tab 手动编辑各文件实现：\n- SKILL.md — 已填入描述，可补全触发词\n- scripts/main.py — 需手动实现核心逻辑\n- references/ — 可补充知识文档\n\n完成后可切换到「测试」Tab 查看测试说明。'
    );
  };

  /** 手动保存为本地草稿（后端无 skill 创建/发布 API，不谎称已发布） */
  const handleSaveDraft = () => {
    toast('已保存为本地草稿（发布需后端 skill 创建接口）', 'info');
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
          {hasRequirement && (
            <button
              onClick={handleSaveDraft}
              className="h-7 px-3 rounded-lg text-[11px] font-medium bg-emerald-600 text-white hover:opacity-90"
            >
              保存草稿
            </button>
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
              <div ref={chatEndRef} />
            </div>
          </div>
          <div className="px-4 pb-3 pt-2 border-t border-white/[0.08] flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="记录你的 Skill 需求..."
              className="flex-1 h-8 border border-white/[0.1] bg-white/[0.03] rounded-lg px-3 text-[12px] outline-none text-slate-200 placeholder:text-slate-500 focus:border-primary/50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
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
              <TestPanel hasRequirement={hasRequirement} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── TestPanel: 诚实提示测试需后端执行环境 ─── */

function TestPanel({ hasRequirement }: { hasRequirement: boolean }) {
  return (
    <div className="p-4 space-y-3 overflow-y-auto hmr-scrollbar h-full">
      {!hasRequirement && (
        <div className="flex items-center justify-center h-[120px] text-[11px] text-slate-500">
          先在对话中记录 Skill 需求，再查看测试说明
        </div>
      )}

      {hasRequirement && (
        <>
          {/* 测试执行需后端环境提示 */}
          <div className="border border-amber-500/20 bg-amber-500/[0.04] rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-medium text-amber-400">
                ⚠ 测试执行需配置后端环境
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-[1.6]">
              当前后端未接入 Skill 脚本执行环境（OpenSandbox/容器）。测试执行需后端提供运行
              <code className="text-emerald-300">scripts/main.py</code>
              的能力并返回真实输出。配置后此处将展示真实执行结果。
            </p>
          </div>

          {/* 预置用例（仅作输入参考） */}
          <div className="border border-white/[0.08] bg-white/[0.03] rounded-xl p-3">
            <span className="text-[11px] font-medium text-slate-200 mb-2 block">
              🧪 预置用例（输入参考）
            </span>
            <div className="space-y-1.5">
              {DEFAULT_TEST_CASES.map((tc) => (
                <div
                  key={tc.id}
                  className="w-full flex items-center gap-2 p-2 rounded-lg border border-white/[0.06]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-medium text-slate-200">{tc.label}</div>
                    <div className="text-[9px] text-slate-500 font-mono truncate">{tc.input}</div>
                  </div>
                  {tc.expected && (
                    <span className="text-[8px] text-slate-500 shrink-0">期望: {tc.expected}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
