/**
 * CredentialLeasesTab — lease 列表 + status 过滤 + 吊销。
 *
 * lease 签发 redeem 后端未实现（service 注释），admin 手动签发的 lease 当前无消费方；
 * 此 tab 提供只读列表 + 紧急吊销能力。
 */
import { useState, useEffect, useCallback } from 'react';
import {
  credentialManagementApi,
  type CredentialLease,
} from '../../../infrastructure/api/credentialManagementApi';
import { useToastStore } from '../../../application/stores/toastStore';

const PAGE_SIZE = 20;
type StatusFilter = 'all' | 'active' | 'revoked' | 'expired';
const STATUS_OPTIONS: StatusFilter[] = ['all', 'active', 'revoked', 'expired'];

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  revoked: 'bg-gray-100 text-gray-500',
  expired: 'bg-amber-100 text-amber-700',
};

export function CredentialLeasesTab() {
  const [leases, setLeases] = useState<CredentialLease[]>([]);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const toast = useToastStore((s) => s.addToast);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await credentialManagementApi.listLeases({
        ...(status !== 'all' ? { status } : {}),
        limit: PAGE_SIZE,
        offset,
      });
      setLeases(r.leases);
    } catch (e) {
      toast(`加载 lease 失败: ${(e as Error).message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [status, offset, toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const revoke = async (leaseId: string) => {
    setRevoking(leaseId);
    try {
      await credentialManagementApi.revokeLease(leaseId);
      toast('lease 已吊销', 'success');
      await refresh();
    } catch (e) {
      toast(`吊销失败: ${(e as Error).message}`, 'error');
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as StatusFilter);
            setOffset(0);
          }}
          className="px-2 py-1 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? '全部状态' : s}
            </option>
          ))}
        </select>
        <button
          onClick={refresh}
          className="px-3 py-1 text-[12px] rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
        >
          刷新
        </button>
        <span className="text-[11px] text-gray-400 ml-auto">
          第 {offset + 1} - {offset + leases.length} 条
        </span>
      </div>

      {loading ? (
        <p className="text-[13px] text-gray-400">加载中...</p>
      ) : leases.length === 0 ? (
        <div className="p-8 text-center text-[13px] text-gray-400 border border-dashed border-gray-200 rounded-xl">
          暂无 lease
        </div>
      ) : (
        <div className="space-y-2">
          {leases.map((l) => (
            <div key={l.id} className="p-3 border border-gray-200 rounded-xl bg-white">
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    STATUS_COLORS[l.status] ?? 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {l.status}
                </span>
                <code className="text-[11px] text-gray-500">{l.leaseId.slice(0, 13)}…</code>
                <span className="text-[11px] text-gray-400 ml-auto">
                  {new Date(l.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="text-[11px] text-gray-500 mb-2">
                user {l.userId} · provider {l.providerId}
                {l.scope ? ` · scope ${l.scope}` : ''}
              </div>
              <div className="text-[11px] text-gray-400 mb-2">
                过期 {new Date(l.expiresAt).toLocaleString()}
                {l.revokedAt ? ` · 吊销 ${new Date(l.revokedAt).toLocaleString()}` : ''}
              </div>
              {l.status === 'active' && (
                <button
                  onClick={() => revoke(l.leaseId)}
                  disabled={revoking === l.leaseId}
                  className="px-3 py-1.5 text-[12px] rounded-lg border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  {revoking === l.leaseId ? '吊销中...' : '吊销'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          disabled={offset === 0 || loading}
          className="px-3 py-1.5 text-[12px] rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
        >
          上一页
        </button>
        <button
          onClick={() => setOffset(offset + PAGE_SIZE)}
          disabled={leases.length < PAGE_SIZE || loading}
          className="px-3 py-1.5 text-[12px] rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
        >
          下一页
        </button>
      </div>
    </div>
  );
}
