import { useState, useEffect, useCallback } from 'react';
import {
  employeeMemoryApi,
  type MemoryStore,
  type MemoryFragment,
} from '../../../../application/services/adminApi';
import { useToastStore } from '../../../../application/stores/toastStore';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { Icon } from '../../../components/ui/Icon';

const ORG_USER_ID = '__org__';

interface Props {
  store: MemoryStore;
  scope: 'org' | 'personal';
  onStoreChange: () => void;
}

const TYPE_OPTIONS = [
  { value: 'preference', label: '画像', icon: 'auto_awesome', cls: 'bg-amber-50 text-amber-700' },
  { value: 'fact', label: '规则', icon: 'gavel', cls: 'bg-blue-50 text-blue-700' },
] as const;

/** 共享记忆不含画像，仅保留 fact */
const ORG_TYPE_OPTIONS = TYPE_OPTIONS.filter((t) => t.value !== 'preference');

function typeOf(v: string) {
  return TYPE_OPTIONS.find((t) => t.value === v) ?? TYPE_OPTIONS[1];
}

const SOURCE_LABEL: Record<string, string> = {
  auto_extracted: '观察',
  manual: '声明',
  rule_generated: '规则生成',
};

const SOURCE_CLS: Record<string, string> = {
  auto_extracted: 'text-sky-600',
  manual: 'text-amber-600',
  rule_generated: 'text-violet-600',
};

function orgSourceLabel(frag: MemoryFragment): { label: string; cls: string; icon: string } {
  const isConsensus = frag.metadata?.consensus === true;
  if (isConsensus) {
    const n = typeof frag.metadata?.sourceUserCount === 'number' ? frag.metadata.sourceUserCount : null;
    return { label: n ? `从 ${n} 位用户提取` : '共识提取', cls: 'bg-emerald-50 text-emerald-700', icon: 'groups' };
  }
  return { label: '管理员补充', cls: 'bg-blue-50 text-blue-700', icon: 'admin_panel_settings' };
}

/* 紧凑筛选控件样式 */
const sCls = 'px-2 py-1 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#007AFF]/30 focus:border-[#007AFF]';

