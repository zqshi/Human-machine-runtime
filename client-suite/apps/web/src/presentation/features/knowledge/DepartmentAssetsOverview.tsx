/**
 * DepartmentAssetsOverview — 部门资产总览
 * 统一布局：Header(icon+title+count+search+action) → Description+ViewToggle → Content
 *
 * 数据来源：knowledgeStore.folders (cat-department 子文件夹)
 */
import { useState, useEffect, useMemo } from 'react';
import { Icon } from '../../components/ui/Icon';
import { SearchInput } from '../../components/ui/SearchInput';
import { useToastStore } from '../../../application/stores/toastStore';
import { useKnowledgeStore } from '../../../application/stores/knowledgeStore';
import { DepartmentPermissionModal } from './DepartmentPermissionModal';
import { AccessRestrictedModal } from './AccessRestrictedModal';

const FOLDER_COLORS = ['#007AFF', '#FF9500', '#5856D6', '#34C759', '#FF3B30', '#8E8E93'];

interface DepartmentAssetsOverviewProps {
  onFolderClick?: (folderId: string) => void;
  onClose?: () => void;
}

export function DepartmentAssetsOverview({ onFolderClick, onClose }: DepartmentAssetsOverviewProps) {
  const [showPermModal, setShowPermModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [search, setSearch] = useState('');

  const folders = useKnowledgeStore((s) => s.folders);
  const fetchCategories = useKnowledgeStore((s) => s.fetchCategories);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Get department folders (children of cat-department)
  const deptFolders = useMemo(() => {
    const catDept = folders.find((f) => f.id === 'cat-department');
    if (catDept && catDept.hasChildren) return catDept.children;
    return folders.filter((f) => f.parentId === 'cat-department');
  }, [folders]);

  const filteredFolders = deptFolders.filter((f) => !search || f.name.includes(search));

  return (
    <>
    <DepartmentPermissionModal open={showPermModal} onClose={() => setShowPermModal(false)} />
    <AccessRestrictedModal open={showAccessModal} onClose={() => setShowAccessModal(false)} />
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onClose && (
              <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-bg-hover">
                <Icon name="arrow_back" size={20} className="text-text-secondary" />
              </button>
            )}
            <Icon name="corporate_fare" size={22} className="text-primary" />
            <h2 className="text-lg font-semibold text-text-primary">部门资产</h2>
            <span className="text-xs text-text-muted bg-fill-tertiary px-2 py-0.5 rounded-full">
              {deptFolders.length} 个部门
            </span>
          </div>
          <div className="flex items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="搜索部门..."
              className="w-56"
            />
            <button
              type="button"
              onClick={() => useToastStore.getState().addToast('新建文件夹功能开发中', 'info')}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Icon name="create_new_folder" size={16} />
              <span>新建文件夹</span>
            </button>
          </div>
        </div>

        {/* Description */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-muted">
            各部门的私有知识空间，由部门负责人管理和审批
          </p>
        </div>

        {/* Folder cards grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredFolders.map((folder, i) => {
            const color = folder.color || FOLDER_COLORS[i % FOLDER_COLORS.length];
            return (
              <button
                key={folder.id}
                type="button"
                onClick={() => onFolderClick?.(folder.id)}
                className="relative bg-bg-white-var rounded-2xl border border-border p-4 text-left hover:shadow-md hover:border-primary/30 transition-all group"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                  style={{ backgroundColor: color + '14' }}
                >
                  <Icon name="folder" size={24} style={{ color }} />
                </div>
                <h3 className="text-sm font-semibold text-text-primary group-hover:text-primary transition-colors">
                  {folder.name}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">{folder.documentCount} 个文件</p>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowPermModal(true); }}
                  className="absolute top-3 right-3 p-1 rounded-md text-text-muted hover:text-text-secondary hover:bg-bg-hover opacity-0 group-hover:opacity-100 transition-opacity"
                  title="权限管理"
                >
                  <Icon name="more_vert" size={16} />
                </button>
              </button>
            );
          })}

          {/* Add new folder */}
          <button
            type="button"
            onClick={() => useToastStore.getState().addToast('新建文件夹功能开发中', 'info')}
            className="rounded-2xl border-2 border-dashed border-border p-4 flex flex-col items-center justify-center gap-2 text-text-muted hover:border-primary hover:text-primary transition-colors min-h-[120px]"
          >
            <Icon name="create_new_folder" size={24} />
            <span className="text-xs font-medium">添加新部门</span>
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
