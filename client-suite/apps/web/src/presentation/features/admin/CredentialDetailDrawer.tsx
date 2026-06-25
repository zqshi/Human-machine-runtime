/**
 * CredentialDetailDrawer — 凭证详情 + secrets 元数据 + 签发 lease。
 *
 * secrets 仅展示 SecretMeta 元数据（secretType/keyVersion/createdAt），后端 listSecrets 已剔除 ciphertext，无明文。
 * 签发 lease：POST /:id/leases，ttlSec 可选（空则后端用默认 TTL）。
 */
import { useState, useEffect, useCallback } from 'react';
import { Drawer } from '../../components/ui/Drawer';
import {
  credentialManagementApi,
  type CredentialDetail,
} from '../../../infrastructure/api/credentialManagementApi';
import { useToastStore } from '../../../application/stores/toastStore';

interface Props {
  open: boolean;
  credentialId: number | null;
  onClose: () => void;
  onLeaseIssued: () => void;
}

const inputCls =
  'w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <span className="text-gray-400 w-28 shrink-0">{label}</span>
      <span className="text-gray-700 break-all">{value ?? '-'}</span>
    </div>
  );
}

export function CredentialDetailDrawer({ open, credentialId, onClose, onLeaseIssued }: Props) {
  const [detail, setDetail] = useState<CredentialDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [ttlSec, setTtlSec] = useState('');
  const [issuing, setIssuing] = useState(false);
  const toast = useToastStore((s) => s.addToast);

  const load = useCallback(async () => {
    if (credentialId === null) return;
    setLoading(true);
    try {
      const d = await credentialManagementApi.getCredential(credentialId);
      setDetail(d);
    } catch (e) {
      toast(`加载详情失败: ${(e as Error).message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [credentialId, toast]);

  useEffect(() => {
    if (open && credentialId !== null) {
      setTtlSec('');
      load();
    } else {
      setDetail(null);
    }
  }, [open, credentialId, load]);

  const issueLease = async () => {
    if (credentialId === null) return;
    const ttl = ttlSec.trim() ? Number(ttlSec) : undefined;
    if (ttl !== undefined && (!Number.isInteger(ttl) || ttl <= 0)) {
      toast('ttlSec 须为正整数', 'error');
      return;
    }
    setIssuing(true);
    try {
      await credentialManagementApi.issueLease(
        credentialId,
        ttl !== undefined ? { ttlSec: ttl } : {}
      );
      toast('lease 已签发', 'success');
      setTtlSec('');
      onLeaseIssued();
    } catch (e) {
      toast(`签发失败: ${(e as Error).message}`, 'error');
    } finally {
      setIssuing(false);
    }
  };

  return (
    <Drawer open={open} onClose={onClose} title="凭证详情" width="w-[520px]">
      {loading ? (
        <p className="text-[13px] text-gray-400">加载中...</p>
      ) : detail ? (
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Field label="id" value={detail.id} />
            <Field label="userId" value={detail.userId} />
            <Field label="providerId" value={detail.providerId} />
            <Field label="externalAccountId" value={detail.externalAccountId} />
            <Field label="scope" value={detail.scope} />
            <Field label="status" value={detail.status} />
            <Field label="expiresAt" value={detail.expiresAt} />
            <Field label="createdAt" value={detail.createdAt} />
            <Field label="updatedAt" value={detail.updatedAt} />
          </div>

          <div>
            <h4 className="text-xs font-medium text-gray-500 mb-2">Secret 元数据（无明文）</h4>
            {detail.secrets.length === 0 ? (
              <p className="text-[12px] text-gray-400">无 secret 记录</p>
            ) : (
              <div className="space-y-1.5">
                {detail.secrets.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 text-[12px] px-2 py-1.5 bg-gray-50 rounded-lg"
                  >
                    <span className="font-medium text-gray-700">{s.secretType}</span>
                    <span className="text-gray-400">·</span>
                    <span className="text-gray-500">v{s.keyVersion}</span>
                    <span className="text-gray-400 ml-auto">{s.createdAt}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h4 className="text-xs font-medium text-gray-500 mb-2">签发 lease</h4>
            <div className="flex gap-2">
              <input
                type="number"
                value={ttlSec}
                onChange={(e) => setTtlSec(e.target.value)}
                className={inputCls}
                placeholder="ttlSec（秒，留空用默认）"
              />
              <button
                onClick={issueLease}
                disabled={issuing}
                className="px-4 py-1.5 text-[12px] rounded-lg bg-[#007AFF] text-white hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0"
              >
                {issuing ? '签发中...' : '签发'}
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">
              lease redeem 后端尚未实现，手动签发的 lease 当前无消费方。
            </p>
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-gray-400">无数据</p>
      )}
    </Drawer>
  );
}
