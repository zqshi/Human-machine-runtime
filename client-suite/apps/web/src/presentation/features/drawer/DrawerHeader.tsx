import { Icon } from '../../components/ui/Icon';
import { useToastStore } from '../../../application/stores/toastStore';
import type { DrawerContentType } from '../../../domain/shared/types';

const COLLAB_AVATARS = [
  { initials: 'ZQ', color: 'bg-blue-500' },
  { initials: 'LW', color: 'bg-emerald-500' },
  { initials: 'YX', color: 'bg-amber-500' },
];

const TYPE_ICON: Record<string, string> = {
  doc: 'description',
  code: 'code',
  markdown: 'markdown',
  preview: 'preview',
  spreadsheet: 'table_chart',
  location: 'location_on',
  subscription: 'tune',
};

interface DrawerHeaderProps {
  title?: string;
  status?: string;
  contentType?: DrawerContentType;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  onClose: () => void;
}

export function DrawerHeader({ title, status, contentType, saveStatus, onClose }: DrawerHeaderProps) {
  const icon = TYPE_ICON[contentType ?? 'doc'] ?? 'description';

  return (
    <div className="h-14 px-4 flex items-center gap-2 border-b border-border shrink-0 min-w-[360px]">
      <button type="button" onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-text-secondary hover:bg-bg-hover shrink-0">
        <Icon name="chevron_right" size={18} />
      </button>
      <Icon name={icon} size={18} className="text-primary shrink-0" />
      <h3 className="text-base font-semibold text-text-primary truncate">{title}</h3>
      {(() => {
        if (status === 'published') return (
          <span className="text-[10px] font-medium text-success bg-success/10 px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />已发布
          </span>
        );
        if (status === 'done') return (
          <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />编辑完成
          </span>
        );
        return (<>
          <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">草稿</span>
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1 text-[10px] text-text-muted shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />正在保存...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-[10px] text-success shrink-0">
              <Icon name="check_circle" size={12} />已保存
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1 text-[10px] text-error shrink-0">
              <Icon name="error" size={12} />保存失败
            </span>
          )}
        </>);
      })()}
      <div className="flex-1" />
      <div className="flex items-center -space-x-1.5 shrink-0">
        {COLLAB_AVATARS.map((a) => (
          <div
            key={a.initials}
            className={`w-6 h-6 rounded-full ${a.color} text-white text-[9px] font-medium flex items-center justify-center ring-2 ring-white`}
          >
            {a.initials}
          </div>
        ))}
        <div className="w-6 h-6 rounded-full bg-fill-tertiary text-[9px] font-medium text-text-muted flex items-center justify-center ring-2 ring-white">
          +3
        </div>
      </div>
      <button type="button" onClick={() => useToastStore.getState().addToast('分享功能即将上线', 'info')} className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-semibold rounded-lg hover:bg-primary/15 transition-colors shrink-0">
        分享
      </button>
      <button type="button" onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-text-secondary hover:bg-bg-hover shrink-0">
        <Icon name="more_horiz" size={18} />
      </button>
    </div>
  );
}
