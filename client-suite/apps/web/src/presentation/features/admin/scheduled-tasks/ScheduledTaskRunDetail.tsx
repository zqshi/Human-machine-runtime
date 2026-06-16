import type { ScheduledTaskRun } from '../../../../application/services/adminApi';
import { Icon } from '../../../components/ui/Icon';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const STATUS_STYLE: Record<string, string> = {
  completed: 'bg-green-50 text-green-700 border-green-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  timeout: 'bg-orange-50 text-orange-700 border-orange-200',
  running: 'bg-blue-50 text-blue-700 border-blue-200',
  pending: 'bg-gray-50 text-gray-600 border-gray-200',
  cancelled: 'bg-gray-50 text-gray-500 border-gray-200',
};

const STATUS_LABEL: Record<string, string> = {
  completed: '成功',
  failed: '失败',
  timeout: '超时',
  running: '执行中',
  pending: '等待',
  cancelled: '已取消',
};

const STATUS_ICON: Record<string, string> = {
  completed: 'check_circle',
  failed: 'error',
  timeout: 'schedule',
  running: 'sync',
  pending: 'hourglass_top',
};

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('zh-CN', { hour12: false });
}

function fmtDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m${Math.round((ms % 60_000) / 1000)}s`;
}

/** 单次执行详情页：状态头 + conclusion 突出 + 结构化产出 + 错误 */
export function ScheduledTaskRunDetail({
  run,
  taskName,
  jobType,
}: {
  run: ScheduledTaskRun;
  taskName?: string;
  jobType?: string;
}) {
  const status = run.status;
  // 周报类任务在 outputPayload.markdown 携带完整报告正文，富文本渲染展示
  const reportMd =
    run.outputPayload && typeof run.outputPayload === 'object'
      ? String((run.outputPayload as Record<string, unknown>).markdown ?? '')
      : '';
  return (
    <div className="space-y-4">
      {/* 任务上下文 */}
      {taskName && (
        <div className="flex items-center gap-2">
          <Icon
            name={jobType === 'agent' ? 'smart_toy' : 'settings'}
            size={16}
            className="text-gray-400"
          />
          <span className="text-sm font-medium text-gray-800 truncate">{taskName}</span>
        </div>
      )}

      {/* 状态头 */}
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${STATUS_STYLE[status] ?? STATUS_STYLE.pending}`}
      >
        <Icon name={STATUS_ICON[status] ?? 'info'} size={18} />
        <span className="text-sm font-semibold">{STATUS_LABEL[status] ?? status}</span>
        <span className="text-xs opacity-70 ml-auto">
          {run.triggerType === 'manual' ? '手动触发' : '定时触发'}
        </span>
      </div>

      {/* 时间与耗时 */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-gray-400">开始</div>
          <div className="text-gray-700 mt-0.5">{fmtTime(run.startedAt)}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-gray-400">结束</div>
          <div className="text-gray-700 mt-0.5">{fmtTime(run.finishedAt)}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-gray-400">耗时</div>
          <div className="text-gray-700 mt-0.5">{fmtDuration(run.durationMs)}</div>
        </div>
      </div>

      {/* 产出结论（摘要速览） */}
      {run.conclusion && (
        <div>
          <div className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
            <Icon name="subject" size={13} /> 产出结论
          </div>
          <pre className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-100 rounded-lg p-3 text-sm text-gray-800 whitespace-pre-wrap break-all leading-relaxed">
            {run.conclusion}
          </pre>
        </div>
      )}

      {/* 报告内容（富文本渲染，仅周报等携带 markdown 正文的任务） */}
      {reportMd && (
        <div>
          <div className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
            <Icon name="description" size={13} /> 报告内容
          </div>
          <div className="prose prose-sm max-w-none bg-white border border-gray-100 rounded-lg p-4 hmr-scrollbar">
            <Markdown remarkPlugins={[remarkGfm]}>{reportMd}</Markdown>
          </div>
        </div>
      )}

      {/* 结构化产出（原始 JSON，供调试/非报告任务查看；有渲染报告时隐藏避免冗余） */}
      {run.outputPayload != null && !reportMd && (
        <div>
          <div className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
            <Icon name="data_object" size={13} /> 结构化产出
          </div>
          <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs whitespace-pre-wrap break-all max-h-72 overflow-y-auto">
            {JSON.stringify(run.outputPayload, null, 2)}
          </pre>
        </div>
      )}

      {/* 错误信息 */}
      {run.errorMessage && (
        <div>
          <div className="text-xs font-medium text-red-500 mb-1 flex items-center gap-1">
            <Icon name="warning" size={13} /> 错误信息
          </div>
          <pre className="bg-red-50 border border-red-100 rounded-lg p-3 text-xs text-red-700 whitespace-pre-wrap break-all">
            {run.errorMessage}
          </pre>
        </div>
      )}

      {/* 元数据 */}
      {run.metadata != null && (
        <div className="text-[11px] text-gray-400">
          <span className="font-medium">metadata：</span>
          {JSON.stringify(run.metadata)}
        </div>
      )}
    </div>
  );
}
