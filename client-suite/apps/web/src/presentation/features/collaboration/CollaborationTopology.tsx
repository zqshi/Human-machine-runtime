/**
 * CollaborationTopology — AI-AI 协作网络拓扑图
 *
 * 展示当前活跃的 CollaborationSession 和 Agent 间的意图连接。
 */
import { useState, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useCollaborationStore } from '../../../application/stores/collaborationStore';

interface SessionNode {
  id: string;
  purpose: string;
  status: 'forming' | 'active' | 'escalated' | 'completed';
  participants: { id: string; type: 'agent' | 'human'; role: string }[];
  createdAt: number;
}

const STATUS_META: Record<string, { color: string; label: string; dot: string }> = {
  forming: { color: 'text-slate-400', label: '组建中', dot: 'bg-slate-400' },
  active: { color: 'text-green-400', label: '协作中', dot: 'bg-green-400 animate-pulse' },
  escalated: { color: 'text-orange-400', label: '已升维', dot: 'bg-orange-400' },
  completed: { color: 'text-blue-400', label: '已完成', dot: 'bg-blue-400' },
};

export function CollaborationTopology() {
  const { sessions: rawSessions, fetchSessions, subscribeSSE } = useCollaborationStore();
  const [now] = useState(Date.now);

  useEffect(() => {
    fetchSessions();
    subscribeSSE();
  }, [fetchSessions, subscribeSSE]);

  const sessions: SessionNode[] = rawSessions.map((s) => ({
    id: s.id,
    purpose: s.purpose,
    status: s.status as SessionNode['status'],
    participants: s.participants.map((p) => ({ id: p.id, type: p.type, role: 'collaborator' })),
    createdAt: s.createdAt,
  }));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 shrink-0 flex items-center gap-2">
        <Icon name="share" size={18} className="text-primary/80" />
        <span className="text-sm font-semibold text-slate-200">协作拓扑</span>
        <span className="text-[10px] text-slate-500">{sessions.length} 活跃会话</span>
      </div>

      <div className="flex-1 overflow-y-auto hmr-scrollbar p-4 space-y-3">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <Icon name="group_off" size={32} className="text-slate-600 mb-2" />
            <p className="text-[11px]">暂无活跃协作会话</p>
          </div>
        ) : (
          sessions.map((session) => {
            const status = STATUS_META[session.status];
            const agents = session.participants.filter((p) => p.type === 'agent');
            const humans = session.participants.filter((p) => p.type === 'human');

            return (
              <div
                key={session.id}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full ${status.dot}`} />
                  <span className="text-xs font-medium text-slate-200 flex-1 truncate">
                    {session.purpose}
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded ${status.color} bg-white/[0.04]`}
                  >
                    {status.label}
                  </span>
                </div>

                {/* Participants */}
                <div className="flex items-center gap-2 flex-wrap">
                  {agents.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 border border-primary/20"
                    >
                      <Icon name="smart_toy" size={10} className="text-primary/70" />
                      <span className="text-[10px] text-primary/80">
                        {p.id.replace('agent-', '')}
                      </span>
                      {p.role === 'initiator' && (
                        <Icon name="star" size={8} className="text-yellow-400" />
                      )}
                    </div>
                  ))}
                  {humans.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-orange-400/10 border border-orange-400/20"
                    >
                      <Icon name="person" size={10} className="text-orange-400/70" />
                      <span className="text-[10px] text-orange-400/80">
                        {p.id.replace('user-', '')}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-500">
                  <span>{Math.round((now - session.createdAt) / 60_000)}m 前创建</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
