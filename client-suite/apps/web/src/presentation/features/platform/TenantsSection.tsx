import { useState, useEffect, useCallback } from 'react';
import { tenantApi } from '../../../application/services/adminApi';
import { Drawer } from '../../components/ui/Drawer';
import { Icon } from '../../components/ui/Icon';
import {
  STATUS_COLORS,
  CAPACITY_LABELS,
  AI_LABELS,
  DATA_LABELS,
} from './tenantConstants';
import { TenantConfigOverrides } from './TenantConfigOverrides';
import { TenantEditor } from './TenantEditor';

export function TenantsSection() {
  const [tenants, setTenants] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Record<string, unknown> | null>(null);
  const [credentialsModal, setCredentialsModal] = useState<{ username: string; password: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ tenant: Record<string, unknown>; deletable: boolean; reason?: string } | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchTenants = useCallback(() => {
    return tenantApi
      .list()
      .then((r) => setTenants(r.tenants || []))
      .catch(() => setTenants([]));
  }, []);

  useEffect(() => {
    fetchTenants().finally(() => setLoading(false));
  }, [fetchTenants]);

  const load = () => {
    setLoading(true);
    fetchTenants().finally(() => setLoading(false));
  };

  const handleAction = async (id: string, action: 'suspend' | 'activate' | 'archive') => {
    await tenantApi[action](id);
    load();
  };

  const handleDeleteClick = async (tenant: Record<string, unknown>) => {
    try {
      const result = await tenantApi.checkDeletable(String(tenant.id));
      setDeleteConfirm({ tenant, ...result });
    } catch {
      showToast('error', '检查租户状态失败');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    try {
      await tenantApi.delete(String(deleteConfirm.tenant.id));
      setDeleteConfirm(null);
      showToast('success', '删除成功');
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '删除失败';
      showToast('error', msg);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">租户管理</h1>
          <p className="text-xs text-gray-400 mt-0.5">租户生命周期管理与配额分配</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditTarget(null);
              setEditorOpen(true);
            }}
            className="px-3 py-1.5 text-sm bg-[#007AFF] text-white rounded-lg hover:bg-[#0066DD] transition-colors"
          >
            <Icon name="add" size={14} className="mr-1 align-[-2px]" />
            新建租户
          </button>
          <button onClick={load} className="p-1.5 text-gray-400 hover:text-[#007AFF]" title="刷新">
            <Icon name="refresh" size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">加载中...</div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">租户</th>
                {/* 一期暂不需要套餐列 */}
                {/* <th className="text-left px-4 py-2.5 font-medium text-gray-500">套餐</th> */}
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">状态</th>
                {/* 一期暂不需要实例列 */}
                {/* <th className="text-left px-4 py-2.5 font-medium text-gray-500">实例</th> */}
                <th className="text-right px-4 py-2.5 font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr
                  key={String(t.id)}
                  className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelected(t)}
                >
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-gray-800">{String(t.name || '—')}</div>
                    <div className="text-xs text-gray-400">{String(t.slug || t.id)}</div>
                  </td>
                  {/* 一期暂不需要套餐列 */}
                  {/* <td className="px-4 py-2.5">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${PLAN_COLORS[String(t.plan)] || 'bg-gray-100 text-gray-500'}`}
                    >
                      {String(t.plan || '—')}
                    </span>
                  </td> */}
                  <td className="px-4 py-2.5">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[String(t.status)] || 'bg-gray-100 text-gray-500'}`}
                    >
                      {String(t.status || '—')}
                    </span>
                  </td>
                  {/* 一期暂不需要实例列 */}
                  {/* <td className="px-4 py-2.5 text-gray-600">
                    {String((t.quotas as Record<string, unknown>)?.maxInstances ?? '—')}
                  </td> */}
                  <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => {
                          setEditTarget(t);
                          setEditorOpen(true);
                        }}
                        className="p-1 text-gray-400 hover:text-[#007AFF]"
                        title="编辑"
                      >
                        <Icon name="edit" size={16} />
                      </button>
                      {t.status === 'active' && (
                        <button
                          onClick={() => handleAction(String(t.id), 'suspend')}
                          className="px-2 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100"
                        >
                          暂停
                        </button>
                      )}
                      {t.status === 'suspended' && (
                        <button
                          onClick={() => handleAction(String(t.id), 'activate')}
                          className="px-2 py-1 text-xs rounded bg-green-50 text-green-700 hover:bg-green-100"
                        >
                          激活
                        </button>
                      )}
                      {(t.status === 'archived' || t.status === 'suspended') && (
                        <button
                          onClick={() => handleDeleteClick(t)}
                          className="px-2 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100"
                        >
                          删除
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                    暂无租户
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 详情抽屉 */}
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? String(selected.name) : ''}
        width="w-[520px]"
      >
        {selected && (
          <div className="space-y-5">
            <section>
              <h3 className="text-xs text-gray-400 uppercase tracking-wide mb-2">基本信息</h3>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">ID</dt>
                  <dd className="text-sm font-mono">{String(selected.id)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Slug</dt>
                  <dd className="text-sm">{String(selected.slug || '—')}</dd>
                </div>
                {/* 一期暂不需要套餐 */}
                {/* <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">套餐</dt>
                  <dd className="text-sm">{String(selected.plan || '—')}</dd>
                </div> */}
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">状态</dt>
                  <dd className="text-sm">{String(selected.status || '—')}</dd>
                </div>
              </dl>
            </section>

            <section>
              <h3 className="text-xs text-gray-400 uppercase tracking-wide mb-2">公司信息</h3>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">行业</dt>
                  <dd className="text-sm">{String(selected.industry || '—')}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">公司规模</dt>
                  <dd className="text-sm">{String(selected.companySize || '—')}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">联系电话</dt>
                  <dd className="text-sm">{String(selected.contactPhone || '—')}</dd>
                </div>
                {selected.description ? (
                  <div>
                    <dt className="text-sm text-gray-500 mb-1">公司描述</dt>
                    <dd className="text-sm text-gray-700 whitespace-pre-wrap">{String(selected.description)}</dd>
                  </div>
                ) : null}
              </dl>
            </section>

            <section>
              <h3 className="text-xs text-gray-400 uppercase tracking-wide mb-2">管理员</h3>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">管理员</dt>
                  <dd className="text-sm">{String(selected.contact || '—')}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">邮箱</dt>
                  <dd className="text-sm">{String(selected.email || '—')}</dd>
                </div>
              </dl>
            </section>

            {selected.quotas != null && typeof selected.quotas === 'object'
              ? (() => {
                  const q = selected.quotas as Record<string, unknown>;
                  const used = {
                    maxInstances: Number(selected.agents) || 0,
                    maxUsers: Number(selected.users) || 0,
                  };
                  const sections: { title: string; labels: Record<string, string> }[] = [
                    { title: '容量配额', labels: CAPACITY_LABELS },
                    {
                      title: '实例资源',
                      labels: {
                        instanceCpu: 'CPU',
                        instanceMemory: '内存',
                        instanceStorage: '存储',
                      },
                    },
                    { title: 'AI 用量', labels: AI_LABELS },
                    { title: '数据策略', labels: DATA_LABELS },
                  ];
                  return (
                    <section>
                      <h3 className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                        配额与资源
                      </h3>
                      {sections.map((sec) => {
                        const entries = Object.entries(sec.labels).filter(
                          ([k]) => q[k] !== undefined
                        );
                        if (entries.length === 0) return null;
                        return (
                          <div key={sec.title} className="mb-3">
                            <div className="text-[10px] text-gray-400 font-medium mb-1.5">
                              {sec.title}
                            </div>
                            <dl className="grid grid-cols-2 gap-2">
                              {entries.map(([k, label]) => {
                                const v = q[k];
                                const usedVal = used[k as keyof typeof used];
                                const numV = Number(v);
                                const pct =
                                  usedVal && numV > 0 ? Math.round((usedVal / numV) * 100) : null;
                                return (
                                  <div key={k} className="bg-gray-50 rounded-lg p-2">
                                    <dt className="text-[10px] text-gray-400">{label}</dt>
                                    <dd className="text-sm font-medium text-gray-700">
                                      {String(v)}
                                    </dd>
                                    {pct !== null && (
                                      <div className="mt-1">
                                        <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5">
                                          <span>已用 {usedVal}</span>
                                          <span>{pct}%</span>
                                        </div>
                                        <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                                          <div
                                            className={`h-full rounded-full ${pct > 80 ? 'bg-red-400' : pct > 50 ? 'bg-yellow-400' : 'bg-green-400'}`}
                                            style={{ width: `${Math.min(pct, 100)}%` }}
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </dl>
                          </div>
                        );
                      })}
                    </section>
                  );
                })()
              : null}

            <TenantConfigOverrides tenantId={String(selected.id)} />
          </div>
        )}
      </Drawer>

      {/* 编辑/新建 */}
      {editorOpen && (
        <TenantEditor
          tenant={editTarget}
          onClose={() => setEditorOpen(false)}
          onSaved={() => {
            setEditorOpen(false);
            load();
          }}
          onCredentialsCreated={(credentials) => {
            setEditorOpen(false);
            setCredentialsModal(credentials);
          }}
        />
      )}

      {/* 初始凭证弹窗 */}
      {credentialsModal && (
        <Drawer
          open={true}
          onClose={() => setCredentialsModal(null)}
          title="租户创建成功"
          width="w-[400px]"
        >
          <div className="space-y-4">
            <div className="p-3 bg-green-50 rounded-lg flex items-center gap-2">
              <Icon name="check_circle" size={20} className="text-green-500" />
              <span className="text-sm text-green-700">租户创建成功，以下是初始管理员登录凭证</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">用户名</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={credentialsModal.username}
                    readOnly
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 font-mono"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(credentialsModal.username)}
                    className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Icon name="content_copy" size={14} />
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">初始密码</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={credentialsModal.password}
                    readOnly
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 font-mono"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(credentialsModal.password)}
                    className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Icon name="content_copy" size={14} />
                  </button>
                </div>
              </div>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg">
              <p className="text-[10px] text-yellow-700">
                <Icon name="warning" size={12} className="inline mr-1" />
                请妥善保管此密码！首次登录后请立即修改密码。
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-gray-100">
              <button
                onClick={() => {
                  setCredentialsModal(null);
                  load();
                }}
                className="w-full py-2 text-sm bg-[#007AFF] text-white rounded-lg hover:bg-[#0066DD] transition-colors"
              >
                确定
              </button>
            </div>
          </div>
        </Drawer>
      )}

      {/* 删除确认弹窗 */}
      {deleteConfirm && (
        <Drawer
          open={true}
          onClose={() => setDeleteConfirm(null)}
          title="确认删除"
          width="w-[400px]"
        >
          <div className="space-y-4">
            {!deleteConfirm.deletable ? (
              <>
                <div className="p-3 bg-red-50 rounded-lg flex items-center gap-2">
                  <Icon name="error" size={20} className="text-red-500" />
                  <span className="text-sm text-red-700">无法删除该租户</span>
                </div>
                <p className="text-sm text-gray-600">{deleteConfirm.reason}</p>
                <div className="pt-4">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="w-full py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    确定
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="p-3 bg-yellow-50 rounded-lg flex items-center gap-2">
                  <Icon name="warning" size={20} className="text-yellow-500" />
                  <span className="text-sm text-yellow-700">确定要删除此租户吗？</span>
                </div>
                <p className="text-sm text-gray-600">
                  租户名称：{String(deleteConfirm.tenant.name)}
                </p>
                <p className="text-xs text-gray-400">此操作不可恢复，请谨慎操作。</p>
                <div className="pt-4 flex gap-2">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleDeleteConfirm}
                    className="flex-1 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  >
                    确认删除
                  </button>
                </div>
              </>
            )}
          </div>
        </Drawer>
      )}

      {/* Toast 提示 */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 ${
            toast.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          <Icon name={toast.type === 'success' ? 'check_circle' : 'error'} size={18} />
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
