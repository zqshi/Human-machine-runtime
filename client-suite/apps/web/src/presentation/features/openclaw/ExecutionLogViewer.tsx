/**
 * ExecutionLogViewer — 执行日志组件（可复用）
 */
interface LogEntry {
  time: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
}

const LEVEL_STYLE: Record<LogEntry['level'], string> = {
  INFO: 'text-slate-400',
  WARN: 'text-amber-400',
  ERROR: 'text-red-400',
  DEBUG: 'text-slate-500',
};

interface ExecutionLogViewerProps {
  logs: LogEntry[];
  maxHeight?: number;
}

export function ExecutionLogViewer({ logs, maxHeight = 200 }: ExecutionLogViewerProps) {
  return (
    <div
      className="rounded-lg border border-white/10 bg-black/20 overflow-y-auto hmr-scrollbar font-mono text-[11px] leading-relaxed p-2.5"
      style={{ maxHeight }}
    >
      {logs.length === 0 ? (
        <p className="text-slate-500 text-center py-4">暂无日志</p>
      ) : (
        logs.map((entry, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-slate-600 shrink-0">[{entry.time}]</span>
            <span className={`shrink-0 ${LEVEL_STYLE[entry.level]}`}>{entry.level}</span>
            <span className="text-slate-300">{entry.message}</span>
          </div>
        ))
      )}
    </div>
  );
}

export type { LogEntry };
