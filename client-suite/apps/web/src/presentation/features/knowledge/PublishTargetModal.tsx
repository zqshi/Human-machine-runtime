import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useKnowledgeStore } from '../../../application/stores/knowledgeStore';
import { useToastStore } from '../../../application/stores/toastStore';

type PublishTarget = 'org' | 'department' | 'shared';

interface PublishTargetModalProps {
  documentId: string;
  documentTitle: string;
  onClose: () => void;
  onPublished?: () => void;
}

const TARGETS: { key: PublishTarget; label: string; icon: string; desc: string; needsReview: boolean }[] = [
  { key: 'org', label: '公司文库', icon: 'library_books', desc: '全公司可见，需管理员审批', needsReview: true },
  { key: 'department', label: '部门资产', icon: 'corporate_fare', desc: '本部门可见，需部门负责人审批', needsReview: true },
  { key: 'shared', label: '共享空间', icon: 'group', desc: '所有人可见，无需审批直接发布', needsReview: false },
];

export function PublishTargetModal({ documentId, documentTitle, onClose, onPublished }: PublishTargetModalProps) {
  const [selected, setSelected] = useState<PublishTarget | null>(null);
  const [loading, setLoading] = useState(false);
  const { publishToTarget } = useKnowledgeStore();

  const handlePublish = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const ok = await publishToTarget(documentId, selected);
      if (ok) {
        const target = TARGETS.find((t) => t.key === selected);
        const msg = target?.needsReview
          ? `「${documentTitle}」已提交审核，审批通过后将发布到${target.label}`
          : `「${documentTitle}」已发布到${target?.label}`;
        useToastStore.getState().addToast(msg, 'success');
        onPublished?.();
      } else {
        useToastStore.getState().addToast('发布失败', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-bg-white-var rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-text-primary">选择发布目标</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-bg-hover">
            <Icon name="close" size={20} className="text-text-muted" />
          </button>
        </div>

        <p className="text-xs text-text-muted">
          选择文档的发布目标，不同目标有不同的可见范围和审批流程
        </p>

        <div className="space-y-2">
          {TARGETS.map((target) => (
            <button
              key={target.key}
              onClick={() => setSelected(target.key)}
              className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ${
                selected === target.key
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/30 hover:bg-bg-hover'
              }`}
            >
              <Icon
                name={target.icon}
                size={20}
                className={selected === target.key ? 'text-primary' : 'text-text-secondary'}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">{target.label}</span>
                  {target.needsReview && (
                    <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded text-[10px] font-medium">
                      需审批
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-muted mt-0.5">{target.desc}</p>
              </div>
              {selected === target.key && (
                <Icon name="check_circle" size={20} className="text-primary flex-shrink-0" />
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={!selected || loading}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '发布中...' : selected ? (TARGETS.find((t) => t.key === selected)?.needsReview ? '提交审核' : '立即发布') : '请选择目标'}
          </button>
        </div>
      </div>
    </div>
  );
}
