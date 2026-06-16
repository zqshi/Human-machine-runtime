import { useState, useEffect, useMemo, useCallback } from 'react';
import { aiGatewayApi, type GrantInstanceDTO } from '../../../application/services/adminApi';
import {
  MOCK_INSTANCES,
  mockListGrantsByModel,
  mockSetModelGrants,
} from '../../../application/mock/aiGatewayMock';
import { Drawer } from '../../components/ui/Drawer';
import { Icon } from '../../components/ui/Icon';

interface Props {
  /** 模型 id；null/undefined 表示抽屉关闭 */
  modelId: string | null;
  modelName: string;
  /** 演示模式：true 时走 mock 数据，不调后端 */
  demoMode: boolean;
  onClose: () => void;
  onSaved?: (grantedCount: number) => void;
}

/**
 * 模型授权抽屉 —— 配置哪些数字员工(Agent)可使用该模型。
 *
 * 数据源：
 * - demoMode → 内存 mock（aiGatewayMock）
 * - 否则 → GET /models/:id/grants（instances 全量 + 当前 grants）
 *
 * 存储：白名单语义，全量覆盖 instanceIds，调 PUT /models/:id/grants。
 */
export function AgentGrantsDrawer({ modelId, modelName, demoMode, onClose, onSaved }: Props) {
  const [instances, setInstances] = useState<GrantInstanceDTO[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [keyword, setKeyword] = useState('');
  /** 授权筛选/分组维度：按部门 或 按员工（负责人） */
  const [groupMode, setGroupMode] = useState<'department' | 'owner'>('department');

  const load = useCallback(async () => {
    if (!modelId) return;
    setLoading(true);
    try {
      if (demoMode) {
        setInstances(MOCK_INSTANCES);
        setSelected(new Set(mockListGrantsByModel(modelId)));
      } else {
        const { grants, instances: list } = await aiGatewayApi.listModelGrants(modelId);
        setInstances(list);
        setSelected(new Set(grants));
      }
    } catch {
      setInstances([]);
    } finally {
      setLoading(false);
    }
  }, [modelId, demoMode]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return instances;
    return instances.filter(
      (i) =>
        i.name.toLowerCase().includes(kw) ||
        (i.department || '').toLowerCase().includes(kw) ||
        (i.ownerName || '').toLowerCase().includes(kw)
    );
  }, [instances, keyword]);

  // 按所选维度（部门 / 员工）分组
  const grouped = useMemo(() => {
    const map = new Map<string, GrantInstanceDTO[]>();
    for (const i of filtered) {
      const key = groupMode === 'owner' ? i.ownerName || '未指定负责人' : i.department || '未分组';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(i);
    }
    return Array.from(map.entries());
  }, [filtered, groupMode]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /** 分组的勾选状态：全选 / 部分 / 未选 */
  const groupState = (items: GrantInstanceDTO[]): 'all' | 'some' | 'none' => {
    const sel = items.filter((i) => selected.has(i.id)).length;
    if (sel === 0) return 'none';
    return sel === items.length ? 'all' : 'some';
  };

  /** 批量切换整组（按部门或按员工一次性授权） */
  const toggleGroup = (items: GrantInstanceDTO[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = items.every((i) => next.has(i.id));
      if (allSelected) items.forEach((i) => next.delete(i.id));
      else items.forEach((i) => next.add(i.id));
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((i) => next.add(i.id));
      return next;
    });
  };
  const clearAll = () => setSelected(new Set());

  const save = async () => {
    if (!modelId) return;
    setSaving(true);
    try {
      const ids = Array.from(selected);
      if (demoMode) {
        mockSetModelGrants(modelId, ids);
      } else {
        await aiGatewayApi.setModelGrants(modelId, ids);
      }
      onSaved?.(ids.length);
      onClose();
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = selected.size;

  return (
    <Drawer
      open={!!modelId}
      onClose={onClose}
      title={`授权数字员工 · ${modelName}`}
      width="w-[560px]"
    >
      <div className="flex flex-col h-full">
        {/* ── 顶部说明 + 筛选 ── */}
        <div className="px-1 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50/60 border border-amber-100 text-[11px] text-amber-700 mb-3">
            <Icon name="lock" size={14} className="shrink-0" />
            白名单授权 · 默认关闭：未被勾选的数字员工将无法调用该模型
            {demoMode && <span className="ml-auto text-amber-600 font-medium">演示数据</span>}
          </div>

          <div className="flex items-center gap-2 mb-2">
            <div className="relative flex-1">
              <Icon
                name="search"
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索名称 / 部门 / 负责人"
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg"
              />
            </div>
            {/* 授权维度切换：按部门 / 按员工 */}
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setGroupMode('department')}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  groupMode === 'department'
                    ? 'bg-white text-[#007AFF] shadow-sm font-medium'
                    : 'text-gray-500'
                }`}
              >
                按部门
              </button>
              <button
                onClick={() => setGroupMode('owner')}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  groupMode === 'owner'
                    ? 'bg-white text-[#007AFF] shadow-sm font-medium'
                    : 'text-gray-500'
                }`}
              >
                按员工
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-gray-500">
            <span>
              共 {instances.length} 个 Agent · 当前筛选 {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <button onClick={selectAllFiltered} className="text-[#007AFF] hover:underline">
                全选筛选结果
              </button>
              <span className="text-gray-300">|</span>
              <button onClick={clearAll} className="text-gray-500 hover:underline">
                清空
              </button>
            </div>
          </div>
        </div>

        {/* ── 列表（按部门分组） ── */}
        <div className="flex-1 overflow-y-auto px-1 py-2 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
              加载中...
            </div>
          ) : grouped.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
              没有匹配的数字员工
            </div>
          ) : (
            grouped.map(([dept, items]) => {
              const gstate = groupState(items);
              return (
              <div key={dept}>
                <div className="flex items-center gap-2 px-1 py-1 mb-1 rounded-md hover:bg-gray-50">
                  <input
                    type="checkbox"
                    ref={(el) => {
                      if (el) el.indeterminate = gstate === 'some';
                    }}
                    checked={gstate === 'all'}
                    onChange={() => toggleGroup(items)}
                    className="w-3.5 h-3.5 accent-[#007AFF]"
                  />
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                    <Icon name={groupMode === 'owner' ? 'person' : 'groups'} size={12} />
                    {dept}
                  </span>
                  <span className="text-[11px] text-gray-400 normal-case">
                    · {items.filter((i) => selected.has(i.id)).length}/{items.length}
                  </span>
                </div>
                <div className="space-y-1">
                  {items.map((inst) => {
                    const checked = selected.has(inst.id);
                    const shared = inst.ownerName?.includes('共享');
                    return (
                      <label
                        key={inst.id}
                        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg border cursor-pointer transition-colors ${
                          checked
                            ? 'border-[#007AFF]/40 bg-[#007AFF]/5'
                            : 'border-gray-100 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(inst.id)}
                          className="w-3.5 h-3.5 accent-[#007AFF]"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm text-gray-800 truncate">{inst.name}</span>
                            {shared && (
                              <span className="shrink-0 text-[9px] px-1 py-px rounded bg-blue-50 text-blue-500">
                                共享
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-400 truncate">
                            {inst.ownerName || '—'}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ${
                            inst.state === 'running'
                              ? 'bg-green-50 text-green-600'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {inst.state === 'running' ? '运行中' : '已停止'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
            })
          )}
        </div>

        {/* ── 底部操作 ── */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <span className="text-sm text-gray-600">
            已选 <span className="font-semibold text-[#007AFF]">{selectedCount}</span> 个 Agent
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-[#007AFF] rounded-lg hover:bg-[#0066DD] disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存授权'}
            </button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
