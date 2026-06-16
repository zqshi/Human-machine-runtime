/**
 * AuditLogPage — 审核日志页 (km_12 对齐)
 * 筛选器 + 操作日志表格 + 操作详情面板
 *
 * 数据来源：knowledgeStore.auditEntries (通过 fetchAuditLog)
 */
import { useState, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { Avatar } from '../../components/ui/Avatar';
import { useToastStore } from '../../../application/stores/toastStore';
import { useKnowledgeStore } from '../../../application/stores/knowledgeStore';
import type { AuditEntry, AuditOperationType } from '../../../domain/knowledge/AuditEntry';

interface AuditLogPageProps {
  onClose?: () => void;
}

export function AuditLogPage({ onClose }: AuditLogPageProps) {
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [operatorSearch, setOperatorSearch] = useState('');
  const [operationType, setOperationType] = useState('全部类型');
  const [timeRange, setTimeRange] = useState('最近 24 小时');

  const auditEntries = useKnowledgeStore((s) => s.auditEntries);
  const fetchAuditLog = useKnowledgeStore((s) => s.fetchAuditLog);

  useEffect(() => {
    fetchAuditLog();
  }, [fetchAuditLog]);

  // Re-fetch with filters when filters change
  useEffect(() => {
    const TYPE_MAP: Record<string, AuditOperationType | undefined> = {
      删除文档: 'delete',
      登录系统: 'login',
      编辑文档: 'edit',
      创建文档: 'create',
      权限变更: 'permission',
      发布文档: 'publish',
      归档文档: 'archive',
    };
    fetchAuditLog({
      operationType: TYPE_MAP[operationType],
      search: operatorSearch || undefined,
    });
  }, [operationType, operatorSearch, fetchAuditLog]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary mb-3 px-6 pt-3"
        >
          <Icon name="arrow_back" size={18} /> 返回
        </button>
      )}
      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-border">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-text-primary">审核日志</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => useToastStore.getState().addToast('日志导出功能开发中', 'info')}
                  className="px-3 py-1.5 text-xs font-medium text-text-secondary border border-border rounded-lg hover:bg-bg-hover flex items-center gap-1.5"
                >
                  <Icon name="download" size={14} /> 导出日志
                </button>
                <button
                  type="button"
                  onClick={() => fetchAuditLog()}
                  className="px-3 py-1.5 text-xs font-medium text-text-secondary border border-border rounded-lg hover:bg-bg-hover flex items-center gap-1.5"
                >
                  <Icon name="refresh" size={14} /> 刷新
                </button>
              </div>
            </div>
            <p className="text-xs text-text-muted">监控和审计企业资产中的所有关键操作行为</p>
          </div>

          {/* Filters */}
          <div className="px-6 py-3 border-b border-border bg-fill-tertiary/20">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">操作类型</span>
                <select
                  value={operationType}
                  onChange={(e) => setOperationType(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-border rounded-lg bg-bg-white-var appearance-none"
                >
                  <option>全部类型</option>
                  <option>创建文档</option>
                  <option>编辑文档</option>
                  <option>删除文档</option>
                  <option>发布文档</option>
                  <option>归档文档</option>
                  <option>权限变更</option>
                  <option>登录系统</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">时间范围</span>
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-border rounded-lg bg-bg-white-var appearance-none"
                >
                  <option>最近 24 小时</option>
                  <option>最近 7 天</option>
                  <option>最近 30 天</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">操作人</span>
                <div className="relative">
                  <Icon
                    name="search"
                    size={14}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
                  />
                  <input
                    type="text"
                    value={operatorSearch}
                    onChange={(e) => setOperatorSearch(e.target.value)}
                    placeholder="搜索姓名或 ID"
                    className="pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg bg-bg-white-var w-40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOperatorSearch('');
                  setOperationType('全部类型');
                  setTimeRange('最近 24 小时');
                }}
                className="text-xs text-text-muted hover:text-text-primary"
              >
                重置
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-fill-tertiary/30 text-left">
                  <th className="px-4 py-2.5 text-[11px] font-medium text-text-muted">时间戳</th>
                  <th className="px-4 py-2.5 text-[11px] font-medium text-text-muted">操作人</th>
                  <th className="px-4 py-2.5 text-[11px] font-medium text-text-muted">操作类型</th>
                  <th className="px-4 py-2.5 text-[11px] font-medium text-text-muted">操作对象</th>
                  <th className="px-4 py-2.5 text-[11px] font-medium text-text-muted">IP地址</th>
                  <th className="px-4 py-2.5 text-[11px] font-medium text-text-muted text-right">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {auditEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    onClick={() => setSelectedEntry(entry)}
                    className={`border-b border-border/50 cursor-pointer transition-colors ${
                      selectedEntry?.id === entry.id ? 'bg-primary/5' : 'hover:bg-bg-hover/30'
                    }`}
                  >
                    <td className="px-4 py-3 text-xs text-text-secondary whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar letter={entry.operatorName.charAt(0)} size={24} />
                        <span className="text-xs font-medium text-text-primary">
                          {entry.operatorName}
                        </span>
                        {entry.operatorRole && (
                          <span className="text-[9px] text-text-muted">({entry.operatorRole})</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-md ${entry.operationColor} bg-opacity-10`}
                      >
                        {entry.operationLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Icon name="description" size={14} className="text-text-muted" />
                        <span className="text-xs text-text-primary truncate max-w-[200px]">
                          {entry.targetName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted font-mono">
                      {entry.ip || '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedEntry(entry)}
                        className="px-2.5 py-1 text-[11px] text-primary border border-primary/20 rounded-lg hover:bg-primary/5 font-medium"
                      >
                        详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-border">
            <span className="text-xs text-text-muted">
              显示 1-{auditEntries.length} 条，共 {auditEntries.length} 条记录
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="px-2 py-1 text-xs rounded border border-border text-text-muted"
              >
                <Icon name="chevron_left" size={14} />
              </button>
              <button
                type="button"
                className="px-2.5 py-1 text-xs rounded bg-primary text-white font-medium"
              >
                1
              </button>
              <button
                type="button"
                className="px-2 py-1 text-xs rounded border border-border text-text-muted"
              >
                <Icon name="chevron_right" size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Detail drawer overlay */}
      {selectedEntry && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setSelectedEntry(null)} />
          <AuditDetailPanel entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
        </>
      )}
    </div>
  );
}

function AuditDetailPanel({ entry, onClose }: { entry: AuditEntry; onClose: () => void }) {
  return (
    <div
      className="fixed right-0 top-0 z-50 h-full w-96 border-l border-border bg-bg-white-var overflow-y-auto flex flex-col dcf-scrollbar"
      style={{ boxShadow: 'var(--shadow-drawer)', animation: 'slideInRight 0.25s ease-out' }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-text-primary">操作详情</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md hover:bg-bg-hover text-text-secondary"
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      <div className="p-4 space-y-5">
        {/* Operator info */}
        <section>
          <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
            操作人信息
          </h4>
          <div className="bg-bg-white-var rounded-xl border border-border p-3 flex items-center gap-3">
            <Avatar letter={entry.operatorName.charAt(0)} size={40} />
            <div className="flex-1">
              <span className="text-sm font-semibold text-text-primary">{entry.operatorName}</span>
              {entry.operatorRole && (
                <span className="ml-2 text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  {entry.operatorRole.toUpperCase()}
                </span>
              )}
              <p className="text-[10px] text-text-muted mt-0.5">ID: {entry.operatorId}</p>
            </div>
          </div>
        </section>

        {/* Execution detail */}
        <section>
          <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
            执行详情
          </h4>
          <div className="space-y-3">
            <div>
              <p className="text-[10px] text-text-muted mb-0.5">具体行为</p>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${entry.operationType === 'delete' ? 'bg-error' : 'bg-primary'}`}
                />
                <span className="text-xs font-medium text-text-primary">
                  {entry.operationLabel}
                </span>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-text-muted mb-0.5">发生时间</p>
              <p className="text-xs font-medium text-text-primary">
                {new Date(entry.timestamp).toLocaleString('zh-CN')}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-text-muted mb-0.5">操作对象</p>
              <p className="text-xs font-medium text-text-primary">{entry.targetName}</p>
            </div>
            {entry.resourcePath && (
              <div>
                <p className="text-[10px] text-text-muted mb-0.5">资源路径</p>
                <div className="bg-fill-tertiary/30 rounded-lg p-2.5 flex items-start gap-2">
                  <Icon name="folder" size={14} className="text-text-muted mt-0.5 shrink-0" />
                  <span className="text-[11px] text-text-secondary leading-relaxed break-all">
                    {entry.resourcePath}
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Metadata */}
        {entry.metadata && Object.keys(entry.metadata).length > 0 && (
          <section>
            <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
              请求元数据
            </h4>
            <div className="bg-surface-dark rounded-xl p-3 font-mono text-[10px] text-[#9DA5B4] leading-relaxed">
              {'{'}
              {Object.entries(entry.metadata).map(([k, v]) => (
                <div key={k} className="pl-3">
                  "<span className="text-[#E06C75]">{k}</span>": "
                  <span className="text-[#98C379]">{String(v)}</span>",
                </div>
              ))}
              {'}'}
            </div>
          </section>
        )}

        {/* IP info */}
        {entry.ip && (
          <section>
            <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
              网络信息
            </h4>
            <p className="text-xs font-mono text-text-secondary">IP: {entry.ip}</p>
          </section>
        )}

        {/* User history button */}
        <button
          type="button"
          onClick={() => useToastStore.getState().addToast('用户轨迹功能开发中', 'info')}
          className="w-full py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors flex items-center justify-center gap-2"
        >
          <Icon name="history" size={16} />
          查看该用户历史轨迹
        </button>
      </div>
    </div>
  );
}
