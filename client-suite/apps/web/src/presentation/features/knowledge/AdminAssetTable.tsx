/**
 * AdminAssetTable — 知识库管理员视图 全量资产明细表 (km_10 对齐)
 * 表头：文件名 / 所属分类 / 最后修改 / 权限 / 状态 / 操作
 *
 * 数据来源：knowledgeStore.documents
 */
import { useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useToastStore } from '../../../application/stores/toastStore';
import { useKnowledgeStore } from '../../../application/stores/knowledgeStore';
import { useUIStore } from '../../../application/stores/uiStore';
import { getCategoryName } from '../../../domain/knowledge/Category';

export function AdminAssetTable() {
  const documents = useKnowledgeStore((s) => s.documents);
  const fetchDocuments = useKnowledgeStore((s) => s.fetchDocuments);

  useEffect(() => {
    if (documents.length === 0) fetchDocuments();
  }, [documents.length, fetchDocuments]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="inventory_2" size={18} className="text-primary" />
          <h3 className="text-base font-semibold text-text-primary">全量资产明细</h3>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => useToastStore.getState().addToast('筛选功能开发中', 'info')} className="p-1.5 rounded-md text-text-muted hover:bg-bg-hover">
            <Icon name="filter_list" size={18} />
          </button>
          <button type="button" onClick={() => useToastStore.getState().addToast('导出功能开发中', 'info')} className="p-1.5 rounded-md text-text-muted hover:bg-bg-hover">
            <Icon name="download" size={18} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-fill-tertiary/30 border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">文件名</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">所属分类</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">最后修改</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-primary">权限 (管理)</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary">状态</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-text-secondary">操作</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id} className="border-b border-border last:border-0 hover:bg-bg-hover/50 transition-colors">
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <Icon name="description" size={18} className="text-primary" />
                    <span className="text-sm font-medium text-text-primary">{doc.title}</span>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-sm text-text-secondary">{getCategoryName(doc.categoryId)}</td>
                <td className="px-4 py-3.5 text-sm text-text-secondary">{new Date(doc.updatedAt).toLocaleDateString('zh-CN')}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <Icon name={doc.permissions.length > 0 ? 'group' : 'lock'} size={14} className="text-text-muted" />
                    <span className="text-xs text-text-primary">
                      {doc.permissions.length > 0 ? `${doc.permissions.length} 条规则` : '未设置'}
                    </span>
                    <Icon name="expand_more" size={14} className="text-text-muted" />
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${doc.statusColor}`}>
                    {doc.statusLabel}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center justify-center gap-1">
                    <button type="button" onClick={() => {
                      useKnowledgeStore.getState().selectDocument(doc.id);
                      useUIStore.getState().setSubView('knowledge:doc-editor');
                    }} className="p-1 rounded text-text-muted hover:text-primary hover:bg-primary/5">
                      <Icon name="edit" size={16} />
                    </button>
                    <button type="button" onClick={() => {
                      useKnowledgeStore.getState().selectDocument(doc.id);
                      useUIStore.getState().setSubView('knowledge:doc-read');
                    }} className="p-1 rounded text-text-muted hover:text-text-secondary">
                      <Icon name="visibility" size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-text-muted px-1">
        <span>显示 1 - {documents.length} 个文档，共 {documents.length} 个</span>
        <div className="flex items-center gap-1">
          <button type="button" className="p-1 rounded hover:bg-bg-hover text-text-muted">
            <Icon name="chevron_left" size={16} />
          </button>
          <button type="button" className="w-7 h-7 rounded-lg bg-primary text-white text-xs font-medium flex items-center justify-center">
            1
          </button>
          <button type="button" className="p-1 rounded hover:bg-bg-hover text-text-muted">
            <Icon name="chevron_right" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Stats card shown in the recent section */
export function OrgStatsCard() {
  const documents = useKnowledgeStore((s) => s.documents);

  return (
    <div className="bg-surface-dark rounded-xl p-5 flex flex-col justify-between min-h-[180px] text-white">
      <div>
        <p className="text-xs text-white/60">本月组织新增</p>
        <p className="text-3xl font-bold mt-1">{documents.length} 件</p>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/60">报表分析</span>
        <button type="button" onClick={() => useToastStore.getState().addToast('数据分析功能开发中', 'info')} className="p-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
          <Icon name="bar_chart" size={18} className="text-white" />
        </button>
      </div>
    </div>
  );
}
