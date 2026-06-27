/**
 * RuntimeTemplatesSection — 运行时/沙箱模板管理(治本 D8 后端侧,T6,只读)。
 *
 * 展示内置 sandbox 模板(basic/high-privilege/network-isolated)资源配置 +
 * 声明态 runtimeType → AgentFramework adapter 映射。消费 runtimeTemplatesApi(只读)。
 */
import { useState, useEffect } from 'react';
import {
  runtimeTemplatesApi,
  type SandboxTemplateDef,
  type RuntimeTypeEntry,
} from '../../../application/services/adminApi';
import { useToastStore } from '../../../application/stores/toastStore';

export function RuntimeTemplatesSection() {
  const [templates, setTemplates] = useState<SandboxTemplateDef[]>([]);
  const [types, setTypes] = useState<RuntimeTypeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToastStore((s) => s.addToast);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [t, r] = await Promise.all([
          runtimeTemplatesApi.listSandboxTemplates(),
          runtimeTemplatesApi.listRuntimeTypes(),
        ]);
        setTemplates(t.items);
        setTypes(r.items);
      } catch (e) {
        toast(`加载运行时模板失败: ${(e as Error).message}`, 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  return (
    <div className="p-6 max-w-5xl">
      <h2 className="text-lg font-semibold text-gray-800 mb-1">运行时与沙箱模板</h2>
      <p className="text-[12px] text-gray-500 mb-4">
        声明态 runtimeType → adapter 映射 + 内置 sandbox 模板(治本 D8,只读)
      </p>

      {loading ? (
        <p className="text-[13px] text-gray-400">加载中...</p>
      ) : (
        <>
          {/* Runtime Types */}
          <div className="mb-6">
            <h3 className="text-[13px] font-semibold text-gray-700 mb-2">运行时类型映射</h3>
            <div className="grid grid-cols-1 gap-2">
              {types.map((t) => (
                <div
                  key={t.runtimeType}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-xl bg-white"
                >
                  <span className="text-[13px] font-medium text-gray-800">{t.runtimeType}</span>
                  <span className="text-[12px] text-gray-500">→ {t.framework}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sandbox Templates */}
          <div>
            <h3 className="text-[13px] font-semibold text-gray-700 mb-2">沙箱模板</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {templates.map((t) => (
                <div key={t.name} className="p-4 border border-gray-200 rounded-xl bg-white">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[13px] font-semibold text-gray-800">{t.name}</span>
                    {t.highPrivilege && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-700">
                        高权限
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 mb-3">{t.description}</p>
                  <div className="space-y-1 text-[11px] text-gray-600">
                    <div className="flex justify-between">
                      <span>CPU</span>
                      <span className="font-mono">{t.cpu}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>内存</span>
                      <span className="font-mono">{t.memory}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>网络</span>
                      <span className="font-mono">{t.networkMode}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
