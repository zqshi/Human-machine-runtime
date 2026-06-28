/**
 * McpOpenApiFlow — OpenAPI 对话式接入
 *
 * ⚠️ [演示模式 — 功能开发中] 本流程未接真实后端:后端已有
 * contexts/tool-management/parsers/openapi-parser.ts 与 ToolSourceService.syncOpenApi
 * 真实能力(POST /admin/tools/sources + /sync + /upload-spec),但前端对话式编排
 * (端点发现/Swagger 生成/Higress 导入/mcporter 命令生成)属升级项,当前未实装。
 * 发送消息不会产生任何真实请求,仅提示功能开发中。
 *
 * 设计源模式:左对话 + 右4Tab实时面板(端点发现 → Swagger → Higress MCP → mcporter)
 * 保留 UI 骨架(对话/Tab 结构)供预览,执行按钮禁用,不展示假端点/Swagger 数据。
 *
 * 接真路径(升级时):参照 McpDatabaseFlow(T37)模式 ——
 *   createSource(openapi+specUrl/specContent) → syncSource → 展示真实 tools。
 */
import { useState } from 'react';
import { useToastStore } from '../../../../application/stores/toastStore';
import { Icon } from '../../../components/ui/Icon';

interface Props {
  onBack: () => void;
}

const DEMO_NOTICE = '功能开发中,即将上线';

export function McpOpenApiFlow({ onBack }: Props) {
  const toast = useToastStore((s) => s.addToast);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    toast(DEMO_NOTICE, 'info');
    setInput('');
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
          <h2 className="text-[13px] font-semibold text-slate-100">
            OpenAPI 接入
            <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/15 text-amber-400 align-middle">
              演示模式
            </span>
          </h2>
          <p className="text-[9px] text-slate-500">通过对话快速将 API 文档转为 MCP 工具</p>
        </div>
      </header>

      {/* 演示模式 banner:醒目提示功能开发中 */}
      <div className="px-5 py-2.5 border-b border-amber-500/20 bg-amber-500/[0.06] flex items-center gap-2">
        <Icon name="info" size={12} className="text-amber-400 shrink-0" />
        <p className="text-[11px] text-amber-300">
          本流程为演示模式,功能开发中,即将上线。对话与各 Tab 不会发起任何真实解析或 MCP 生成请求。
        </p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Chat(保留对话骨架,发送仅提示开发中) */}
        <div className="flex-1 flex flex-col min-w-[340px] border-r border-white/[0.06]">
          <div className="flex-1 p-4 overflow-y-auto hmr-scrollbar">
            <div className="flex flex-col gap-3 max-w-[480px]">
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-[9px] shrink-0">
                  AI
                </div>
                <div className="border border-white/[0.1] bg-white/[0.04] rounded-[12px] rounded-bl-[3px] px-3 py-2 text-[12px] leading-[1.6] text-slate-300">
                  你好!OpenAPI 对话式接入功能正在开发中,即将上线。届时提供 API
                  文档链接或描述,即可自动完成端点发现、Swagger 生成、Higress 导入与 mcporter 配置。
                </div>
              </div>
            </div>
          </div>
          <div className="px-4 pb-3 pt-2 border-t border-white/[0.08] flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())
              }
              placeholder="输入 API 文档链接或描述..."
              className="flex-1 h-8 border border-white/[0.1] bg-white/[0.03] rounded-lg px-3 text-[12px] outline-none text-slate-200 placeholder:text-slate-500 focus:border-primary/50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs disabled:opacity-30"
              title={DEMO_NOTICE}
            >
              ↑
            </button>
          </div>
        </div>

        {/* Right: 结果面板(演示模式,各 Tab 不展示假数据) */}
        <div className="w-[45%] min-w-[340px] flex flex-col bg-white/[0.01]">
          <div className="flex px-4 pt-2 gap-0 border-b border-white/[0.06]">
            {['端点发现', 'Swagger', 'Higress MCP', 'mcporter'].map((label) => (
              <button
                key={label}
                className="px-3 py-2.5 text-[10px] font-medium border-b-2 border-transparent text-slate-500"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex-1 p-4 overflow-y-auto hmr-scrollbar">
            <div className="flex flex-col items-center justify-center h-full text-center gap-2">
              <Icon name="construction" size={28} className="text-slate-600" />
              <p className="text-[11px] text-slate-500">
                功能开发中,即将上线
                <br />
                <span className="text-[10px] text-slate-600">
                  端点发现/Swagger/Higress/mcporter 结果将在接入后端后启用
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
