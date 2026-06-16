import { useState, useEffect, useCallback, Fragment } from 'react';
import { adminLogsApi } from '../../../application/services/adminApi';
import { FilterBar } from '../../components/ui/FilterBar';
import { StatCard } from '../../components/ui/StatCard';
import { Icon } from '../../components/ui/Icon';

const ACTION_SUMMARIES: Record<string, string> = {
  'employee.create': '创建员工',
  'employee.update': '更新员工',
  'employee.delete': '删除员工',
  'employee.policy.update': '更新员工策略',
  'employee.instance.start': '启动实例',
  'employee.instance.stop': '停止实例',
  'employee.instance.rebuild': '重建实例',
  'skill.create': '创建技能',
  'skill.update': '更新技能',
  'skill.delete': '删除技能',
  'skill.approve': '审批技能',
  'skill.reject': '驳回技能',
  'skill.publish': '发布技能',
  'skill.link': '绑定技能',
  'skill.unlink': '解绑技能',
  'tool.create': '创建工具',
  'tool.update': '更新工具',
  'tool.approve': '审批工具',
  'auth.user.create': '创建用户',
  'auth.user.update': '更新用户',
  'auth.user.delete': '删除用户',
  'auth.role.create': '创建角色',
  'auth.role.update': '更新角色',
  'gateway.model.create': '添加模型',
  'gateway.model.update': '更新模型',
  'gateway.config.update': '更新网关配置',
  'gateway.rule.create': '创建风控规则',
  'notification.dismiss': '关闭通知',
  'notification.escalate': '升级通知',
  'tenant.create': '创建租户',
  'tenant.suspend': '暂停租户',
  'tenant.activate': '激活租户',
  'config.update': '更新配置',
  'agent.spawn': '生成 Agent',
  'agent.register': '注册 Agent',
  'task.complete': '完成任务',
  'task.fail': '任务失败',
  login: '登录',
  logout: '登出',
};

function summarizeAction(action: string): string {
  return ACTION_SUMMARIES[action] || action;
}

function getFilterDefs() {
  return [
    { key: 'keyword', label: '关键词', type: 'text' as const, placeholder: '搜索...' },
    {
      key: 'level',
      label: '级别',
      type: 'select' as const,
      options: [
        { value: 'error', label: '错误' },
        { value: 'warn', label: '警告' },
        { value: 'info', label: '信息' },
      ],
    },
    { key: 'actor', label: '操作者', type: 'text' as const, placeholder: '用户名' },
    { key: 'operation', label: '操作', type: 'text' as const, placeholder: '事件类型' },
  ];
}

function resolveWho(log: Record<string, unknown>): string {
  const actor = log.actor as Record<string, unknown> | null;
  if (actor && actor.username) return `${actor.username}${actor.role ? `（${actor.role}）` : ''}`;
  const payload = (log.payload || {}) as Record<string, unknown>;
  return String(payload.actor_name || payload.actor || payload.username || log.agent || '—');
}

function resolveWhere(log: Record<string, unknown>): string {
  const where = log.where as Record<string, unknown> | null;
  if (where && (where.ip || where.userAgent)) {
    const parts: string[] = [];
    if (where.ip) parts.push(`IP: ${where.ip}`);
    if (where.userAgent) parts.push(String(where.userAgent));
    return parts.join(' | ');
  }
  return '—';
}

function resolveWhat(log: Record<string, unknown>): string {
  const target = log.target as Record<string, unknown> | null;
  if (target) {
    return [target.type, target.name, target.id].filter(Boolean).join(' / ') || '—';
  }
  const payload = (log.payload || {}) as Record<string, unknown>;
  const parts: string[] = [];
  if (payload.taskId) parts.push(`任务 ${payload.taskId}`);
  if (payload.employeeId) parts.push(`员工 ${payload.employeeId}`);
  if (payload.serviceId) parts.push(`服务 ${payload.serviceId}`);
  if (payload.skillId) parts.push(`技能 ${payload.skillId}`);
  return parts.join(' / ') || '—';
}

function resolveHow(log: Record<string, unknown>): string {
  if (log.action && log.action !== log.type) return String(log.action);
  return summarizeAction(String(log.action || log.type || '—'));
}

function resolveResult(log: Record<string, unknown>): { success: boolean; reason: string } | null {
  const r = log.result as Record<string, unknown> | null;
  if (r && typeof r === 'object')
    return { success: Boolean(r.success), reason: String(r.reason || '') };
  return null;
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 py-1.5 border-b border-gray-50">
      <span className="text-xs text-gray-400 w-24 shrink-0">{label}</span>
      <span className="text-xs text-gray-700 break-all">{value || '—'}</span>
    </div>
  );
}

