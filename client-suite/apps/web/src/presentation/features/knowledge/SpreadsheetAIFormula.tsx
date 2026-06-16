/**
 * SpreadsheetAIFormula — 表格AI公式助手浮层 (km_9 对齐)
 * 输入公式时弹出AI智能建议 (推荐公式 + 语法说明 + 自然语言生成)
 */
import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useToastStore } from '../../../application/stores/toastStore';

interface SpreadsheetAIFormulaProps {
  onApply?: (formula: string) => void;
  onDismiss?: () => void;
}

export function SpreadsheetAIFormula({ onApply, onDismiss }: SpreadsheetAIFormulaProps) {
  const [formulaPrompt, setFormulaPrompt] = useState('');

  return (
    <div className="w-80 bg-bg-white-var rounded-2xl shadow-2xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-primary/5 border-b border-border">
        <div className="flex items-center gap-1.5">
          <Icon name="auto_awesome" size={14} className="text-primary" />
          <span className="text-xs font-semibold text-primary">AI 智能建议</span>
        </div>
        {onDismiss && (
          <button type="button" onClick={onDismiss} className="p-0.5 text-text-muted hover:text-text-secondary">
            <Icon name="close" size={14} />
          </button>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Current input */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-fill-tertiary/20 font-mono text-xs">
          <Icon name="functions" size={14} className="text-text-muted" />
          <span className="text-text-primary">=SUMIF(</span>
          <span className="text-text-muted animate-pulse">|</span>
        </div>

        {/* Recommended formula */}
        <div className="p-3 rounded-xl border border-primary/20 bg-primary/5">
          <div className="flex items-center gap-1 mb-1.5">
            <Icon name="lightbulb" size={12} className="text-primary" />
            <span className="text-[10px] font-semibold text-primary">推荐公式</span>
          </div>
          <code className="text-xs text-text-primary font-mono block mb-2">
            =SUMIF(C2:C10, &quot;&gt;1000000&quot;, B2:B10)
          </code>
          <p className="text-[10px] text-text-secondary leading-relaxed">
            对C列中大于100万的行，求B列预算合计
          </p>
          <button
            type="button"
            onClick={() => onApply?.('=SUMIF(C2:C10, ">1000000", B2:B10)')}
            className="mt-2 px-3 py-1 text-[10px] font-medium text-white bg-primary rounded-md hover:bg-primary/90"
          >
            应用此公式
          </button>
        </div>

        {/* Syntax help */}
        <div className="p-3 rounded-xl border border-border">
          <h5 className="text-[10px] font-semibold text-text-secondary mb-1.5">SUMIF 语法</h5>
          <code className="text-[10px] text-text-muted font-mono block">
            SUMIF(range, criteria, [sum_range])
          </code>
          <ul className="text-[10px] text-text-muted mt-1.5 space-y-0.5">
            <li>• <span className="text-text-secondary">range</span> — 条件判断区域</li>
            <li>• <span className="text-text-secondary">criteria</span> — 筛选条件</li>
            <li>• <span className="text-text-secondary">sum_range</span> — 求和区域（可选）</li>
          </ul>
        </div>

        {/* Natural language input */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={formulaPrompt}
            onChange={(e) => setFormulaPrompt(e.target.value)}
            placeholder="用自然语言描述你想要的计算…"
            className="flex-1 px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button type="button" onClick={() => useToastStore.getState().addToast('AI 公式生成功能开发中', 'info')} className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white hover:bg-primary/90">
            <Icon name="auto_awesome" size={14} />
          </button>
        </div>

        {/* Collaborators indicator */}
        <div className="flex items-center gap-2 pt-1 border-t border-border">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          <span className="text-[10px] text-text-muted">在线协作中 (3人)</span>
        </div>
      </div>
    </div>
  );
}
