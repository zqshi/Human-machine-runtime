/**
 * ConfigPanel — 中栏配置面板（暗色主题）
 *
 * 对话体验 / 能力配置 / 工具 MCP（含智能推荐） / 技能 Skill（含智能推荐） / 知识库
 */
import { useState } from 'react';
import {
  useOrchestrationStore,
  type McpRef,
  type SkillRef,
} from '../../../../application/stores/orchestrationStore';
import { useToastStore } from '../../../../application/stores/toastStore';
import { Icon } from '../../../components/ui/Icon';

/* 平台 MCP 工具库（模拟） */
const PLATFORM_MCPS: McpRef[] = [
  { id: 'mcp-db', name: 'db-query', description: '执行 SQL 查询并返回结果', toolCount: 5 },
  { id: 'mcp-doc', name: '云文档', description: '搜索和查询云文档', toolCount: 8 },
  { id: 'mcp-calendar', name: '日程管理', description: '创建/查询日程和会议', toolCount: 3 },
  { id: 'mcp-email', name: '邮箱', description: '发送和搜索邮件', toolCount: 4 },
  { id: 'mcp-search', name: '联网搜索', description: '搜索互联网获取最新信息', toolCount: 2 },
  { id: 'mcp-table', name: '多维表格', description: '读写多维表格数据', toolCount: 6 },
];

/* 平台 Skill 库（模拟） */
const PLATFORM_SKILLS: SkillRef[] = [
  { id: 'skill-report', name: '报告生成', description: '自动生成结构化优化报告', icon: '📋' },
  { id: 'skill-bench', name: '性能基准测试', description: '执行查询性能对比测试', icon: '⚡' },
  { id: 'skill-viz', name: '数据可视化', description: '生成图表和数据看板', icon: '📊' },
  { id: 'skill-translate', name: '多语言翻译', description: '翻译代码注释和文档', icon: '🌐' },
  { id: 'skill-summary', name: '智能摘要', description: '自动提取文档核心信息', icon: '📝' },
];

