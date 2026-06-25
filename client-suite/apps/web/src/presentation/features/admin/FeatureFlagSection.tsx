/**
 * FeatureFlagSection — Feature Flag 管理(#13 灰度发布,T5)。
 *
 * 列出已配置 flag(enabled/rolloutPct/killSwitch/allowedTenants),可编辑 + 新增。
 * 关键 flag:agent.guardrails.enforce / tool.approval.enforce / agent.runtime.canary。
 * 消费 featureFlagApi。
 */
import { useState, useEffect, useCallback } from 'react';
import { featureFlagApi, type FeatureFlagConfig } from '../../../infrastructure/api/v19AdminApi';
import { useToastStore } from '../../../application/stores/toastStore';

const PRESET_KEYS = ['agent.guardrails.enforce', 'tool.approval.enforce', 'agent.runtime.canary'];

interface FlagDraft extends FeatureFlagConfig {
  key: string;
  tenantsInput: string; // allowedTenants 编辑用(逗号分隔)
}

function toDraft(key: string, flag: FeatureFlagConfig): FlagDraft {
  return {
    key,
    enabled: flag.enabled,
    rolloutPct: flag.rolloutPct,
    allowedTenants: flag.allowedTenants,
    killSwitch: flag.killSwitch,
    tenantsInput: (flag.allowedTenants ?? []).join(', '),
  };
}

export function FeatureFlagSection() {
  const [drafts, setDrafts] = useState<FlagDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [newKey, setNewKey] = useState('');
  const toast = useToastStore((s) => s.addToast);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await featureFlagApi.list();
      const allKeys = new Set([...Object.keys(r.flags), ...PRESET_KEYS]);
      setDrafts(
        Array.from(allKeys).map((k) =>
          r.flags[k] ? toDraft(k, r.flags[k]) : { key: k, enabled: false, tenantsInput: '' }
        )
      );
    } catch (e) {
      toast(`加载 feature flag 失败: ${(e as Error).message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateDraft = (key: string, patch: Partial<FlagDraft>) => {
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  };

  const save = async (d: FlagDraft) => {
    setSaving(d.key);
    try {
      const tenants = d.tenantsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const config: FeatureFlagConfig = {
        enabled: d.enabled,
        rolloutPct: d.rolloutPct,
        allowedTenants: tenants.length ? tenants : undefined,
        killSwitch: d.killSwitch,
      };
      await featureFlagApi.set(d.key, config);
      toast(`已保存 ${d.key}`, 'success');
    } catch (e) {
      toast(`保存失败: ${(e as Error).message}`, 'error');
    } finally {
      setSaving(null);
    }
  };

  const addFlag = async () => {
    const k = newKey.trim();
    if (!k) return;
    if (drafts.some((d) => d.key === k)) {
      toast('该 flag 已存在', 'error');
      return;
    }
    setDrafts((ds) => [...ds, { key: k, enabled: false, tenantsInput: '' }]);
    setNewKey('');
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Feature Flag</h2>
          <p className="text-[12px] text-gray-500 mt-0.5">
            灰度发布:enabled + rolloutPct(确定性 hash 灰度) + killSwitch(紧急关停)
          </p>
        </div>
        <button
          onClick={refresh}
          className="px-3 py-1.5 text-[12px] rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
        >
          刷新
        </button>
      </div>

      {loading ? (
        <p className="text-[13px] text-gray-400">加载中...</p>
      ) : (
        <div className="space-y-3">
          {drafts.map((d) => (
            <div key={d.key} className="p-4 border border-gray-200 rounded-xl bg-white">
              <div className="flex items-center justify-between mb-3">
                <code className="text-[13px] font-medium text-gray-800">{d.key}</code>
                <label className="flex items-center gap-1.5 text-[12px] text-gray-600">
                  <input
                    type="checkbox"
                    checked={d.enabled}
                    onChange={(e) => updateDraft(d.key, { enabled: e.target.checked })}
                  />
                  enabled
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <label className="text-[12px] text-gray-600">
                  rolloutPct (0-100)
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={d.rolloutPct ?? 0}
                    onChange={(e) =>
                      updateDraft(d.key, {
                        rolloutPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                      })
                    }
                    className="w-full mt-1 h-9 px-2 border border-gray-300 rounded-lg text-[12px] text-gray-700 outline-none focus:border-[#007AFF]/50"
                  />
                </label>
                <label className="text-[12px] text-gray-600">
                  白名单租户(逗号分隔)
                  <input
                    value={d.tenantsInput}
                    onChange={(e) => updateDraft(d.key, { tenantsInput: e.target.value })}
                    placeholder="tenant-1, tenant-2"
                    className="w-full mt-1 h-9 px-2 border border-gray-300 rounded-lg text-[12px] text-gray-700 outline-none focus:border-[#007AFF]/50"
                  />
                </label>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[12px] text-gray-600">
                  <input
                    type="checkbox"
                    checked={d.killSwitch === false}
                    onChange={(e) =>
                      updateDraft(d.key, { killSwitch: e.target.checked ? false : undefined })
                    }
                  />
                  killSwitch(勾选=紧急关停,优先级最高)
                </label>
                <button
                  onClick={() => save(d)}
                  disabled={saving === d.key}
                  className="px-3 py-1.5 text-[12px] rounded-lg bg-[#007AFF] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {saving === d.key ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          ))}

          {/* 新增 flag */}
          <div className="flex gap-2 pt-2">
            <input
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="新增 flag key,如 feature.xxx"
              className="flex-1 h-9 px-3 border border-gray-300 rounded-lg text-[12px] text-gray-700 outline-none focus:border-[#007AFF]/50"
            />
            <button
              onClick={addFlag}
              className="px-4 h-9 text-[12px] rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
            >
              添加
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
