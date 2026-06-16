import { useState, useEffect, useCallback } from 'react';
import { tenantApi, platformConfigApi } from '../../../application/services/adminApi';
import { Icon } from '../../components/ui/Icon';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import type { ConfigMeta } from './tenantConstants';

export function TenantConfigOverrides({ tenantId }: { tenantId: string }) {
  const [globalConfig, setGlobalConfig] = useState<Record<string, ConfigMeta>>({});
  const [overrides, setOverrides] = useState<Record<string, unknown>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    return Promise.all([platformConfigApi.list(), tenantApi.getConfig(tenantId)])
      .then(([configRes, tenantConfigRes]) => {
        const cfg: Record<string, ConfigMeta> = {};
        for (const [key, raw] of Object.entries(configRes.config || {})) {
          cfg[key] =
            typeof raw === 'object' && raw !== null
              ? (raw as ConfigMeta)
              : { value: raw, source: 'env', description: '' };
        }
        setGlobalConfig(cfg);
        setOverrides(tenantConfigRes.overrides || {});
      })
      .catch(() => {});
  }, [tenantId]);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const load = () => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  };

  const configurableKeys = Object.entries(globalConfig).filter(
    ([, meta]) => meta.source === 'config'
  );

  const handleSave = async (key: string) => {
    let parsed: unknown = editValue;
    if (/^\d+$/.test(editValue)) parsed = Number(editValue);
    await tenantApi.updateConfig(tenantId, { [key]: parsed });
    setEditing(null);
    load();
  };

  const handleToggle = async (key: string, currentOverride: unknown, globalVal: unknown) => {
    const current = currentOverride !== undefined ? currentOverride : globalVal;
    await tenantApi.updateConfig(tenantId, { [key]: !current });
    load();
  };

  const handleReset = async (key: string) => {
    await tenantApi.resetConfigKey(tenantId, key);
    load();
  };

  if (loading) {
    return <div className="text-xs text-gray-400 py-3">加载配置中...</div>;
  }

  if (configurableKeys.length === 0) return null;

  return (
    <section>
      <h3 className="text-xs text-gray-400 uppercase tracking-wide mb-2">配置覆盖</h3>
      <p className="text-[10px] text-gray-400 mb-3">覆盖值优先于全局默认生效，重置后继承全局配置</p>
      <div className="space-y-1.5">
        {configurableKeys.map(([key, meta]) => {
          const hasOverride = key in overrides;
          const effectiveValue = hasOverride ? overrides[key] : meta.value;
          const isBool = meta.value === true || meta.value === false;
          const shortKey = key.split('.').slice(1).join('.');

          return (
            <div
              key={key}
              className={`flex items-center gap-3 py-2 px-3 rounded-lg border ${
                hasOverride ? 'border-[#007AFF]/30 bg-blue-50/30' : 'border-gray-100 bg-gray-50/50'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-700">{meta.description || shortKey}</div>
                <div className="text-[10px] text-gray-400 font-mono">{key}</div>
              </div>

              {/* 全局默认 */}
              <div className="text-[10px] text-gray-400 shrink-0">
                默认: <span className="font-mono">{String(meta.value)}</span>
              </div>

              {/* 生效值/编辑 */}
              <div className="flex items-center gap-1.5 shrink-0">
                {isBool ? (
                  <ToggleSwitch
                    checked={effectiveValue as boolean}
                    onChange={() => handleToggle(key, overrides[key], meta.value)}
                  />
                ) : editing === key ? (
                  <div className="flex items-center gap-1">
                    <input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => { if (e.nativeEvent.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') handleSave(key); }}
                      className="px-1.5 py-0.5 text-xs border border-gray-200 rounded w-20 focus:outline-none focus:ring-1 focus:ring-[#007AFF]"
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
                  <>
                    <span
                      className={`text-xs font-mono ${
                        hasOverride ? 'text-[#007AFF] font-medium' : 'text-gray-600'
                      }`}
                    >
                      {String(effectiveValue)}
                    </span>
                    <button
                      onClick={() => {
                        setEditing(key);
                        setEditValue(String(effectiveValue ?? ''));
                      }}
                      className="p-0.5 text-gray-400 hover:text-[#007AFF]"
                      title="编辑覆盖值"
                    >
                      <Icon name="edit" size={12} />
                    </button>
                  </>
                )}

                {hasOverride && (
                  <button
                    onClick={() => handleReset(key)}
                    className="p-0.5 text-gray-400 hover:text-red-500"
                    title="重置为全局默认"
                  >
                    <Icon name="refresh" size={12} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
