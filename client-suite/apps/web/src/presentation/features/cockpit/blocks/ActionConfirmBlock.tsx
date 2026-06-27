import { Icon } from '../../../components/ui/Icon';

interface Props {
  actionId: string;
  title: string;
  description: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  onConfirm?: (actionId: string) => void;
  onCancel?: (actionId: string) => void;
}

export function ActionConfirmBlockComponent({
  actionId,
  title,
  description,
  status,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="p-3 rounded-xl border border-white/10 bg-white/[0.03]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1.5">
        <Icon name="verified" size={16} className="text-primary shrink-0" />
        <span className="text-xs font-medium text-slate-200">{title}</span>

        {status === 'confirmed' && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-emerald-400">
            <Icon name="check_circle" size={12} className="text-emerald-400" />
            已确认
          </span>
        )}
        {status === 'cancelled' && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-slate-400">
            <Icon name="cancel" size={12} className="text-slate-400" />
            已取消
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-[11px] text-slate-400 mb-3">{description}</p>

      {/* Actions */}
      {status === 'pending' && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="bg-primary text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:opacity-90 transition-opacity"
            onClick={() => onConfirm?.(actionId)}
          >
            确认执行
          </button>
          <button
            type="button"
            className="border border-white/10 text-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-white/[0.04] transition-colors"
            onClick={() => onCancel?.(actionId)}
          >
            取消
          </button>
        </div>
      )}
    </div>
  );
}
