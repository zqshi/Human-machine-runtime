import type { FeedItem, FeedImportance } from '../../../domain/subscription/FeedTypes';

const IMPORTANCE_BORDER: Record<FeedImportance, string> = {
  high: 'border-l-[#FF3B30]',
  medium: 'border-l-[#007AFF]',
  low: 'border-l-[#8E8E93]',
};

const IMPORTANCE_LABEL: Record<FeedImportance, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

const IMPORTANCE_DOT: Record<FeedImportance, string> = {
  high: 'bg-error',
  medium: 'bg-primary',
  low: 'bg-secondary',
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hours}:${mins}`;
}

interface IntelligenceCardProps {
  item: FeedItem;
  onViewDetail?: () => void;
}

export function IntelligenceCard({ item, onViewDetail }: IntelligenceCardProps) {
  const borderCls = IMPORTANCE_BORDER[item.importance];

  return (
    <div
      className={`bg-bg-white-var rounded-xl border border-border-primary border-l-4 ${borderCls} p-4 hover:shadow-md transition-shadow duration-200 cursor-pointer`}
      onClick={onViewDetail}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text-primary leading-snug truncate">
            {item.title}
          </h3>
          <p className="mt-1 text-xs text-text-secondary leading-relaxed line-clamp-2">
            {item.summary}
          </p>
          <div className="mt-2.5 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[10px] text-text-muted">
              <span className={`w-1.5 h-1.5 rounded-full ${IMPORTANCE_DOT[item.importance]}`} />
              {IMPORTANCE_LABEL[item.importance]}
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-fill-tertiary text-[10px] text-text-secondary font-medium">
              {item.category}
            </span>
            <span className="text-[10px] text-text-muted">{item.source}</span>
            <span className="text-[10px] text-text-muted">{formatTime(item.timestamp)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
