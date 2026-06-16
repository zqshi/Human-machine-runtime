/**
 * DraftsPage — 我的草稿/阅读清单/收藏夹列表 (km_3 对齐)
 * 搜索框 + 批量操作栏 + 表格 + 分页器
 *
 * 数据来源：knowledgeStore
 */
import { useState, useEffect, useMemo } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useUIStore } from '../../../application/stores/uiStore';
import { useToastStore } from '../../../application/stores/toastStore';
import { useKnowledgeStore } from '../../../application/stores/knowledgeStore';
import { getCategoryName } from '../../../domain/knowledge/Category';

type DraftsMode = 'drafts' | 'favorites' | 'my-docs';

const MODE_CONFIG: Record<
  DraftsMode,
  { title: string; countLabel: string; actionLabel: string; timeLabel: string }
> = {
  drafts: {
    title: '我的草稿',
    countLabel: '份草稿',
    actionLabel: '新建草稿',
    timeLabel: '最后保存',
  },
  favorites: {
    title: '收藏夹',
    countLabel: '个收藏',
    actionLabel: '浏览知识库',
    timeLabel: '收藏时间',
  },
  'my-docs': {
    title: '我的文档',
    countLabel: '篇文档',
    actionLabel: '新建文档',
    timeLabel: '更新时间',
  },
};

interface DraftsPageProps {
  mode?: DraftsMode;
  onBack?: () => void;
}

