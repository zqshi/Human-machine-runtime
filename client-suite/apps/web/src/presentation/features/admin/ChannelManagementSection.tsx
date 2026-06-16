import { useState, useEffect, useCallback } from 'react';
import { channelApi } from '../../../application/services/adminApi';
import { useToastStore } from '../../../application/stores/toastStore';
import { FilterBar } from '../../components/ui/FilterBar';
import { StatCard } from '../../components/ui/StatCard';
import { Icon } from '../../components/ui/Icon';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { ChannelDrawer } from './ChannelDrawer';

export interface Channel {
  id: string;
  appId: string;
  name: string;
  ak: string;
  sk: string;
  webhookUrl: string;
  webhookEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  verified: boolean;
}

const FILTER_DEFS = [
  { key: 'keyword', label: '搜索', type: 'text' as const, placeholder: '应用ID/名称' },
];

export function ChannelManagementSection() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const fetchChannels = useCallback(() => {
    channelApi
      .list({ keyword: filters.keyword || undefined })
      .then((r) => setChannels(r.channels || []))
      .catch(() => setChannels([]))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(fetchChannels, [fetchChannels]);

  const handleCreate = () => {
    setEditingChannel(null);
    setDrawerOpen(true);
  };

  const handleEdit = (channel: Channel) => {
    setEditingChannel(channel);
    setDrawerOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeleteTarget(id);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await channelApi.delete(deleteTarget);
      fetchChannels();
    } catch {
      /* ignore */
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const handleVerify = async (id: string) => {
    setVerifyingId(id);
    try {
      const result = await channelApi.verify(id);
      if (result.success) {
        useToastStore.getState().addToast('应用验证成功', 'success');
      } else {
        useToastStore.getState().addToast(result.message || '应用验证失败', 'error');
      }
      fetchChannels();
    } catch {
      useToastStore.getState().addToast('应用验证异常，请稍后重试', 'error');
    }
    setVerifyingId(null);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setEditingChannel(null);
  };

  const handleSaveSuccess = () => {
    fetchChannels();
    handleDrawerClose();
  };

  const filtered = channels.filter((channel) => {
    if (!filters.keyword) return true;
    const keyword = filters.keyword.toLowerCase();
    return (
      channel.appId.toLowerCase().includes(keyword) || channel.name.toLowerCase().includes(keyword)
    );
  });

  const stats = {
    total: channels.length,
    verified: channels.filter((c) => c.verified).length,
    webhookEnabled: channels.filter((c) => c.webhookEnabled).length,
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Channel 管理</h2>
          <p className="text-xs text-gray-400 mt-0.5">管理渠道应用配置与订阅地址</p>
        </div>
        <button
          onClick={handleCreate}
          className="px-4 py-2 text-sm font-medium text-white bg-[#007AFF] rounded-lg hover:bg-[#0066DD] transition-colors flex items-center gap-1"
        >
          <Icon name="auto_awesome" size={16} />
          新增应用
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="应用总数" value={stats.total} icon="radio" color="#007AFF" />
        <StatCard label="已验证" value={stats.verified} icon="check_circle" color="#16A34A" />
        <StatCard label="Webhook 已启用" value={stats.webhookEnabled} icon="webhook" color="#7C3AED" />
      </div>

      <div className="flex items-center justify-between">
        <FilterBar
          filters={FILTER_DEFS}
          values={filters}
          onChange={(k, v) => setFilters((p) => ({ ...p, [k]: v }))}
          onSearch={fetchChannels}
        />
        <button
          onClick={fetchChannels}
          className="p-1.5 text-gray-400 hover:text-[#007AFF]"
          title="刷新"
        >
          <Icon name="refresh" size={16} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">加载中...</div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">应用信息</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">AK/SK</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">Webhook</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">状态</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((channel) => (
                <tr
                  key={channel.id}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-gray-800">{channel.name}</div>
                    <div className="text-xs text-gray-400">{channel.appId}</div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                        {channel.ak.slice(0, 8)}...
                      </span>
                      <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                        {channel.sk.slice(0, 8)}...
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {channel.webhookEnabled ? (
                        <>
                          <Icon name="check" size={14} className="text-green-500" />
                          <span className="text-xs text-gray-600 truncate max-w-[200px]">
                            {channel.webhookUrl}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400">未配置</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {channel.verified ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-50 text-green-700 rounded-full">
                          <Icon name="verified" size={12} />
                          已验证
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-yellow-50 text-yellow-700 rounded-full">
                          <Icon name="warning" size={12} />
                          未验证
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleVerify(channel.id)}
                        disabled={verifyingId === channel.id}
                        className={`p-1 ${
                          channel.verified
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-400 hover:text-green-500'
                        }`}
                        title="联通验证"
                      >
                        {verifyingId === channel.id ? (
                          <Icon name="refresh" size={16} className="animate-spin" />
                        ) : (
                          <Icon name="wifi" size={16} />
                        )}
                      </button>
                      <button
                        onClick={() => handleEdit(channel)}
                        className="p-1 text-gray-400 hover:text-[#007AFF]"
                        title="编辑"
                      >
                        <Icon name="edit" size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(channel.id)}
                        className="p-1 text-gray-400 hover:text-red-500"
                        title="删除"
                      >
                        <Icon name="delete" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    暂无应用配置
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ChannelDrawer
        open={drawerOpen}
        channel={editingChannel}
        onClose={handleDrawerClose}
        onSave={handleSaveSuccess}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title="删除应用配置"
        message="确定要删除该应用配置？此操作不可恢复。"
        danger
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
