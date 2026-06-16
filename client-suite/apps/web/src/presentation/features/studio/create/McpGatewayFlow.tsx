/**
 * McpGatewayFlow — Gateway 对接模式
 *
 * 设计源模式：左网关配置 + 右路由发现列表
 * 流程：选网关类型 → 填 Admin API 地址 → 连接发现路由 → 勾选路由 → 确认发布
 */
import { useState } from 'react';
import { useToastStore } from '../../../../application/stores/toastStore';
import { Icon } from '../../../components/ui/Icon';

interface Props {
  onBack: () => void;
}

interface Route {
  id: string;
  name: string;
  method: string;
  path: string;
  upstream: string;
  enabled: boolean;
}

const MOCK_ROUTES: Route[] = [
  {
    id: '1',
    name: 'get-users',
    method: 'GET',
    path: '/api/v1/users',
    upstream: 'user-service:8080',
    enabled: true,
  },
  {
    id: '2',
    name: 'create-user',
    method: 'POST',
    path: '/api/v1/users',
    upstream: 'user-service:8080',
    enabled: true,
  },
  {
    id: '3',
    name: 'get-orders',
    method: 'GET',
    path: '/api/v1/orders',
    upstream: 'order-service:8080',
    enabled: true,
  },
  {
    id: '4',
    name: 'create-order',
    method: 'POST',
    path: '/api/v1/orders',
    upstream: 'order-service:8080',
    enabled: true,
  },
  {
    id: '5',
    name: 'get-products',
    method: 'GET',
    path: '/api/v1/products',
    upstream: 'product-service:8080',
    enabled: true,
  },
  {
    id: '6',
    name: 'admin-config',
    method: 'PUT',
    path: '/admin/config',
    upstream: 'admin-service:9090',
    enabled: true,
  },
  {
    id: '7',
    name: 'health-check',
    method: 'GET',
    path: '/health',
    upstream: 'gateway:80',
    enabled: false,
  },
];

const GW_TYPES = ['Higress', 'Kong', 'APISIX'] as const;

type Step = 'form' | 'discovering' | 'done';