export function DraftsPage({ mode = 'drafts', onBack }: DraftsPageProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [myDocsTab, setMyDocsTab] = useState<'all' | 'draft' | 'pending_review' | 'published'>(
    'all'
  );
  const config = MODE_CONFIG[mode];

  const documents = useKnowledgeStore((s) => s.documents);
  const fetchDocuments = useKnowledgeStore((s) => s.fetchDocuments);
  const deleteDocument = useKnowledgeStore((s) => s.deleteDocument);
  const publishDocument = useKnowledgeStore((s) => s.publishDocument);
  const toggleStar = useKnowledgeStore((s) => s.toggleStar);

  useEffect(() => {
    if (documents.length === 0) fetchDocuments();
  }, [documents.length, fetchDocuments]);

  // Filter documents based on mode
  const items = useMemo(() => {
    switch (mode) {
      case 'drafts':
        return documents.filter((d) => d.isDraft);
      case 'favorites':
        return documents.filter((d) => d.starred);
      case 'my-docs': {
        const mine = documents.filter(
          (d) => d.ownerId === 'current-user' || d.author?.name === '当前用户'
        );
        const pool = mine.length > 0 ? mine : documents;
        if (myDocsTab === 'all') return pool;
        if (myDocsTab === 'draft') return pool.filter((d) => d.isDraft);
        if (myDocsTab === 'pending_review')
          return pool.filter((d) => d.status === 'pending_review');
        if (myDocsTab === 'published') return pool.filter((d) => d.isPublished);
        return pool;
      }
      default:
        return [];
    }
  }, [documents, mode, myDocsTab]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((d) => d.id)));
  };

  const filtered = items.filter(
    (d) =>
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.excerpt.toLowerCase().includes(search.toLowerCase())
  );

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 60) return `${diffMin}分钟前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}小时前`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay}天前`;
    return d.toLocaleDateString('zh-CN');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-white-var">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary mb-3 px-6 pt-3"
        >
          <Icon name="arrow_back" size={18} /> 返回
        </button>
      )}
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{config.title}</h2>
          <p className="text-xs text-text-muted mt-0.5">
            {items.length} {config.countLabel}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Icon
              name="search"
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`搜索${config.title}...`}
              className="pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-bg-white-var w-56 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            type="button"
            onClick={() => useUIStore.getState().setSubView('knowledge:doc-editor')}
            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5"
          >
            <Icon name="add" size={16} />
            {config.actionLabel}
          </button>
        </div>
      </div>

      {/* My-docs tab bar */}
      {mode === 'my-docs' && (
        <div className="flex items-center gap-1 px-6 py-2 border-b border-border bg-bg-white-var">
          {(
            [
              ['all', '全部'],
              ['draft', '草稿'],
              ['pending_review', '审核中'],
              ['published', '已发布'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setMyDocsTab(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                myDocsTab === key
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-6 py-2 bg-primary/5 border-b border-border">
          <span className="text-xs font-medium text-primary">已选择 {selected.size} 项</span>
          <button
            type="button"
            onClick={() => {
              selected.forEach((id) => deleteDocument(id));
              setSelected(new Set());
            }}
            className="text-xs text-text-secondary hover:text-primary font-medium"
          >
            批量删除
          </button>
          {mode === 'drafts' && (
            <button
              type="button"
              onClick={() => {
                selected.forEach((id) => publishDocument(id));
                setSelected(new Set());
                useToastStore.getState().addToast(`已发布 ${selected.size} 项`, 'success');
              }}
              className="text-xs text-text-secondary hover:text-primary font-medium"
            >
              直接发布
            </button>
          )}
          {mode === 'favorites' && (
            <button
              type="button"
              onClick={() => {
                selected.forEach((id) => toggleStar(id));
                setSelected(new Set());
              }}
              className="text-xs text-text-secondary hover:text-primary font-medium"
            >
              取消收藏
            </button>
          )}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs text-text-muted hover:text-text-primary ml-auto"
          >
            取消选择
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-fill-tertiary/30 text-left">
              <th className="px-6 py-2.5 w-10">
                <input
                  type="checkbox"
                  checked={selected.size === items.length && items.length > 0}
                  onChange={toggleAll}
                  className="rounded border-border"
                />
              </th>
              <th className="px-3 py-2.5 text-xs font-medium text-text-secondary">文档标题</th>
              <th className="px-3 py-2.5 text-xs font-medium text-text-secondary">所属分类</th>
              <th className="px-3 py-2.5 text-xs font-medium text-text-secondary">
                {config.timeLabel}
              </th>
              <th className="px-3 py-2.5 text-xs font-medium text-text-secondary text-right">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((doc) => (
              <tr
                key={doc.id}
                className="border-b border-border/30 hover:bg-bg-hover/30 transition-colors"
              >
                <td className="px-6 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(doc.id)}
                    onChange={() => toggleSelect(doc.id)}
                    className="rounded border-border"
                  />
                </td>
                <td className="px-3 py-3">
                  <p className="text-sm font-medium text-text-primary">{doc.title}</p>
                  <p className="text-[11px] text-text-muted mt-0.5 line-clamp-1">{doc.excerpt}</p>
                </td>
                <td className="px-3 py-3">
                  <span className="text-xs text-text-secondary">
                    {getCategoryName(doc.categoryId)}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span className="text-xs text-text-muted">{formatTime(doc.updatedAt)}</span>
                </td>
                <td className="px-3 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {mode === 'drafts' && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            useKnowledgeStore.getState().selectDocument(doc.id);
                            useUIStore.getState().setSubView('knowledge:doc-editor');
                          }}
                          className="text-xs text-primary font-medium hover:text-primary/80"
                        >
                          继续编辑
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteDocument(doc.id)}
                          className="text-xs text-text-muted hover:text-error font-medium"
                        >
                          删除
                        </button>
                      </>
                    )}
                    {mode === 'my-docs' && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            useKnowledgeStore.getState().selectDocument(doc.id);
                            useUIStore
                              .getState()
                              .setSubView(
                                doc.isDraft ? 'knowledge:doc-editor' : 'knowledge:doc-read'
                              );
                          }}
                          className="text-xs text-primary font-medium hover:text-primary/80"
                        >
                          {doc.isDraft ? '编辑' : '查看'}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteDocument(doc.id)}
                          className="text-xs text-text-muted hover:text-error font-medium"
                        >
                          删除
                        </button>
                      </>
                    )}
                    {mode === 'favorites' && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            useKnowledgeStore.getState().selectDocument(doc.id);
                            useUIStore.getState().setSubView('knowledge:doc-read');
                          }}
                          className="text-xs text-primary font-medium hover:text-primary/80"
                        >
                          查看
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleStar(doc.id)}
                          className="text-xs text-text-muted hover:text-error font-medium"
                        >
                          取消收藏
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-border">
        <span className="text-xs text-text-muted">
          显示 1-{filtered.length} 个文档，共 {items.length} 个
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="px-2.5 py-1 text-xs rounded border border-border text-text-muted hover:bg-bg-hover"
          >
            <Icon name="chevron_left" size={14} />
          </button>
          <button
            type="button"
            className="px-2.5 py-1 text-xs rounded bg-primary text-white font-medium"
          >
            1
          </button>
          <button
            type="button"
            className="px-2.5 py-1 text-xs rounded border border-border text-text-muted hover:bg-bg-hover"
          >
            <Icon name="chevron_right" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
