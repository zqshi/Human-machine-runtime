/**
 * ApprovalRequestCard — 聊天内权限审批请求卡片 (stitch_16 对齐)
 * 蓝色盾牌图标 + 申请人/文档/理由 + 批准/拒绝按钮
 */
import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useUIStore } from '../../../application/stores/uiStore';

export interface ApprovalRequestData {
  applicant: string;
  documentName: string;
  documentContent?: string;
  reason: string;
  time: string;
}

export function ApprovalRequestCard({ data }: { data: ApprovalRequestData }) {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const openDrawer = useUIStore((s) => s.openDrawer);

  const handleDocClick = () => {
    openDrawer({
      type: 'doc',
      title: data.documentName,
      data: {
        html: data.documentContent
          ?? `<h1>${data.documentName}</h1><p style="color:#999;margin-top:12px">文档内容加载中…</p>`,
      },
    });
  };

  return (
    <div className="bg-bg-white-var rounded-xl border border-border p-4 max-w-[400px] space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Icon name="shield" size={18} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary">权限申请</p>
          <p className="text-[11px] text-text-muted">{data.time}</p>
        </div>
      </div>

      {/* Applicant info */}
      <div className="px-3 py-2.5 bg-fill-tertiary/50 rounded-lg space-y-2">
        <div className="flex items-center gap-2">
          <Icon name="person" size={14} className="text-primary shrink-0" />
          <span className="text-xs text-text-muted">申请人</span>
          <span className="text-xs font-medium text-text-primary">{data.applicant} 申请编辑权限</span>
        </div>
        <div className="flex items-center gap-2">
          <Icon name="description" size={14} className="text-primary shrink-0" />
          <span className="text-xs text-text-muted">申请编辑</span>
          <button
            type="button"
            onClick={handleDocClick}
            className="text-xs font-medium text-primary hover:underline cursor-pointer"
          >
            {data.documentName}
          </button>
        </div>
      </div>

      {/* Reason */}
      <div className="text-xs text-text-secondary leading-relaxed px-1">
        {data.reason}
      </div>

      {/* Action buttons */}
      {status === 'pending' ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStatus('approved')}
            className="flex-1 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors"
          >
            批准
          </button>
          <button
            type="button"
            onClick={() => setStatus('rejected')}
            className="flex-1 py-2 bg-bg-white-var border border-border text-text-primary text-sm font-medium rounded-xl hover:bg-bg-hover transition-colors"
          >
            拒绝
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-1.5 py-2 text-xs font-medium">
          <Icon
            name={status === 'approved' ? 'check_circle' : 'cancel'}
            size={16}
            className={status === 'approved' ? 'text-success' : 'text-error'}
          />
          <span className={status === 'approved' ? 'text-success' : 'text-error'}>
            {status === 'approved' ? '已批准' : '已拒绝'}
          </span>
        </div>
      )}

      <p className="text-[10px] text-text-muted text-center">只有管理员可见此操作</p>
    </div>
  );
}
