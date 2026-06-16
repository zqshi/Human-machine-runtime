import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import { Modal } from '../../components/ui/Modal';
import {
  quotaApi,
  type QuotaAlertRule,
  type QuotaAlertEvent,
} from '../../../application/services/adminApi';

const SEVERITY_BADGE: Record<string, { label: string; cls: string }> = {
  warning: { label: '警告', cls: 'bg-orange-100 text-orange-700' },
  critical: { label: '严重', cls: 'bg-red-100 text-red-700' },
};

const RESOURCE_LABELS: Record<string, string> = {
  instance_count: '实例数量',
  token_monthly: '月度 Token',
  token_daily: '日度 Token',
  storage: '存储空间',
  api_calls: 'API 调用',
};

const EVENT_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active: { label: '活跃', cls: 'bg-red-100 text-red-700' },
  acknowledged: { label: '已确认', cls: 'bg-yellow-100 text-yellow-700' },
  resolved: { label: '已解决', cls: 'bg-green-100 text-green-700' },
};

export function QuotaAlertsTab() {
  const [rules, setRules] = useState<QuotaAlertRule[]>([]);
  const [events, setEvents] = useState<QuotaAlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRes, eventsRes] = await Promise.all([
        quotaApi.listRules(),
        quotaApi.listEvents(undefined, { limit: 20 }),
      ]);
      setRules(rulesRes.data);
      setEvents(eventsRes.data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (rule: QuotaAlertRule) => {
    try {
      await quotaApi.updateRule(rule.id, { enabled: !rule.enabled });
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)));
    } catch {
      /* ignore */
    }
  };

  const handleDelete = async (ruleId: number) => {
    try {
      await quotaApi.deleteRule(ruleId);
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    } catch {
      /* ignore */
    }
  };

  const handleAck = async (eventId: number) => {
    try {
      await quotaApi.acknowledgeEvent(eventId);
      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, status: 'acknowledged' } : e))
      );
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 gap-2">
        <Icon name="hourglass_empty" size={20} className="animate-spin" />
        加载中...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Rules section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-800">预警规则</h3>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-[#007AFF] rounded-lg hover:bg-[#007AFF]/90 transition-colors"
          >
            <Icon name="add" size={14} />
            新建规则
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">
                  资源类型
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">阈值</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">级别</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">
                  通知渠道
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">启用</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => {
                const sev = SEVERITY_BADGE[rule.severity] ?? SEVERITY_BADGE.warning;
                return (
                  <tr key={rule.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 text-gray-900">
                      {RESOURCE_LABELS[rule.resourceType] ?? rule.resourceType}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 font-mono">{rule.thresholdPct}%</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex px-2 py-0.5 text-[11px] rounded-full ${sev.cls}`}
                      >
                        {sev.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">
                      {rule.notifyChannels.join(', ') || '-'}
                    </td>
                    <td className="px-4 py-2.5">
                      <ToggleSwitch checked={rule.enabled} onChange={() => handleToggle(rule)} />
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Icon name="delete" size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rules.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                    暂无预警规则，点击上方按钮创建
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Events section */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">告警事件</h3>
        <div className="space-y-2">
          {events.map((event) => {
            const statusMeta = EVENT_STATUS_BADGE[event.status] ?? EVENT_STATUS_BADGE.active;
            const sevMeta = SEVERITY_BADGE[event.severity] ?? SEVERITY_BADGE.warning;
            return (
              <div
                key={event.id}
                className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl"
              >
                <Icon
                  name={event.severity === 'critical' ? 'error' : 'warning'}
                  size={18}
                  className={event.severity === 'critical' ? 'text-red-500' : 'text-orange-500'}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {RESOURCE_LABELS[event.resourceType] ?? event.resourceType}
                    </span>
                    <span
                      className={`inline-flex px-1.5 py-0.5 text-[10px] rounded-full ${sevMeta.cls}`}
                    >
                      {sevMeta.label}
                    </span>
                    <span
                      className={`inline-flex px-1.5 py-0.5 text-[10px] rounded-full ${statusMeta.cls}`}
                    >
                      {statusMeta.label}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    当前 {event.currentPct}% · 阈值 {event.thresholdPct}% ·{' '}
                    {new Date(event.triggeredAt).toLocaleString('zh-CN')}
                  </div>
                </div>
                {event.status === 'active' && (
                  <button
                    onClick={() => handleAck(event.id)}
                    className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    确认
                  </button>
                )}
              </div>
            );
          })}
          {events.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">暂无告警事件</div>
          )}
        </div>
      </div>

      {/* Create Rule Modal */}
      <CreateRuleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(rule) => {
          setRules((prev) => [...prev, rule]);
          setModalOpen(false);
        }}
      />
    </div>
  );
}

function CreateRuleModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (rule: QuotaAlertRule) => void;
}) {
  const [resourceType, setResourceType] = useState('instance_count');
  const [thresholdPct, setThresholdPct] = useState(80);
  const [severity, setSeverity] = useState('warning');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const res = await quotaApi.createRule({
        resourceType,
        thresholdPct,
        severity,
        notifyChannels: ['in_app'],
      });
      onCreated(res.data);
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="新建预警规则" width="max-w-sm">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">资源类型</label>
          <select
            value={resourceType}
            onChange={(e) => setResourceType(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20"
          >
            {Object.entries(RESOURCE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">阈值 (%)</label>
          <input
            type="number"
            min={1}
            max={100}
            value={thresholdPct}
            onChange={(e) => setThresholdPct(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">严重级别</label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20"
          >
            <option value="warning">警告</option>
            <option value="critical">严重</option>
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm text-white bg-[#007AFF] rounded-lg hover:bg-[#007AFF]/90 disabled:opacity-50 transition-colors"
          >
            {saving ? '保存中...' : '创建'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
