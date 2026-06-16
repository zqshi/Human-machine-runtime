import { Icon } from './Icon';

interface FileCardProps {
  fileName: string;
  fileSize: string;
  status?: 'uploading' | 'complete' | 'error';
  editStatus?: 'edited' | 'synced' | 'syncing';
  editMeta?: string;
  onDownload?: () => void;
  onOpenEditor?: () => void;
}

const FILE_ICONS: Record<string, string> = {
  pdf: 'picture_as_pdf',
  doc: 'description',
  docx: 'description',
  xls: 'table_chart',
  xlsx: 'table_chart',
  ppt: 'slideshow',
  pptx: 'slideshow',
  zip: 'folder_zip',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
};

function getFileIcon(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return FILE_ICONS[ext] ?? 'insert_drive_file';
}

const EDIT_STATUS_META = {
  edited: { label: '已编辑', color: '#34C759' },
  synced: { label: '已同步', color: '#34C759' },
  syncing: { label: '同步中...', color: '#FF9500' },
};

export function FileCard({ fileName, fileSize, status = 'complete', editStatus, editMeta, onDownload, onOpenEditor }: FileCardProps) {
  return (
    <div className="bg-bg-white-var/80 border border-border rounded-xl max-w-[300px] overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon name={getFileIcon(fileName)} size={22} className="text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-medium text-text-primary truncate">{fileName}</p>
            {editStatus && (
              <span
                className="shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded"
                style={{
                  color: EDIT_STATUS_META[editStatus].color,
                  backgroundColor: EDIT_STATUS_META[editStatus].color + '14',
                }}
              >
                {EDIT_STATUS_META[editStatus].label}
              </span>
            )}
          </div>
          <p className="text-[10px] text-text-muted">
            {fileSize}
            {status === 'uploading' && ' · 上传中...'}
            {status === 'error' && ' · 上传失败'}
            {editMeta && ` · ${editMeta}`}
          </p>
        </div>
        {status === 'complete' && onDownload && (
          <button type="button" onClick={onDownload} className="text-text-muted hover:text-primary transition-colors shrink-0">
            <Icon name="download" size={18} />
          </button>
        )}
      </div>
      {onOpenEditor && (
        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={onOpenEditor}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Icon name="edit" size={14} />
            打开编辑器
          </button>
        </div>
      )}
    </div>
  );
}