function LogDetail({ log }: { log: Record<string, unknown> }) {
  const result = resolveResult(log);
  return (
    <div className="grid gap-3 p-4 bg-gray-50/80">
      <div>
        <h4 className="text-xs font-medium text-gray-500 mb-1">5W1H 审计要素</h4>
        <div className="bg-white rounded-lg p-3 border border-gray-100 space-y-0">
          <DetailField label="Who（操作者）" value={resolveWho(log)} />
          <DetailField
            label="When（时间）"
            value={
              log.at
                ? new Date(String(log.at)).toLocaleString('zh-CN', { hour12: false })
                : String(log.timestamp || '—')
            }
          />
          <DetailField label="Where（来源）" value={resolveWhere(log)} />
          <DetailField label="What（对象）" value={resolveWhat(log)} />
          <DetailField label="How（动作）" value={resolveHow(log)} />
          <div className="flex gap-2 py-1.5">
            <span className="text-xs text-gray-400 w-24 shrink-0">Result（结果）</span>
            {result ? (
              <span
                className={`text-xs font-medium ${result.success ? 'text-green-600' : 'text-red-600'}`}
              >
                {result.success ? '成功' : '失败'}
                {result.reason ? ` — ${result.reason}` : ''}
              </span>
            ) : (
              <span className="text-xs text-gray-400">—</span>
            )}
          </div>
        </div>
      </div>
      <div>
        <h4 className="text-xs font-medium text-gray-500 mb-1">追踪信息</h4>
        <div className="bg-white rounded-lg p-3 border border-gray-100 space-y-0">
          <DetailField label="事件类型" value={String(log.type || '—')} />
          <DetailField label="事件ID" value={String(log.id || '—')} />
          <DetailField label="请求ID" value={String(log.requestId || '—')} />
          <DetailField label="链路ID" value={String(log.traceId || '—')} />
        </div>
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-[#007AFF] font-medium">原始 JSON</summary>
        <pre className="mt-2 p-3 bg-white rounded-lg border border-gray-100 font-mono text-[11px] whitespace-pre-wrap break-all max-h-48 overflow-auto">
          {JSON.stringify(log, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export function LogsSection() {
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // filters 变化时在渲染阶段标记 loading（避免 useEffect 中同步 setState）
  const [prevDeps, setPrevDeps] = useState({ filters });
  if (filters !== prevDeps.filters) {
    setPrevDeps({ filters });
    setLoading(true);
  }

  const fetchLogs = useCallback(() => {
    adminLogsApi
      .list({
        scope: 'admin',
        limit: 200,
        keyword: filters.keyword || undefined,
        level: filters.level || undefined,
        actor: filters.actor || undefined,
        operation: filters.operation || undefined,
      })
      .then((r) => setLogs(Array.isArray(r) ? r : []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(fetchLogs, [fetchLogs]);

  // 供手动刷新用（带 loading 态）
  const load = useCallback(() => {
    setLoading(true);
    fetchLogs();
  }, [fetchLogs]);

  const exportData = (format: 'json' | 'csv') => {
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'logs.json';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const header = 'timestamp,level,scope,action,agent,status,duration\n';
      const rows = logs
        .map((l) =>
          [l.timestamp, l.level, l.scope, l.action, l.agent, l.status, l.duration]
            .map((v) => `"${String(v ?? '')}"`)
            .join(',')
        )
        .join('\n');
      const blob = new Blob([header + rows], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'logs.csv';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const stats = {
    total: logs.length,
    latest: logs[0] ? String(logs[0].timestamp || logs[0].at || '') : '—',
  };

  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="日志总数" value={stats.total} icon="description" />
        <StatCard
          label="最新时间"
          value={stats.latest.slice(0, 19).replace('T', ' ')}
          icon="schedule"
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center px-1 text-xs font-medium text-gray-700">平台操作日志</div>
          <FilterBar
            filters={getFilterDefs()}
            values={filters}
            onChange={(k, v) => setFilters((p) => ({ ...p, [k]: v }))}
            onSearch={load}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportData('csv')}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            CSV
          </button>
          <button
            onClick={() => exportData('json')}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            JSON
          </button>
          <button onClick={load} className="p-1.5 text-gray-400 hover:text-[#007AFF]" title="刷新">
            <Icon name="refresh" size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">加载中...</div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white max-h-[calc(100vh-280px)] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50/95 backdrop-blur-sm">
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2.5 font-medium text-gray-500 w-40">时间</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500 w-20">动作</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">对象</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500 w-20">操作者</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500 w-16">结果</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => {
                const id = String(log.id || i);
                const expanded = expandedId === id;
                const result = resolveResult(log);
                return (
                  <Fragment key={id}>
                    <tr
                      className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedId(expanded ? null : id)}
                    >
                      <td className="px-4 py-2 text-xs text-gray-400 font-mono">
                        {String(log.at || log.timestamp || '—')
                          .slice(0, 19)
                          .replace('T', ' ')}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-700">{resolveHow(log)}</td>
                      <td className="px-4 py-2 text-xs text-gray-600 truncate max-w-[200px]">
                        {resolveWhat(log)}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-600">
                        {resolveWho(log).split('（')[0]}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {result ? (
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap ${result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}
                          >
                            {result.success ? '成功' : '失败'}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <Icon
                          name={expanded ? 'expand_less' : 'expand_more'}
                          size={14}
                          className="text-gray-300"
                        />
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={6} className="border-b border-gray-100">
                          <LogDetail log={log} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    暂无日志
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
