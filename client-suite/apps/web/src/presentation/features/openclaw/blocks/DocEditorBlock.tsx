/**
 * DocEditorBlock — 对话中的文档生成卡片
 */
import { useOpenClawStore } from '../../../../application/stores/openclawStore';
import { Icon } from '../../../components/ui/Icon';
import type { OpenClawDrawerContent } from '../../../../domain/agent/DrawerContent';

interface Props {
  docId: string;
  docTitle: string;
  sectionsReady: number;
  totalSections: number;
  onOpen: (content: OpenClawDrawerContent) => void;
}

export function DocEditorBlockComponent({ docId, docTitle, sectionsReady: initReady, totalSections: initTotal, onOpen }: Props) {
  const doc = useOpenClawStore((s) => s.documents.find((d) => d.id === docId));
  const sections = doc?.sections ?? [];
  const doneCount = sections.filter((s) => s.status === 'done').length;
  const total = sections.length || initTotal;
  const ready = doneCount || initReady;
  const isComplete = ready >= total;
  const writingSection = sections.find((s) => s.status === 'writing');

  return (
    <button
      type="button"
      className="w-full text-left p-3 rounded-xl border border-white/10 bg-white/[0.03] cursor-pointer hover:bg-white/[0.06] transition-colors"
      onClick={() => onOpen({ type: 'doc-editor', title: doc?.title ?? docTitle, data: { docId } })}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-500/10">
          <Icon name="description" size={16} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-slate-200 truncate">{doc?.title ?? docTitle}</div>
          <div className="text-[10px] text-slate-500">
            {isComplete ? '文档已生成，可编辑' : writingSection ? `正在撰写: ${writingSection.title}` : '准备中...'}
          </div>
        </div>
        <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${isComplete ? 'text-emerald-400 bg-emerald-400/10' : 'text-amber-400 bg-amber-400/10'}`}>
          {isComplete ? '已完成' : `${ready}/${total}`}
        </span>
      </div>

      {/* Section progress bar */}
      <div className="flex gap-1 px-1 mb-1.5">
        {sections.map((s, i) => (
          <div
            key={i}
            className="flex-1 h-1 rounded-full transition-all"
            style={{
              backgroundColor: s.status === 'done' ? '#34C759' : s.status === 'writing' ? '#FF9500' : 'rgba(255,255,255,0.08)',
            }}
          />
        ))}
      </div>

      <div className="flex items-center justify-between px-1">
        <div className="flex gap-2">
          {sections.slice(0, 4).map((s, i) => (
            <span key={i} className="text-[9px]" style={{ color: s.status === 'done' ? '#34C759' : s.status === 'writing' ? '#FF9500' : '#475569' }}>
              {s.status === 'done' ? '✓' : s.status === 'writing' ? '✎' : '○'} {s.title}
            </span>
          ))}
          {sections.length > 4 && <span className="text-[9px] text-slate-500">+{sections.length - 4}</span>}
        </div>
        <span className="text-[10px] text-primary">打开文档 →</span>
      </div>
    </button>
  );
}
