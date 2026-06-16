import { useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { SearchInput } from '../../components/ui/SearchInput';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { useKnowledgeStore } from '../../../application/stores/knowledgeStore';
import { useUIStore } from '../../../application/stores/uiStore';
import { DocumentCard } from './DocumentCard';
import { FileManager } from './FileManager';
import { DraftsPage } from './DraftsPage';
import { DepartmentAssetsOverview } from './DepartmentAssetsOverview';
import { AuditLogPage } from './AuditLogPage';
import { StorageManagementPage } from './StorageManagementPage';
import { FileListView } from './FileListView';
import { SpreadsheetEditor } from './SpreadsheetEditor';
import { DocumentEditorWithSettings } from './DocumentEditorWithSettings';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConflictMergeView } from './ConflictMergeView';
import { HTMLPreviewPanel } from './HTMLPreviewPanel';
import { CollaborativeEditConflict } from './CollaborativeEditConflict';
import { VersionHistoryPanel } from './VersionHistoryPanel';
import { DocumentReadView } from './DocumentReadView';
import { KnowledgeAdminPage } from './KnowledgeAdminPage';
import { AIHTMLEditDiff } from './AIHTMLEditDiff';
import { DocumentSecurityPanel } from './DocumentSecurityPanel';
import { DocumentSettingsPanel } from './DocumentSettingsPanel';
import { KnowledgeAIChat } from './KnowledgeAIChat';
import { OrgLibraryPage } from './OrgLibraryPage';
import { SharedSpacePage } from './SharedSpacePage';
import { PendingReviewPage } from './PendingReviewPage';

interface SidebarItem {
  id: string;
  label: string;
  icon: string;
}

/* ── 浏览 ── */
const BROWSE_ITEMS: SidebarItem[] = [
  { id: 'org-library', label: '公司文库', icon: 'library_books' },
  { id: 'dept-assets', label: '部门资产', icon: 'corporate_fare' },
  { id: 'shared-space', label: '共享空间', icon: 'group' },
];

/* ── 我的 ── */
const MY_ITEMS: SidebarItem[] = [
  { id: 'my-docs', label: '我的文档', icon: 'description' },
  { id: 'pending-review', label: '待我审核', icon: 'rate_review' },
  { id: 'favorites', label: '收藏夹', icon: 'star' },
];

/* ── 管理 ── */
const ADMIN_ITEMS: SidebarItem[] = [
  { id: 'admin', label: '管理概览', icon: 'admin_panel_settings' },
  { id: 'capacity', label: '容量管理', icon: 'storage' },
  { id: 'audit', label: '审核日志', icon: 'rule' },
];

/** Map sidebar item IDs to sub-view names. All items now go through subView. */
const SUBVIEW_MAP: Record<string, string> = {
  'org-library': 'knowledge:org-library',
  'dept-assets': 'knowledge:dept-assets',
  'shared-space': 'knowledge:shared-space',
  'my-docs': 'knowledge:my-docs',
  'pending-review': 'knowledge:pending-review',
  favorites: 'knowledge:favorites',
  admin: 'knowledge:admin',
  capacity: 'knowledge:storage',
  audit: 'knowledge:audit-log',
};

