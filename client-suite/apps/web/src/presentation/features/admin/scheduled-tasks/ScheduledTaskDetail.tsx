/**
 * ScheduledTaskDetail —— 定时任务详情页（参考记忆库 MemoryStoreDetail 的列表→详情交互）
 *
 * 列表点击任务进入本页：任务信息卡 + 执行时间（调度/下次/上次）+ 执行历史表 + 输出报告。
 * 左列历史、右侧选中 run 的输出报告；移动端堆叠。onBack 返回列表。
 */

import { useState, useEffect } from 'react';
import {
  scheduledTaskApi,
  type ScheduledTask,
  type ScheduledTaskRun,
} from '../../../../application/services/adminApi';
import { Button } from '../../../components/ui/Button';
import { StatCard } from '../../../components/ui/StatCard';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Icon } from '../../../components/ui/Icon';
import { ScheduledTaskRunDetail } from './ScheduledTaskRunDetail';
import { MOCK_RUNS } from '../../../../application/mock/scheduledTaskMock';
import { findSpec, type JobSpec } from './jobSpecs';

const STATUS_DOT: Record<string, string> = {
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  timeout: 'bg-orange-500',
  running: 'bg-blue-500',
  pending: 'bg-gray-400',
};

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('zh-CN', { hour12: false });
}

export function ScheduledTaskDetail({
  task,
  demoMode,
  onBack,
  onEdit,
}: {
  task: ScheduledTask;
  demoMode: boolean;
  onBack: () => void;
  onEdit: () => void;
}) {
  const [runs, setRuns] = useState<ScheduledTaskRun[]>([]);
  const [selected, setSelected] = useState<ScheduledTaskRun | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (demoMode) {
      const r = MOCK_RUNS[task.id] ?? [];
      setRuns(r);
      setSelected(r[0] ?? null);
      setLoading(false);
      return;
    }
    setLoading(true);
    scheduledTaskApi
      .listRuns(task.id, { limit: 50 })
      .then((r) => {
        setRuns(r.runs || []);
        setSelected(r.runs?.[0] ?? null);
      })
      .finally(() => setLoading(false));
  }, [task.id, demoMode]);

  const spec: JobSpec | undefined = findSpec(
    task.jobType,
    task.jobPayload?.handlerKey as string | undefined
  );

  const handleRun = async () => {
    try {
      await scheduledTaskApi.run(task.id);
      // 重新拉历史
      const r = await scheduledTaskApi.listRuns(task.id, { limit: 50 });
      setRuns(r.runs || []);
      setSelected(r.runs?.[0] ?? null);
    } catch {
      /* ignore */
    }
  };

  const scheduleText =
    task.scheduleType === 'cron'
      ? `cron ${task.cronExpr}`
      : `每 ${task.intervalSeconds}s`;

  const totalRun = runs.length;
  const successRun = runs.filter((r) => r.status === 'completed').length;
  const failRun = runs.filter((r) => r.status === 'failed' || r.status === 'timeout').length;
  const avgDur =
    runs.length > 0
      ? Math.round(runs.reduce((s, r) => s + (r.durationMs ?? 0), 0) / runs.length)
      : 0;

  return (
    <div className="p-6 space-y-4">
      {/* 顶部：返回 + 标题 + 操作 */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <Icon name="arrow_back" size={18} /> 返回列表
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-semibold text-gray-900 truncate">{task.name}</h1>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] ${
                task.jobType === 'agent' ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {spec?.label ?? task.jobType}
            </span>
            {task.isEnabled ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-50 text-green-600">启用</span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-400">已暂停</span>
            )}
          </div>
          {task.description && <p className="text-xs text-gray-400 mt-0.5">{task.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleRun} disabled={demoMode}>
            <Icon name="play_arrow" size={14} className="mr-1" /> 立即执行
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Icon name="edit" size={14} className="mr-1" /> 编辑
          </Button>
        </div>
      </div>

      {/* 执行时间 + 统计 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="调度频次" value={scheduleText} icon="schedule" />
        <StatCard label="下次执行" value={fmtTime(task.nextRunAt)} icon="update" color="#007AFF" />
        <StatCard label="上次执行" value={fmtTime(task.lastRunAt)} icon="history" color="#34C759" />
        <StatCard
          label="上次结果"
          value={task.lastRunStatus ?? '—'}
          icon="flag"
          color={task.lastRunStatus === 'failed' ? '#FF3B30' : '#5856D6'}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="累计执行" value={totalRun} icon="repeat" />
        <StatCard label="成功" value={successRun} icon="check_circle" color="#34C759" />
        <StatCard label="失败/超时" value={failRun} icon="error_outline" color="#FF3B30" />
      </div>
      {avgDur > 0 && (
        <div className="text-xs text-gray-400">平均耗时 {(avgDur / 1000).toFixed(1)}s</div>
      )}

      {task.lastError && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          ⚠ 最近错误：{task.lastError}
        </div>
      )}

      {/* 执行历史 + 输出报告（双栏） */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
          <Icon name="receipt_long" size={16} className="text-gray-500" />
          <span className="text-sm font-semibold text-gray-800">执行历史与输出报告</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr]">
          {/* 左：历史列表 */}
          <div className="md:border-r md:border-gray-100 max-h-[70vh] overflow-y-auto">
            {loading ? (
              <div className="p-6 text-xs text-gray-400 text-center">加载中…</div>
            ) : runs.length === 0 ? (
              <EmptyState icon="history" title="暂无执行记录" />
            ) : (
              runs.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className={`w-full text-left px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50 ${
                    selected?.id === r.id ? 'bg-[#007AFF]/5' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[r.status] ?? 'bg-gray-400'}`} />
                    <span className="text-xs text-gray-700">{r.status}</span>
                    <span className="text-[10px] text-gray-400 ml-auto">
                      {r.triggerType === 'manual' ? '手动' : '定时'}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {fmtTime(r.createdAt)}
                    {r.durationMs != null ? ` · ${(r.durationMs / 1000).toFixed(1)}s` : ''}
                  </div>
                </button>
              ))
            )}
          </div>
          {/* 右：输出报告 */}
          <div className="p-4 max-h-[70vh] overflow-y-auto">
            {selected ? (
              <ScheduledTaskRunDetail run={selected} />
            ) : (
              <EmptyState icon="description" title="选择左侧记录查看输出报告" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
