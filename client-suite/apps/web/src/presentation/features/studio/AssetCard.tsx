/**
 * AssetCard — 资产卡片组件（暗色主题）
 *
 * 展示单个 AI 资产，带来源标签（自建/已安装/组织共享）和操作菜单。
 */
import { Icon } from '../../components/ui/Icon';

export type AssetType = 'Agent' | 'Skill' | 'MCP' | 'App';
export type AssetOrigin = 'created' | 'installed' | 'shared';
export type AssetStatus = 'draft' | 'published' | 'running';

export interface AssetItem {
  id: string;
  name: string;
  type: AssetType;
  origin: AssetOrigin;
  source?: string;
  description?: string;
  version?: string;
  status: AssetStatus;
  updatedAt?: string;
  icon?: string;
}

const ORIGIN_STYLE: Record<AssetOrigin, { label: string; bg: string; text: string }> = {
  created: { label: '自建', bg: 'rgba(0,122,255,0.15)', text: '#5AC8FA' },
  installed: { label: '已安装', bg: 'rgba(52,199,89,0.15)', text: '#34C759' },
  shared: { label: '组织共享', bg: 'rgba(255,255,255,0.06)', text: '#94a3b8' },
};

const TYPE_ICON: Record<AssetType, string> = {
  Agent: 'smart_toy',
  Skill: 'bolt',
  MCP: 'build',
  App: 'grid_view',
};

const STATUS_DOT: Record<AssetStatus, string> = {
  draft: 'bg-slate-500',
  published: 'bg-emerald-400',
  running: 'bg-sky-400',
};

interface AssetCardProps {
  asset: AssetItem;
  onClick?: (asset: AssetItem) => void;
  onConfigure?: (asset: AssetItem) => void;
  onUse?: (asset: AssetItem) => void;
  onUninstall?: (asset: AssetItem) => void;
}

export function AssetCard({ asset, onClick, onConfigure, onUse, onUninstall }: AssetCardProps) {
  const origin = ORIGIN_STYLE[asset.origin];

  return (
    <div
      onClick={() => onClick?.(asset)}
      className={`group flex items-center gap-3 p-3 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.15] transition-all ${onClick ? 'cursor-pointer' : ''}`}
    >
      {' '}
      {/* Icon */}
      <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0">
        {asset.icon ? (
          <span className="text-lg">{asset.icon}</span>
        ) : (
          <Icon name={TYPE_ICON[asset.type]} size={20} className="text-slate-400" />
        )}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-slate-100 truncate">{asset.name}</span>
          <span
            className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium"
            style={{ background: origin.bg, color: origin.text }}
          >
            {origin.label}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-slate-500">
            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[asset.status]}`} />
            {asset.status === 'draft' ? '草稿' : asset.status === 'published' ? '已发布' : '运行中'}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 truncate mt-0.5">
          {asset.description || `${asset.type} · ${asset.version || 'v0.0.1'}`}
        </p>
      </div>
      {/* Actions */}
      <div
        className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {asset.origin === 'created' && onConfigure && (
          <button
            onClick={() => onConfigure(asset)}
            className="h-7 px-2.5 rounded-lg text-[11px] font-medium border border-white/[0.15] text-slate-300 hover:bg-white/[0.08] transition-colors"
          >
            管理
          </button>
        )}
        {onUse && (
          <button
            onClick={() => onUse(asset)}
            className="h-7 px-2.5 rounded-lg text-[11px] font-medium bg-primary text-white hover:opacity-90 transition-opacity"
          >
            使用
          </button>
        )}
        {asset.origin === 'installed' && onUninstall && (
          <button
            onClick={() => onUninstall(asset)}
            className="h-7 px-2.5 rounded-lg text-[11px] text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors"
          >
            卸载
          </button>
        )}
      </div>
    </div>
  );
}
