/**
 * DocumentReadView — 文档只读阅读页 (km_8 对齐)
 * 顶部: 文档图标+标题+收藏星标+协作者头像+申请编辑按钮
 * 中间: 只读文档内容 (指标卡片+正文)
 * 底部浮动: 申请编辑权限按钮 → 触发 RequestEditPermissionModal
 *
 * 数据来源：knowledgeStore.selectedDocumentId → documents
 */
import { useState, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { Avatar } from '../../components/ui/Avatar';
import { RequestEditPermissionModal } from './RequestEditPermissionModal';
import { sanitizeHtml } from '../../utils/sanitize';
import { useUIStore } from '../../../application/stores/uiStore';
import { useToastStore } from '../../../application/stores/toastStore';
import { useKnowledgeStore } from '../../../application/stores/knowledgeStore';
import { getCategoryName } from '../../../domain/knowledge/Category';

interface DocumentReadViewProps {
  onBack?: () => void;
}

export function DocumentReadView({ onBack }: DocumentReadViewProps) {
  const [showPermModal, setShowPermModal] = useState(false);
  const setSubView = useUIStore((s) => s.setSubView);

  const selectedDocumentId = useKnowledgeStore((s) => s.selectedDocumentId);
  const documents = useKnowledgeStore((s) => s.documents);
  const fetchDocuments = useKnowledgeStore((s) => s.fetchDocuments);
  const toggleStar = useKnowledgeStore((s) => s.toggleStar);

  useEffect(() => {
    if (documents.length === 0) fetchDocuments();
  }, [documents.length, fetchDocuments]);

  const doc = documents.find((d) => d.id === selectedDocumentId);

  const handleBack = () => {
    if (onBack) onBack();
    else setSubView(null);
  };

  if (!doc) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-white-var">
        <div className="text-center">
          <Icon name="description" size={48} className="text-text-muted mb-3" />
          <p className="text-sm text-text-muted">未选择文档</p>
          <button
            type="button"
            onClick={handleBack}
            className="mt-3 text-sm text-primary hover:text-primary/80"
          >
            返回列表
          </button>
        </div>
      </div>
    );
  }

  const authorLetter = doc.author.name.charAt(0);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-white-var">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary"
          >
            <Icon name="arrow_back" size={18} />
          </button>
          <Icon name="description" size={18} className="text-primary" />
          <h3 className="text-[15px] font-bold text-text-primary">{doc.title}</h3>
          <button
            type="button"
            onClick={() => toggleStar(doc.id)}
            className="p-1 text-text-muted hover:text-warning"
          >
            <Icon
              name={doc.starred ? 'star' : 'star_border'}
              size={18}
              className={doc.starred ? 'text-warning' : ''}
            />
          </button>
          <span className={`px-2 py-0.5 text-[9px] font-medium rounded-full ${doc.statusColor}`}>
            {doc.statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {doc.readCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-text-muted">
              <Icon name="visibility" size={14} />
              {doc.readCount}人已阅读
            </span>
          )}
          <button
            type="button"
            onClick={() => useToastStore.getState().addToast('链接已复制到剪贴板', 'success')}
            className="px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/15"
          >
            分享
          </button>
          <button
            type="button"
            onClick={() => setShowPermModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-fill-tertiary/50 text-text-secondary rounded-lg text-xs font-medium hover:bg-fill-tertiary/70"
          >
            <Icon name="lock" size={14} />
            申请编辑
          </button>
        </div>
      </div>

      {/* Document content */}
      <div className="flex-1 overflow-y-auto dcf-scrollbar">
        <div className="max-w-3xl mx-auto px-8 py-8">
          {/* Title + meta */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-0.5 text-[10px] font-medium text-primary bg-primary/10 rounded">
                只读
              </span>
              {doc.size !== '0 KB' && (
                <span className="px-2 py-0.5 text-[10px] font-medium text-text-muted bg-fill-tertiary rounded">
                  {doc.size}
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold text-text-primary mb-4">{doc.title}</h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Avatar
                  letter={authorLetter}
                  size={28}
                  gradient="bg-gradient-to-br from-orange-400 to-amber-500"
                />
                <div>
                  <span className="text-sm font-medium text-text-primary">{doc.author.name}</span>
                  {doc.departmentId && (
                    <span className="text-xs text-text-muted ml-2">
                      {getCategoryName(doc.categoryId)}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs text-text-muted">
                更新于{' '}
                {new Date(doc.updatedAt).toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
              {doc.readCount > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-text-muted">
                  <Icon name="visibility" size={14} />
                  {doc.readCount} 次阅读
                </span>
              )}
            </div>
            {/* Tags */}
            {doc.tags.length > 0 && (
              <div className="flex items-center gap-1.5 mt-3">
                {doc.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 text-[10px] font-medium text-text-secondary bg-fill-tertiary rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Content body */}
          <div
            className="prose prose-sm max-w-none text-text-primary
              prose-headings:text-text-primary prose-headings:font-semibold
              prose-h2:text-lg prose-h2:mt-8 prose-h2:mb-3
              prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2
              prose-p:leading-relaxed prose-p:text-text-secondary
              prose-li:text-text-secondary
              prose-strong:text-text-primary
              prose-blockquote:border-l-primary prose-blockquote:text-text-muted prose-blockquote:bg-fill-tertiary/30 prose-blockquote:rounded-r-lg prose-blockquote:py-2 prose-blockquote:px-4"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(doc.content) }}
          />
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="shrink-0 border-t border-border bg-bg-white-var/80 backdrop-blur-sm px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Icon name="lock" size={14} />
            <span>此文档为只读模式，需要编辑请申请权限</span>
          </div>
          <button
            type="button"
            onClick={() => setShowPermModal(true)}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Icon name="edit" size={16} />
            申请编辑权限
          </button>
        </div>
      </div>

      <RequestEditPermissionModal open={showPermModal} onClose={() => setShowPermModal(false)} />
    </div>
  );
}