export function MemoryFragmentList({ store, scope, onStoreChange }: Props) {
  const [fragments, setFragments] = useState<MemoryFragment[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [keywordFilter, setKeywordFilter] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ userId: '', type: 'preference', content: '' });
  const [addLoading, setAddLoading] = useState(false);

  const [supplementOpen, setSupplementOpen] = useState(false);
  const [supplementForm, setSupplementForm] = useState({ type: 'fact', content: '' });
  const [supplementLoading, setSupplementLoading] = useState(false);

  /* Delete confirm */
  const [deleteTarget, setDeleteTarget] = useState<MemoryFragment | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadFragments = useCallback(async () => {
    setLoading(true);
    try {
      const list = await employeeMemoryApi.listFragments(store.id, {
        scope,
        type: typeFilter || undefined,
        keyword: keywordFilter || undefined,
        ...(scope === 'personal' && userIdFilter ? { userId: userIdFilter } : {}),
      });
      setFragments(Array.isArray(list) ? list : []);
    } catch { setFragments([]); }
    finally { setLoading(false); }
  }, [store.id, scope, typeFilter, keywordFilter, userIdFilter]);

  useEffect(() => { loadFragments(); }, [loadFragments]);

  const handleAdd = async () => {
    if (!addForm.userId.trim() || !addForm.content.trim()) {
      useToastStore.getState().addToast('请填写用户ID和内容', 'info');
      return;
    }
    setAddLoading(true);
    try {
      await employeeMemoryApi.addFragment(store.id, {
        userId: addForm.userId.trim(),
        type: addForm.type,
        content: addForm.content.trim(),
      });
      useToastStore.getState().addToast('记忆已添加', 'success');
      setAddOpen(false);
      setAddForm({ userId: '', type: 'preference', content: '' });
      loadFragments();
      onStoreChange();
    } catch (err) {
      useToastStore.getState().addToast(`添加失败：${err instanceof Error ? err.message : '未知'}`, 'error');
    } finally { setAddLoading(false); }
  };

  const handleSupplement = async () => {
    if (!supplementForm.content.trim()) {
      useToastStore.getState().addToast('请填写内容', 'info');
      return;
    }
    setSupplementLoading(true);
    try {
      await employeeMemoryApi.addFragment(store.id, {
        userId: ORG_USER_ID,
        type: supplementForm.type,
        content: supplementForm.content.trim(),
        source: 'manual',
      });
      useToastStore.getState().addToast('共享记忆已补充', 'success');
      setSupplementOpen(false);
      setSupplementForm({ type: 'fact', content: '' });
      loadFragments();
      onStoreChange();
    } catch (err) {
      useToastStore.getState().addToast(`补充失败：${err instanceof Error ? err.message : '未知'}`, 'error');
    } finally { setSupplementLoading(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await employeeMemoryApi.deleteFragment(store.id, deleteTarget.id);
      useToastStore.getState().addToast('记忆已删除', 'success');
      setDeleteTarget(null);
      loadFragments();
      onStoreChange();
    } catch (err) {
      useToastStore.getState().addToast(`删除失败：${err instanceof Error ? err.message : '未知'}`, 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const distinctUsers = [...new Set(fragments.map((f) => f.userId))];
  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]';

  /* ─── Shared scope ─── */
  if (scope === 'org') {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-50/40 border border-blue-100">
          <Icon name="info" size={14} className="text-blue-500 mt-0.5 shrink-0" />
          <div className="text-[11px] text-blue-700 leading-relaxed">
            共享记忆从各用户的个人记忆中自动提取并脱敏，作为该数字员工的通用记忆。可手动补充或删除。
          </div>
        </div>

        {/* Inline filter: type pills + search icon button */}
        <div className="flex items-center gap-1.5">
          {['', ...ORG_TYPE_OPTIONS.map((t) => t.value)].map((v) => {
            const t = v ? typeOf(v) : null;
            return (
              <button
                key={v}
                onClick={() => setTypeFilter(v)}
                className={`px-2 py-0.5 text-[11px] rounded-full transition-colors ${
                  typeFilter === v
                    ? 'bg-[#007AFF] text-white font-medium'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {t ? t.label : '全部'}
              </button>
            );
          })}
          <div className="relative ml-1">
            <Icon name="search" size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text" value={keywordFilter} onChange={(e) => setKeywordFilter(e.target.value)}
              placeholder="搜索"
              className={`${sCls} w-28 pl-6`}
            />
          </div>
          <button onClick={loadFragments} className="p-1 text-gray-400 hover:text-[#007AFF] transition-colors"><Icon name="refresh" size={14} /></button>
          <span className="text-[11px] text-gray-400 ml-auto">{fragments.length} 条</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-24 text-gray-400 text-xs">加载中...</div>
        ) : fragments.length === 0 ? (
          <div className="text-[11px] text-gray-400 py-6 text-center border border-dashed border-gray-200 rounded-lg">
            暂无共享记忆。当个人记忆积累后，系统将自动提取共识并脱敏展示。
          </div>
        ) : (() => {
          const visibleFrags = fragments.filter((f) => f.type !== 'preference');
          return visibleFrags.length === 0 ? (
            <div className="text-[11px] text-gray-400 py-6 text-center border border-dashed border-gray-200 rounded-lg">
              暂无共享记忆。当个人记忆积累后，系统将自动提取共识并脱敏展示。
            </div>
          ) : (
            <div className="space-y-1.5">
              {visibleFrags.map((frag) => {
                const src = orgSourceLabel(frag);
                const t = typeOf(frag.type);
                return (
                  <div key={frag.id} className="group px-3 py-2 rounded-lg border border-gray-100 bg-white hover:border-gray-200 transition-colors">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-full ${t.cls}`}>
                        <Icon name={t.icon} size={10} />{t.label}
                      </span>
                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-full ${src.cls}`}>
                        <Icon name={src.icon} size={9} />{src.label}
                      </span>
                      <span className="ml-auto text-[10px] text-gray-400">{new Date(frag.updatedAt).toLocaleDateString('zh-CN')}</span>
                      <button onClick={() => setDeleteTarget(frag)} className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 text-[10px] border border-red-200 text-red-500 rounded hover:bg-red-50 transition-all">删除</button>
                    </div>
                    <div className="text-xs text-gray-700 leading-relaxed">{frag.content}</div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        <div className="flex justify-center pt-1">
          <button onClick={() => setSupplementOpen(true)} className="px-3 py-1.5 text-[11px] font-medium text-[#007AFF] border border-[#007AFF]/20 rounded-lg hover:bg-[#007AFF]/5 transition-colors flex items-center gap-1">
            <Icon name="add" size={12} />手动补充共享记忆
          </button>
        </div>

        {/* Delete confirm — shared */}
        <ConfirmModal
          open={!!deleteTarget && scope === 'org'}
          title="确认删除共享记忆"
          message={`删除共享记忆「${deleteTarget?.content?.slice(0, 30) || ''}${(deleteTarget?.content?.length ?? 0) > 30 ? '...' : ''}」，所有用户将不再看到此记忆。此操作不可撤销。`}
          danger
          loading={deleteLoading}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />

        <Modal open={supplementOpen} onClose={() => setSupplementOpen(false)} title="手动补充共享记忆" width="max-w-md">
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50/40 border border-blue-100 text-xs text-blue-700">
              <Icon name="info" size={14} className="shrink-0" />
              补充的记忆将对所有用户可见，作为该数字员工的通用共享记忆
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">类型</label>
              <select value={supplementForm.type} onChange={(e) => setSupplementForm({ ...supplementForm, type: e.target.value })} className={inputCls}>
                {ORG_TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">内容 *</label>
              <textarea value={supplementForm.content} onChange={(e) => setSupplementForm({ ...supplementForm, content: e.target.value })} placeholder="共享记忆内容..." rows={3} className={`${inputCls} resize-none`} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setSupplementOpen(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">取消</button>
              <button onClick={handleSupplement} disabled={supplementLoading} className="px-4 py-2 text-sm font-medium text-white bg-[#007AFF] rounded-lg hover:bg-[#0066DD] disabled:opacity-50">
                {supplementLoading ? '添加中...' : '补充'}
              </button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  /* ─── Personal scope ─── */
  return (
    <div className="space-y-3">
      {/* Inline filter: type pills + user + search */}
      <div className="flex items-center gap-1.5">
        {['', ...TYPE_OPTIONS.map((t) => t.value)].map((v) => {
          const t = v ? typeOf(v) : null;
          return (
            <button
              key={v}
              onClick={() => setTypeFilter(v)}
              className={`px-2 py-0.5 text-[11px] rounded-full transition-colors ${
                typeFilter === v
                  ? 'bg-[#007AFF] text-white font-medium'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {t ? t.label : '全部'}
            </button>
          );
        })}
        <div className="relative ml-1">
          <Icon name="person" size={11} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" value={userIdFilter} onChange={(e) => setUserIdFilter(e.target.value)}
            placeholder="用户"
            className={`${sCls} w-20 pl-5`}
          />
        </div>
        <div className="relative">
          <Icon name="search" size={11} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" value={keywordFilter} onChange={(e) => setKeywordFilter(e.target.value)}
            placeholder="搜索"
            className={`${sCls} w-20 pl-5`}
          />
        </div>
        <button onClick={loadFragments} className="p-1 text-gray-400 hover:text-[#007AFF] transition-colors"><Icon name="refresh" size={14} /></button>
        <span className="text-[11px] text-gray-400">{fragments.length} 条 · {distinctUsers.length} 用户</span>
        <div className="flex-1" />
        <button onClick={() => setAddOpen(true)} className="px-2.5 py-1 text-[11px] font-medium text-white bg-[#007AFF] rounded-md hover:bg-[#0066DD] transition-colors flex items-center gap-1">
          <Icon name="add" size={12} />添加
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-24 text-gray-400 text-xs">加载中...</div>
      ) : fragments.length === 0 ? (
        <div className="text-[11px] text-gray-400 py-6 text-center border border-dashed border-gray-200 rounded-lg">暂无个人记忆</div>
      ) : (
        <div className="space-y-1.5">
          {fragments.map((frag) => {
            const t = typeOf(frag.type);
            const src = SOURCE_LABEL[frag.source] || frag.source;
            const srcCls = SOURCE_CLS[frag.source] || 'text-gray-500';
            return (
              <div key={frag.id} className="group px-3 py-2 rounded-lg border border-gray-100 bg-white hover:border-gray-200 transition-colors">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-full ${t.cls}`}>
                    <Icon name={t.icon} size={10} />{t.label}
                  </span>
                  <span className="text-[11px] font-mono text-gray-500">{frag.userId}</span>
                  <span className={`text-[10px] ${srcCls}`}>· {src}</span>
                  {frag.accessCount > 0 && <span className="text-[10px] text-gray-400">· 命中{frag.accessCount}</span>}
                  <span className="ml-auto text-[10px] text-gray-400">{new Date(frag.updatedAt).toLocaleDateString('zh-CN')}</span>
                  <button onClick={() => setDeleteTarget(frag)} className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 text-[10px] border border-red-200 text-red-500 rounded hover:bg-red-50 transition-all">删除</button>
                </div>
                <div className="text-xs text-gray-700 leading-relaxed">{frag.content}</div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="添加记忆" width="max-w-lg">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">用户ID *</label>
            <input type="text" value={addForm.userId} onChange={(e) => setAddForm({ ...addForm, userId: e.target.value })} placeholder="例：user_xxx" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">类型</label>
            <select value={addForm.type} onChange={(e) => setAddForm({ ...addForm, type: e.target.value })} className={inputCls}>
              {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">内容 *</label>
            <textarea value={addForm.content} onChange={(e) => setAddForm({ ...addForm, content: e.target.value })} placeholder="记忆内容..." rows={3} className={`${inputCls} resize-none`} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setAddOpen(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">取消</button>
            <button onClick={handleAdd} disabled={addLoading} className="px-4 py-2 text-sm font-medium text-white bg-[#007AFF] rounded-lg hover:bg-[#0066DD] disabled:opacity-50">
              {addLoading ? '添加中...' : '添加'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm — personal */}
      <ConfirmModal
        open={!!deleteTarget && scope === 'personal'}
        title="确认删除记忆"
        message={`删除用户「${deleteTarget?.userId || ''}」的记忆「${deleteTarget?.content?.slice(0, 30) || ''}${(deleteTarget?.content?.length ?? 0) > 30 ? '...' : ''}」，此操作不可撤销。`}
        danger
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
