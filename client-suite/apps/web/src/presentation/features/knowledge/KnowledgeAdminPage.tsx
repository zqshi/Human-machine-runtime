/**
 * KnowledgeAdminPage — 知识库管理概览 (精简版)
 * 统计卡片 + 最近更新 + 全量资产明细表 + 分页器
 *
 * 数据来源：knowledgeStore.documents (sorted by updatedAt)
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useToastStore } from '../../../application/stores/toastStore';
import { useUIStore } from '../../../application/stores/uiStore';
import { useKnowledgeStore } from '../../../application/stores/knowledgeStore';
import { getCategoryName } from '../../../domain/knowledge/Category';

const TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  doc: { icon: 'description', color: '#007AFF' },
  sheet: { icon: 'table_chart', color: '#34C759' },
  markdown: { icon: 'code', color: '#5856D6' },
  slide: { icon: 'slideshow', color: '#FF9500' },
};

export function KnowledgeAdminPage({ onClose }: { onClose?: () => void }) {
  const [search, setSearch] = useState('');

  const documents = useKnowledgeStore((s) => s.documents);
  const fetchDocuments = useKnowledgeStore((s) => s.fetchDocuments);

  useEffect(() => {
    if (documents.length === 0) fetchDocuments();
  }, [documents.length, fetchDocuments]);

  // Recent updates: last 3 updated documents
  const recentUpdates = useMemo(
    () =>
      [...documents]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 3),
    [documents]
  );

  // Asset table: all documents filtered by search
  const filteredAssets = useMemo(
    () =>
      documents.filter(
        (d) => !search || d.title.includes(search) || (d.departmentId || '').includes(search)
      ),
    [documents, search]
  );

  const formatRelativeTime = useCallback((iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return '刚刚';
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}天前`;
    return new Date(iso).toLocaleDateString('zh-CN');
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-white-var">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          {onClose && (
            <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-bg-hover">
              <Icon name="arrow_back" size={20} className="text-text-secondary" />
            </button>
          )}
          <Icon name="admin_panel_settings" size={22} className="text-primary" />
          <h2 className="text-lg font-semibold text-text-primary">管理概览</h2>
          <span className="px-2.5 py-1 text-[9px] font-bold text-white bg-primary rounded-full tracking-wider">
            ADMIN
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Icon
              name="search"
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索资产…"
              className="pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg w-48 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            type="button"
            onClick={() => useToastStore.getState().addToast('筛选功能开发中', 'info')}
            className="px-3 py-1.5 text-xs text-text-secondary border border-border rounded-lg hover:bg-bg-hover flex items-center gap-1.5"
          >
            <Icon name="filter_list" size={14} /> 筛选
          </button>
          <button
            type="button"
            onClick={() => useUIStore.getState().setSubView('knowledge:doc-editor')}
            className="px-3 py-1.5 text-xs text-white bg-primary rounded-lg hover:bg-primary/90 flex items-center gap-1.5 font-medium"
          >
            <Icon name="add" size={14} /> 新建内容
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Recent updates card area */}
        <div className="grid grid-cols-4 gap-4">
          {recentUpdates.map((doc) => {
            const ti = TYPE_ICONS[doc.type] || TYPE_ICONS.doc;
            return (
              <div
                key={doc.id}
                className="p-4 rounded-xl border border-border hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  useKnowledgeStore.getState().selectDocument(doc.id);
                  useUIStore.getState().setSubView('knowledge:doc-read');
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                  style={{ backgroundColor: `${ti.color}12` }}
                >
                  <Icon name={ti.icon} size={20} style={{ color: ti.color }} />
                </div>
                <p className="text-sm font-medium text-text-primary truncate">{doc.title}</p>
                <p className="text-[11px] text-text-muted mt-1">
                  {doc.tags[0] || getCategoryName(doc.categoryId)} · {doc.author.name} ·{' '}
                  {formatRelativeTime(doc.updatedAt)}
                </p>
              </div>
            );
          })}
          {/* Dark stat card */}
          <div className="p-4 rounded-xl bg-surface-dark text-white flex flex-col justify-between">
            <div>
              <p className="text-[10px] text-white/60 mb-1">本月组织新增</p>
              <p className="text-3xl font-bold">{documents.length}</p>
              <p className="text-[10px] text-white/50 mt-1">件知识资产</p>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-success">
              <Icon name="trending_up" size={12} /> +12.4%
            </div>
          </div>
        </div>

        {/* Asset table */}
        <section>
          <h3 className="text-sm font-bold text-text-primary mb-3">全量资产明细</h3>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-fill-tertiary/20">
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">
                    文件名
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">
                    所属分类
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">
                    最后修改
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-muted bg-primary/5">
                    权限
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">状态</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-text-muted">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map((doc) => (
                  <tr
                    key={doc.id}
                    className="border-b border-border/30 hover:bg-bg-hover/30 transition-colors"
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Icon name="description" size={16} className="text-primary" />
                        <span className="text-sm text-text-primary">{doc.title}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-text-secondary">
                      {getCategoryName(doc.categoryId)}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-text-muted">
                      {new Date(doc.updatedAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-3 py-2.5 bg-primary/5">
                      <span className="text-xs text-text-secondary">
                        {doc.permissions.length > 0 ? `${doc.permissions.length} 条规则` : '未设置'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-medium rounded-md ${doc.statusColor}`}
                      >
                        {doc.statusLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          useKnowledgeStore.getState().selectDocument(doc.id);
                          useUIStore.getState().setSubView('knowledge:doc-read');
                        }}
                        className="px-2.5 py-1 text-[11px] text-primary border border-primary/20 rounded-lg hover:bg-primary/5 font-medium"
                      >
                        详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-text-muted">
            显示 1-{filteredAssets.length} 个文档，共 {documents.length} 个
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="w-7 h-7 rounded-md border border-border text-text-muted hover:bg-bg-hover flex items-center justify-center"
            >
              <Icon name="chevron_left" size={14} />
            </button>
            <button
              type="button"
              className="w-7 h-7 rounded-md bg-primary text-white text-xs font-medium flex items-center justify-center"
            >
              1
            </button>
            <button
              type="button"
              className="w-7 h-7 rounded-md border border-border text-text-muted hover:bg-bg-hover flex items-center justify-center"
            >
              <Icon name="chevron_right" size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
