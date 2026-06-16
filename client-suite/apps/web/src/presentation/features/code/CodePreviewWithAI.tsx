/**
 * CodePreviewWithAI — 代码预览面板 + AI助手 (stitch_17 对齐)
 * 上方: 代码预览器 (暗色主题, 语法高亮)
 * 下方: AI助手面板 (快捷按钮 + 提问输入框)
 */
import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useToastStore } from '../../../application/stores/toastStore';

const CODE_LINES = [
  { num: 1, tokens: [{ text: 'const ', cls: 'text-[#569CD6]' }, { text: 'generateExecutiveSummary', cls: 'text-[#DCDCAA]' }, { text: ' = (', cls: 'text-white/80' }, { text: 'data', cls: 'text-[#9CDCFE]' }, { text: ') => {', cls: 'text-white/80' }] },
  { num: 2, tokens: [{ text: '  const ', cls: 'text-[#569CD6]' }, { text: 'summary', cls: 'text-[#9CDCFE]' }, { text: ' = {', cls: 'text-white/80' }] },
  { num: 3, tokens: [{ text: '    year: ', cls: 'text-[#9CDCFE]' }, { text: '2024', cls: 'text-[#B5CEA8]' }, { text: ',', cls: 'text-white/80' }] },
  { num: 4, tokens: [{ text: '    growth: ', cls: 'text-[#9CDCFE]' }, { text: '"45%"', cls: 'text-[#CE9178]' }, { text: ',', cls: 'text-white/80' }] },
  { num: 5, tokens: [{ text: '    status: ', cls: 'text-[#9CDCFE]' }, { text: '"completed"', cls: 'text-[#CE9178]' }] },
  { num: 6, tokens: [{ text: '  };', cls: 'text-white/80' }] },
  { num: 7, tokens: [{ text: '  // 处理年度报告核心指标', cls: 'text-[#6A9955]' }] },
  { num: 8, tokens: [{ text: '  return ', cls: 'text-[#C586C0]' }, { text: '`2024财年是企业转型的关键。`', cls: 'text-[#CE9178]' }, { text: ';', cls: 'text-white/80' }] },
  { num: 9, tokens: [{ text: '};', cls: 'text-white/80' }] },
  { num: 10, tokens: [] },
  { num: 11, tokens: [{ text: 'export default ', cls: 'text-[#569CD6]' }, { text: 'generateExecutiveSummary', cls: 'text-[#DCDCAA]' }, { text: ';', cls: 'text-white/80' }] },
];

interface CodePreviewWithAIProps {
  onClose?: () => void;
}

export function CodePreviewWithAI({ onClose }: CodePreviewWithAIProps) {
  const [language, setLanguage] = useState('JavaScript');
  const [aiQuestion, setAiQuestion] = useState('');
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e1e]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-[#3c3c3c]">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => useToastStore.getState().addToast('折叠/展开功能开发中', 'info')} className="p-1 text-white/40 hover:text-white/70">
            <Icon name="chevron_right" size={14} />
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-[#E8AB53] text-xs">JS</span>
            <span className="text-xs text-white/80 font-mono">AnnualReportSummary.js</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="text-[10px] bg-[#3c3c3c] text-white/60 border border-[#555] rounded px-2 py-0.5">
            <option>JavaScript</option>
          </select>
          <button type="button" onClick={() => { navigator.clipboard?.writeText(CODE_LINES.map(l => l.tokens.map(t => t.text).join('')).join('\n')); useToastStore.getState().addToast('代码已复制', 'success'); }} className="px-2 py-0.5 text-[10px] text-white/60 border border-[#555] rounded hover:text-white/80 flex items-center gap-1">
            <Icon name="content_copy" size={12} /> 复制
          </button>
          {onClose && (
            <button type="button" onClick={onClose} className="p-1 text-white/40 hover:text-white/70">
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Code area */}
      <div className="flex-1 overflow-auto font-mono text-sm leading-6">
        {CODE_LINES.map((line) => (
          <div key={line.num} className="flex hover:bg-white/5">
            <span className="w-12 text-right pr-4 text-white/20 select-none shrink-0">{line.num}</span>
            <span className="flex-1">
              {line.tokens.map((token, ti) => (
                <span key={ti} className={token.cls}>{token.text}</span>
              ))}
            </span>
          </div>
        ))}
      </div>

      {/* AI Assistant panel */}
      <div className="bg-[#252526] border-t border-[#3c3c3c] p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center">
            <Icon name="smart_toy" size={12} className="text-success" />
          </div>
          <span className="text-xs text-white/70 font-medium">AI 助手</span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <button type="button" onClick={() => useToastStore.getState().addToast('AI 正在解释代码…', 'info')} className="px-3 py-1.5 text-[10px] text-white/70 bg-[#3c3c3c] rounded-lg hover:bg-[#4c4c4c] border border-[#555]">
            解释这段代码
          </button>
          <button type="button" onClick={() => useToastStore.getState().addToast('AI 正在生成优化建议…', 'info')} className="px-3 py-1.5 text-[10px] text-white/70 bg-[#3c3c3c] rounded-lg hover:bg-[#4c4c4c] border border-[#555]">
            优化建议
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={aiQuestion}
            onChange={(e) => setAiQuestion(e.target.value)}
            placeholder="向 AI 提问关于代码的问题..."
            className="flex-1 px-3 py-2 text-xs text-white/80 bg-[#3c3c3c] border border-[#555] rounded-lg placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#34C759]/50"
          />
          <button type="button" onClick={() => { useToastStore.getState().addToast('AI 代码助手功能开发中', 'info'); setAiQuestion(''); }} className="w-8 h-8 rounded-lg bg-success flex items-center justify-center text-white hover:bg-success/80">
            <Icon name="send" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
