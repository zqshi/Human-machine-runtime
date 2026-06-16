/**
 * ProjectBoardBlock — 对话中的项目看板卡片
 */
import { useOpenClawStore } from '../../../../application/stores/openclawStore';
import { Icon } from '../../../components/ui/Icon';
import type { OpenClawDrawerContent } from '../../../../domain/agent/DrawerContent';

interface Props {
  boardId: string;
  boardName: string;
  totalCards: number;
  activeAgents: number;
  onOpen: (content: OpenClawDrawerContent) => void;
}

const COL_COLORS = ['#64748b', '#007AFF', '#FF9500', '#34C759'];

export function ProjectBoardBlockComponent({ boardId, boardName, totalCards: initTotal, activeAgents: initAgents, onOpen }: Props) {
  const board = useOpenClawStore((s) => s.boards.find((b) => b.id === boardId));
  const total = board?.cards.length ?? initTotal;
  const active = board?.activeAgentCount ?? initAgents;
  const doneCount = board?.getCardsByColumn('col-done').length ?? 0;

  // Mini progress segments
  const colCounts = board
    ? board.columns.map((col) => board.getCardsByColumn(col.id).length)
    : [0, 0, 0, 0];
  const maxCount = Math.max(total, 1);

  return (
    <button
      type="button"
      className="w-full text-left p-3 rounded-xl border border-white/10 bg-white/[0.03] cursor-pointer hover:bg-white/[0.06] transition-colors"
      onClick={() => onOpen({ type: 'project-board', title: board?.name ?? boardName, data: { boardId } })}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-500/10">
          <Icon name="view_kanban" size={16} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-slate-200 truncate">{board?.name ?? boardName}</div>
          <div className="text-[10px] text-slate-500">
            {total} 个卡片 · {active} 个 Agent 协作中
          </div>
        </div>
        <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
          doneCount === total ? 'text-emerald-400 bg-emerald-400/10' : 'text-primary bg-primary/10'
        }`}>
          {doneCount === total ? '已完成' : `${doneCount}/${total}`}
        </span>
      </div>

      {/* Column progress bar */}
      <div className="flex gap-0.5 px-1 mb-1.5">
        {colCounts.map((count, i) => (
          <div
            key={i}
            className="h-1 rounded-full transition-all"
            style={{
              width: `${Math.max((count / maxCount) * 100, count > 0 ? 8 : 2)}%`,
              backgroundColor: count > 0 ? COL_COLORS[i] : 'rgba(255,255,255,0.06)',
            }}
          />
        ))}
      </div>

      <div className="flex items-center justify-between px-1">
        <div className="flex gap-3 text-[9px] text-slate-500">
          <span>待办 {colCounts[0]}</span>
          <span>进行中 {colCounts[1]}</span>
          <span>评审 {colCounts[2]}</span>
          <span className="text-emerald-500">完成 {colCounts[3]}</span>
        </div>
        <span className="text-[10px] text-primary">查看看板 →</span>
      </div>
    </button>
  );
}