const MODELS = [
  { id: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
  { id: 'claude-opus-4', label: 'Claude Opus 4' },
  { id: 'gpt-4o', label: 'GPT-4o' },
  { id: 'deepseek-r1', label: 'DeepSeek R1' },
];

export function ConfigPanel() {
  const {
    openingMessage,
    presetQuestions,
    shortcuts,
    modelId,
    humanize,
    webSearch,
    mcpRefs,
    skillRefs,
    systemPrompt,
    updateField,
    addPresetQuestion,
    removePresetQuestion,
    addShortcut,
    removeShortcut,
    addMcpRef,
    removeMcpRef,
    addSkillRef,
    removeSkillRef,
  } = useOrchestrationStore();
  const toast = useToastStore((s) => s.addToast);

  const [newPreset, setNewPreset] = useState('');
  const [newShortcut, setNewShortcut] = useState('');
  const [showMcpPicker, setShowMcpPicker] = useState(false);
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [mcpSearch, setMcpSearch] = useState('');
  const [skillSearch, setSkillSearch] = useState('');

  const currentModel = MODELS.find((m) => m.id === modelId) || MODELS[0];
  const filteredMcps = PLATFORM_MCPS.filter(
    (m) => !mcpRefs.find((r) => r.id === m.id) && m.name.includes(mcpSearch)
  );
  const filteredSkills = PLATFORM_SKILLS.filter(
    (s) => !skillRefs.find((r) => r.id === s.id) && s.name.includes(skillSearch)
  );

  /** 基于 prompt 智能推荐 MCP */
  const recommendMcps = () => {
    const lower = systemPrompt.toLowerCase();
    const recommended = PLATFORM_MCPS.filter((m) => {
      if (mcpRefs.find((r) => r.id === m.id)) return false;
      if (
        (lower.includes('sql') || lower.includes('数据库') || lower.includes('查询')) &&
        m.id === 'mcp-db'
      )
        return true;
      if ((lower.includes('文档') || lower.includes('搜索')) && m.id === 'mcp-doc') return true;
      if (
        (lower.includes('搜索') || lower.includes('联网') || lower.includes('最新')) &&
        m.id === 'mcp-search'
      )
        return true;
      if ((lower.includes('表格') || lower.includes('数据')) && m.id === 'mcp-table') return true;
      return false;
    });
    if (recommended.length === 0) {
      toast('未发现匹配的推荐工具', 'info');
      return;
    }
    recommended.forEach((m) => addMcpRef(m));
    toast(`已推荐 ${recommended.length} 个工具`, 'success');
  };

  /** 基于 prompt 智能推荐 Skill */
  const recommendSkills = () => {
    const lower = systemPrompt.toLowerCase();
    const recommended = PLATFORM_SKILLS.filter((s) => {
      if (skillRefs.find((r) => r.id === s.id)) return false;
      if (
        (lower.includes('报告') || lower.includes('输出') || lower.includes('生成')) &&
        s.id === 'skill-report'
      )
        return true;
      if ((lower.includes('性能') || lower.includes('基准')) && s.id === 'skill-bench') return true;
      if ((lower.includes('可视化') || lower.includes('图表')) && s.id === 'skill-viz') return true;
      if ((lower.includes('摘要') || lower.includes('总结')) && s.id === 'skill-summary')
        return true;
      return false;
    });
    if (recommended.length === 0) {
      toast('未发现匹配的推荐技能', 'info');
      return;
    }
    recommended.forEach((s) => addSkillRef(s));
    toast(`已推荐 ${recommended.length} 个技能`, 'success');
  };

  return (
    <div className="p-3 space-y-2.5">
      {/* 模型选择 */}
      <section className="border border-white/[0.08] bg-white/[0.03] rounded-2xl p-3">
        <div className="text-xs font-semibold text-slate-100 mb-2">🤖 模型</div>
        <div className="relative">
          <button
            onClick={() => setShowModelPicker(!showModelPicker)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-slate-200 hover:border-primary/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="w-[7px] h-[7px] rounded-full bg-emerald-400" />
              {currentModel.label}
            </div>
            <span className="text-[9px] text-slate-500">▾</span>
          </button>
          {showModelPicker && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#1e1e2e] rounded-xl border border-white/[0.1] shadow-lg overflow-hidden z-50">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    updateField('modelId', m.id);
                    setShowModelPicker(false);
                    toast(`模型: ${m.label}`, 'info');
                  }}
                  className={`w-full px-3 py-2 text-left text-[11px] hover:bg-white/[0.04] flex items-center justify-between ${m.id === modelId ? 'text-primary font-medium bg-primary/[0.06]' : 'text-slate-300'}`}
                >
                  {m.label}
                  {m.id === modelId && <span>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 对话体验 */}
      <section className="border border-white/[0.08] bg-white/[0.03] rounded-2xl p-3">
        <div className="text-xs font-semibold text-slate-100 mb-2">💬 对话体验</div>
        <div className="text-[10px] text-slate-400 mb-1">开场白</div>
        <textarea
          value={openingMessage}
          onChange={(e) => updateField('openingMessage', e.target.value)}
          className="w-full p-2 bg-white/[0.03] rounded-lg text-[11px] leading-[1.5] border border-dashed border-white/[0.1] mb-2 resize-none min-h-[36px] outline-none text-slate-200 placeholder:text-slate-500 focus:border-primary/50"
          placeholder="设置 Agent 的开场白"
        />
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-slate-400">预设问题 ({presetQuestions.length}/5)</span>
        </div>
        {presetQuestions.map((q, i) => (
          <div key={i} className="group flex items-center gap-1 py-0.5 text-[11px] text-slate-300">
            <span className="w-3.5 h-3.5 rounded-full bg-white/[0.06] flex items-center justify-center text-[8px] text-slate-400 shrink-0">
              {i + 1}
            </span>
            <span className="flex-1 truncate">{q}</span>
            <button
              onClick={() => removePresetQuestion(i)}
              className="opacity-0 group-hover:opacity-100 text-red-400 text-[8px]"
            >
              ✕
            </button>
          </div>
        ))}
        {presetQuestions.length < 5 && (
          <div className="flex items-center gap-1 mt-1">
            <input
              value={newPreset}
              onChange={(e) => setNewPreset(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newPreset.trim()) {
                  addPresetQuestion(newPreset.trim());
                  setNewPreset('');
                }
              }}
              className="flex-1 h-5 border border-white/[0.08] bg-white/[0.03] rounded px-1.5 text-[10px] outline-none text-slate-200 placeholder:text-slate-500 focus:border-primary/50"
              placeholder="添加预设问题"
            />
          </div>
        )}

        <div className="flex items-center justify-between mt-2 mb-1">
          <span className="text-[10px] text-slate-400">快捷指令</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {shortcuts.map((s, i) => (
            <span
              key={i}
              className="group relative px-1.5 py-0.5 bg-white/[0.06] rounded-full text-[10px] text-slate-300"
            >
              {s}
              <button
                onClick={() => removeShortcut(i)}
                className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 text-white text-[6px] flex items-center justify-center opacity-0 group-hover:opacity-100"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1 mt-1.5">
          <input
            value={newShortcut}
            onChange={(e) => setNewShortcut(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newShortcut.trim()) {
                addShortcut(newShortcut.trim());
                setNewShortcut('');
              }
            }}
            className="flex-1 h-5 border border-white/[0.08] bg-white/[0.03] rounded px-1.5 text-[10px] outline-none text-slate-200 placeholder:text-slate-500 focus:border-primary/50"
            placeholder="添加快捷指令"
          />
        </div>
      </section>

      {/* 能力配置 */}
      <section className="border border-white/[0.08] bg-white/[0.03] rounded-2xl p-3">
        <div className="text-xs font-semibold text-slate-100 mb-2">⚙️ 能力配置</div>
        {[
          { key: 'humanize' as const, label: '拟人化', desc: '自然对话风格', value: humanize },
          { key: 'webSearch' as const, label: '联网搜索', desc: '获取最新信息', value: webSearch },
        ].map((c) => (
          <div key={c.key} className="flex items-center justify-between py-1.5">
            <div>
              <div className="text-[11px] font-medium text-slate-200">{c.label}</div>
              <div className="text-[9px] text-slate-500">{c.desc}</div>
            </div>
            <button
              onClick={() => updateField(c.key, !c.value)}
              className={`w-[28px] h-[15px] rounded-full relative transition-colors ${c.value ? 'bg-emerald-500' : 'bg-slate-600'}`}
            >
              <div
                className={`w-[13px] h-[13px] rounded-full bg-white shadow-sm absolute top-[1px] transition-transform ${c.value ? 'translate-x-[13px]' : 'translate-x-[1px]'}`}
              />
            </button>
          </div>
        ))}
      </section>

      {/* 工具 MCP */}
      <section className="border border-white/[0.08] bg-white/[0.03] rounded-2xl p-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-100 mb-2">
          <span>🔧 工具 (MCP)</span>
          <div className="flex items-center gap-2">
            <button
              onClick={recommendMcps}
              className="text-[9px] text-amber-400 font-medium hover:underline"
            >
              ✨ 推荐
            </button>
            <button
              onClick={() => setShowMcpPicker(true)}
              className="text-[10px] text-primary font-medium"
            >
              + 添加
            </button>
          </div>
        </div>
        {mcpRefs.length === 0 && (
          <div className="text-[11px] text-slate-500 py-2">暂无工具，点击添加或智能推荐</div>
        )}
        {mcpRefs.map((m) => (
          <div
            key={m.id}
            className="group flex items-center gap-1.5 p-1.5 bg-white/[0.03] rounded-[7px] mb-1"
          >
            <div className="w-5 h-5 rounded-[5px] bg-primary/10 flex items-center justify-center">
              <Icon name="build" size={11} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium text-slate-200 truncate">{m.name}</div>
              <div className="text-[9px] text-slate-500">{m.toolCount} 个接口</div>
            </div>
            <button
              onClick={() => removeMcpRef(m.id)}
              className="opacity-0 group-hover:opacity-100 text-red-400 text-[9px]"
            >
              ✕
            </button>
          </div>
        ))}
      </section>

      {/* 技能 Skill */}
      <section className="border border-white/[0.08] bg-white/[0.03] rounded-2xl p-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-100 mb-2">
          <span>⚡ 技能 (Skill)</span>
          <div className="flex items-center gap-2">
            <button
              onClick={recommendSkills}
              className="text-[9px] text-amber-400 font-medium hover:underline"
            >
              ✨ 推荐
            </button>
            <button
              onClick={() => setShowSkillPicker(true)}
              className="text-[10px] text-primary font-medium"
            >
              + 添加
            </button>
          </div>
        </div>
        {skillRefs.length === 0 && (
          <div className="text-[11px] text-slate-500 py-2">暂无技能，点击添加或智能推荐</div>
        )}
        {skillRefs.map((s) => (
          <div
            key={s.id}
            className="group flex items-center gap-1.5 p-1.5 bg-white/[0.03] rounded-[7px] mb-1"
          >
            <div className="w-5 h-5 rounded-[5px] bg-amber-500/10 flex items-center justify-center text-[9px]">
              {s.icon || '⚡'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium text-slate-200 truncate">{s.name}</div>
              <div className="text-[9px] text-slate-500 truncate">{s.description}</div>
            </div>
            <button
              onClick={() => removeSkillRef(s.id)}
              className="opacity-0 group-hover:opacity-100 text-red-400 text-[9px]"
            >
              ✕
            </button>
          </div>
        ))}
      </section>

      {/* MCP 选择弹窗 */}
      {showMcpPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[3px]"
            onClick={() => setShowMcpPicker(false)}
          />
          <div className="relative bg-[#1e1e2e] rounded-2xl shadow-xl w-[420px] max-h-[380px] flex flex-col border border-white/[0.1]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <span className="text-[13px] font-semibold text-slate-100">添加 MCP 工具</span>
              <button
                onClick={() => setShowMcpPicker(false)}
                className="w-5 h-5 rounded-full bg-white/[0.06] flex items-center justify-center text-[10px] text-slate-400"
              >
                ✕
              </button>
            </div>
            <div className="px-4 pt-2">
              <input
                value={mcpSearch}
                onChange={(e) => setMcpSearch(e.target.value)}
                className="w-full h-7 border border-white/[0.08] bg-white/[0.03] rounded-lg px-3 text-[11px] outline-none text-slate-200 placeholder:text-slate-500 focus:border-primary/50"
                placeholder="🔍 搜索..."
                autoFocus
              />
            </div>
            <div className="flex-1 p-3 overflow-y-auto space-y-1 dcf-scrollbar">
              {filteredMcps.length === 0 && (
                <div className="text-center py-4 text-[11px] text-slate-500">无可添加的工具</div>
              )}
              {filteredMcps.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.04] transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon name="build" size={14} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-slate-200">{m.name}</div>
                    <div className="text-[9px] text-slate-500">
                      {m.description} · {m.toolCount} 接口
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      addMcpRef(m);
                      toast(`已添加 ${m.name}`, 'success');
                    }}
                    className="h-6 px-2.5 rounded-lg text-[10px] font-medium bg-primary text-white hover:opacity-90"
                  >
                    添加
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Skill 选择弹窗 */}
      {showSkillPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[3px]"
            onClick={() => setShowSkillPicker(false)}
          />
          <div className="relative bg-[#1e1e2e] rounded-2xl shadow-xl w-[420px] max-h-[380px] flex flex-col border border-white/[0.1]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <span className="text-[13px] font-semibold text-slate-100">添加技能 (Skill)</span>
              <button
                onClick={() => setShowSkillPicker(false)}
                className="w-5 h-5 rounded-full bg-white/[0.06] flex items-center justify-center text-[10px] text-slate-400"
              >
                ✕
              </button>
            </div>
            <div className="px-4 pt-2">
              <input
                value={skillSearch}
                onChange={(e) => setSkillSearch(e.target.value)}
                className="w-full h-7 border border-white/[0.08] bg-white/[0.03] rounded-lg px-3 text-[11px] outline-none text-slate-200 placeholder:text-slate-500 focus:border-primary/50"
                placeholder="🔍 搜索..."
                autoFocus
              />
            </div>
            <div className="flex-1 p-3 overflow-y-auto space-y-1 dcf-scrollbar">
              {filteredSkills.length === 0 && (
                <div className="text-center py-4 text-[11px] text-slate-500">无可添加的技能</div>
              )}
              {filteredSkills.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.04] transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-[12px]">
                    {s.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-slate-200">{s.name}</div>
                    <div className="text-[9px] text-slate-500">{s.description}</div>
                  </div>
                  <button
                    onClick={() => {
                      addSkillRef(s);
                      toast(`已添加 ${s.name}`, 'success');
                    }}
                    className="h-6 px-2.5 rounded-lg text-[10px] font-medium bg-primary text-white hover:opacity-90"
                  >
                    添加
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
