import { useState, useEffect, useRef, useCallback } from 'react';
import { platformConfigApi, tenantApi } from '../../../application/services/adminApi';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import { Icon } from '../../components/ui/Icon';

interface ConfigMeta {
  value: unknown;
  source: string;
  description: string;
  options?: string[];
  nullable?: boolean;
}

interface TenantOverrideInfo {
  tenantName: string;
  value: unknown;
}

const DIMENSIONS: { prefix: string; label: string; icon: string }[] = [
  { prefix: 'tenant', label: '租户限制', icon: 'apartment' },
  { prefix: 'resource', label: '资源配额', icon: 'memory' },
  { prefix: 'ai', label: 'AI 用量', icon: 'psychology' },
  { prefix: 'gateway', label: '网关配置', icon: 'api' },
  { prefix: 'security', label: '安全策略', icon: 'shield' },
  { prefix: 'feature', label: '功能开关', icon: 'toggle_on' },
  { prefix: 'notification', label: '通知配置', icon: 'notifications' },
];

function groupByDimension(config: Record<string, unknown>): Record<string, [string, ConfigMeta][]> {
  const groups: Record<string, [string, ConfigMeta][]> = {};
  for (const dim of DIMENSIONS) groups[dim.prefix] = [];
  groups['other'] = [];

  for (const [key, raw] of Object.entries(config)) {
    const meta: ConfigMeta =
      typeof raw === 'object' && raw !== null
        ? (raw as ConfigMeta)
        : { value: raw, source: 'env', description: '' };
    const prefix = key.split('.')[0];
    if (groups[prefix]) groups[prefix].push([key, meta]);
    else groups['other'].push([key, meta]);
  }
  return groups;
}

function isBoolean(v: unknown): v is boolean {
  return v === true || v === false;
}

