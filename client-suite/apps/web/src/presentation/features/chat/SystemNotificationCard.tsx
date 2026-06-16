import { Icon } from '../../components/ui/Icon';
import { useUIStore } from '../../../application/stores/uiStore';
import { useToastStore } from '../../../application/stores/toastStore';
import { documentApi } from '../../../application/services/apiGateway';

interface ApprovalPassedProps {
  type: 'approved';
  documentName: string;
  documentId?: string;
  approver: string;
  reason?: string;
  time: string;
}

interface ApprovalRejectedProps {
  type: 'rejected';
  documentName: string;
  documentId?: string;
  reason: string;
  approver: string;
  time: string;
}

export type SystemNotificationData = ApprovalPassedProps | ApprovalRejectedProps;

export function SystemNotificationCard({ data }: { data: SystemNotificationData }) {
  if (data.type === 'approved') return <ApprovedCard data={data} />;
  return <RejectedCard data={data} />;
}

/** Load document from API then open in Drawer editor; fallback to placeholder */
async function openDocInDrawer(documentId?: string, documentName?: string) {
  const openDrawer = useUIStore.getState().openDrawer;
  const fallbackTitle = documentName ?? '文档';

  if (documentId) {
    try {
      const { document: doc } = await documentApi.get(documentId);
      openDrawer({
        type: doc.type ?? 'doc',
        title: doc.title,
        data: { docId: doc.id, ...doc.content },
      });
      return;
    } catch {
      /* API unavailable — use placeholder */
    }
  }

  openDrawer({
    type: 'doc',
    title: fallbackTitle,
    data: {
      html: `<h1>${fallbackTitle}</h1><p style="color:#999;margin-top:12px">文档内容加载中…</p>`,
    },
  });
}

function ApprovedCard({ data }: { data: ApprovalPassedProps }) {
  return (
    <div className="bg-bg-white-var rounded-xl border border-border p-4 max-w-[360px] space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
          <Icon name="check_circle" size={20} className="text-success" />
        </div>
        <div>
          <p className="text-sm font-semibold text-text-primary">权限申请已通过</p>
          <p className="text-xs text-text-secondary">你的编辑权限申请已通过</p>
        </div>
      </div>

      <div className="px-3 py-2.5 bg-fill-tertiary/50 rounded-lg space-y-2">
        <div className="flex items-center gap-2">
          <Icon name="description" size={16} className="text-primary shrink-0" />
          <span className="text-xs font-medium text-text-primary truncate">
            {data.documentName}
          </span>
          <span className="ml-auto text-[10px] text-text-muted shrink-0">审批人：</span>
          <span className="text-xs text-primary font-medium shrink-0">{data.approver}</span>
        </div>
        {data.reason && (
          <p className="text-[11px] text-text-secondary leading-relaxed pl-6">{data.reason}</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => openDocInDrawer(data.documentId, data.documentName)}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors"
      >
        立即编辑
        <Icon name="arrow_forward" size={16} />
      </button>
    </div>
  );
}

function RejectedCard({ data }: { data: ApprovalRejectedProps }) {
  return (
    <div className="bg-bg-white-var rounded-xl border border-border p-4 max-w-[360px] space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center shrink-0">
          <Icon name="report" size={22} className="text-warning" />
        </div>
        <div>
          <p className="text-sm font-bold text-text-primary">权限申请已被驳回</p>
          <p className="text-xs text-text-secondary">请核实原因后重新操作</p>
        </div>
      </div>

      <div className="px-3 py-2.5 bg-fill-tertiary/50 rounded-lg space-y-2">
        <div className="flex items-center gap-2">
          <Icon name="description" size={16} className="text-primary shrink-0" />
          <span className="text-xs font-medium text-text-primary truncate">
            {data.documentName}
          </span>
          <span className="ml-auto text-[10px] text-text-muted shrink-0">审批人：</span>
          <span className="text-xs font-medium text-text-primary shrink-0">{data.approver}</span>
        </div>
        {data.reason && (
          <div className="px-2.5 py-2 rounded-lg bg-warning/5 border border-warning/15">
            <p className="text-[11px] text-text-muted mb-0.5">驳回理由</p>
            <p className="text-xs text-text-primary leading-relaxed">{data.reason}</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => openDocInDrawer(data.documentId, data.documentName)}
          className="flex-1 flex items-center justify-center gap-1.5 h-9 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors"
        >
          <Icon name="replay" size={16} />
          再次申请
        </button>
        <button
          type="button"
          onClick={() => useToastStore.getState().addToast('已通知管理员，请等待回复', 'info')}
          className="flex-1 flex items-center justify-center gap-1.5 h-9 bg-bg-white-var border border-border text-text-primary text-sm font-medium rounded-xl hover:bg-bg-hover transition-colors"
        >
          <Icon name="chat" size={16} />
          联系管理员
        </button>
      </div>

      <p className="text-[10px] text-text-muted text-center">{data.time} · 系统自动推送</p>
    </div>
  );
}
