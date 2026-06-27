/**
 * GoalDecomposePanel — 目标分解结果展示 + 编辑
 *
 * 展示 AI 建议的子任务和里程碑，支持编辑、删除、添加。
 */
import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';

interface SuggestedTask {
  id: string;
  name: string;
  agentId: string;
  [key: string]: unknown;
}

interface SuggestedMilestone {
  id: string;
  name: string;
  [key: string]: unknown;
}

interface Props {
  category?: string;
  tasks: SuggestedTask[];
  milestones: SuggestedMilestone[];
  onTasksChange: (tasks: SuggestedTask[]) => void;
  onMilestonesChange: (milestones: SuggestedMilestone[]) => void;
}

const AGENT_LABELS: Record<string, { name: string; color: string }> = {
  'dev-assistant': { name: '开发', color: 'text-blue-400' },
  'ops-assistant': { name: '运维', color: 'text-green-400' },
  'security-agent': { name: '安全', color: 'text-purple-400' },
  'data-analyst': { name: '数据', color: 'text-orange-400' },
};

export function GoalDecomposePanel({
  category,
  tasks,
  milestones,
  onTasksChange,
  onMilestonesChange,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newTaskName, setNewTaskName] = useState('');

  const handleEditStart = (task: SuggestedTask) => {
    setEditingId(task.id);
    setEditValue(task.name);
  };

  const handleEditSave = (taskId: string) => {
    if (editValue.trim()) {
      onTasksChange(tasks.map((t) => (t.id === taskId ? { ...t, name: editValue.trim() } : t)));
    }
    setEditingId(null);
    setEditValue('');
  };

  const handleDelete = (taskId: string) => {
    onTasksChange(tasks.filter((t) => t.id !== taskId));
    onMilestonesChange(milestones.filter((m) => m.id !== taskId.replace('task-', 'ms-')));
  };

  const handleAddTask = () => {
    if (!newTaskName.trim()) return;
    const now = Date.now();
    const id = `task-${now}-${Math.random().toString(36).slice(2, 5)}`;
    onTasksChange([...tasks, { id, name: newTaskName.trim(), agentId: 'dev-assistant' }]);
    onMilestonesChange([
      ...milestones,
      { id: id.replace('task-', 'ms-'), name: newTaskName.trim() },
    ]);
    setNewTaskName('');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon name="account_tree" size={14} className="text-primary" />
        <span className="text-[11px] font-medium text-slate-300">分解建议</span>
        {category && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
            {category}
          </span>
        )}
        <span className="text-[9px] text-slate-600">{tasks.length} 个子任务</span>
      </div>

      {/* Task list */}
      <div className="space-y-1.5">
        {tasks.map((task, idx) => {
          const agent = AGENT_LABELS[task.agentId];
          return (
            <div
              key={task.id}
              className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 group"
            >
              <span className="text-[10px] text-slate-600 w-4 shrink-0">{idx + 1}</span>
              {editingId === task.id ? (
                <input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                    if (e.key === 'Enter') handleEditSave(task.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onBlur={() => handleEditSave(task.id)}
                  autoFocus
                  className="flex-1 h-6 bg-white/[0.06] border border-primary/30 rounded px-2 text-[11px] text-slate-200 focus:outline-none"
                />
              ) : (
                <span className="text-[11px] text-slate-200 flex-1 truncate">{task.name}</span>
              )}
              {agent && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] ${agent.color}`}>
                  {agent.name}
                </span>
              )}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => handleEditStart(task)}
                  className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]"
                >
                  <Icon name="edit" size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(task.id)}
                  className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-white/[0.06]"
                >
                  <Icon name="close" size={11} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add task */}
      <div className="flex gap-2">
        <input
          value={newTaskName}
          onChange={(e) => setNewTaskName(e.target.value)}
          onKeyDown={(e) => { if (e.nativeEvent.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') handleAddTask(); }}
          placeholder="添加子任务..."
          className="flex-1 h-8 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary/50"
        />
        <button
          type="button"
          onClick={handleAddTask}
          disabled={!newTaskName.trim()}
          className="h-8 px-3 rounded-lg bg-primary/15 text-[10px] text-primary hover:bg-primary/25 disabled:opacity-40"
        >
          添加
        </button>
      </div>

      {/* Milestones */}
      {milestones.length > 0 && (
        <div className="pt-2 border-t border-white/[0.06]">
          <div className="flex items-center gap-1.5 mb-2">
            <Icon name="flag" size={12} className="text-green-400/70" />
            <span className="text-[10px] text-slate-500">里程碑 ({milestones.length})</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {milestones.map((m) => (
              <span
                key={m.id}
                className="text-[9px] px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.08] text-slate-400"
              >
                {m.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
