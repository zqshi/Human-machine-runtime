/**
 * FloatingNotification — 右下浮动通知铃铛
 *
 * 铃铛固定在右下角，点击弹出通知浮窗（绝对定位在铃铛上方），
 * 不影响铃铛自身位置。
 */
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useNotificationStore, selectCrossChannelNotifications } from '../../../application/stores/notificationStore';
import { Icon } from '../../components/ui/Icon';

export function FloatingNotification() {
  const notifications = useNotificationStore(useShallow(selectCrossChannelNotifications));
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const [expanded, setExpanded] = useState(false);

  const count = notifications.length;

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {/* Popup — absolutely positioned above the bell */}
      {expanded && (
        <div className="absolute bottom-14 right-0 w-72 rounded-xl border border-white/10 bg-bg-white-var shadow-2xl overflow-hidden animate-[dcf-fade-in_0.2s_ease-out]">
          <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-200">通知</span>
            <button onClick={() => setExpanded(false)} className="text-slate-500 hover:text-slate-300">
              <Icon name="close" size={14} />
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto dcf-scrollbar">
            {notifications.length === 0 && (
              <div className="px-3 py-4 text-xs text-slate-500 text-center">暂无通知</div>
            )}
            {notifications.map((n) => (
              <div key={n.id} onClick={() => markAsRead(n.id)} className="px-3 py-2 border-b border-white/5 text-xs text-slate-300 hover:bg-white/5 cursor-pointer">
                {n.body}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bell button — always at the same position */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="relative w-12 h-12 rounded-full bg-primary text-white shadow-lg shadow-primary/30 flex items-center justify-center hover:bg-primary-dark transition-colors"
      >
        <Icon name="notifications" size={22} />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {count}
          </span>
        )}
      </button>
    </div>
  );
}
