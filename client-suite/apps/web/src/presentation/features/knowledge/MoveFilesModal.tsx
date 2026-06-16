/**
 * MoveFilesModal — 文件移动弹窗 (km_2 对齐)
 * 文件夹树选择器 + 路径预览 + 确认移动
 */
import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Icon } from '../../components/ui/Icon';

interface FolderNode {
  id: string;
  name: string;
  icon: string;
  children?: FolderNode[];
}

const FOLDER_TREE: FolderNode[] = [
  {
    id: 'f-enterprise',
    name: '企业知识库',
    icon: 'business',
    children: [
      { id: 'f-guides', name: '官方指南', icon: 'menu_book' },
      { id: 'f-templates', name: '模板中心', icon: 'description' },
    ],
  },
  {
    id: 'f-dept',
    name: '部门资产',
    icon: 'folder_shared',
    children: [
      { id: 'f-marketing', name: '市场部', icon: 'folder' },
      { id: 'f-finance', name: '财务部', icon: 'folder' },
      { id: 'f-tech', name: '技术中心', icon: 'folder' },
    ],
  },
  {
    id: 'f-personal',
    name: '个人空间',
    icon: 'person',
  },
];

interface MoveFilesModalProps {
  open: boolean;
  onClose: () => void;
  fileCount?: number;
  onConfirm?: (folderId: string) => void;
}

export function MoveFilesModal({ open, onClose, fileCount = 2, onConfirm }: MoveFilesModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const findPath = (nodes: FolderNode[], targetId: string, path: string[] = []): string[] | null => {
    for (const node of nodes) {
      const current = [...path, node.name];
      if (node.id === targetId) return current;
      if (node.children) {
        const result = findPath(node.children, targetId, current);
        if (result) return result;
      }
    }
    return null;
  };

  const selectedPath = selectedId ? findPath(FOLDER_TREE, selectedId) : null;

  const handleConfirm = () => {
    if (selectedId) {
      onConfirm?.(selectedId);
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`移动 ${fileCount} 个文件到...`} width="max-w-md">
      {/* Folder tree */}
      <div className="border border-border rounded-xl p-2 mb-4 max-h-64 overflow-y-auto">
        {FOLDER_TREE.map((node) => (
          <FolderItem
            key={node.id}
            node={node}
            selectedId={selectedId}
            onSelect={setSelectedId}
            depth={0}
          />
        ))}
      </div>

      {/* Path preview */}
      {selectedPath && (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/5 mb-4">
          <Icon name="subdirectory_arrow_right" size={14} className="text-primary" />
          <span className="text-xs text-text-secondary">
            将移动到：<span className="font-medium text-text-primary">{selectedPath.join(' > ')}</span>
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover rounded-lg transition-colors"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!selectedId}
          className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          确认移动
        </button>
      </div>
    </Modal>
  );
}

function FolderItem({
  node,
  selectedId,
  onSelect,
  depth,
}: {
  node: FolderNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const isSelected = selectedId === node.id;
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          onSelect(node.id);
          if (hasChildren) setExpanded(!expanded);
        }}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
          isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-bg-hover text-text-primary'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <Icon name={expanded ? 'expand_more' : 'chevron_right'} size={16} className="text-text-muted shrink-0" />
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <Icon name={node.icon} size={16} className={isSelected ? 'text-primary' : 'text-text-secondary'} />
        <span className="text-xs font-medium flex-1">{node.name}</span>
        {isSelected && <Icon name="check" size={16} className="text-primary" />}
      </button>
      {hasChildren && expanded && node.children!.map((child) => (
        <FolderItem
          key={child.id}
          node={child}
          selectedId={selectedId}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}
