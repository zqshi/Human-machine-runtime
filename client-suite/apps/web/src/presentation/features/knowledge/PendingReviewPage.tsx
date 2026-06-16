import { useMemo } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useKnowledgeStore } from '../../../application/stores/knowledgeStore';
import { useUIStore } from '../../../application/stores/uiStore';
import { useToastStore } from '../../../application/stores/toastStore';
import type { Document } from '../../../domain/knowledge/Document';

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  pending_review: '审核中',
  published: '已发布',
  archived: '已归档',
};

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  pending_review: 'bg-amber-50 text-amber-600',
  published: 'bg-green-50 text-green-600',
  archived: 'bg-gray-50 text-gray-400',
};

function ReviewCard({ doc }: { doc: Document }) {
  const { approveDocument, rejectDocument, selectDocument } = useKnowledgeStore();
  const setSubView = useUIStore((s) => s.setSubView);

  const handleApprove = async () => {
    const ok = await approveDocument(doc.id);
    if (ok) useToastStore.getState().addToast(`「${doc.title}」已审批通过`, 'success');
  };

  const handleReject = async () => {
    const comment = window.prompt('驳回理由:');
    if (comment === null) return;
    const ok = await rejectDocument(doc.id, comment || '未通过审核');
    if (ok) useToastStore.getState().addToast(`「${doc.title}」已驳回`, 'info');
  };

  const handleView = () => {
    selectDocument(doc.id);
    setSubView('knowledge:doc-read');
  };

  return (
    <div className="bg-bg-white-var border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <button type="button" onClick={handleView} className="text-sm font-semibold text-text-primary hover:text-primary truncate block">
            {doc.title}
          </button>
          <p className="text-xs text-text-muted mt-0.5">
            {doc.author?.name || '未知'} · {new Date(doc.updatedAt).toLocaleDateString('zh-CN')}
          </p>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLOR[doc.status] || ''}`}>
          {STATUS_LABEL[doc.status] || doc.status}
        </span>
      </div>

      {doc.content && (
        <p className="text-xs text-text-secondary line-clamp-2">
          {doc.content.replace(/<[^>]+>/g, ' ').slice(0, 120)}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleApprove}
          className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600 transition-colors"
        >
          <Icon name="check" size={14} />
          通过
        </button>
        <button
          type="button"
          onClick={handleReject}
          className="flex items-center gap-1 px-3 py-1.5 bg-bg-white-var border border-border text-text-secondary rounded-lg text-xs font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
        >
          <Icon name="close" size={14} />
          驳回
        </button>
        <button
          type="button"
          onClick={handleView}
          className="ml-auto flex items-center gap-1 px-3 py-1.5 text-text-muted text-xs hover:text-primary transition-colors"
        >
          <Icon name="visibility" size={14} />
          查看
        </button>
      </div>
    </div>
  );
}

export function PendingReviewPage({ onBack }: { onBack?: () => void }) {
  const documents = useKnowledgeStore((s) => s.documents);

  const pending = useMemo(
    () => documents.filter((d) => d.status === 'pending_review'),
    [documents],
  );

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          {onBack && (
            <button type="button" onClick={onBack} className="p-1 rounded-md hover:bg-bg-hover">
              <Icon name="arrow_back" size={20} className="text-text-secondary" />
            </button>
          )}
          <Icon name="rate_review" size={22} className="text-primary" />
          <h2 className="text-lg font-semibold text-text-primary">待我审核</h2>
          {pending.length > 0 && (
            <span className="px-2.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
              {pending.length}
            </span>
          )}
        </div>

        <p className="text-sm text-text-muted">
          以下文档正在等待审核，审核通过后将发布到对应的目标空间
        </p>

        {pending.length === 0 ? (
          <div className="text-center py-16">
            <Icon name="check_circle" size={48} className="text-green-300 mx-auto mb-3" />
            <p className="text-sm text-text-muted">没有待审核的文档，干得漂亮！</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pending.map((doc) => (
              <ReviewCard key={doc.id} doc={doc} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
