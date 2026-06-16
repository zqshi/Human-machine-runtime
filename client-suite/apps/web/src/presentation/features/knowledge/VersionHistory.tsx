import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { Avatar } from '../../components/ui/Avatar';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import { useKnowledgeStore } from '../../../application/stores/knowledgeStore';
import { useToastStore } from '../../../application/stores/toastStore';
import type { Version } from '../../../domain/knowledge/Version';

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 1) return '刚才';
  if (diffH < 24) return `${diffH}小时前`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return '昨天 ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

interface VersionHistoryProps {
  onClose?: () => void;
}

export function VersionHistory({ onClose }: VersionHistoryProps) {
  const { versions, selectedDocumentId } = useKnowledgeStore();
  const [showDiff, setShowDiff] = useState(true);
  const [previewVersion, setPreviewVersion] = useState<number | null>(null);

  const filtered = versions.filter((v) => v.documentId === selectedDocumentId);
  const latestVersion = filtered.length > 0 ? Math.max(...filtered.map((v) => v.version)) : 0;
  const currentPreview = previewVersion ?? latestVersion;

  if (!selectedDocumentId || filtered.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-text-muted">选择文档以查看版本历史</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-base font-semibold text-text-primary">版本历史</h3>
        {onClose && (
          <button type="button" onClick={onClose} className="p-1 rounded-md text-text-secondary hover:bg-bg-hover">
            <Icon name="close" size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Current preview label */}
        <p className="text-xs text-text-muted">
          当前预览版本：<span className="text-primary font-medium">版本 {currentPreview}</span>
        </p>

        {/* Restore button */}
        {currentPreview < latestVersion && (
          <button
            type="button"
            onClick={() => useToastStore.getState().addToast(`已恢复至版本 ${currentPreview}`, 'success')}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors"
          >
            <Icon name="restore" size={18} />
            恢复此版本
          </button>
        )}

        {/* Version entries */}
        <div className="space-y-1">
          {filtered.map((ver, idx) => (
            <VersionEntry
              key={ver.id}
              version={ver}
              isCurrent={idx === 0}
              isPreview={ver.version === currentPreview}
              showDiff={showDiff}
              onSelect={() => setPreviewVersion(ver.version)}
            />
          ))}
        </div>
      </div>

      {/* Bottom: show diff toggle */}
      <div className="px-4 py-3 border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="visibility" size={16} className="text-text-muted" />
          <span className="text-xs text-text-secondary">显示对比修改</span>
        </div>
        <ToggleSwitch checked={showDiff} onChange={() => setShowDiff(!showDiff)} />
      </div>
    </div>
  );
}

function VersionEntry({
  version: ver,
  isCurrent,
  isPreview,
  showDiff,
  onSelect,
}: {
  version: Version;
  isCurrent: boolean;
  isPreview: boolean;
  showDiff: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left p-3 rounded-xl transition-colors ${
        isPreview ? 'bg-primary/8 border border-primary/20' : 'hover:bg-bg-hover'
      }`}
    >
      <div className="flex items-start gap-3">
        <Avatar letter={ver.author.name.charAt(0)} size={36} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-text-primary">
              {isCurrent ? `${ver.author.name} (当前版本)` : (
                <span onClick={() => useToastStore.getState().addToast(`切换到版本 ${ver.version}`, 'info')} className="text-primary cursor-pointer hover:underline">版本 {ver.version}</span>
              )}
            </span>
            <span className="text-[10px] text-text-muted ml-auto shrink-0">{formatRelative(ver.createdAt)}</span>
          </div>
          <p className="text-xs text-text-secondary mt-1 line-clamp-2">{ver.changeDescription}</p>

          {/* Diff badges */}
          {showDiff && (ver.diffStats.added > 0 || ver.diffStats.removed > 0) && (
            <div className="flex items-center gap-2 mt-2">
              {ver.diffStats.added > 0 && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-success/10 text-success">
                  +{ver.diffStats.added} 处修改
                </span>
              )}
              {ver.diffStats.removed > 0 && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-error/10 text-error">
                  -{ver.diffStats.removed} 处删除
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
