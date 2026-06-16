/**
 * PushConfigDialog — 推送设置弹窗
 */
import { Icon } from '../../components/ui/Icon';
import { usePushConfigStore } from '../../../application/stores/pushConfigStore';

type Urgency = 'critical' | 'high' | 'normal' | 'low';
type Channel = 'toast' | 'sound' | 'floating' | 'desktop' | 'badge';

interface MatrixRow {
  urgency: Urgency;
  label: string;
  channels: Channel[];
}

const CHANNEL_META: Record<Channel, { icon: string; label: string }> = {
  toast: { icon: 'notifications', label: 'Toast' },
  sound: { icon: 'volume_up', label: '声音' },
  floating: { icon: 'picture_in_picture', label: '浮窗' },
  desktop: { icon: 'desktop_windows', label: '桌面通知' },
  badge: { icon: 'circle', label: '角标' },
};

const ALL_CHANNELS: Channel[] = ['toast', 'sound', 'floating', 'desktop', 'badge'];

const URGENCY_COLORS: Record<Urgency, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  normal: 'text-slate-300',
  low: 'text-slate-500',
};

interface PushConfigDialogProps {
  open: boolean;
  onClose: () => void;
}

export function PushConfigDialog({ open, onClose }: PushConfigDialogProps) {
  const { policy, toggleChannel: storeToggle, setQuietHours, reset: _reset } = usePushConfigStore();

  const matrix: MatrixRow[] = (['critical', 'high', 'normal', 'low'] as Urgency[]).map(
    (urgency) => ({
      urgency,
      label:
        urgency === 'critical'
          ? '紧急'
          : urgency === 'high'
            ? '重要'
            : urgency === 'normal'
              ? '普通'
              : '低优',
      channels: policy.matrix[urgency],
    })
  );

  const quietEnabled = policy.quietHours.enabled;
  const quietStart = policy.quietHours.startHour;
  const quietEnd = policy.quietHours.endHour;
  const overrideCritical = policy.quietHours.overrideForCritical;

  if (!open) return null;

  const toggleChannel = (urgency: Urgency, channel: Channel) => {
    storeToggle(urgency, channel);
  };

  const setQuietEnabled = (enabled: boolean) => setQuietHours({ enabled });
  const setQuietStart = (startHour: number) => setQuietHours({ startHour });
  const setQuietEnd = (endHour: number) => setQuietHours({ endHour });
  const setOverrideCritical = (override: boolean) =>
    setQuietHours({ overrideForCritical: override });

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[480px] max-h-[80vh] rounded-2xl border border-white/10 bg-[#1a1a2e] shadow-2xl overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2 shrink-0">
          <Icon name="tune" size={18} className="text-primary/80" />
          <span className="text-sm font-semibold text-slate-200">推送设置</span>
          <div className="flex-1" />
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto hmr-scrollbar p-5 space-y-5">
          {/* Channel matrix */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <Icon name="grid_on" size={14} className="text-primary/60" />
              <span className="text-xs font-medium text-slate-200">通道 × 紧急度</span>
            </div>

            <div className="rounded-lg border border-white/10 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-[10px] text-slate-500 font-normal text-left px-3 py-2 w-16">
                      级别
                    </th>
                    {ALL_CHANNELS.map((ch) => (
                      <th
                        key={ch}
                        className="text-[10px] text-slate-500 font-normal text-center px-1 py-2"
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <Icon name={CHANNEL_META[ch].icon} size={12} />
                          <span>{CHANNEL_META[ch].label}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row) => (
                    <tr key={row.urgency} className="border-b border-white/[0.04] last:border-0">
                      <td
                        className={`text-[11px] font-medium px-3 py-2 ${URGENCY_COLORS[row.urgency]}`}
                      >
                        {row.label}
                      </td>
                      {ALL_CHANNELS.map((ch) => {
                        const active = row.channels.includes(ch);
                        return (
                          <td key={ch} className="text-center px-1 py-2">
                            <button
                              type="button"
                              onClick={() => toggleChannel(row.urgency, ch)}
                              className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                                active
                                  ? 'bg-primary/20 text-primary'
                                  : 'bg-white/[0.04] text-slate-600 hover:bg-white/[0.08]'
                              }`}
                            >
                              <Icon name={active ? 'check' : 'remove'} size={10} />
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quiet hours */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <Icon name="do_not_disturb" size={14} className="text-orange-400/60" />
              <span className="text-xs font-medium text-slate-200">静默时段</span>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <button
                  type="button"
                  onClick={() => setQuietEnabled(!quietEnabled)}
                  className={`w-8 h-[18px] rounded-full transition-colors relative ${
                    quietEnabled ? 'bg-primary' : 'bg-white/10'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                      quietEnabled ? 'translate-x-[18px]' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                <span className="text-[11px] text-slate-300">启用静默时段</span>
              </label>

              {quietEnabled && (
                <div className="flex items-center gap-2 pl-10">
                  <select
                    value={quietStart}
                    onChange={(e) => setQuietStart(Number(e.target.value))}
                    className="h-7 px-2 rounded bg-white/[0.04] border border-white/10 text-[10px] text-slate-200 focus:outline-none"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {String(i).padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-500">至</span>
                  <select
                    value={quietEnd}
                    onChange={(e) => setQuietEnd(Number(e.target.value))}
                    className="h-7 px-2 rounded bg-white/[0.04] border border-white/10 text-[10px] text-slate-200 focus:outline-none"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {String(i).padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {quietEnabled && (
                <label className="flex items-center gap-2 pl-10 cursor-pointer">
                  <button
                    type="button"
                    onClick={() => setOverrideCritical(!overrideCritical)}
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      overrideCritical
                        ? 'bg-primary/20 border-primary/40 text-primary'
                        : 'border-white/20 text-transparent'
                    }`}
                  >
                    <Icon name="check" size={10} />
                  </button>
                  <span className="text-[10px] text-slate-400">紧急信号仍可穿透静默</span>
                </label>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-white/10 flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-4 rounded-lg text-[11px] text-slate-400 hover:bg-white/[0.06]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-4 rounded-lg bg-primary/20 text-[11px] text-primary font-medium hover:bg-primary/30"
          >
            保存
          </button>
        </div>
      </div>
    </>
  );
}
