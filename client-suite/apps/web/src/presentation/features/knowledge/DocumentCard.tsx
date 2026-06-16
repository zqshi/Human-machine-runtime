import { useState, useRef, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useKnowledgeStore } from '../../../application/stores/knowledgeStore';
import { useUIStore } from '../../../application/stores/uiStore';
import type { Document, DocumentType } from '../../../domain/knowledge/Document';

const TYPE_META: Record<DocumentType, { icon: string; color: string; bg: string }> = {
  doc: { icon: 'description', color: '#007AFF', bg: '#F0F4FF' },
  sheet: { icon: 'table_chart', color: '#34C759', bg: '#F0FFF4' },
  slide: { icon: 'slideshow', color: '#FF9500', bg: '#FFF8F0' },
  markdown: { icon: 'code', color: '#AF52DE', bg: '#F8F0FF' },
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}天前`;
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const CARD_ACTIONS = [
  { key: 'knowledge:version-history', label: '版本历史', icon: 'history' },
  { key: 'knowledge:doc-security', label: '安全设置', icon: 'security' },
  { key: 'knowledge:doc-settings', label: '文档设置', icon: 'settings' },
] as const;

export function DocumentCard({ document: doc, badge }: { document: Document; badge?: string }) {
  const { selectDocument, toggleStar } = useKnowledgeStore();
  const setSubView = useUIStore((s) => s.setSubView);
  const meta = TYPE_META[doc.type];
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleClick = () => {
    selectDocument(doc.id);
    if (doc.type === 'sheet') {
      setSubView('knowledge:spreadsheet');
    } else {
      setSubView('knowledge:doc-read');
    }
  };

  const handleAction = (key: string) => {
    selectDocument(doc.id);
    setSubView(key);
    setMenuOpen(false);
  };

  return (
    <div
      onClick={handleClick}
      className="relative bg-bg-white-var border border-border rounded-xl hover:shadow-md transition-all cursor-pointer overflow-hidden"
    >
      {/* Preview area with doc type icon */}
      <div
        className="h-28 flex items-center justify-center relative"
        style={{ backgroundColor: meta.bg }}
      >
        <Icon name={meta.icon} size={36} style={{ color: meta.color }} className="opacity-60" />
        {/* Team/individual badge */}
        <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-bg-white-var/80 text-[10px] text-text-muted font-medium backdrop-blur-sm">
          <Icon name="groups" size={12} className="text-text-muted" />
          {badge ?? '团队'}
        </span>
        {/* Star button */}
        <button
          onClick={(e) => { e.stopPropagation(); toggleStar(doc.id); }}
          className="absolute top-2.5 left-2.5 p-0.5 rounded hover:bg-bg-white-var/50 transition-colors"
        >
          <Icon
            name="star"
            size={16}
            filled={doc.starred}
            className={doc.starred ? 'text-yellow-400' : 'text-white/60'}
          />
        </button>
      </div>

      {/* Info */}
      <div className="p-3 flex items-start justify-between gap-1">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text-primary truncate">{doc.title}</h3>
          <p className="text-[11px] text-text-muted mt-1">
            {formatRelative(doc.updatedAt)} · {doc.author.name}
          </p>
        </div>
        {/* Actions menu trigger */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            className="p-1 rounded-md text-text-muted hover:bg-bg-hover hover:text-text-secondary transition-colors"
          >
            <Icon name="more_vert" size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-36 bg-bg-white-var border border-border rounded-xl shadow-lg z-50 py-1">
              {CARD_ACTIONS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleAction(a.key); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-bg-hover transition-colors"
                >
                  <Icon name={a.icon} size={14} className="text-text-secondary" />
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