export function KnowledgeSidebar() {
  const subView = useUIStore((s) => s.subView);
  const setSubView = useUIStore((s) => s.setSubView);
  const { selectFolder } = useKnowledgeStore();
  const isAdmin = useKnowledgeStore((s) => s.isAdminView);

  const handleItemClick = (item: SidebarItem) => {
    const mapped = SUBVIEW_MAP[item.id];
    if (!mapped) return;
    setSubView(subView === mapped ? null : mapped);
    selectFolder(null);
  };

  const isActiveItem = (item: SidebarItem) => {
    const mapped = SUBVIEW_MAP[item.id];
    return mapped ? subView === mapped : false;
  };

  const renderItem = (item: SidebarItem) => {
    const isActive = isActiveItem(item);
    return (
      <button
        key={item.id}
        onClick={() => handleItemClick(item)}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
          isActive ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-bg-hover text-text-primary font-medium'
        }`}
      >
        <Icon name={item.icon} size={16} className={isActive ? 'text-primary' : 'text-text-secondary'} />
        <span>{item.label}</span>
      </button>
    );
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      <h3 className="text-lg font-semibold text-text-primary">知识库</h3>

      <div className="space-y-0.5">
        <SectionLabel>浏览</SectionLabel>
        {BROWSE_ITEMS.map(renderItem)}
      </div>

      <div className="space-y-0.5">
        <SectionLabel>我的</SectionLabel>
        {MY_ITEMS.map(renderItem)}
      </div>

      {isAdmin && (
        <div className="space-y-0.5">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-text-muted px-2 mb-1.5 flex items-center gap-1">
            <Icon name="admin_panel_settings" size={14} className="text-primary" />
            管理
          </h3>
          {ADMIN_ITEMS.map(renderItem)}
        </div>
      )}
    </div>
  );
}

function RecentFilesGrid() {
  const documents = useKnowledgeStore((s) => s.documents);
  const published = documents.filter((d) => d.status === 'published');
  const recent = published.slice(0, 4);

  if (recent.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="schedule" size={18} className="text-primary" />
          <h3 className="text-base font-semibold text-text-primary">最近发布</h3>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {recent.map((doc) => (
          <DocumentCard key={doc.id} document={doc} />
        ))}
      </div>
    </div>
  );
}

export function KnowledgePage() {
  const {
    documents, searchQuery, setSearchQuery, viewMode, setViewMode,
    fetchDocuments, loading, error,
  } = useKnowledgeStore();
  const subView = useUIStore((s) => s.subView);
  const setSubView = useUIStore((s) => s.setSubView);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // ── Sub-view routing ─────────────────────────────────────────────
  // Browse
  if (subView === 'knowledge:org-library') return <OrgLibraryPage onBack={() => setSubView(null)} />;
  if (subView === 'knowledge:dept-assets') return <DepartmentAssetsOverview onClose={() => setSubView(null)} />;
  if (subView === 'knowledge:shared-space') return <SharedSpacePage onBack={() => setSubView(null)} />;
  // My
  if (subView === 'knowledge:my-docs') return <DraftsPage mode="my-docs" onBack={() => setSubView(null)} />;
  if (subView === 'knowledge:pending-review') return <PendingReviewPage onBack={() => setSubView(null)} />;
  if (subView === 'knowledge:favorites') return <DraftsPage mode="favorites" onBack={() => setSubView(null)} />;
  // Admin
  if (subView === 'knowledge:admin') return <KnowledgeAdminPage onClose={() => setSubView(null)} />;
  if (subView === 'knowledge:storage') return <StorageManagementPage onClose={() => setSubView(null)} />;
  if (subView === 'knowledge:audit-log') return <AuditLogPage onClose={() => setSubView(null)} />;
  // Utility sub-views (opened from within pages, not from sidebar)
  if (subView === 'knowledge:file-list') return <FileListView onBack={() => setSubView(null)} />;
  if (subView === 'knowledge:spreadsheet') return <SpreadsheetEditor onExit={() => setSubView(null)} />;
  if (subView === 'knowledge:doc-editor') return <DocumentEditorWithSettings onClose={() => setSubView(null)} />;
  if (subView === 'knowledge:conflict-merge') return <ConflictMergeView onCancel={() => setSubView(null)} />;
  if (subView === 'knowledge:html-preview') return <HTMLPreviewPanel onClose={() => setSubView(null)} />;
  if (subView === 'knowledge:collab-conflict') return <CollaborativeEditConflict onDismiss={() => setSubView(null)} />;
  if (subView === 'knowledge:version-history') return <VersionHistoryPanel onClose={() => setSubView(null)} />;
  if (subView === 'knowledge:doc-read') return <DocumentReadView onBack={() => setSubView(null)} />;
  if (subView === 'knowledge:ai-diff') return <AIHTMLEditDiff onClose={() => setSubView(null)} />;
  if (subView === 'knowledge:doc-security') return <DocumentSecurityPanel onClose={() => setSubView(null)} />;
  if (subView === 'knowledge:doc-settings') return <DocumentSettingsPanel onClose={() => setSubView(null)} />;
  if (subView === 'knowledge:ai-chat') return <KnowledgeAIChat onClose={() => setSubView(null)} />;

  // ── Default: 知识广场 (home) ──────────────────────────────────────
  const filtered = searchQuery
    ? documents.filter((d) => d.matchesSearch(searchQuery))
    : documents.filter((d) => d.status === 'published');

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">知识广场</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSubView('knowledge:ai-chat')}
              className="flex items-center gap-1.5 px-3 py-2 bg-fill-tertiary text-text-secondary rounded-lg text-sm font-medium hover:bg-primary/10 hover:text-primary transition-colors"
            >
              <Icon name="smart_toy" size={16} />
              <span>AI 问答</span>
            </button>
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="搜索文档、流程或资产..."
              className="w-64"
            />
            <button
              type="button"
              onClick={() => setSubView('knowledge:doc-editor')}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Icon name="add" size={18} />
              <span>新建</span>
            </button>
          </div>
        </div>

        {/* Loading / Error */}
        {loading && documents.length === 0 && (
          <div className="flex items-center justify-center py-16 gap-2 text-text-muted">
            <Icon name="hourglass_empty" size={20} className="animate-spin" />
            <span className="text-sm">加载文档中...</span>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <Icon name="error_outline" size={18} />
            <span>{error}</span>
            <button type="button" onClick={() => fetchDocuments()} className="ml-auto text-xs text-primary hover:underline">重试</button>
          </div>
        )}

        {/* Recent published */}
        {!searchQuery && <RecentFilesGrid />}

        {/* All documents */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="description" size={18} className="text-primary" />
              <h3 className="text-base font-semibold text-text-primary">
                {searchQuery ? '搜索结果' : '已发布文档'}
              </h3>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'grid' ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <Icon name="grid_view" size={18} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'list' ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <Icon name="view_list" size={18} />
              </button>
            </div>
          </div>

          {filtered.length === 0 && (
            <EmptyState
              icon={searchQuery ? 'search_off' : 'description'}
              title={searchQuery ? '没有找到匹配的文档' : '暂无已发布的文档'}
              description={searchQuery ? '尝试使用其他关键词搜索' : '点击右上角「新建」创建第一篇文档'}
            />
          )}

          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((doc) => (
                <DocumentCard key={doc.id} document={doc} />
              ))}
            </div>
          ) : (
            <FileManager documents={filtered} />
          )}
        </div>
      </div>
    </div>
  );
}
