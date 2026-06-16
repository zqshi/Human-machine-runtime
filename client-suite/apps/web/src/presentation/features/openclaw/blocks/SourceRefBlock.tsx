import { Icon } from '../../../components/ui/Icon';
import type { OpenClawDrawerContent } from '../../../../domain/agent/DrawerContent';

interface Props {
  sourceId: string;
  title: string;
  snippet?: string;
  onOpen: (content: OpenClawDrawerContent) => void;
}

export function SourceRefBlockComponent({ sourceId, title, snippet, onOpen }: Props) {
  return (
    <button
      type="button"
      className="w-full text-left flex items-start gap-2 p-2.5 rounded-lg border border-white/10 bg-white/[0.03] cursor-pointer hover:bg-white/[0.06] transition-colors"
      onClick={() =>
        onOpen({ type: 'source-detail', title, data: { sourceId } })
      }
    >
      <Icon name="menu_book" size={16} className="text-primary mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-slate-200 truncate">{title}</div>
        {snippet && (
          <div className="mt-0.5 text-[11px] text-slate-400 line-clamp-2">{snippet}</div>
        )}
      </div>
    </button>
  );
}
