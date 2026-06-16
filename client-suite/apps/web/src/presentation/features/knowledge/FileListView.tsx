/**
 * FileListView — 部门文件列表 + 批量操作栏 (km_20 对齐)
 * Finder风格文件表格 + 多选checkbox + 底部批量操作浮层
 *
 * 数据来源：knowledgeStore.documents (按 selectedFolderId/departmentId 筛选)
 */
import { useState, useEffect, useMemo } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useUIStore } from '../../../application/stores/uiStore';
import { useToastStore } from '../../../application/stores/toastStore';
import { useKnowledgeStore } from '../../../application/stores/knowledgeStore';
import { MoveFilesModal } from './MoveFilesModal';

const TYPE_ICON: Record<string, { icon: string; color: string }> = {
  doc: { icon: 'description', color: '#007AFF' },
  sheet: { icon: 'table_chart', color: '#34C759' },
  markdown: { icon: 'code', color: '#5856D6' },
  slide: { icon: 'slideshow', color: '#FF9500' },
};

interface FileListViewProps {
  departmentName?: string;
  folderId?: string;
  onMoveFiles?: (ids: string[]) => void;
  onBack?: () => void;
}

export function FileListView({ departmentName, folderId, onMoveFiles, onBack }: FileListViewProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [search, setSearch] = useState('');
  const setSubView = useUIStore((s) => s.setSubView);

  const documents = useKnowledgeStore((s) => s.documents);
  const selectedFolderId = useKnowledgeStore((s) => s.selectedFolderId);
  const folders = useKnowledgeStore((s) => s.folders);

  // Resolve department name from folder store if not provided via props
  const resolvedDeptName = departmentName || (() => {
    const targetId = folderId || selectedFolderId;
    if (!targetId) return '未知部门';
    const folder = folders.find((f) => f.id === targetId);
    return folder?.name || '未知部门';
  })();
  const fetchDocuments = useKnowledgeStore((s) => s.fetchDocuments);
  const deleteDocument = useKnowledgeStore((s) => s.deleteDocument);

  useEffect(() => {
    if (documents.length === 0) fetchDocuments();
  }, [documents.length, fetchDocuments]);

  // Filter documents by folder/department
  const targetFolderId = folderId || selectedFolderId;
  const files = useMemo(() => {
    if (!targetFolderId) return documents;
    return documents.filter((d) =>
      d.folderId === targetFolderId ||
      d.categoryId === targetFolderId ||
      d.departmentId === targetFolderId,
    );
  }, [documents, targetFolderId]);

  const filteredFiles = files.filter((f) => !search || f.title.includes(search) || f.author.name.includes(search));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filteredFiles.length) setSelected(new Set());
    else setSelected(new Set(filteredFiles.map((f) => f.id)));
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-white-var relative">
      {/* Back + Header */}
      {onBack && (
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary mb-0 px-6 pt-3">
          <Icon name="arrow_back" size={18} /> 返回
        </button>
      )}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-text-muted">部门资产</span>
          <Icon name="chevron_right" size={16} className="text-text-muted" />
          <span className="font-semibold text-text-primary">{resolvedDeptName}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`在${resolvedDeptName}文件夹内搜索...`}
              className="pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-bg-white-var w-56 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button type="button" onClick={() => useToastStore.getState().addToast('文件上传功能开发中', 'info')} className="px-3 py-2 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90 flex items-center gap-1.5">
            <Icon name="upload" size={14} /> 上传文件
          </button>
          <button type="button" onClick={() => setSubView('knowledge:doc-editor')} className="px-3 py-2 text-xs font-medium text-text-secondary border border-border rounded-lg hover:bg-bg-hover flex items-center gap-1.5">
            <Icon name="note_add" size={14} /> 新建文档
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left border-b border-border">
              <th className="px-6 py-2.5 w-10">
                <input type="checkbox" checked={selected.size === filteredFiles.length && filteredFiles.length > 0} onChange={toggleAll} className="rounded" />
              </th>
              <th className="px-3 py-2.5 text-xs font-medium text-text-muted">文件名</th>
              <th className="px-3 py-2.5 text-xs font-medium text-text-muted">作者</th>
              <th className="px-3 py-2.5 text-xs font-medium text-text-muted">修改时间</th>
              <th className="px-3 py-2.5 text-xs font-medium text-text-muted">大小</th>
              <th className="px-3 py-2.5 text-xs font-medium text-text-muted text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredFiles.map((file) => {
              const fi = TYPE_ICON[file.type] || TYPE_ICON.doc;
              const isSelected = selected.has(file.id);
              return (
                <tr
                  key={file.id}
                  className={`border-b border-border/30 transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-bg-hover/30'}`}
                >
                  <td className="px-6 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(file.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        useKnowledgeStore.getState().selectDocument(file.id);
                        setSubView('knowledge:doc-read');
                      }}
                      className="flex items-center gap-2.5 hover:text-primary transition-colors"
                    >
                      <Icon name={fi.icon} size={20} style={{ color: fi.color }} />
                      <span className="text-sm text-text-primary font-medium hover:text-primary">{file.title}</span>
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-xs text-text-secondary">{file.author.name}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-xs text-text-muted">{new Date(file.updatedAt).toLocaleDateString('zh-CN')}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-xs text-text-muted">{file.size}</span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button type="button" onClick={(e) => { e.stopPropagation(); useToastStore.getState().addToast('文件操作菜单开发中', 'info'); }} className="p-1 text-text-muted hover:text-text-secondary">
                      <Icon name="more_horiz" size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Batch action floating bar */}
      {selected.size > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-bg-white-var rounded-2xl shadow-lg border border-border px-6 py-3 flex items-center gap-6 dcf-fade-in">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
              {selected.size}
            </span>
            <span className="text-sm text-text-secondary">
              已选择 {selected.size} 项
            </span>
          </div>
          <div className="w-px h-8 bg-border" />
          <button
            type="button"
            onClick={() => { if (onMoveFiles) { onMoveFiles(Array.from(selected)); } else { setShowMoveModal(true); } }}
            className="flex flex-col items-center gap-0.5 text-text-secondary hover:text-primary transition-colors"
          >
            <Icon name="drive_file_move" size={18} />
            <span className="text-[10px]">移动</span>
          </button>
          <button type="button" onClick={() => useToastStore.getState().addToast(`已下载 ${selected.size} 个文件`, 'success')} className="flex flex-col items-center gap-0.5 text-text-secondary hover:text-primary transition-colors">
            <Icon name="download" size={18} />
            <span className="text-[10px]">下载</span>
          </button>
          <button type="button" onClick={() => {
            selected.forEach((id) => deleteDocument(id));
            setSelected(new Set());
          }} className="flex flex-col items-center gap-0.5 text-text-secondary hover:text-error transition-colors">
            <Icon name="delete" size={18} />
            <span className="text-[10px] text-error">删除</span>
          </button>
          <div className="w-px h-8 bg-border" />
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs text-text-muted hover:text-text-primary"
          >
            取消选择
          </button>
        </div>
      )}
      <MoveFilesModal open={showMoveModal} onClose={() => setShowMoveModal(false)} fileCount={selected.size} onConfirm={() => { setShowMoveModal(false); setSelected(new Set()); }} />
    </div>
  );
}
