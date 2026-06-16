/**
 * AppPreviewBlock — 对话中的应用构建卡片
 */
import { useOpenClawStore } from '../../../../application/stores/openclawStore';
import { Icon } from '../../../components/ui/Icon';
import type { OpenClawDrawerContent } from '../../../../domain/agent/DrawerContent';

const STAGE_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  designing: { icon: 'palette', label: '设计中', color: '#AF52DE' },
  building: { icon: 'construction', label: '构建中', color: '#FF9500' },
  preview: { icon: 'visibility', label: '预览就绪', color: '#007AFF' },
  done: { icon: 'check_circle', label: '已完成', color: '#34C759' },
};

interface Props {
  appId: string;
  appName: string;
  stage: string;
  onOpen: (content: OpenClawDrawerContent) => void;
}

export function AppPreviewBlockComponent({ appId, appName, stage: initialStage, onOpen }: Props) {
  const app = useOpenClawStore((s) => s.apps.find((a) => a.id === appId));
  const currentStage = app?.stage ?? initialStage;
  const cfg = STAGE_CONFIG[currentStage] ?? STAGE_CONFIG.designing;

  return (
    <button
      type="button"
      className="w-full text-left p-3 rounded-xl border border-white/10 bg-white/[0.03] cursor-pointer hover:bg-white/[0.06] transition-colors"
      onClick={() => onOpen({ type: 'app-preview', title: `${app?.name ?? appName} - 构建预览`, data: { appId } })}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${cfg.color}15` }}>
          <Icon name={cfg.icon} size={16} style={{ color: cfg.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-slate-200 truncate">{app?.name ?? appName}</div>
          <div className="text-[10px] text-slate-500">{app?.description ?? '应用构建中'}</div>
        </div>
        <span className="text-[9px] px-2 py-0.5 rounded-full font-medium" style={{ color: cfg.color, backgroundColor: `${cfg.color}15` }}>
          {cfg.label}
        </span>
      </div>

      {/* Stage progress dots */}
      <div className="flex items-center gap-1 px-1">
        {['designing', 'building', 'preview', 'done'].map((s, i) => {
          const reached = ['designing', 'building', 'preview', 'done'].indexOf(currentStage) >= i;
          return (
            <div key={s} className="flex items-center">
              <div className="w-1.5 h-1.5 rounded-full transition-colors" style={{ backgroundColor: reached ? cfg.color : 'rgba(255,255,255,0.1)' }} />
              {i < 3 && <div className="w-6 h-px mx-0.5" style={{ backgroundColor: reached ? `${cfg.color}40` : 'rgba(255,255,255,0.06)' }} />}
            </div>
          );
        })}
        <span className="text-[10px] text-primary ml-auto">查看预览 →</span>
      </div>
    </button>
  );
}
