import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { platformAuditApi } from '../../../application/services/adminApi';
import { StatCard } from '../../components/ui/StatCard';
import { Icon } from '../../components/ui/Icon';

const CATEGORY_BADGE: Record<string, string> = {
  tenant: 'bg-purple-50 text-purple-700',
  instance: 'bg-blue-50 text-blue-700',
  config: 'bg-green-50 text-green-700',
  user: 'bg-yellow-50 text-yellow-700',
  asset: 'bg-red-50 text-red-600',
};

const ACTION_LABELS: Record<string, string> = {
  'tenant.created': '创建租户',
  'tenant.updated': '更新租户',
  'tenant.suspended': '暂停租户',
  'tenant.activated': '激活租户',
  'tenant.archived': '归档租户',
  'tenant.deleted': '删除租户',
  'instance.started': '启动实例',
  'instance.stopped': '停止实例',
  'instance.failed': '实例异常',
  'instance.created': '创建实例',
  'instance.deleted': '删除实例',
  'instance.restarted': '重启实例',
  'config.updated': '修改配置',
  'config.reset': '重置配置',
  'user.login': '用户登录',
  'user.logout': '用户登出',
  'user.created': '创建用户',
  'user.deleted': '删除用户',
  'asset.published': '发布资产',
  'asset.reviewed': '审核资产',
  'asset.rejected': '驳回资产',
};

function resolveCategory(type: string): string {
  return String(type || '').split('.')[0];
}

function resolveCategoryLabel(type: string): string {
  const map: Record<string, string> = {
    tenant: '租户',
    instance: '实例',
    config: '配置',
    user: '用户',
    asset: '资产',
  };
  return map[resolveCategory(type)] || '系统';
}

function resolveAction(log: Record<string, unknown>): string {
  if (log.action && log.action !== log.type) return String(log.action);
  return ACTION_LABELS[String(log.type)] || String(log.type || '—').replace('.', ' · ');
}

function resolveWho(log: Record<string, unknown>): string {
  const actor = log.actor as Record<string, unknown> | null;
  if (actor && typeof actor === 'object' && actor.username) {
    return `${actor.username}${actor.role ? `（${actor.role}）` : ''}`;
  }
  if (typeof log.actor === 'string') return log.actor;
  const payload = (log.payload || {}) as Record<string, unknown>;
  return String(payload.actor || payload.username || '—');
}

function resolveWhere(log: Record<string, unknown>): string {
  const where = log.where as Record<string, unknown> | null;
  if (where && (where.ip || where.userAgent)) {
    const parts: string[] = [];
    if (where.ip) parts.push(`IP: ${where.ip}`);
    if (where.userAgent) parts.push(String(where.userAgent));
    return parts.join(' | ');
  }
  const payload = (log.payload || {}) as Record<string, unknown>;
  if (payload.ip) return `IP: ${payload.ip}`;
  return '—';
}

function resolveWhat(log: Record<string, unknown>): string {
  const target = log.target as Record<string, unknown> | null;
  if (target) {
    return [target.type, target.name, target.id].filter(Boolean).join(' / ') || '—';
  }
  const payload = (log.payload || {}) as Record<string, unknown>;
  if (payload.tenantName) return String(payload.tenantName);
  if (payload.instanceId && payload.name) return `${payload.name} (${payload.instanceId})`;
  if (payload.instanceId) return String(payload.instanceId);
  if (payload.tenantId) return String(payload.tenantId);
  if (payload.assetName) return String(payload.assetName);
  return '—';
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

function AuditDetail({ log }: { log: Record<string, unknown> }) {
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
          <DetailField label="How（动作）" value={resolveAction(log)} />
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

export function PlatformAuditSection() {
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadRef = useRef<() => void>();

  const load = useCallback(() => {
    setLoading(true);
    platformAuditApi
      .list({ limit: 200 })
      .then((r) => {
        setLogs(r.logs || []);
        setTotal(r.total || 0);
      })
      .catch(() => {
        setLogs([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadRef.current = load; }, [load]);

  useEffect(() => {
    loadRef.current?.();
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">审计日志</h1>
          <p className="text-xs text-gray-400 mt-0.5">平台操作记录与变更追溯</p>
        </div>
        <button onClick={load} className="p-1.5 text-gray-400 hover:text-[#007AFF]" title="刷新">
          <Icon name="refresh" size={16} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard label="日志总数" value={total} icon="receipt_long" />
        <StatCard
          label="最新时间"
          value={
            logs[0]
              ? String(logs[0].at || logs[0].timestamp || '')
                  .slice(0, 19)
                  .replace('T', ' ')
              : '—'
          }
          icon="schedule"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">加载中...</div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white max-h-[calc(100vh-280px)] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50/95 backdrop-blur-sm">
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2.5 font-medium text-gray-500 w-40">时间</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500 w-20">分类</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500 w-24">动作</th>
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
                const category = resolveCategory(String(log.type));
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
                      <td className="px-4 py-2">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full ${CATEGORY_BADGE[category] || 'bg-gray-100 text-gray-500'}`}
                        >
                          {resolveCategoryLabel(String(log.type))}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-700">{resolveAction(log)}</td>
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
                        <td colSpan={7} className="border-b border-gray-100">
                          <AuditDetail log={log} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    暂无审计日志
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
