import { useState, useEffect, useCallback } from 'react';
import { scheduledTaskApi, type ScheduledTask } from '../../../../application/services/adminApi';
import { Icon } from '../../../components/ui/Icon';
import { StatCard } from '../../../components/ui/StatCard';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ScheduledTaskEditor } from './ScheduledTaskEditor';
import { ScheduledTaskRunsDrawer } from './ScheduledTaskRunsDrawer';
import { ScheduledTaskDetail } from './ScheduledTaskDetail';

const LAST_STATUS_LABEL: Record<string, string> = {
  completed: '成功',
  failed: '失败',
  timeout: '超时',
  running: '执行中',
};

function relativeTime(fromIso: string | null, now: number): string {
  if (!fromIso) return '未调度';
  const diff = new Date(fromIso).getTime() - now;
  if (diff <= 0) return '已到期';
  const min = Math.floor(diff / 60000);
  if (min < 1) return '即将执行';
  if (min < 60) return `${min} 分钟后`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时后`;
  return `${Math.floor(hr / 24)} 天后`;
}

/** 定时任务管理主页 */
export function ScheduledTasksSection() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [filter, setFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const [editorOpen, setEditorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ScheduledTask | null>(null);
  const [detailTarget, setDetailTarget] = useState<ScheduledTask | null>(null);
  const [runsTarget, setRunsTarget] = useState<ScheduledTask | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  // 每分钟刷新「下次执行」倒计时
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError('');
    const params =
      filter === 'enabled'
        ? { isEnabled: true }
        : filter === 'disabled'
          ? { isEnabled: false }
          : undefined;
    scheduledTaskApi
      .list(params)
      .then((r) => setTasks(r.tasks || []))
      .catch((e) => setLoadError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false));
  }, [filter]);
  useEffect(() => {
    load();
  }, [load]);

  const filtered = search.trim()
    ? tasks.filter((t) => t.name.toLowerCase().includes(search.trim().toLowerCase()))
    : tasks;

  const stats = {
    total: tasks.length,
    enabled: tasks.filter((t) => t.isEnabled).length,
    failed: tasks.filter((t) => t.lastRunStatus === 'failed' || t.lastRunStatus === 'timeout')
      .length,
  };

  const handleToggle = async (t: ScheduledTask) => {
    try {
      await scheduledTaskApi.toggle(t.id, !t.isEnabled);
      load();
    } catch {
      /* ignore */
    }
  };
  const handleRun = async (t: ScheduledTask) => {
    setRunning(t.id);
    try {
      await scheduledTaskApi.run(t.id);
      setRunsTarget(t);
    } catch {
      /* ignore */
    } finally {
      setRunning(null);
    }
  };
  const handleDelete = async (t: ScheduledTask) => {
    if (!window.confirm(`确认删除任务「${t.name}」？执行历史将一并删除。`)) return;
    try {
      await scheduledTaskApi.delete(t.id);
      load();
    } catch {
      /* ignore */
    }
  };

  // 详情页模式（参考记忆库列表→详情交互）：选中任务则渲染整页详情
  if (detailTarget) {
    return (
      <>
        <ScheduledTaskDetail
          task={detailTarget}
          onBack={() => setDetailTarget(null)}
          onEdit={() => {
            setEditTarget(detailTarget);
            setEditorOpen(true);
          }}
        />
        <ScheduledTaskEditor
          key={editTarget?.id ?? '__new__'}
          open={editorOpen}
          task={editTarget}
          onClose={() => setEditorOpen(false)}
          onSaved={load}
        />
      </>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">定时任务</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            管理周期性自动执行的任务，查看每次执行与产出结论
          </p>
        </div>
        <Button
          onClick={() => {
            setEditTarget(null);
            setEditorOpen(true);
          }}
        >
          <Icon name="add" size={16} className="mr-1" />
          新建任务
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="任务总数" value={stats.total} icon="schedule" />
        <StatCard label="启用中" value={stats.enabled} icon="play_circle" color="#34C759" />
        <StatCard label="最近异常" value={stats.failed} icon="error_outline" color="#FF3B30" />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'enabled', 'disabled'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2 py-1 text-xs rounded-lg border transition-colors ${
              filter === f
                ? 'border-[#007AFF] text-[#007AFF] bg-[#007AFF]/5'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f === 'all' ? '全部' : f === 'enabled' ? '启用' : '暂停'}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1 px-2 py-1 border border-gray-200 rounded-lg">
            <Icon name="search" size={14} className="text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索任务名"
              className="text-xs outline-none bg-transparent w-28 sm:w-40"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : loadError ? (
          <div className="py-10 text-center">
            <div className="text-sm text-red-500">{loadError}</div>
            <Button variant="ghost" size="sm" onClick={load} className="mt-3">
              重试
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="schedule"
            title={search ? '没有匹配的任务' : '暂无定时任务'}
            description={search ? '换个关键词试试' : '点击右上角「新建任务」创建第一个定时任务'}
          />
        ) : (
          filtered.map((t, i) => (
            <div
              key={t.id}
              className={`flex items-center px-4 py-3 gap-3 hover:bg-gray-50 ${
                i > 0 ? 'border-t border-gray-50' : ''
              }`}
            >
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setDetailTarget(t)}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-900 truncate hover:text-[#007AFF]">
                    {t.name}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                      t.jobType === 'agent'
                        ? 'bg-purple-50 text-purple-600'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {t.jobType === 'agent' ? '数字员工' : '系统作业'}
                  </span>
                  {!t.isEnabled && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-400">
                      已暂停
                    </span>
                  )}
                  {t.lastRunStatus && (
                    <span
                      className={`text-[10px] ${
                        t.lastRunStatus === 'completed'
                          ? 'text-green-600'
                          : t.lastRunStatus === 'failed'
                            ? 'text-red-500'
                            : 'text-orange-500'
                      }`}
                    >
                      上次：{LAST_STATUS_LABEL[t.lastRunStatus] ?? t.lastRunStatus}
                    </span>
                  )}
                  {t.isEnabled && (
                    <span className="text-[10px] text-[#007AFF]">
                      ⏱ {relativeTime(t.nextRunAt, now)}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-gray-400 mt-1 truncate">
                  {t.scheduleType === 'cron' ? (
                    <span className="font-mono">{t.cronExpr}</span>
                  ) : (
                    `每 ${t.intervalSeconds}s`
                  )}
                  {t.lastError ? ` · ${t.lastError.slice(0, 50)}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <IconBtn title="手动执行" onClick={() => handleRun(t)} disabled={running === t.id}>
                  {running === t.id ? 'hourglass_top' : 'play_arrow'}
                </IconBtn>
                <IconBtn title="查看详情与历史" onClick={() => setDetailTarget(t)}>
                  description
                </IconBtn>
                <IconBtn title={t.isEnabled ? '暂停' : '启用'} onClick={() => handleToggle(t)}>
                  {t.isEnabled ? 'pause' : 'play_arrow'}
                </IconBtn>
                <IconBtn
                  title="编辑"
                  onClick={() => {
                    setEditTarget(t);
                    setEditorOpen(true);
                  }}
                >
                  edit
                </IconBtn>
                <IconBtn title="删除" onClick={() => handleDelete(t)} danger>
                  delete
                </IconBtn>
              </div>
            </div>
          ))
        )}
      </div>

      <ScheduledTaskEditor
        key={editTarget?.id ?? '__new__'}
        open={editorOpen}
        task={editTarget}
        onClose={() => setEditorOpen(false)}
        onSaved={load}
      />
      <ScheduledTaskRunsDrawer task={runsTarget} onClose={() => setRunsTarget(null)} />
    </div>
  );
}

function IconBtn({
  title,
  onClick,
  children,
  disabled,
  danger,
}: {
  title: string;
  onClick: () => void;
  children: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`p-1.5 rounded-lg hover:bg-gray-100 transition-colors ${
        danger ? 'text-red-500' : 'text-gray-400 hover:text-gray-600'
      } disabled:opacity-40`}
    >
      <Icon name={children} size={16} />
    </button>
  );
}