export function McpGatewayFlow({ onBack }: Props) {
  const toast = useToastStore((s) => s.addToast);

  const [gwType, setGwType] = useState<string>('Higress');
  const [gwUrl, setGwUrl] = useState('');
  const [token, setToken] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [selectedRoutes, setSelectedRoutes] = useState<Set<string>>(new Set());

  const handleDiscover = async () => {
    if (!gwUrl.trim()) {
      toast('请输入网关 Admin API 地址', 'error');
      return;
    }
    setStep('discovering');
    await new Promise((r) => setTimeout(r, 1500));
    // 自动选择已启用的非内部路由
    setSelectedRoutes(
      new Set(
        MOCK_ROUTES.filter(
          (r) => r.enabled && !r.path.startsWith('/admin') && !r.path.startsWith('/health')
        ).map((r) => r.id)
      )
    );
    setStep('done');
    toast(`发现 ${MOCK_ROUTES.length} 条路由`, 'success');
  };

  const toggleRoute = (id: string) => {
    const route = MOCK_ROUTES.find((r) => r.id === id);
    if (!route?.enabled) return;
    setSelectedRoutes((prev) => {
      const n = new Set(prev);
      if (n.has(id)) {
        n.delete(id);
      } else {
        n.add(id);
      }
      return n;
    });
  };

  const selectAll = () => {
    const enabledIds = MOCK_ROUTES.filter((r) => r.enabled).map((r) => r.id);
    setSelectedRoutes((prev) =>
      prev.size === enabledIds.length ? new Set() : new Set(enabledIds)
    );
  };

  const handlePublish = () => {
    if (selectedRoutes.size === 0) {
      toast('请至少选择一条路由', 'error');
      return;
    }
    toast(`MCP 工具集已创建（${selectedRoutes.size} 条路由）`, 'success');
    onBack();
  };

  const METHOD_STYLE: Record<string, string> = {
    GET: 'bg-emerald-500/10 text-emerald-400',
    POST: 'bg-sky-500/10 text-sky-400',
    PUT: 'bg-amber-500/10 text-amber-400',
    DELETE: 'bg-red-500/10 text-red-400',
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-[48px] flex items-center px-5 border-b border-white/[0.08] bg-white/[0.02] shrink-0">
        <button
          onClick={onBack}
          className="text-[11px] text-slate-400 hover:text-primary transition-colors flex items-center gap-1"
        >
          <Icon name="arrow_back" size={13} /> 返回
        </button>
        <div className="ml-3">
          <h2 className="text-[13px] font-semibold text-slate-100">Gateway 对接</h2>
          <p className="text-[9px] text-slate-500">连接 API 网关，自动发现路由转为 MCP 工具</p>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Config */}
        <div className="w-[320px] shrink-0 border-r border-white/[0.06] p-5 overflow-y-auto dcf-scrollbar">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] text-slate-400 mb-2">网关类型</label>
              <div className="flex gap-1">
                {GW_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setGwType(t)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                      gwType === t
                        ? 'bg-primary text-white'
                        : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 mb-1 block">Admin API 地址 *</label>
              <input
                value={gwUrl}
                onChange={(e) => setGwUrl(e.target.value)}
                placeholder={
                  gwType === 'Higress'
                    ? 'http://higress-admin:8080'
                    : gwType === 'Kong'
                      ? 'http://kong-admin:8001'
                      : 'http://apisix-admin:9180'
                }
                className="w-full h-9 px-3 border border-white/[0.1] bg-white/[0.04] rounded-lg text-[12px] outline-none text-slate-200 placeholder:text-slate-500 focus:border-primary/50"
              />
              <p className="text-[9px] text-slate-500 mt-1">
                {gwType === 'Higress'
                  ? '通常为 Higress Controller 地址'
                  : gwType === 'Kong'
                    ? 'Kong Admin API (8001 端口)'
                    : 'APISIX Admin API (9180 端口)'}
              </p>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 mb-1 block">认证 Token（可选）</label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Admin API 访问凭证"
                className="w-full h-9 px-3 border border-white/[0.1] bg-white/[0.04] rounded-lg text-[12px] outline-none text-slate-200 placeholder:text-slate-500 focus:border-primary/50"
              />
            </div>

            <button
              onClick={handleDiscover}
              disabled={step === 'discovering'}
              className="w-full h-9 rounded-xl text-[12px] font-medium bg-primary text-white disabled:opacity-50 transition-all"
            >
              {step === 'form'
                ? '连接网关并发现路由'
                : step === 'discovering'
                  ? '正在发现路由...'
                  : '✓ 发现完成 · 重新发现'}
            </button>

            {step === 'done' && (
              <div className="bg-emerald-500/[0.06] border border-emerald-500/20 rounded-xl p-3 text-[11px] text-emerald-400 flex items-center gap-2">
                ✓ 连接成功，发现 {MOCK_ROUTES.length} 条路由（
                {MOCK_ROUTES.filter((r) => r.enabled).length} 条已启用）
              </div>
            )}
          </div>
        </div>

        {/* Right: Discovered routes */}
        <div className="flex-1 flex flex-col min-w-[360px]">
          <div className="px-4 pt-3 pb-2.5 border-b border-white/[0.06] flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-200">路由列表</span>
            {step === 'done' && (
              <button onClick={selectAll} className="text-[10px] text-primary font-medium">
                {selectedRoutes.size === MOCK_ROUTES.filter((r) => r.enabled).length
                  ? '取消全选'
                  : '全选已启用'}
              </button>
            )}
          </div>
          <div className="flex-1 p-4 overflow-y-auto dcf-scrollbar">
            {step !== 'done' ? (
              <div className="flex items-center justify-center h-full text-[11px] text-slate-500">
                {step === 'discovering' ? '正在发现路由...' : '填写网关信息后点击"连接网关"'}
              </div>
            ) : (
              <div className="space-y-1.5">
                {MOCK_ROUTES.map((route) => (
                  <div
                    key={route.id}
                    onClick={() => toggleRoute(route.id)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                      !route.enabled
                        ? 'opacity-40 cursor-not-allowed border-white/[0.06]'
                        : selectedRoutes.has(route.id)
                          ? 'border-primary/30 bg-primary/[0.04] cursor-pointer'
                          : 'border-white/[0.06] bg-white/[0.02] cursor-pointer hover:border-white/[0.15]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedRoutes.has(route.id)}
                      readOnly
                      disabled={!route.enabled}
                      className="accent-primary shrink-0"
                    />
                    <span
                      className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${METHOD_STYLE[route.method] || 'bg-white/[0.06] text-slate-400'}`}
                    >
                      {route.method}
                    </span>
                    <span className="text-[11px] font-mono text-slate-300 flex-1 truncate">
                      {route.path}
                    </span>
                    <span className="text-[9px] text-slate-500 shrink-0">{route.upstream}</span>
                    {!route.enabled && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-500 shrink-0">
                        已禁用
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          {step === 'done' && (
            <div className="px-4 pb-3 pt-2 border-t border-white/[0.06] flex justify-between items-center">
              <span className="text-[10px] text-slate-500">
                已选 {selectedRoutes.size} / {MOCK_ROUTES.filter((r) => r.enabled).length} 条路由
              </span>
              <button
                onClick={handlePublish}
                className="h-7 px-4 rounded-lg text-[11px] font-medium bg-primary text-white hover:opacity-90"
              >
                确认发布
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
