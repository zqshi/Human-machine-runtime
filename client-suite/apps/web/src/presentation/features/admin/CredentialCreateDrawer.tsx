/**
 * CredentialCreateDrawer — 新建凭证（授权记录 + 加密 secret）。
 *
 * 安全约束：plaintext 用 password 输入，提交成功后清空 + 关抽屉，不回显不存前端（后端只返回 {id}）。
 * userId/providerId 用 number input（无现成 providers/users list API，范围界定见 plan）。
 */
import { useState } from 'react';
import { Drawer } from '../../components/ui/Drawer';
import { credentialManagementApi } from '../../../infrastructure/api/credentialManagementApi';
import { useToastStore } from '../../../application/stores/toastStore';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const SECRET_TYPES = ['password', 'token', 'apiKey', 'secret'];

const inputCls =
  'w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20';

export function CredentialCreateDrawer({ open, onClose, onCreated }: Props) {
  const [userId, setUserId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [externalAccountId, setExternalAccountId] = useState('');
  const [scope, setScope] = useState('');
  const [secretType, setSecretType] = useState('password');
  const [plaintext, setPlaintext] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToastStore((s) => s.addToast);

  // 抽屉重新打开时重置表单（prevKey 模式，渲染阶段 setState，规避 set-state-in-effect）
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setUserId('');
      setProviderId('');
      setExternalAccountId('');
      setScope('');
      setSecretType('password');
      setPlaintext('');
      setError('');
    }
  }

  const save = async () => {
    const uid = Number(userId);
    const pid = Number(providerId);
    if (!Number.isInteger(uid) || uid <= 0) {
      setError('userId 须为正整数');
      return;
    }
    if (!Number.isInteger(pid) || pid <= 0) {
      setError('providerId 须为正整数');
      return;
    }
    if (!secretType.trim()) {
      setError('secretType 不能为空');
      return;
    }
    if (!plaintext) {
      setError('plaintext 不能为空');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await credentialManagementApi.createCredential({
        userId: uid,
        providerId: pid,
        secretType: secretType.trim(),
        plaintext,
        ...(externalAccountId.trim() ? { externalAccountId: externalAccountId.trim() } : {}),
        ...(scope.trim() ? { scope: scope.trim() } : {}),
      });
      toast('凭证已创建', 'success');
      onCreated();
      onClose();
    } catch (e) {
      setError(String((e as Error).message || '创建失败'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open={open} onClose={onClose} title="新建凭证" width="w-[480px]">
      <div className="space-y-4">
        {error && (
          <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
        )}
        <div className="text-[11px] text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
          plaintext 提交后不回显、不存储，后端仅返回凭证 id。
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-0.5 block">userId *</label>
            <input
              type="number"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className={inputCls}
              placeholder="用户 id"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-0.5 block">providerId *</label>
            <input
              type="number"
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              className={inputCls}
              placeholder="auth_providers.id"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-0.5 block">externalAccountId</label>
          <input
            type="text"
            value={externalAccountId}
            onChange={(e) => setExternalAccountId(e.target.value)}
            className={inputCls}
            placeholder="外部账号 id（可选）"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-0.5 block">scope</label>
          <input
            type="text"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className={inputCls}
            placeholder="授权范围（可选）"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-0.5 block">secretType *</label>
          <select
            value={secretType}
            onChange={(e) => setSecretType(e.target.value)}
            className={inputCls}
          >
            {SECRET_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-0.5 block">plaintext *</label>
          <input
            type="password"
            value={plaintext}
            onChange={(e) => setPlaintext(e.target.value)}
            className={inputCls}
            placeholder="明文密钥（提交后不回显）"
            autoComplete="new-password"
          />
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full py-2 text-sm bg-[#007AFF] text-white rounded-lg hover:bg-[#0066DD] transition-colors disabled:opacity-50"
        >
          {saving ? '创建中...' : '创建凭证'}
        </button>
      </div>
    </Drawer>
  );
}
