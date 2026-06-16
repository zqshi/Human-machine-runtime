/**
 * BriefingCard — AI 行业简报结构化卡片 (stitch_21 对齐)
 * 蓝色左边线 + AI 核心综述(紫色块) + 新闻条目(分类标签)
 */
import { Icon } from '../../components/ui/Icon';
import { useToastStore } from '../../../application/stores/toastStore';

export interface BriefingNewsItem {
  title: string;
  category: string;
  categoryColor: string;
  source: string;
  time: string;
}

export interface BriefingData {
  title: string;
  date: string;
  summary: string;
  news: BriefingNewsItem[];
}

export function BriefingCard({ data }: { data: BriefingData }) {
  return (
    <div className="bg-bg-white-var rounded-xl border border-border max-w-[480px] overflow-hidden">
      {/* Blue left border accent */}
      <div className="border-l-4 border-primary p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Icon name="newspaper" size={18} className="text-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary">{data.title}</p>
            <p className="text-[11px] text-text-muted">{data.date}</p>
          </div>
        </div>

        {/* AI Summary — purple highlight block */}
        <div className="bg-gradient-to-r from-primary/8 to-[#5856D6]/8 rounded-lg px-3 py-2.5">
          <div className="flex items-center gap-1 mb-1">
            <Icon name="auto_awesome" size={12} className="text-primary" />
            <span className="text-[10px] font-bold text-primary uppercase">AI 核心综述</span>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">{data.summary}</p>
        </div>

        {/* News items */}
        <div className="space-y-2">
          {data.news.map((item, i) => (
            <div key={i} className="flex items-start gap-2 py-1.5">
              <span className="text-xs text-text-muted font-mono mt-0.5">{i + 1}.</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-text-primary leading-tight">{item.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="text-[9px] font-medium px-1.5 py-0.5 rounded"
                    style={{ color: item.categoryColor, backgroundColor: `${item.categoryColor}14` }}
                  >
                    {item.category}
                  </span>
                  <span className="text-[10px] text-text-muted">{item.source}</span>
                  <span className="text-[10px] text-text-muted">{item.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-text-muted">点击项目查看详细分析</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => useToastStore.getState().addToast('分享功能开发中', 'info')} className="p-1 rounded text-text-muted hover:text-primary hover:bg-primary/5">
              <Icon name="share" size={14} />
            </button>
            <button type="button" onClick={() => useToastStore.getState().addToast('书签功能开发中', 'info')} className="p-1 rounded text-text-muted hover:text-primary hover:bg-primary/5">
              <Icon name="bookmark" size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
