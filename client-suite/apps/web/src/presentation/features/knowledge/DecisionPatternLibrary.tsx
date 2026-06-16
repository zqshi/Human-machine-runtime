/**
 * DecisionPatternLibrary — 决策模式库浏览 + 搜索
 */
import { useState, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useEvaluationStore } from '../../../application/stores/evaluationStore';

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 85 ? 'bg-green-400' : pct >= 60 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-slate-400 w-8 text-right">{pct}%</span>
    </div>
  );
}

export function DecisionPatternLibrary() {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const { knowledgePatterns, fetchKnowledgePatterns } = useEvaluationStore();

  useEffect(() => {
    fetchKnowledgePatterns();
  }, [fetchKnowledgePatterns]);

  const filtered = search.trim()
    ? knowledgePatterns.filter(
        (p) =>
          p.contextKey.includes(search) ||
          p.keywords.some((k) => k.includes(search)) ||
          p.recommendedAction.includes(search)
      )
    : knowledgePatterns;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 shrink-0 flex items-center gap-2">
        <Icon name="library_books" size={18} className="text-primary/80" />
        <span className="text-sm font-semibold text-slate-200">决策模式库</span>
        <span className="text-[10px] text-slate-500">{filtered.length} 条模式</span>
      </div>

      <div className="px-4 pt-3 shrink-0">
        <div className="relative">
          <Icon
            name="search"
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索模式名称 / 关键词..."
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary/40"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto dcf-scrollbar p-4 space-y-2">
        {filtered.map((pattern) => (
          <div
            key={pattern.id}
            className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setExpanded(expanded === pattern.id ? null : pattern.id)}
              className="w-full p-3 flex items-center gap-3 hover:bg-white/[0.03] transition-colors text-left"
            >
              <Icon name="auto_awesome" size={14} className="text-primary/60 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-200 font-medium">
                    {pattern.contextKey}
                  </span>
                  <span className="text-[9px] text-slate-500">{pattern.usageCount} 次使用</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                  {pattern.recommendedAction}
                </p>
              </div>
              <ConfidenceBar value={pattern.successRate} />
              <Icon
                name={expanded === pattern.id ? 'expand_less' : 'expand_more'}
                size={14}
                className="text-slate-500 shrink-0"
              />
            </button>

            {expanded === pattern.id && (
              <div className="px-3 pb-3 space-y-2 border-t border-white/[0.06]">
                <div className="flex flex-wrap gap-1 pt-2">
                  {pattern.keywords.map((kw) => (
                    <span
                      key={kw}
                      className="px-1.5 py-0.5 rounded bg-primary/10 text-[9px] text-primary"
                    >
                      {kw}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 text-[10px]">
                  <Icon name="recommend" size={12} className="text-green-400" />
                  <span className="text-slate-300">推荐操作：</span>
                  <span className="text-green-400 font-medium">{pattern.recommendedAction}</span>
                </div>

                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-slate-300">成功率</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pattern.successRate >= 0.8 ? 'bg-green-400' : pattern.successRate >= 0.5 ? 'bg-yellow-400' : 'bg-red-400'}`}
                      style={{ width: `${pattern.successRate * 100}%` }}
                    />
                  </div>
                  <span className="text-slate-400 w-8 text-right">
                    {Math.round(pattern.successRate * 100)}%
                  </span>
                  <span className="text-slate-600 w-12 text-right">{pattern.sampleSize} 样本</span>
                </div>
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-8 text-[11px] text-slate-500">未找到匹配的决策模式</div>
        )}
      </div>
    </div>
  );
}
