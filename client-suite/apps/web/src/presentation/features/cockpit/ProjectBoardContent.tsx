/**
 * ProjectBoardContent — D 栏项目看板面板
 * 四列看板 + Agent 任务编排 + 点击查看执行过程和思考链
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useCockpitStore } from '../../../application/stores/cockpitStore';
import { useAgentStore } from '../../../application/stores/agentStore';
import { Icon } from '../../components/ui/Icon';
import type { ProjectBoardCard } from '../../../domain/agent/ProjectBoard';

interface ContentProps {
  data: Record<string, unknown>;
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  critical: { label: '紧急', color: '#FF3B30' },
  high: { label: '高', color: '#FF9500' },
  normal: { label: '中', color: '#007AFF' },
  low: { label: '低', color: '#64748b' },
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function ProjectBoardContent({ data }: ContentProps) {
  const boardId = data.boardId as string;
  const board = useCockpitStore((s) => s.boards.find((b) => b.id === boardId));
  const setDrawerWidth = useCockpitStore((s) => s.setDrawerWidth);
  const sharedAgents = useAgentStore((s) => s.sharedAgents);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');

  // Widen drawer on mount, restore on unmount
  useEffect(() => {
    setDrawerWidth(560);
    return () => setDrawerWidth(360);
  }, [setDrawerWidth]);

  const selectedCard = useMemo(() => {
    if (!board || !selectedCardId) return null;
    return board.getCardById(selectedCardId) ?? null;
  }, [board, selectedCardId]);

  const handleAddCard = useCallback(() => {
    if (!newCardTitle.trim() || !board) return;
    const updateBoard = useCockpitStore.getState().updateBoard;
    const now = Date.now();
    updateBoard(board.id, (b) => b.addCard({
      id: `${board.id}-c${Date.now()}`,
      title: newCardTitle.trim(),
      description: '',
      columnId: 'col-backlog',
      assignedAgentId: null,
      assignedAgentName: null,
      priority: 'normal',
      tags: [],
      executionLogs: [],
      reasoningSteps: [],
      status: 'idle',
      createdAt: now,
      updatedAt: now,
    }));
    setNewCardTitle('');
    setShowAddForm(false);
  }, [newCardTitle, board]);

  if (!board) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        <Icon name="error_outline" size={20} className="mr-2" />看板未找到
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <BoardHeader board={board} sharedAgents={sharedAgents} />

      {/* Board + optional detail panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Kanban columns */}
        <div className={`flex-1 overflow-x-auto hmr-scrollbar flex gap-2 px-3 py-3 ${selectedCard ? 'max-w-[55%]' : ''}`}>
          {board.columns.map((col) => {
            const colCards = board.getCardsByColumn(col.id);
            return (
              <div key={col.id} className="w-36 shrink-0 flex flex-col">
                {/* Column header */}
                <div className="flex items-center gap-1.5 mb-2 px-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                  <span className="text-[10px] font-semibold text-slate-300">{col.name}</span>
                  <span className="text-[9px] text-slate-500 ml-auto bg-white/[0.04] px-1.5 py-0.5 rounded-full">
                    {colCards.length}
                  </span>
                </div>
                {/* Cards */}
                <div className="flex-1 overflow-y-auto hmr-scrollbar space-y-2">
                  {colCards.map((card) => (
                    <KanbanCard
                      key={card.id}
                      card={card}
                      isSelected={card.id === selectedCardId}
                      onSelectAgent={() => setSelectedCardId(card.id === selectedCardId ? null : card.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Agent detail side panel */}
        {selectedCard && (
          <AgentDetailPanel card={selectedCard} onClose={() => setSelectedCardId(null)} />
        )}
      </div>

      {/* Footer: add card */}
      <div className="border-t border-white/[0.06] px-3 py-2">
        {showAddForm ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              onKeyDown={(e) => { if (e.nativeEvent.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') handleAddCard(); }}
              placeholder="输入卡片标题..."
              className="flex-1 text-xs bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 text-slate-200 placeholder:text-slate-600 outline-none focus:border-primary/40"
              autoFocus
            />
            <button
              type="button"
              onClick={handleAddCard}
              className="text-[10px] px-2.5 py-1.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
            >
              添加
            </button>
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setNewCardTitle(''); }}
              className="text-[10px] px-2 py-1.5 text-slate-500 hover:text-slate-300 transition-colors"
            >
              取消
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-primary transition-colors"
          >
            <Icon name="add" size={14} />新建卡片
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Board Header ─── */

interface BoardHeaderProps {
  board: { name: string; description: string; cards: ProjectBoardCard[]; agentIds: string[]; activeAgentCount: number };
  sharedAgents: Array<{ id: string; name: string; avatarGradient?: string }>;
}

const AGENT_COLORS = ['#007AFF', '#FF9500', '#34C759', '#AF52DE', '#FF3B30', '#00C7BE'];

function BoardHeader({ board, sharedAgents }: BoardHeaderProps) {
  const activeCount = board.cards.filter((c) => c.status === 'working').length;
  const doneCount = board.cards.filter((c) => c.columnId === 'col-done').length;

  return (
    <div className="px-4 py-3 border-b border-white/[0.06]">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-xs font-semibold text-slate-200">{board.name}</span>
          <p className="text-[10px] text-slate-500 mt-0.5">{board.description}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-slate-500">{board.cards.length} 卡片</span>
          <span className="text-[9px] text-emerald-400">{doneCount} 完成</span>
        </div>
      </div>

      {/* Agent avatars */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] text-slate-500">协作 Agent:</span>
        <div className="flex items-center -space-x-1">
          {board.agentIds.map((agentId, i) => {
            const agent = sharedAgents.find((a) => a.id === agentId);
            return (
              <div
                key={agentId}
                className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] text-white font-bold border border-[#1a1a2e] shrink-0"
                style={{ background: AGENT_COLORS[i % AGENT_COLORS.length] }}
                title={agent?.name ?? agentId}
              >
                {(agent?.name ?? agentId).charAt(0)}
              </div>
            );
          })}
        </div>
        {activeCount > 0 && (
          <span className="text-[9px] text-primary animate-pulse">{activeCount} 个任务执行中</span>
        )}
      </div>
    </div>
  );
}

/* ─── Kanban Card ─── */

interface KanbanCardProps {
  card: ProjectBoardCard;
  isSelected: boolean;
  onSelectAgent: () => void;
}

function KanbanCard({ card, isSelected, onSelectAgent }: KanbanCardProps) {
  const pri = PRIORITY_CONFIG[card.priority] ?? PRIORITY_CONFIG.normal;

  return (
    <div
      className={`p-2.5 rounded-xl border transition-all cursor-default ${
        isSelected
          ? 'border-primary/40 bg-primary/[0.06]'
          : card.status === 'working'
            ? 'border-primary/20 bg-white/[0.03] animate-[pulse_3s_ease-in-out_infinite]'
            : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'
      }`}
    >
      <div className="flex items-start justify-between mb-1.5">
        <span className="text-[10px] font-semibold text-slate-200 leading-tight flex-1 mr-1">{card.title}</span>
        <span
          className="text-[8px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
          style={{ color: pri.color, backgroundColor: `${pri.color}15` }}
        >
          {pri.label}
        </span>
      </div>

      {/* Tags */}
      {card.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {card.tags.map((tag) => (
            <span key={tag} className="text-[8px] text-slate-500 bg-white/[0.04] px-1.5 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Assigned agent */}
      {card.assignedAgentId && (
        <button
          type="button"
          onClick={onSelectAgent}
          className="flex items-center gap-1.5 mt-1 group"
        >
          <div
            className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] text-white font-bold"
            style={{ background: card.status === 'working' ? '#007AFF' : '#34C759' }}
          >
            {(card.assignedAgentName ?? '').charAt(0)}
          </div>
          <span className="text-[9px] text-slate-400 group-hover:text-primary transition-colors">
            {card.assignedAgentName}
          </span>
          {card.status === 'working' && (
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          )}
          <Icon name="chevron_right" size={10} className="text-slate-600 group-hover:text-primary transition-colors" />
        </button>
      )}

      {/* Status: done check */}
      {card.status === 'done' && !card.assignedAgentId && (
        <div className="flex items-center gap-1 mt-1">
          <Icon name="check_circle" size={12} className="text-emerald-400" />
          <span className="text-[9px] text-emerald-400">已完成</span>
        </div>
      )}
    </div>
  );
}

/* ─── Agent Detail Side Panel ─── */

interface AgentDetailPanelProps {
  card: ProjectBoardCard;
  onClose: () => void;
}

function AgentDetailPanel({ card, onClose }: AgentDetailPanelProps) {
  return (
    <div className="w-[45%] shrink-0 border-l border-white/[0.06] flex flex-col overflow-hidden bg-white/[0.01]">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] text-white font-bold shrink-0"
            style={{ background: card.status === 'working' ? '#007AFF' : '#34C759' }}
          >
            {(card.assignedAgentName ?? '?').charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold text-slate-200 truncate">{card.assignedAgentName}</div>
            <div className="text-[9px] text-slate-500 truncate">{card.title}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-white/[0.06] transition-colors"
        >
          <Icon name="close" size={14} className="text-slate-500" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto hmr-scrollbar px-3 py-3 space-y-4">
        {/* Reasoning Steps */}
        {card.reasoningSteps.length > 0 && (
          <section>
            <div className="flex items-center gap-1.5 mb-2">
              <Icon name="psychology" size={14} className="text-primary" />
              <span className="text-[10px] font-semibold text-primary">推理过程</span>
              <span className="text-[9px] text-slate-500 ml-auto">{card.reasoningSteps.length} 步</span>
            </div>
            <div className="relative space-y-0">
              {card.reasoningSteps.map((step, idx) => {
                const isLast = idx === card.reasoningSteps.length - 1;
                return (
                  <div key={idx} className="relative">
                    {!isLast && (
                      <div className="absolute left-[7px] top-[16px] w-px h-[calc(100%+4px)] bg-white/10" />
                    )}
                    <div className="flex items-start gap-2.5 pb-3">
                      <Icon
                        name={idx === card.reasoningSteps.length - 1 && card.status === 'working' ? 'autorenew' : 'check_circle'}
                        size={14}
                        className={`relative z-10 shrink-0 mt-0.5 ${
                          idx === card.reasoningSteps.length - 1 && card.status === 'working'
                            ? 'text-primary animate-spin'
                            : 'text-green-400'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-medium text-slate-200">{step.label}</span>
                        <p className="text-[9px] text-slate-400 mt-0.5 leading-relaxed">{step.detail}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Execution Logs */}
        {card.executionLogs.length > 0 && (
          <section>
            <div className="flex items-center gap-1.5 mb-2">
              <Icon name="terminal" size={14} className="text-slate-400" />
              <span className="text-[10px] font-semibold text-slate-300">执行日志</span>
              <span className="text-[9px] text-slate-500 ml-auto">{card.executionLogs.length} 条</span>
            </div>
            <div className="space-y-1 bg-white/[0.02] rounded-lg p-2 border border-white/[0.04]">
              {card.executionLogs.map((log, i) => {
                const levelColor = log.level === 'ERROR' ? '#FF3B30' : log.level === 'WARN' ? '#FF9500' : '#64748b';
                return (
                  <div key={i} className="flex items-start gap-2 text-[9px]">
                    <span className="text-slate-600 shrink-0 font-mono">{formatTime(log.timestamp)}</span>
                    <span className="shrink-0 font-mono font-bold" style={{ color: levelColor }}>{log.level}</span>
                    <span className="text-slate-400">{log.message}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Empty state */}
        {card.reasoningSteps.length === 0 && card.executionLogs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-slate-600">
            <Icon name="hourglass_empty" size={32} className="mb-2" />
            <span className="text-[10px]">等待 Agent 开始执行...</span>
          </div>
        )}
      </div>
    </div>
  );
}
