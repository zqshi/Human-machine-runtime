import { useState, useEffect, useCallback } from 'react';
import {
  employeeMemoryApi,
  type MemoryStore,
} from '../../../application/services/adminApi';
import { useToastStore } from '../../../application/stores/toastStore';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Icon } from '../../components/ui/Icon';

interface Props {
  employeeId: string;
  employeeName: string;
}

type CloseMode = null | 'empty' | 'withData';

/**
 * 员工详情页记忆库状态区（F-03 展示 + F-05 启停）。
 * 记忆库是数字员工的附属产物，其生命周期（启用/关闭/归档）在此控制，
 * 记忆库管理页不再提供删除入口。
 *
 * 状态机：不存在 →[启用]→ active →[关闭-保留]→ archived →[启用]→ active
 *        active →[关闭-删除 / 空库关闭]→ 不存在（不可逆）
 */
export function EmployeeMemoryStatus({ employeeId, employeeName }: Props) {
  const [store, setStore] = useState<MemoryStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [closeMode, setCloseMode] = useState<CloseMode>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await employeeMemoryApi.listStores(undefined, employeeId);
      setStore(Array.isArray(list) && list.length > 0 ? list[0] : null);
    } catch {
      setStore(null);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    if (employeeId) load();
    else setLoading(false);
  }, [load, employeeId]);

  const isActive = store?.status === 'active';
  const isArchived = store?.status === 'archived';
  const personalCount = store?.personalFragmentCount ?? 0;
  const sharedCount = store?.orgFragmentCount ?? 0;
  const userCount = store?.totalProfiles ?? 0;
  const hasData = (store?.totalFragments ?? 0) > 0;

  const handleEnable = async () => {
    setBusy(true);
    try {
      if (isArchived && store) {
        await employeeMemoryApi.restoreStore(store.id);
        useToastStore.getState().addToast('记忆库已恢复，已有记忆可继续检索', 'success');
      } else {
        await employeeMemoryApi.createStore({
          instanceId: employeeId,
          name: `${employeeName} 记忆库`,
          description: `${employeeName} 的用户粒度记忆库`,
        });
        useToastStore.getState().addToast('记忆库已启用', 'success');
      }
      await load();
    } catch (err) {
      useToastStore.getState().addToast(`启用失败：${err instanceof Error ? err.message : '未知错误'}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleClose = async (mode: 'archive' | 'delete') => {
    if (!store) return;
    setBusy(true);
    try {
      if (mode === 'archive') {
        await employeeMemoryApi.archiveStore(store.id);
        useToastStore.getState().addToast('记忆库已归档，Agent 不再检索，数据已保留', 'success');
      } else {
        await employeeMemoryApi.deleteStore(store.id);
        useToastStore.getState().addToast('记忆库及记忆数据已删除', 'success');
      }
      await load();
      setCloseMode(null);
    } catch (err) {
      useToastStore.getState().addToast(`操作失败：${err instanceof Error ? err.message : '未知错误'}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  /* ─── 状态行渲染 ─── */
  const renderStatus = () => {
    if (loading) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />加载中…
        </span>
      );
    }
    if (!store) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />未启用
        </span>
      );
    }
    if (isActive) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-green-600">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          已启用 · 个人 {personalCount} 条 · 共享 {sharedCount} 条
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-600">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        已禁用（已归档）· 保留 {personalCount + sharedCount} 条
      </span>
    );
  };

  /* ─── 操作按钮 ─── */
  const renderAction = () => {
    if (loading) return null;
    if (isActive) {
      return (
        <button
          onClick={() => setCloseMode(hasData ? 'withData' : 'empty')}
          disabled={busy}
          className="px-2.5 py-1 text-[11px] border border-gray-200 text-gray-600 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-40"
        >
          关闭记忆库
        </button>
      );
    }
    return (
      <button
        onClick={handleEnable}
        disabled={busy}
        className="px-2.5 py-1 text-[11px] font-medium text-white bg-[#007AFF] rounded-md hover:bg-[#0066DD] transition-colors disabled:opacity-40"
      >
        启用记忆库
      </button>
    );
  };

  return (
    <div>
      <div className="text-[11px] text-gray-400 mb-1">记忆库</div>
      <div className="flex items-center justify-between gap-2">
        {renderStatus()}
        {renderAction()}
      </div>

      {/* 关闭-空库：直接确认删除 */}
      <ConfirmModal
        open={closeMode === 'empty'}
        title="关闭记忆库"
        message="当前无记忆数据，关闭后将不再为用户存储记忆，且空记忆库将被删除。"
        danger
        loading={busy}
        onConfirm={() => handleClose('delete')}
        onCancel={() => setCloseMode(null)}
      />

      {/* 关闭-有数据：选择保留（归档）或删除 */}
      <Modal open={closeMode === 'withData'} onClose={() => setCloseMode(null)} title="关闭记忆库" width="max-w-md">
        <div className="space-y-3">
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50/60 border border-amber-100">
            <Icon name="warning" size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <div className="text-[11px] text-amber-700 leading-relaxed">
              该记忆库当前包含 <b>{personalCount}</b> 条个人记忆、<b>{sharedCount}</b> 条共享记忆，覆盖 <b>{userCount}</b> 个用户。请选择处理方式：
            </div>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => handleClose('archive')}
              disabled={busy}
              className="w-full flex items-start gap-2 p-3 text-left border border-gray-200 rounded-lg hover:border-[#007AFF]/40 hover:bg-[#007AFF]/5 transition-colors disabled:opacity-40"
            >
              <Icon name="inventory_2" size={16} className="text-gray-500 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-gray-800">保留记忆库（归档）</div>
                <div className="text-[11px] text-gray-500 mt-0.5">记忆数据保留，Agent 不再检索，后续可重新启用恢复</div>
              </div>
            </button>
            <button
              onClick={() => handleClose('delete')}
              disabled={busy}
              className="w-full flex items-start gap-2 p-3 text-left border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40"
            >
              <Icon name="delete_forever" size={16} className="text-red-500 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-red-600">删除记忆库</div>
                <div className="text-[11px] text-gray-500 mt-0.5">所有记忆数据永久删除，不可恢复；后续重新启用将创建空库</div>
              </div>
            </button>
          </div>
          <div className="flex justify-end pt-1">
            <button onClick={() => setCloseMode(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
              取消
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
