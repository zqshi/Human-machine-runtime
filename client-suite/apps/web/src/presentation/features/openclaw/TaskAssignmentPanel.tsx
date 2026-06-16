/**
 * TaskAssignmentPanel — 任务分配面板
 *
 * 展示 AI 建议的分配方案，支持更换分配人选。
 */
import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import type { TaskAssignment } from '../../../domain/agent/IOpenClawDataSource';
import type { OrgMember } from '../../../domain/agent/Organization';

interface SuggestedTask {
  id: string;
  name: string;
  agentId: string;
  [key: string]: unknown;
}

interface Props {
  tasks: SuggestedTask[];
  assignments: TaskAssignment[];
  members?: OrgMember[];
  onAssignmentsChange: (assignments: TaskAssignment[]) => void;
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 90 ? 'text-green-400' : pct >= 70 ? 'text-yellow-400' : 'text-orange-400';
  return <span className={`text-[9px] ${color}`}>{pct}%</span>;
}

export function TaskAssignmentPanel({
  tasks,
  assignments,
  members = [],
  onAssignmentsChange,
}: Props) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const getAssignment = (taskId: string) => assignments.find((a) => a.taskId === taskId);

  const handleChangeAssignee = (taskId: string, member: OrgMember) => {
    const existing = assignments.find((a) => a.taskId === taskId);
    const updated: TaskAssignment = {
      taskId,
      assigneeId: member.id,
      assigneeType: member.type,
      assigneeName: member.name,
      reason: existing?.reason ?? '手动分配',
      confidence: 1.0,
    };
    onAssignmentsChange(
      assignments
        .map((a) => (a.taskId === taskId ? updated : a))
        .concat(assignments.some((a) => a.taskId === taskId) ? [] : [updated])
    );
    setExpandedTaskId(null);
    setSearchTerm('');
  };

  const filteredMembers = searchTerm.trim()
    ? members.filter(
        (m: OrgMember) =>
          m.name.includes(searchTerm) ||
          m.role.includes(searchTerm) ||
          m.skills.some((s: string) => s.includes(searchTerm))
      )
    : members;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon name="group" size={14} className="text-purple-400" />
        <span className="text-[11px] font-medium text-slate-300">任务分配</span>
        <span className="text-[9px] text-slate-600">
          {assignments.length}/{tasks.length} 已分配
        </span>
      </div>

      <div className="space-y-2">
        {tasks.map((task) => {
          const assignment = getAssignment(task.id);
          const isExpanded = expandedTaskId === task.id;

          return (
            <div
              key={task.id}
              className="rounded-lg border border-white/[0.08] bg-white/[0.02] overflow-hidden"
            >
              {/* Task row */}
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="text-[11px] text-slate-300 flex-1 truncate">{task.name}</span>
                {assignment ? (
                  <button
                    type="button"
                    onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] hover:border-primary/30 transition-colors"
                  >
                    <Icon
                      name={assignment.assigneeType === 'agent' ? 'smart_toy' : 'person'}
                      size={11}
                      className={
                        assignment.assigneeType === 'agent' ? 'text-primary' : 'text-slate-400'
                      }
                    />
                    <span className="text-[10px] text-slate-200">{assignment.assigneeName}</span>
                    <ConfidenceBadge value={assignment.confidence} />
                    <Icon name="swap_horiz" size={10} className="text-slate-500" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md border border-dashed border-white/20 text-[10px] text-slate-500 hover:border-primary/40 hover:text-primary"
                  >
                    <Icon name="person_add" size={11} />
                    分配
                  </button>
                )}
              </div>

              {/* Reason */}
              {assignment && !isExpanded && assignment.reason && (
                <div className="px-3 pb-2">
                  <span className="text-[9px] text-slate-500 italic">{assignment.reason}</span>
                </div>
              )}

              {/* Expanded: member picker */}
              {isExpanded && (
                <div className="border-t border-white/[0.06] px-3 py-2 space-y-2">
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="搜索成员/技能..."
                    autoFocus
                    className="w-full h-7 rounded-md border border-white/10 bg-white/[0.04] px-2.5 text-[10px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary/50"
                  />
                  <div className="max-h-36 overflow-y-auto dcf-scrollbar space-y-0.5">
                    {filteredMembers.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => handleChangeAssignee(task.id, member)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-white/[0.06] transition-colors ${
                          assignment?.assigneeId === member.id
                            ? 'bg-primary/10 border border-primary/20'
                            : ''
                        }`}
                      >
                        <Icon
                          name={member.type === 'agent' ? 'smart_toy' : 'person'}
                          size={12}
                          className={member.type === 'agent' ? 'text-primary' : 'text-slate-400'}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] text-slate-200 block truncate">
                            {member.name}
                          </span>
                          <span className="text-[9px] text-slate-500 block truncate">
                            {member.department} · {member.role}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-0.5 max-w-[100px]">
                          {member.skills.slice(0, 2).map((s) => (
                            <span
                              key={s}
                              className="text-[8px] px-1 py-0.5 rounded bg-white/[0.04] text-slate-500"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Expert suggestion */}
      <div className="rounded-lg border border-dashed border-yellow-400/30 bg-yellow-400/[0.03] px-3 py-2">
        <div className="flex items-center gap-1.5 mb-1">
          <Icon name="lightbulb" size={12} className="text-yellow-400" />
          <span className="text-[10px] font-medium text-yellow-300">建议引入专家</span>
        </div>
        <p className="text-[9px] text-slate-400 leading-relaxed">
          可邀请外部专家参与特定子任务。在上方选择器中搜索技能关键词即可查看可用人选。
        </p>
      </div>
    </div>
  );
}
