import { Icon } from '../../components/ui/Icon';
import { useToastStore } from '../../../application/stores/toastStore';

const COLLAB_AVATARS = [
  { initials: 'ZQ', color: 'bg-blue-500' },
  { initials: 'LW', color: 'bg-emerald-500' },
  { initials: 'YX', color: 'bg-amber-500' },
];

export function DrawerToolbar() {
  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border shrink-0 min-w-[360px]">
      <button type="button" onClick={() => useToastStore.getState().addToast('插入链接即将上线', 'info')} className="w-7 h-7 rounded flex items-center justify-center text-text-secondary hover:bg-bg-hover" title="插入链接">
        <Icon name="link" size={16} />
      </button>
      <button type="button" onClick={() => useToastStore.getState().addToast('插入图片即将上线', 'info')} className="w-7 h-7 rounded flex items-center justify-center text-text-secondary hover:bg-bg-hover" title="插入图片">
        <Icon name="image" size={16} />
      </button>
      <button type="button" onClick={() => useToastStore.getState().addToast('添加评论即将上线', 'info')} className="w-7 h-7 rounded flex items-center justify-center text-text-secondary hover:bg-bg-hover" title="添加评论">
        <Icon name="comment" size={16} />
      </button>
      <div className="flex-1" />
      <div className="flex items-center -space-x-2">
        {COLLAB_AVATARS.map((a) => (
          <div
            key={a.initials}
            className={`w-6 h-6 rounded-full ${a.color} text-white text-[10px] font-medium flex items-center justify-center ring-2 ring-white`}
          >
            {a.initials}
          </div>
        ))}
      </div>
    </div>
  );
}
