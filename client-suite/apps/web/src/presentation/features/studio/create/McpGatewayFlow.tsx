/**
 * McpGatewayFlow — Gateway 对接模式
 *
 * ⚠️ [演示模式 — 功能开发中] 本流程未接真实后端:后端已有
 * contexts/tool-management/parsers/gateway-discoverer.ts 与 ToolSourceService.syncGateway
 * 真实能力(POST /admin/tools/sources + /sync),但前端对接(网关可达性/凭证/契约对齐)
 * 属升级项,当前未实装。点击"连接网关"等动作不会产生任何真实请求,仅提示功能开发中。
 *
 * 设计源模式:左网关配置 + 右路由发现列表
 * 保留 UI 骨架(表单/步骤结构)供预览,执行按钮禁用,不展示假路由数据。
 *
 * 接真路径(升级时):参照 McpDatabaseFlow(T37)模式 ——
 *   createSource(gatewayType+gatewayUrl+gatewayCredentialId) → syncSource → 展示真实 routes。
 */
import { useState } from 'react';
import { useToastStore } from '../../../../application/stores/toastStore';
import { Icon } from '../../../components/ui/Icon';

interface Props {
  onBack: () => void;
}

const GW_TYPES = ['Higress', 'Kong', 'APISIX'] as const;

// 演示模式:不执行任何真实/模拟连接,所有执行按钮禁用,提示功能开发中。
const DEMO_NOTICE = '功能开发中,即将上线';

export function McpGatewayFlow({ onBack }: Props) {
  const toast = useToastStore((s) => s.addToast);

  const [gwType, setGwType] = useState<string>('Higress');
  const [gwUrl, setGwUrl] = useState('');
  const [token, setToken] = useState('');

  const notifyDev = () => toast(DEMO_NOTICE, 'info');

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
          <h2 className="text-[13px] font-semibold text-slate-100">
            Gateway 对接
            <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/15 text-amber-400 align-middle">
              演示模式
            </span>
          </h2>
          <p className="text-[9px] text-slate-500">连接 API 网关,自动发现路由转为 MCP 工具</p>
        </div>
      </header>

      {/* 演示模式 banner:醒目提示功能开发中,不执行真实/模拟连接 */}
      <div className="px-5 py-2.5 border-b border-amber-500/20 bg-amber-500/[0.06] flex items-center gap-2">
        <Icon name="info" size={12} className="text-amber-400 shrink-0" />
        <p className="text-[11px] text-amber-300">
          本流程为演示模式,功能开发中,即将上线。表单可填写预览,但不会发起任何真实连接或路由发现请求。
        </p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Config */}
        <div className="w-[320px] shrink-0 border-r border-white/[0.06] p-5 overflow-y-auto hmr-scrollbar">
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
              <label className="text-[10px] text-slate-400 mb-1 block">Admin API 地址</label>
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
              <label className="text-[10px] text-slate-400 mb-1 block">认证 Token(可选)</label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Admin API 访问凭证"
                className="w-full h-9 px-3 border border-white/[0.1] bg-white/[0.04] rounded-lg text-[12px] outline-none text-slate-200 placeholder:text-slate-500 focus:border-primary/50"
              />
            </div>

            {/* 演示模式:执行按钮禁用,点击仅提示功能开发中 */}
            <button
              onClick={notifyDev}
              className="w-full h-9 rounded-xl text-[12px] font-medium bg-white/[0.06] text-slate-400 cursor-not-allowed"
              title={DEMO_NOTICE}
            >
              连接网关并发现路由
            </button>
          </div>
        </div>

        {/* Right: 路由发现占位(演示模式不展示假路由数据) */}
        <div className="flex-1 flex flex-col min-w-[360px]">
          <div className="px-4 pt-3 pb-2.5 border-b border-white/[0.06] flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-200">路由列表</span>
          </div>
          <div className="flex-1 p-4 overflow-y-auto hmr-scrollbar">
            <div className="flex flex-col items-center justify-center h-full text-center gap-2">
              <Icon name="construction" size={28} className="text-slate-600" />
              <p className="text-[11px] text-slate-500">
                功能开发中,即将上线
                <br />
                <span className="text-[10px] text-slate-600">真实路由发现将在接入后端后启用</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
