import { Icon } from '../../components/ui/Icon';
import { useKnowledgeStore } from '../../../application/stores/knowledgeStore';
import { useToastStore } from '../../../application/stores/toastStore';
import type { Document, DocumentType } from '../../../domain/knowledge/Document';

const TYPE_META: Record<DocumentType, { icon: string; color: string }> = {
  doc: { icon: 'description', color: '#007AFF' },
  sheet: { icon: 'table_chart', color: '#34C759' },
  slide: { icon: 'slideshow', color: '#FF9500' },
  markdown: { icon: 'code', color: '#AF52DE' },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 1) return '刚刚';
  if (diffH < 24) return `${diffH}小时前`;
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/** Already formatted as string in Document entity */

export function FileManager({ documents }: { documents: Document[] }) {
  const { selectedDocumentId, selectDocument, selectedDocIds, toggleDocSelection, selectAllDocs, clearDocSelection } = useKnowledgeStore();

  const allSelected = documents.length > 0 && documents.every((d) => selectedDocIds.has(d.id));
  const someSelected = selectedDocIds.size > 0;

  const handleSelectAll = () => {
    if (allSelected) clearDocSelection();
    else selectAllDocs(documents.map((d) => d.id));
  };

  return (
    <div className="relative">
      <div className="border border-border rounded-xl overflow-hidden bg-bg-white-var">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-left text-text-muted bg-fill-tertiary/50">
              <th className="py-2.5 px-3 w-10">
                <CheckCircle checked={allSelected} indeterminate={someSelected && !allSelected} onChange={handleSelectAll} />
              </th>
              <th className="py-2.5 px-3 font-medium">文件名</th>
              <th className="py-2.5 px-3 font-medium w-28">修改人</th>
              <th className="py-2.5 px-3 font-medium w-28">修改时间</th>
              <th className="py-2.5 px-3 font-medium w-20">大小</th>
              <th className="py-2.5 px-3 font-medium w-12 text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => {
              const meta = TYPE_META[doc.type];
              const isChecked = selectedDocIds.has(doc.id);
              const isActive = selectedDocumentId === doc.id;

              return (
                <tr
                  key={doc.id}
                  onClick={() => selectDocument(doc.id)}
                  className={`border-b border-border/50 last:border-b-0 cursor-pointer transition-colors ${
                    isChecked ? 'bg-primary/5' : isActive ? 'bg-primary/5' : 'hover:bg-bg-hover'
                  }`}
                >
                  <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                    <CheckCircle checked={isChecked} onChange={() => toggleDocSelection(doc.id)} />
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: meta.color + '14' }}
                      >
                        <Icon name={meta.icon} size={18} style={{ color: meta.color }} />
                      </div>
                      <span className="text-text-primary font-medium truncate">{doc.title}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-text-secondary">{doc.author.name}</td>
                  <td className="py-3 px-3 text-text-secondary tabular-nums">{formatDate(doc.updatedAt)}</td>
                  <td className="py-3 px-3 text-text-secondary tabular-nums">{doc.size}</td>
                  <td className="py-3 px-3 text-center">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); useToastStore.getState().addToast('文件操作菜单开发中', 'info'); }}
                      className="p-1 rounded-md text-text-muted hover:bg-bg-hover hover:text-text-secondary transition-colors"
                    >
                      <Icon name="more_horiz" size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Batch operations toolbar */}
      {someSelected && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-bg-white-var border border-border rounded-2xl shadow-lg px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
              {selectedDocIds.size}
            </span>
            <span className="text-sm text-text-primary font-medium">已选择 {selectedDocIds.size} 项</span>
          </div>
          <div className="w-px h-6 bg-border" />
          <BatchButton icon="drive_file_move" label="移动" onClick={() => useToastStore.getState().addToast('文件移动功能开发中', 'info')} />
          <BatchButton icon="download" label="下载" onClick={() => useToastStore.getState().addToast(`已下载 ${selectedDocIds.size} 个文件`, 'success')} />
          <BatchButton icon="delete" label="删除" danger onClick={() => { useToastStore.getState().addToast(`已删除 ${selectedDocIds.size} 个文件`, 'success'); clearDocSelection(); }} />
          <div className="w-px h-6 bg-border" />
          <button
            type="button"
            onClick={clearDocSelection}
            className="text-xs text-text-secondary hover:text-text-primary transition-colors font-medium"
          >
            取消选择
          </button>
        </div>
      )}
    </div>
  );
}

function BatchButton({ icon, label, danger, onClick }: { icon: string; label: string; danger?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg hover:bg-bg-hover transition-colors ${
        danger ? 'text-error hover:bg-error/5' : 'text-text-secondary'
      }`}
    >
      <Icon name={icon} size={20} />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

function CheckCircle({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
        checked
          ? 'bg-primary border-primary text-white'
          : indeterminate
            ? 'border-primary bg-primary/20'
            : 'border-border hover:border-primary/50'
      }`}
    >
      {checked && <Icon name="check" size={14} />}
      {indeterminate && !checked && <span className="w-2 h-0.5 bg-primary rounded-full" />}
    </button>
  );
}
