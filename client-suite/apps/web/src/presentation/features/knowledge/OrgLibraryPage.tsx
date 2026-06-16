import { useState, useMemo } from 'react';
import { Icon } from '../../components/ui/Icon';
import { SearchInput } from '../../components/ui/SearchInput';
import { useKnowledgeStore } from '../../../application/stores/knowledgeStore';
import { useUIStore } from '../../../application/stores/uiStore';
import { DocumentCard } from './DocumentCard';
import { FileManager } from './FileManager';

const ORG_CATEGORY_IDS = ['cat-official', 'cat-standard'];

const TAG_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'cat-official', label: '制度规范' },
  { key: 'cat-standard', label: '操作流程' },
];

export function OrgLibraryPage({ onBack }: { onBack?: () => void }) {
  const documents = useKnowledgeStore((s) => s.documents);
  const { viewMode, setViewMode, searchQuery, setSearchQuery } = useKnowledgeStore();
  const setSubView = useUIStore((s) => s.setSubView);
  const [activeTag, setActiveTag] = useState('all');

  const filtered = useMemo(() => {
    let docs = documents.filter(
      (d) => ORG_CATEGORY_IDS.includes(d.categoryId) && d.status === 'published',
    );
    if (activeTag !== 'all') {
      docs = docs.filter((d) => d.categoryId === activeTag);
    }
    if (searchQuery) {
      docs = docs.filter((d) => d.matchesSearch(searchQuery));
    }
    return docs;
  }, [documents, activeTag, searchQuery]);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button type="button" onClick={onBack} className="p-1 rounded-md hover:bg-bg-hover">
                <Icon name="arrow_back" size={20} className="text-text-secondary" />
              </button>
            )}
            <Icon name="library_books" size={22} className="text-primary" />
            <h2 className="text-lg font-semibold text-text-primary">公司文库</h2>
            <span className="text-xs text-text-muted bg-fill-tertiary px-2 py-0.5 rounded-full">
              {filtered.length} 篇
            </span>
          </div>
          <div className="flex items-center gap-2">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="搜索公司文库..."
              className="w-56"
            />
            <button
              type="button"
              onClick={() => setSubView('knowledge:doc-editor')}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Icon name="add" size={16} />
              <span>新建</span>
            </button>
          </div>
        </div>

        {/* Tag filter */}
        <div className="flex items-center gap-2">
          {TAG_FILTERS.map((tag) => (
            <button
              key={tag.key}
              onClick={() => setActiveTag(tag.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeTag === tag.key
                  ? 'bg-primary text-white'
                  : 'bg-fill-tertiary text-text-secondary hover:bg-primary/10 hover:text-primary'
              }`}
            >
              {tag.label}
            </button>
          ))}
        </div>

        {/* View toggle + document list */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-muted">
            公司级制度、规范与标准化流程，经管理员审批后发布
          </p>
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

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Icon name="library_books" size={48} className="text-text-muted/30 mx-auto mb-3" />
            <p className="text-sm text-text-muted">暂无已发布的公司文档</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((doc) => (
              <DocumentCard key={doc.id} document={doc} badge="公司" />
            ))}
          </div>
        ) : (
          <FileManager documents={filtered} />
        )}
      </div>
    </div>
  );
}
