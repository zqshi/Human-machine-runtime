import { useState, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import {
  useNotificationStore,
  selectUnreadCount,
} from '../../../application/stores/notificationStore';
import { useUIStore } from '../../../application/stores/uiStore';
import { appEvents } from '../../../application/events/eventBus';
import { ApprovalCard } from './ApprovalCard';
import { RejectApprovalModal } from './RejectApprovalModal';
import { ApprovalWithDocPreview } from './ApprovalWithDocPreview';
import { PermissionApprovedCard, PermissionRejectedCard } from './SystemNotificationCards';

const TABS = [
  { key: 'all', label: '全部', icon: 'notifications' },
  { key: 'unread', label: '未读', icon: 'mark_email_unread' },
  { key: 'approvals', label: '审批', icon: 'approval' },
] as const;

export function NotificationsSidebar() {
  const activeTab = useNotificationStore((s) => s.activeTab);
  const setActiveTab = useNotificationStore((s) => s.setActiveTab);
  const unreadCount = useNotificationStore(selectUnreadCount);

  return (
    <div className="p-4 flex flex-col gap-4">
      <h3 className="text-lg font-semibold text-text-primary">通知中心</h3>
      <div className="space-y-0.5">
        {TABS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
              activeTab === key
                ? 'bg-primary/10 text-primary font-semibold'
                : 'hover:bg-bg-hover text-text-primary font-medium'
            }`}
          >
            <Icon
              name={icon}
              size={16}
              className={activeTab === key ? 'text-primary' : 'text-text-secondary'}
            />
            <span className="flex-1 text-left">{label}</span>
            {key === 'unread' && unreadCount > 0 && (
              <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-error text-white text-[10px] font-bold px-1">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export function NotificationsPage() {
  const activeTab = useNotificationStore((s) => s.activeTab);
  const notifications = useNotificationStore((s) => s.notifications);
  const approvals = useNotificationStore((s) => s.approvals);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const approveRequest = useNotificationStore((s) => s.approveRequest);
  const rejectRequest = useNotificationStore((s) => s.rejectRequest);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [detailView, setDetailView] = useState<'approval-preview' | null>(null);
  const [activeApprovalId, setActiveApprovalId] = useState<string | null>(null);

  // Fetch notifications from backend on mount
  useEffect(() => {
    useNotificationStore.getState().fetchFromBackend();
  }, []);

  const filteredNotifications =
    activeTab === 'unread' ? notifications.filter((n) => n.isUnread) : notifications;

  const handleApprove = () => {
    if (activeApprovalId) {
      approveRequest(activeApprovalId);
      appEvents.emit('approval:resolved', {
        documentId: 'doc-q1-finance',
        documentName: '2024Q1_财务报表汇总',
        approved: true,
      });
    }
    setDetailView(null);
  };

  const handleReject = () => {
    setDetailView(null);
    setShowRejectModal(true);
  };

  const handleRejectConfirm = (reason?: string) => {
    if (activeApprovalId) {
      rejectRequest(activeApprovalId, reason ?? '');
      appEvents.emit('approval:resolved', {
        documentId: 'doc-q1-finance',
        documentName: '2024Q1_财务报表汇总',
        approved: false,
        reason,
      });
    }
    setShowRejectModal(false);
  };

  // Full-screen sub-views
  if (detailView === 'approval-preview') {
    return <ApprovalWithDocPreview onApprove={handleApprove} onReject={handleReject} />;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">
            {activeTab === 'approvals'
              ? '审批中心'
              : activeTab === 'unread'
                ? '未读通知'
                : '全部通知'}
          </h2>
          {activeTab !== 'approvals' && (
            <button
              type="button"
              onClick={() => useNotificationStore.getState().markAllAsRead()}
              className="text-xs text-primary hover:text-primary/80 font-medium"
            >
              全部已读
            </button>
          )}
        </div>

        {activeTab === 'approvals' ? (
          approvals.length === 0 ? (
            <p className="text-sm text-text-muted py-8 text-center">暂无审批事项</p>
          ) : (
            <div className="space-y-3">
              {approvals.map((a) => (
                <ApprovalCard
                  key={a.id}
                  approval={a}
                  onViewDetail={() => {
                    setActiveApprovalId(a.id);
                    setDetailView('approval-preview');
                  }}
                />
              ))}
            </div>
          )
        ) : filteredNotifications.length === 0 ? (
          <p className="text-sm text-text-muted py-8 text-center">
            {activeTab === 'unread' ? '没有未读通知' : '暂无通知'}
          </p>
        ) : (
          <div className="space-y-2">
            {filteredNotifications.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  if (n.isUnread) markAsRead(n.id);
                  // Navigate based on notification type
                  if (n.type === 'mention') {
                    appEvents.emit('navigate:chat', {
                      roomId: n.roomId ?? '!sys-notify:example.com',
                    });
                  } else if (n.type === 'approval') {
                    appEvents.emit('navigate:chat', { roomId: '!approval-center:example.com' });
                  } else if (n.type === 'update') {
                    useUIStore.getState().setDock('knowledge');
                  }
                }}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                  n.isUnread
                    ? 'bg-bg-white-var/90 backdrop-blur-sm border-primary/20 shadow-sm'
                    : 'bg-bg-white-var/60 border-transparent hover:bg-bg-white-var/80'
                }`}
              >
                <div className="flex items-start gap-3">
                  {n.isUnread && (
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-text-primary truncate">
                        {n.title}
                      </span>
                      <span className="text-[10px] text-text-muted flex-shrink-0">
                        {new Date(n.timestamp).toLocaleDateString('zh-CN', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary truncate">{n.body}</p>
                    <p className="text-[10px] text-text-muted mt-1">来自 {n.sender.name}</p>
                  </div>
                </div>
              </button>
            ))}

            <div className="pt-4 border-t border-border space-y-3">
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-1">
                系统通知
              </p>
              <PermissionApprovedCard />
              <PermissionRejectedCard />
            </div>
          </div>
        )}
      </div>

      <RejectApprovalModal
        open={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={handleRejectConfirm}
      />
    </div>
  );
}
