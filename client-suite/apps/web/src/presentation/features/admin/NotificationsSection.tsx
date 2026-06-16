import { useState, useEffect, useCallback, useMemo } from 'react';
import { adminNotificationApi } from '../../../application/services/adminApi';
import { StatCard } from '../../components/ui/StatCard';
import { Drawer } from '../../components/ui/Drawer';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Icon } from '../../components/ui/Icon';

const SEVERITY_BADGE: Record<string, string> = {
  high: 'bg-red-50 text-red-700',
  medium: 'bg-yellow-50 text-yellow-700',
  low: 'bg-blue-50 text-blue-700',
};

interface PushChannel {
  id: string;
  type: string;
  name: string;
  url: string;
  enabled: boolean;
}

const DISMISSED_KEY = 'dcf_dismissed_notifications';
const SNOOZED_KEY = 'dcf_snoozed_notifications';

function getDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]'));
  } catch {
    return new Set();
  }
}
function getSnoozed(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SNOOZED_KEY) || '{}');
  } catch {
    return {};
  }
}

export function NotificationsSection() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'dismissed' | 'escalated' | 'channels'>('pending');
  const [dismissed, setDismissed] = useState<Set<string>>(getDismissed);
  const [snoozed, setSnoozed] = useState<Record<string, number>>(getSnoozed);
  const [escalated, setEscalated] = useState<Set<string>>(new Set());
  const [channels, setChannels] = useState<PushChannel[]>([]);
  const [channelDrawer, setChannelDrawer] = useState(false);
  const [editChannel, setEditChannel] = useState<PushChannel | null>(null);
  const [deleteChannelId, setDeleteChannelId] = useState<string | null>(null);

  // 拉取数据（不含 setLoading，供 effect 使用）
  const fetchData = useCallback(() => {
    Promise.all([adminNotificationApi.list(), adminNotificationApi.listPushChannels()])
      .then(([r, ch]) => {
        setItems(r.items || []);
        setChannels((ch.channels || []) as unknown as PushChannel[]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // 供手动刷新用（带 loading 态）
  const load = useCallback(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  useEffect(fetchData, [fetchData]);

  const [now] = useState(Date.now);
  const activeSnoozed = Object.fromEntries(Object.entries(snoozed).filter(([, t]) => t > now));

  const pending = items.filter(
    (n) =>
      !dismissed.has(String(n.id)) && !escalated.has(String(n.id)) && !activeSnoozed[String(n.id)]
  );
  const dismissedItems = items.filter((n) => dismissed.has(String(n.id)));
  const escalatedItems = items.filter((n) => escalated.has(String(n.id)));

  const dismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
    adminNotificationApi.dismiss(id).catch(() => {});
  };

  const snooze = (id: string, hours: number) => {
    const next = { ...snoozed, [id]: Date.now() + hours * 3600_000 };
    setSnoozed(next);
    localStorage.setItem(SNOOZED_KEY, JSON.stringify(next));
    adminNotificationApi.snooze(id, hours).catch(() => {});
  };

  const escalate = (id: string) => {
    setEscalated((prev) => new Set([...prev, id]));
    adminNotificationApi.escalate(id).catch(() => {});
  };

  const restore = (id: string) => {
    const next = new Set(dismissed);
    next.delete(id);
    setDismissed(next);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
    setEscalated((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  };

  const deleteChannel = async () => {
    if (!deleteChannelId) return;
    try {
      await adminNotificationApi.deletePushChannel(deleteChannelId);
      load();
    } catch { /* intentionally ignored */ }
    setDeleteChannelId(null);
  };

  const testChannel = async (id: string) => {
    try {
      const r = await adminNotificationApi.testPushChannel(id);
      alert(r.success ? '推送成功' : `失败: ${r.message || '未知'}`);
    } catch {
      alert('测试失败');
    }
  };

  const stats = {
    pending: pending.length,
    high: pending.filter((n) => n.severity === 'high').length,
    medium: pending.filter((n) => n.severity === 'medium').length,
    low: pending.filter((n) => n.severity === 'low').length,
  };

  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="待处理" value={stats.pending} icon="notifications" />
        <StatCard label="高危" value={stats.high} icon="error" color="#FF3B30" />
        <StatCard label="中危" value={stats.medium} icon="warning" color="#FF9500" />
        <StatCard label="低危" value={stats.low} icon="info" color="#007AFF" />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {(
            [
              ['pending', '待处理'],
              ['dismissed', '已关闭'],
              ['escalated', '已升级'],
              ['channels', '推送渠道'],
            ] as [string, string][]
          ).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k as typeof tab)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${tab === k ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
            >
              {l}
            </button>
          ))}
        </div>
        <button onClick={load} className="p-1.5 text-gray-400 hover:text-[#007AFF]" title="刷新">
          <Icon name="refresh" size={16} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">加载中...</div>
      ) : tab === 'channels' ? (
        <ChannelsTab
          channels={channels}
          onAdd={() => {
            setEditChannel(null);
            setChannelDrawer(true);
          }}
          onEdit={(ch) => {
            setEditChannel(ch);
            setChannelDrawer(true);
          }}
          onDelete={(id) => setDeleteChannelId(id)}
          onTest={testChannel}
        />
      ) : (
        <NotificationList
          items={
            tab === 'pending' ? pending : tab === 'dismissed' ? dismissedItems : escalatedItems
          }
          mode={tab}
          onDismiss={dismiss}
          onSnooze={snooze}
          onEscalate={escalate}
          onRestore={restore}
        />
      )}

      {channelDrawer && (
        <ChannelEditor
          channel={editChannel}
          onClose={() => setChannelDrawer(false)}
          onSaved={() => {
            setChannelDrawer(false);
            load();
          }}
        />
      )}

      <ConfirmModal
        open={!!deleteChannelId}
        title="删除推送渠道"
        message="确定删除该推送渠道？"
        danger
        onConfirm={deleteChannel}
        onCancel={() => setDeleteChannelId(null)}
      />
    </div>
  );
}

function NotificationList({
  items,
  mode,
  onDismiss,
  onSnooze,
  onEscalate,
  onRestore,
}: {
  items: Record<string, unknown>[];
  mode: string;
  onDismiss: (id: string) => void;
  onSnooze: (id: string, h: number) => void;
  onEscalate: (id: string) => void;
  onRestore: (id: string) => void;
}) {
  if (items.length === 0)
    return <div className="py-8 text-center text-gray-400 text-sm">暂无通知</div>;
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={String(item.id)} className="border border-gray-200 rounded-xl p-4 bg-white">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {item.severity ? (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${SEVERITY_BADGE[String(item.severity)] || 'bg-gray-100 text-gray-500'}`}
                  >
                    {String(item.severity)}
                  </span>
                ) : null}
                <h3 className="text-sm font-medium text-gray-800">{String(item.title || '—')}</h3>
              </div>
              <p className="text-xs text-gray-500">{String(item.body || '')}</p>
              <span className="text-xs text-gray-400 mt-1 block">
                {String(item.createdAt || '')}
              </span>
            </div>
            {mode === 'pending' && (
              <div className="flex items-center gap-1 ml-3">
                <button
                  onClick={() => onDismiss(String(item.id))}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  title="关闭"
                >
                  <Icon name="close" size={16} />
                </button>
                <button
                  onClick={() => onSnooze(String(item.id), 1)}
                  className="p-1 text-gray-400 hover:text-yellow-600"
                  title="延后1h"
                >
                  <Icon name="snooze" size={16} />
                </button>
                <button
                  onClick={() => onEscalate(String(item.id))}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="升级"
                >
                  <Icon name="priority_high" size={16} />
                </button>
              </div>
            )}
            {(mode === 'dismissed' || mode === 'escalated') && (
              <button
                onClick={() => onRestore(String(item.id))}
                className="text-xs text-[#007AFF] hover:underline"
              >
                恢复
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ChannelsTab({
  channels,
  onAdd,
  onEdit,
  onDelete,
  onTest,
}: {
  channels: PushChannel[];
  onAdd: () => void;
  onEdit: (ch: PushChannel) => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={onAdd}
          className="px-3 py-1.5 text-xs bg-[#007AFF] text-white rounded-lg hover:bg-[#0066DD]"
        >
          <Icon name="add" size={14} className="mr-1 align-[-2px]" />
          新建渠道
        </button>
      </div>
      {channels.length === 0 ? (
        <div className="py-8 text-center text-gray-400 text-sm">暂无推送渠道</div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">名称</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">类型</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">启用</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((ch) => (
                <tr key={ch.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-800">{ch.name}</td>
                  <td className="px-4 py-2.5 text-gray-600">{ch.type}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${ch.enabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {ch.enabled ? '是' : '否'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onTest(ch.id)}
                        className="p-1 text-gray-400 hover:text-green-600"
                        title="测试"
                      >
                        <Icon name="send" size={16} />
                      </button>
                      <button
                        onClick={() => onEdit(ch)}
                        className="p-1 text-gray-400 hover:text-[#007AFF]"
                        title="编辑"
                      >
                        <Icon name="edit" size={16} />
                      </button>
                      <button
                        onClick={() => onDelete(ch.id)}
                        className="p-1 text-gray-400 hover:text-red-500"
                        title="删除"
                      >
                        <Icon name="delete" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ChannelEditor({
  channel,
  onClose,
  onSaved,
}: {
  channel: PushChannel | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  // 根据 channel prop 派生初始表单值（渲染阶段计算，避免 useEffect 中 setState）
  const derivedForm = useMemo(
    () =>
      channel
        ? { type: channel.type, name: channel.name, url: channel.url, enabled: channel.enabled }
        : { type: 'webhook', name: '', url: '', enabled: true },
    [channel]
  );
  const [form, setForm] = useState(derivedForm);
  const [prevChannel, setPrevChannel] = useState(channel);
  if (channel !== prevChannel) {
    setPrevChannel(channel);
    setForm(derivedForm);
  }
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name || !form.url) return;
    setSaving(true);
    try {
      await adminNotificationApi.savePushChannel(channel ? { ...form, id: channel.id } : form);
      onSaved();
    } catch {
      /* ignore */
    }
    setSaving(false);
  };

  return (
    <Drawer open onClose={onClose} title={channel ? '编辑推送渠道' : '新建推送渠道'}>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-500 block mb-0.5">类型</label>
          <select
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
          >
            <option value="webhook">Webhook</option>
            <option value="dingtalk">钉钉</option>
            <option value="wecom">企微</option>
            <option value="slack">Slack</option>
            <option value="email">Email</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-0.5">名称</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-0.5">URL</label>
          <input
            type="text"
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg font-mono"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
            className="rounded border-gray-300"
          />
          启用
        </label>
        <button
          onClick={save}
          disabled={saving}
          className="w-full py-2 text-sm bg-[#007AFF] text-white rounded-lg hover:bg-[#0066DD] disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </Drawer>
  );
}
