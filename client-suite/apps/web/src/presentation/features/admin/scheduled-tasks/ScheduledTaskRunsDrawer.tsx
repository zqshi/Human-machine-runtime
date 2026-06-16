import { useState, useEffect } from 'react';
import {
  scheduledTaskApi,
  type ScheduledTask,
  type ScheduledTaskRun,
} from '../../../../application/services/adminApi';
import { Drawer } from '../../../components/ui/Drawer';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ScheduledTaskRunDetail } from './ScheduledTaskRunDetail';
import { MOCK_RUNS } from '../../../../application/mock/scheduledTaskMock';

const STATUS_DOT: Record<string, string> = {
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  timeout: 'bg-orange-500',
  running: 'bg-blue-500',
  pending: 'bg-gray-400',
  cancelled: 'bg-gray-400',
};

/** 执行历史抽屉：左列历史 + 右侧详情（移动端堆叠） */
export function ScheduledTaskRunsDrawer({
  task,
  demoMode,
  onClose,
}: {
  task: ScheduledTask | null;
  demoMode?: boolean;
  onClose: () => void;
}) {
  const taskId = task?.id ?? '';
  const [runs, setRuns] = useState<ScheduledTaskRun[]>([]);
  const [selected, setSelected] = useState<ScheduledTaskRun | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!taskId) {
      setRuns([]);
      setSelected(null);
      return;
    }
    if (demoMode) {
      const r = MOCK_RUNS[taskId] ?? [];
      setRuns(r);
      setSelected(r[0] ?? null);
      return;
    }
    setLoading(true);
    scheduledTaskApi
      .listRuns(taskId, { limit: 50 })
      .then((r) => {
        setRuns(r.runs || []);
        setSelected(r.runs?.[0] ?? null);
      })
      .finally(() => setLoading(false));
  }, [taskId, demoMode]);

  return (
    <Drawer open={!!task} onClose={onClose} title="执行历史" width="w-full lg:w-[820px]">
      {demoMode && (
        <div className="text-[11px] text-[#007AFF] bg-[#007AFF]/5 border border-[#007AFF]/10 rounded px-2 py-1 mb-3">
          演示数据
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 md:gap-4">
        {/* 左：历史列表 */}
        <div className="md:border-r md:border-gray-100 md:pr-4">
          <div className="text-xs font-medium text-gray-500 truncate mb-2">{task?.name ?? ''}</div>
          {loading ? (
            <div className="py-8 text-xs text-gray-400 text-center">加载中…</div>
          ) : runs.length === 0 ? (
            <EmptyState icon="history" title="暂无执行记录" />
          ) : (
            <div className="max-h-64 md:max-h-[60vh] overflow-y-auto -mx-1">
              {runs.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className={`w-full text-left px-2 py-2 rounded-lg hover:bg-gray-50 ${
                    selected?.id === r.id ? 'bg-[#007AFF]/5' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        STATUS_DOT[r.status] ?? 'bg-gray-400'
                      }`}
                    />
                    <span className="text-xs text-gray-700">{r.status}</span>
                    <span className="text-[10px] text-gray-400 ml-auto">
                      {r.triggerType === 'manual' ? '手动' : '定时'}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5 pl-3.5 line-clamp-2">
                    {r.conclusion ? r.conclusion.slice(0, 60) : r.errorMessage?.slice(0, 60) ?? '—'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 右：详情 */}
        <div className="mt-4 md:mt-0">
          {selected ? (
            <ScheduledTaskRunDetail
              run={selected}
              taskName={task?.name}
              jobType={task?.jobType}
            />
          ) : (
            <EmptyState icon="description" title="选择左侧记录查看详情" />
          )}
        </div>
      </div>
    </Drawer>
  );
}
