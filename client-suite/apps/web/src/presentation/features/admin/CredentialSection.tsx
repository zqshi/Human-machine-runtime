/**
 * CredentialSection — credential-vault 管理面主容器。
 *
 * 凭证列表（offset 分页）+ 创建/详情/删除 + tab 切换租约管理。照 ToolApprovalsSection 模式。
 * 消费 credentialManagementApi。secrets 不回显明文（后端 listSecrets 已剔除 ciphertext）。
 */
import { useState, useEffect, useCallback } from 'react';
import {
  credentialManagementApi,
  type CredentialAuthorization,
} from '../../../infrastructure/api/credentialManagementApi';
import { useToastStore } from '../../../application/stores/toastStore';
import { CredentialCreateDrawer } from './CredentialCreateDrawer';
import { CredentialDetailDrawer } from './CredentialDetailDrawer';
import { CredentialLeasesTab } from './CredentialLeasesTab';

const PAGE_SIZE = 20;
type Tab = 'credentials' | 'leases';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  revoked: 'bg-gray-100 text-gray-500',
  expired: 'bg-amber-100 text-amber-700',
};

export function CredentialSection() {
  const [tab, setTab] = useState<Tab>('credentials');
  const [items, setItems] = useState<CredentialAuthorization[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const toast = useToastStore((s) => s.addToast);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await credentialManagementApi.listCredentials({ limit: PAGE_SIZE, offset });
      setItems(r.credentials);
    } catch (e) {
      toast(`加载凭证失败: ${(e as Error).message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [offset, toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const remove = async (id: number) => {
    setActing(id);
    try {
      await credentialManagementApi.deleteCredential(id);
      toast('凭证已删除', 'success');
      setConfirmDelete(null);
      await refresh();
    } catch (e) {
      toast(`删除失败: ${(e as Error).message}`, 'error');
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">凭证管理</h2>
          <p className="text-[12px] text-gray-500 mt-0.5">
            外部 provider 授权凭证 + 加密 secret + lease 租约（明文不回显）
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCreateOpen(true)}
            className="px-3 py-1.5 text-[12px] rounded-lg bg-[#007AFF] text-white hover:opacity-90 transition-opacity"
          >
            新建凭证
          </button>
          <button
            onClick={refresh}
            className="px-3 py-1.5 text-[12px] rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
          >
            刷新
          </button>
        </div>
      </div>

      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {[
          { key: 'credentials' as const, label: '凭证' },
          { key: 'leases' as const, label: '租约' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-[13px] -mb-px border-b-2 transition-colors ${
              tab === t.key
                ? 'border-[#007AFF] text-[#007AFF] font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'leases' ? (
        <CredentialLeasesTab />
      ) : loading ? (
        <p className="text-[13px] text-gray-400">加载中...</p>
      ) : items.length === 0 ? (
        <div className="p-8 text-center text-[13px] text-gray-400 border border-dashed border-gray-200 rounded-xl">
          暂无凭证
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {items.map((c) => (
              <div key={c.id} className="p-3 border border-gray-200 rounded-xl bg-white">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[13px] font-medium text-gray-800">#{c.id}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {c.status}
                  </span>
                  <span className="text-[11px] text-gray-400">·</span>
                  <span className="text-[11px] text-gray-500">
                    user {c.userId} · provider {c.providerId}
                  </span>
                  <span className="text-[11px] text-gray-400 ml-auto">
                    {new Date(c.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="text-[11px] text-gray-500 mb-3">
                  {c.externalAccountId ? `外部账号 ${c.externalAccountId}` : '无外部账号'}
                  {c.scope ? ` · scope ${c.scope}` : ''}
                </div>
                {confirmDelete === c.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-red-600">确认删除该凭证及关联 secret？</span>
                    <button
                      onClick={() => remove(c.id)}
                      disabled={acting === c.id}
                      className="px-3 py-1 text-[12px] rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                    >
                      {acting === c.id ? '删除中...' : '确认删除'}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      disabled={acting === c.id}
                      className="px-3 py-1 text-[12px] rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDetailId(c.id)}
                      className="px-3 py-1.5 text-[12px] rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      详情
                    </button>
                    <button
                      onClick={() => setConfirmDelete(c.id)}
                      className="px-3 py-1.5 text-[12px] rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
                    >
                      删除
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0 || loading}
              className="px-3 py-1.5 text-[12px] rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              上一页
            </button>
            <span className="text-[11px] text-gray-400">
              第 {offset + 1} - {offset + items.length} 条
            </span>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={items.length < PAGE_SIZE || loading}
              className="px-3 py-1.5 text-[12px] rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              下一页
            </button>
          </div>
        </>
      )}

      <CredentialCreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={refresh}
      />
      <CredentialDetailDrawer
        open={detailId !== null}
        credentialId={detailId}
        onClose={() => setDetailId(null)}
        onLeaseIssued={refresh}
      />
    </div>
  );
}