function OverrideBadge({ overrides }: { overrides: TenantOverrideInfo[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (overrides.length === 0) return null;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors"
      >
        {overrides.length} 个租户覆盖
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-[180px]">
          {overrides.map((o) => (
            <div key={o.tenantName} className="flex items-center justify-between text-xs py-1 px-1">
              <span className="text-gray-700">{o.tenantName}</span>
              <span className="font-mono text-[#007AFF]">{String(o.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PlatformConfigSection() {
  const [viewMode, setViewMode] = useState<'global' | 'tenant'>('global');
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editError, setEditError] = useState('');
  const [loading, setLoading] = useState(true);
  const [overrideMap, setOverrideMap] = useState<Record<string, TenantOverrideInfo[]>>({});
  const [tenants, setTenants] = useState<Record<string, unknown>[]>([]);

  const [initialized, setInitialized] = useState(false);

  const load = useCallback((showSpinner = true) => {
    if (showSpinner) setLoading(true);
    Promise.all([platformConfigApi.list(), tenantApi.list()])
      .then(([configRes, tenantRes]) => {
        setConfig(configRes.config || {});
        const ts = tenantRes.tenants || [];
        setTenants(ts);
        const map: Record<string, TenantOverrideInfo[]> = {};
        for (const t of ts) {
          const overrides = (t.configOverrides || {}) as Record<string, unknown>;
          for (const [key, value] of Object.entries(overrides)) {
            if (!map[key]) map[key] = [];
            map[key].push({ tenantName: String(t.name), value });
          }
        }
        setOverrideMap(map);
      })
      .catch(() => setConfig({}))
      .finally(() => {
        setLoading(false);
        setInitialized(true);
      });
  }, []);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  useEffect(() => {
    loadRef.current();
  }, []);

  const handleSave = async (key: string, meta?: ConfigMeta) => {
    const trimmed = editValue.trim();
    setEditError('');
    if (trimmed === '') {
      if (meta?.nullable) {
        await platformConfigApi.update({ [key]: '' });
      } else {
        setEditError('此项不能为空');
        return;
      }
    } else if (typeof meta?.value === 'number' || meta?.value === null) {
      if (!/^\d+$/.test(trimmed)) {
        setEditError('请输入有效数字');
        return;
      }
      await platformConfigApi.update({ [key]: Number(trimmed) });
    } else {
      await platformConfigApi.update({ [key]: trimmed });
    }
    setEditing(null);
    load(false);
  };

  const handleToggle = async (key: string, current: boolean) => {
    await platformConfigApi.update({ [key]: !current });
    load(false);
  };

  const groups = groupByDimension(config);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">平台配置</h1>
          <p className="text-xs text-gray-400 mt-0.5">全局默认配置，租户可在各自配置中覆盖</p>
        </div>
        <button
          onClick={() => load(false)}
          className="p-1.5 text-gray-400 hover:text-[#007AFF]"
          title="刷新"
        >
          <Icon name="refresh" size={16} />
        </button>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-1 border-b border-gray-100 pb-2">
        <button
          onClick={() => setViewMode('global')}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition-colors ${
            viewMode === 'global' ? 'bg-[#007AFF] text-white' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <Icon name="settings" size={14} />
          全局默认
        </button>
        <button
          onClick={() => setViewMode('tenant')}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition-colors ${
            viewMode === 'tenant' ? 'bg-[#007AFF] text-white' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <Icon name="apartment" size={14} />
          租户配置视角
        </button>
      </div>

      {loading && !initialized ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">加载中...</div>
      ) : viewMode === 'global' ? (
        <GlobalConfigView
          groups={groups}
          overrideMap={overrideMap}
          editing={editing}
          editValue={editValue}
          editError={editError}
          setEditing={(k) => {
            setEditing(k);
            setEditError('');
          }}
          setEditValue={(v) => {
            setEditValue(v);
            setEditError('');
          }}
          handleSave={handleSave}
          handleToggle={handleToggle}
          handleSelectChange={async (key: string, value: string) => {
            await platformConfigApi.update({ [key]: value });
            load(false);
          }}
        />
      ) : (
        <TenantConfigView config={config} tenants={tenants} onReload={() => load(false)} />
      )}
    </div>
  );
}

function GlobalConfigView({
  groups,
  overrideMap,
  editing,
  editValue,
  editError,
  setEditing,
  setEditValue,
  handleSave,
  handleToggle,
  handleSelectChange,
}: {
  groups: Record<string, [string, ConfigMeta][]>;
  overrideMap: Record<string, TenantOverrideInfo[]>;
  editing: string | null;
  editValue: string;
  editError: string;
  setEditing: (k: string | null) => void;
  setEditValue: (v: string) => void;
  handleSave: (key: string, meta?: ConfigMeta) => Promise<void>;
  handleToggle: (key: string, current: boolean) => Promise<void>;
  handleSelectChange: (key: string, value: string) => Promise<void>;
}) {
  const allDims = [...DIMENSIONS];
  if (groups['other']?.length > 0)
    allDims.push({ prefix: 'other', label: '其他', icon: 'settings' });
  const visibleDims = allDims.filter((d) => (groups[d.prefix] || []).length > 0);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(visibleDims.length > 0 ? [visibleDims[0].prefix] : [])
  );

  const toggleDim = (prefix: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(prefix)) next.delete(prefix);
      else next.add(prefix);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {visibleDims.map((dim) => {
        const items = groups[dim.prefix] || [];
        const isOpen = expanded.has(dim.prefix);
        const overrideCount = items.filter(([key]) => (overrideMap[key] || []).length > 0).length;
        return (
          <div
            key={dim.prefix}
            className="border border-gray-200 rounded-xl bg-white overflow-hidden"
          >
            <button
              onClick={() => toggleDim(dim.prefix)}
              className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50/60 hover:bg-gray-100/60 transition-colors text-left"
            >
              <Icon
                name={isOpen ? 'expand_less' : 'expand_more'}
                size={18}
                className="text-gray-400"
              />
              <Icon name={dim.icon} size={16} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-700 flex-1">{dim.label}</span>
              <span className="text-[10px] text-gray-400">{items.length} 项</span>
              {overrideCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-600">
                  {overrideCount} 项覆盖
                </span>
              )}
            </button>
            {isOpen && (
              <div className="divide-y divide-gray-50 border-t border-gray-100">
                {items.map(([key, meta]) => {
                  const editable = meta.source === 'config';
                  const isBool = isBoolean(meta.value);
                  const shortKey = key.split('.').slice(1).join('.');
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium text-gray-800">
                            {meta.description || shortKey}
                          </span>
                          <span className="text-[10px] font-mono text-gray-400">{key}</span>
                          <OverrideBadge overrides={overrideMap[key] || []} />
                        </div>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded ${editable ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}
                        >
                          {editable ? '可配置' : '环境变量'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isBool ? (
                          <ToggleSwitch
                            checked={meta.value as boolean}
                            onChange={() => editable && handleToggle(key, meta.value as boolean)}
                            disabled={!editable}
                          />
                        ) : meta.options && meta.options.length > 0 ? (
                          <select
                            value={String(meta.value)}
                            onChange={(e) => editable && handleSelectChange(key, e.target.value)}
                            disabled={!editable}
                            className="px-2 py-1 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#007AFF] disabled:opacity-50"
                          >
                            {meta.options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : editing === key ? (
                          <div>
                            <div className="flex items-center gap-1">
                              <input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                                  if (e.key === 'Enter') handleSave(key, meta);
                                }}
                                placeholder={meta.nullable ? '留空表示不限制' : undefined}
                                className={`px-2 py-1 text-sm border rounded w-28 focus:outline-none focus:ring-1 ${
                                  editError
                                    ? 'border-red-400 focus:ring-red-300'
                                    : 'border-gray-200 focus:ring-[#007AFF]'
                                }`}
                                autoFocus
                              />
                              <button
                                onClick={() => handleSave(key, meta)}
                                className="px-2 py-1 text-xs rounded bg-[#007AFF] text-white"
                              >
                                保存
                              </button>
                              <button
                                onClick={() => setEditing(null)}
                                className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600"
                              >
                                取消
                              </button>
                            </div>
                            {editError && (
                              <p className="text-[10px] text-red-500 mt-0.5">{editError}</p>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-mono ${meta.value == null ? 'text-gray-400 italic' : 'text-gray-800'}`}
                            >
                              {meta.value == null ? '不限制' : String(meta.value)}
                            </span>
                            {editable && (
                              <button
                                onClick={() => {
                                  setEditing(key);
                                  setEditValue(meta.value == null ? '' : String(meta.value));
                                }}
                                className="p-1 text-gray-400 hover:text-[#007AFF]"
                                title="编辑"
                              >
                                <Icon name="edit" size={14} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TenantConfigView({
  config,
  tenants,
  onReload,
}: {
  config: Record<string, unknown>;
  tenants: Record<string, unknown>[];
  onReload: () => void;
}) {
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [overrides, setOverrides] = useState<Record<string, unknown>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const activeTenants = tenants.filter((t) => t.status !== 'archived');
  const selectedTenant = activeTenants.find((t) => String(t.id) === selectedTenantId);

  useEffect(() => {
    if (!selectedTenantId) return;
    tenantApi
      .getConfig(selectedTenantId)
      .then((res) => {
        setOverrides(res.overrides || {});
      })
      .catch(() => setOverrides({}));
  }, [selectedTenantId]);

  const configEntries = Object.entries(config)
    .map(([key, raw]) => {
      const meta: ConfigMeta =
        typeof raw === 'object' && raw !== null
          ? (raw as ConfigMeta)
          : { value: raw, source: 'env', description: '' };
      return [key, meta] as [string, ConfigMeta];
    })
    .filter(([, meta]) => meta.source === 'config');

  const handleSave = async (key: string) => {
    let parsed: unknown = editValue;
    if (/^\d+$/.test(editValue)) parsed = Number(editValue);
    await tenantApi.updateConfig(selectedTenantId, { [key]: parsed });
    setEditing(null);
    const res = await tenantApi.getConfig(selectedTenantId);
    setOverrides(res.overrides || {});
    onReload();
  };

  const handleToggle = async (key: string, currentOverride: unknown, globalVal: unknown) => {
    const current = currentOverride !== undefined ? currentOverride : globalVal;
    await tenantApi.updateConfig(selectedTenantId, { [key]: !current });
    const res = await tenantApi.getConfig(selectedTenantId);
    setOverrides(res.overrides || {});
    onReload();
  };

  const handleReset = async (key: string) => {
    await tenantApi.resetConfigKey(selectedTenantId, key);
    const res = await tenantApi.getConfig(selectedTenantId);
    setOverrides(res.overrides || {});
    onReload();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-500 shrink-0">选择租户</label>
        <select
          value={selectedTenantId}
          onChange={(e) => {
            setSelectedTenantId(e.target.value);
            if (!e.target.value) setOverrides({});
          }}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] w-64"
        >
          <option value="">请选择租户...</option>
          {activeTenants.map((t) => (
            <option key={String(t.id)} value={String(t.id)}>
              {String(t.name)} ({String(t.slug || t.id)})
            </option>
          ))}
        </select>
        {selectedTenant && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              selectedTenant.status === 'active'
                ? 'bg-green-50 text-green-700'
                : 'bg-yellow-50 text-yellow-700'
            }`}
          >
            {String(selectedTenant.status)}
          </span>
        )}
      </div>

      {!selectedTenantId ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
          选择一个租户以查看其生效配置
        </div>
      ) : configEntries.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
          暂无可配置项
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">配置项</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">全局默认</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">租户覆盖</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">生效值</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {configEntries.map(([key, meta]) => {
                const hasOverride = key in overrides;
                const effectiveValue = hasOverride ? overrides[key] : meta.value;
                const isBool = isBoolean(meta.value);
                return (
                  <tr key={key} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <div className="text-sm text-gray-800">{meta.description || key}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{key}</div>
                    </td>
                    <td className="px-4 py-2.5 text-sm font-mono text-gray-500">
                      {String(meta.value)}
                    </td>
                    <td className="px-4 py-2.5">
                      {hasOverride ? (
                        <span className="text-sm font-mono text-[#007AFF] font-medium">
                          {String(overrides[key])}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-sm font-mono ${hasOverride ? 'text-[#007AFF] font-medium' : 'text-gray-700'}`}
                      >
                        {String(effectiveValue)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isBool ? (
                          <ToggleSwitch
                            checked={effectiveValue as boolean}
                            onChange={() => handleToggle(key, overrides[key], meta.value)}
                          />
                        ) : meta.options && meta.options.length > 0 ? (
                          <select
                            value={String(effectiveValue)}
                            onChange={async (e) => {
                              await tenantApi.updateConfig(selectedTenantId, {
                                [key]: e.target.value,
                              });
                              const res = await tenantApi.getConfig(selectedTenantId);
                              setOverrides(res.overrides || {});
                              onReload();
                            }}
                            className="px-2 py-0.5 text-xs border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#007AFF]"
                          >
                            {meta.options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : editing === key ? (
                          <div className="flex items-center gap-1">
                            <input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                                if (e.key === 'Enter') handleSave(key);
                              }}
                              className="px-2 py-0.5 text-xs border border-gray-200 rounded w-20 focus:outline-none focus:ring-1 focus:ring-[#007AFF]"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSave(key)}
                              className="px-1.5 py-0.5 text-[10px] rounded bg-[#007AFF] text-white"
                            >
                              保存
                            </button>
                            <button
                              onClick={() => setEditing(null)}
                              className="px-1.5 py-0.5 text-[10px] rounded bg-gray-100 text-gray-500"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditing(key);
                              setEditValue(String(effectiveValue ?? ''));
                            }}
                            className="px-2 py-0.5 text-xs border border-gray-200 rounded hover:bg-gray-100 text-gray-500"
                          >
                            编辑
                          </button>
                        )}
                        {hasOverride && (
                          <button
                            onClick={() => handleReset(key)}
                            className="px-2 py-0.5 text-xs border border-gray-200 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                            title="重置为全局默认"
                          >
                            重置
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
