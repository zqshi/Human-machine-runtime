import { useState, useEffect, useCallback } from 'react';
import {
  employeeMemoryApi,
  employeeApi,
  type MemoryStore,
  type Employee,
} from '../../../../application/services/adminApi';
import { StatCard } from '../../../components/ui/StatCard';
import { MemoryStoreDetail } from './MemoryStoreDetail';

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-50 text-green-700',
  archived: 'bg-gray-100 text-gray-500',
};

const SEARCH_MODE_BADGE: Record<string, { label: string; cls: string }> = {
  keyword: { label: '关键词', cls: 'bg-blue-50 text-blue-700' },
  vector: { label: '向量', cls: 'bg-purple-50 text-purple-700' },
  hybrid: { label: '混合', cls: 'bg-amber-50 text-amber-700' },
};

function getSearchMode(store: MemoryStore): string {
  const c = store.retrievalConfig;
  if (c.useKeywordSearch && c.useVectorSearch) return 'hybrid';
  if (c.useVectorSearch) return 'vector';
  return 'keyword';
}

export function MemorySection() {
  const [stores, setStores] = useState<MemoryStore[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [storeList, empList] = await Promise.all([
        employeeMemoryApi.listStores(),
        employeeApi.list(),
      ]);
      setStores(Array.isArray(storeList) ? storeList : []);
      setEmployees(Array.isArray(empList) ? empList : []);
    } catch {
      setStores([]);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const instanceNameMap = new Map(employees.map((e) => [e.id, e.displayName || e.name]));

  const departmentOf = (instanceId: string): string => {
    const dept = employees.find((e) => e.id === instanceId)?.department;
    return dept && dept.trim() ? dept.trim() : '';
  };
  const distinctDepartments = [...new Set(stores.map((s) => departmentOf(s.instanceId)).filter(Boolean))];
  const filteredStores = departmentFilter
    ? stores.filter((s) => departmentOf(s.instanceId) === departmentFilter)
    : stores;

  const totalFragments = filteredStores.reduce((sum, s) => sum + s.totalFragments, 0);
  const totalProfiles = filteredStores.reduce((sum, s) => sum + s.totalProfiles, 0);

  if (selectedStoreId) {
    return (
      <MemoryStoreDetail
        storeId={selectedStoreId}
        onBack={() => { setSelectedStoreId(null); fetchData(); }}
      />
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">记忆库管理</h2>
          <p className="text-xs text-gray-400 mt-0.5">为数字员工配置用户粒度的记忆能力，实现千人千面</p>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-4">
        <StatCard label="记忆库" value={filteredStores.length} icon="psychology" />
        <StatCard label="片段总数" value={totalFragments} icon="segment" />
        <StatCard label="用户覆盖" value={totalProfiles} icon="person" />
        <StatCard label="活跃库" value={filteredStores.filter((s) => s.status === 'active').length} icon="check_circle" />
        <StatCard label="部门覆盖" value={distinctDepartments.length} icon="corporate_fare" />
      </div>
      {distinctDepartments.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">按部门筛选</span>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#007AFF]/30 focus:border-[#007AFF]"
          >
            <option value="">全部</option>
            {distinctDepartments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          {departmentFilter && (
            <button onClick={() => setDepartmentFilter('')} className="text-xs text-gray-400 hover:text-[#007AFF]">清空</button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">加载中...</div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-3 py-2.5 font-medium text-gray-500">名称</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-500">数字员工</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-500">部门</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-500">检索模式</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-500">片段</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-500">用户</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-500">状态</th>
                <th className="text-right px-3 py-2.5 font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredStores.map((store) => (
                <tr key={store.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors h-12">
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-800">{store.name}</div>
                    <div className="text-[11px] text-gray-400 font-mono">{store.id}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {instanceNameMap.get(store.instanceId) || store.instanceId}
                  </td>
                  <td className="px-3 py-2">
                    {(() => {
                      const dept = departmentOf(store.instanceId);
                      return dept
                        ? <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-emerald-50 text-emerald-700">{dept}</span>
                        : <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-400">未分配</span>;
                    })()}
                  </td>
                  <td className="px-3 py-2">
                    {(() => {
                      const mode = SEARCH_MODE_BADGE[getSearchMode(store)] || SEARCH_MODE_BADGE.keyword;
                      return (
                        <span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${mode.cls}`}>
                          {mode.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">{store.totalFragments}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{store.totalProfiles}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${STATUS_BADGE[store.status] || STATUS_BADGE.active}`}>
                      {store.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right" onClick={(ev) => ev.stopPropagation()}>
                    <button
                      onClick={() => setSelectedStoreId(store.id)}
                      className="px-2 py-0.5 text-xs border border-gray-200 rounded hover:bg-gray-100"
                    >
                      查看
                    </button>
                  </td>
                </tr>
              ))}
              {filteredStores.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    {departmentFilter ? '该部门暂无启用记忆库的数字员工' : '暂无记忆库。创建数字员工时勾选"启用记忆库"即可自动创建。'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
