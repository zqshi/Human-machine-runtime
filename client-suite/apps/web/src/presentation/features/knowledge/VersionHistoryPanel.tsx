/**
 * VersionHistoryPanel — 版本历史面板 (document_version_history 对齐)
 * 版本列表 + 当前预览版本提示 + 恢复按钮 + diff统计 + 显示对比修改开关
 *
 * 数据来源：knowledgeStore.versions (通过 fetchVersions)
 */
import { useState, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { Avatar } from '../../components/ui/Avatar';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import { useToastStore } from '../../../application/stores/toastStore';
import { useKnowledgeStore } from '../../../application/stores/knowledgeStore';

interface VersionHistoryPanelProps {
  onClose?: () => void;
  documentId?: string;
}

export function VersionHistoryPanel({ onClose, documentId }: VersionHistoryPanelProps) {
  const [showDiff, setShowDiff] = useState(true);

  const selectedDocumentId = useKnowledgeStore((s) => s.selectedDocumentId);
  const versions = useKnowledgeStore((s) => s.versions);
  const fetchVersions = useKnowledgeStore((s) => s.fetchVersions);
  const restoreVersion = useKnowledgeStore((s) => s.restoreVersion);

  const docId = documentId || selectedDocumentId;
  // Auto-select first non-current version — derived from versions
  const autoSelectedId = versions.length > 1 ? (versions[1]?.id ?? null) : null;
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const effectiveVersionId = selectedVersionId ?? autoSelectedId;

  useEffect(() => {
    if (docId) fetchVersions(docId);
  }, [docId, fetchVersions]);

  const selectedVersion = versions.find((v) => v.id === effectiveVersionId);

  const handleRestore = async () => {
    if (!effectiveVersionId) return;
    const ok = await restoreVersion(effectiveVersionId);
    if (ok) {
      useToastStore.getState().addToast('已恢复至所选版本', 'success');
    } else {
      useToastStore.getState().addToast('该版本没有内容快照，无法恢复', 'info');
    }
  };

  return (
    <div className="w-80 border-l border-border bg-bg-secondary overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-text-primary">版本历史</h3>
        {onClose && (
          <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-bg-hover text-text-secondary">
            <Icon name="close" size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Current preview hint */}
        {selectedVersion && (
          <div className="px-4 py-3 text-xs text-text-muted">
            当前预览版本：<span className="font-medium text-primary">版本 {selectedVersion.version}</span>
          </div>
        )}

        {/* Restore button */}
        <div className="px-4 mb-4">
          <button
            type="button"
            onClick={handleRestore}
            disabled={!effectiveVersionId}
            className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon name="history" size={16} />
            恢复此版本
          </button>
        </div>

        {/* Version timeline */}
        <div className="px-4 space-y-1">
          {versions.map((v, i) => {
            const isSelected = effectiveVersionId === v.id;
            const isCurrent = i === 0;
            const authorLetter = v.author.name.charAt(0);
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedVersionId(v.id)}
                className={`w-full text-left p-3 rounded-xl transition-colors ${
                  isSelected ? 'bg-primary/5 border border-primary/20' : 'hover:bg-bg-hover border border-transparent'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <Avatar letter={authorLetter} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold ${isSelected ? 'text-primary' : 'text-text-primary'}`}>
                        {isCurrent ? `${v.author.name} (当前版本)` : `版本 ${v.version}`}
                      </span>
                      <span className="text-[10px] text-text-muted shrink-0">
                        {new Date(v.createdAt).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-secondary mt-0.5 line-clamp-2">{v.changeDescription}</p>
                    {v.totalChanges > 0 && (
                      <div className="flex items-center gap-2 mt-1.5">
                        {v.diffStats.added > 0 && (
                          <span className="text-[10px] font-medium text-success bg-success/10 px-1.5 py-0.5 rounded">
                            +{v.diffStats.added} 处修改
                          </span>
                        )}
                        {v.diffStats.removed > 0 && (
                          <span className="text-[10px] font-medium text-error bg-error/10 px-1.5 py-0.5 rounded">
                            -{v.diffStats.removed} 处删除
                          </span>
                        )}
                      </div>
                    )}
                    {/* Status badge */}
                    {v.status !== 'auto' && (
                      <span className="inline-block mt-1 text-[9px] font-medium text-text-muted bg-fill-tertiary px-1.5 py-0.5 rounded">
                        {v.statusLabel}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom toggle */}
      <div className="px-4 py-3 border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="visibility" size={14} className="text-text-muted" />
          <span className="text-[11px] text-text-secondary">显示对比修改</span>
        </div>
        <ToggleSwitch checked={showDiff} onChange={setShowDiff} />
      </div>
    </div>
  );
}
