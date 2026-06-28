/**
 * ManifestSection — 编译固化管理(v2.0 C12)。
 *
 * 触发 bake / 查看 manifest 列表(generation 倒序)/ 查看某版本固化产物内容。
 * 经 adminApi(runtimeManifestApi)调后端,不直调 infrastructure(T46 模式)。
 *
 * 用途:发布 Agent 定义后固化 manifest,运行时 harness 读 manifest 不再动态查 DB;
 * 版本对比/回滚靠 generation 隔离(旧 instance 引用旧 generation)。
 */
import { useState, useCallback, useEffect } from 'react';
import { useToastStore } from '../../../application/stores/toastStore';
import {
  runtimeManifestApi,
  type RuntimeManifestView,
} from '../../../application/services/adminApi';

export function ManifestSection() {
  const [defId, setDefId] = useState('');
  const [manifests, setManifests] = useState<RuntimeManifestView[]>([]);
  const [selected, setSelected] = useState<RuntimeManifestView | null>(null);
  const [loading, setLoading] = useState(false);
  const [baking, setBaking] = useState(false);
  const toast = useToastStore((s) => s.addToast);

  const refresh = useCallback(async () => {
    if (!defId.trim()) return;
    setLoading(true);
    try {
      const res = await runtimeManifestApi.listByDefinition(defId.trim());
      setManifests(res.items);
    } catch (e) {
      toast(`加载 manifest 失败: ${(e as Error).message}`, 'error');
      setManifests([]);
    } finally {
      setLoading(false);
    }
  }, [defId, toast]);

  useEffect(() => {
    if (defId.trim()) refresh();
    else setManifests([]);
  }, [refresh, defId]);

  const bake = async () => {
    const id = defId.trim();
    if (!id) {
      toast('请输入 Agent 定义 ID', 'error');
      return;
    }
    setBaking(true);
    try {
      const result = await runtimeManifestApi.bake(id);
      if (result.status === 'baked') {
        toast(`已固化成功(gen 已锁定),manifestId: ${result.manifestId}`, 'success');
      } else {
        toast(`固化失败: ${result.errorMsg ?? '未知错误'},可重试`, 'error');
      }
      // 同步返回,DB 已落终态,直接刷新看 baked/failed(无需轮询)
      refresh();
    } catch (e) {
      toast(`bake 请求失败: ${(e as Error).message}`, 'error');
    } finally {
      setBaking(false);
    }
  };

  const viewDetail = async (m: RuntimeManifestView) => {
    try {
      const detail = await runtimeManifestApi.get(m.agentDefinitionId, m.generation);
      setSelected(detail);
    } catch (e) {
      toast(`查看 manifest 失败: ${(e as Error).message}`, 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          value={defId}
          onChange={(e) => setDefId(e.target.value)}
          placeholder="Agent 定义 ID"
          className="flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-black/30"
        />
        <button
          onClick={bake}
          disabled={baking || !defId.trim()}
          className="rounded-lg bg-[#007AFF] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {baking ? '固化中...' : '触发 bake'}
        </button>
        <button
          onClick={refresh}
          disabled={loading || !defId.trim()}
          className="rounded-lg border border-black/10 px-4 py-2 text-sm dark:border-white/10"
        >
          刷新
        </button>
      </div>

      <div className="text-xs text-black/50 dark:text-white/50">
        bake 把声明态产物(systemPrompt/guardrails/tools/skills/quota/route)固化为不可变
        RuntimeManifest,运行时 harness 读 manifest 不再动态查 DB。改 spec → bumpGeneration → re-bake
        新 generation,旧 instance 引用旧 generation(灰度/回滚)。
      </div>

      {manifests.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Manifest 列表(generation 倒序)</h3>
          {manifests.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-lg border border-black/10 p-3 text-sm dark:border-white/10"
            >
              <div>
                <span className="font-mono">gen {m.generation}</span>
                <span className="ml-2 text-black/50 dark:text-white/50">{m.id}</span>
                <span
                  className={`ml-2 rounded px-1.5 py-0.5 text-xs ${
                    m.status === 'baked'
                      ? 'bg-green-500/15 text-green-600'
                      : m.status === 'failed'
                        ? 'bg-red-500/15 text-red-600'
                        : 'bg-yellow-500/15 text-yellow-600'
                  }`}
                >
                  {m.status}
                </span>
                {m.sandboxStrategy === 'cubesandbox' && (
                  <span className="ml-2 rounded bg-purple-500/15 px-1.5 py-0.5 text-xs text-purple-600">
                    KVM
                  </span>
                )}
              </div>
              <button onClick={() => viewDetail(m)} className="text-xs text-[#007AFF] underline">
                查看内容
              </button>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="space-y-2 rounded-lg border border-black/10 p-3 dark:border-white/10">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Manifest 内容 · gen {selected.generation}</h3>
            <button onClick={() => setSelected(null)} className="text-xs text-black/50">
              关闭
            </button>
          </div>
          <pre className="max-h-96 overflow-auto rounded bg-black/5 p-3 text-xs dark:bg-white/5">
            {JSON.stringify(selected, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
