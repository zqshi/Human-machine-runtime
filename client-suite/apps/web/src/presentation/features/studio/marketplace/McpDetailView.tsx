/**
 * McpDetailView — 共享中心 MCP 完整详情
 *
 * Tab: 概览 | 接口列表 | 使用指南
 */
import { useState } from 'react';
import { Icon } from '../../../components/ui/Icon';

interface McpItem {
  id: string;
  name: string;
  description: string;
  mode: string;
  icon: string;
  color: string;
  toolCount: number;
  installs: number;
}

interface Props {
  mcp: McpItem;
}

interface ToolEndpoint {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  desc: string;
  params: { name: string; type: string; required: boolean; desc: string }[];
  response: string;
}

const METHOD_STYLE: Record<string, string> = {
  GET: 'bg-emerald-500/15 text-emerald-400',
  POST: 'bg-sky-500/15 text-sky-400',
  PUT: 'bg-amber-500/15 text-amber-400',
  DELETE: 'bg-red-500/15 text-red-400',
};

type DetailTab = 'overview' | 'tools' | 'guide';

export function McpDetailView({ mcp }: Props) {
  const [tab, setTab] = useState<DetailTab>('overview');
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  const tools: ToolEndpoint[] = []; // 去 mock:接口列表待接 mcpApi.getToolSchema 真实 schema

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 border-b border-white/[0.06]">
        <div className="flex items-center gap-1">
          {[
            { key: 'overview' as const, label: '概览' },
            { key: 'tools' as const, label: `接口列表 (${tools.length})` },
            { key: 'guide' as const, label: '使用指南' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2.5 text-[11px] font-medium border-b-2 transition-all ${
                tab === t.key
                  ? 'text-primary border-primary'
                  : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 hmr-scrollbar">
        {/* 概览 */}
        {tab === 'overview' && (
          <div className="w-full max-w-3xl space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: '接入模式', value: mcp.mode },
                { label: '工具数', value: String(mcp.toolCount) },
                { label: '安装量', value: String(mcp.installs) },
                { label: '协议', value: 'MCP (SSE)' },
              ].map((m) => (
                <div
                  key={m.label}
                  className="p-3 rounded-xl border border-white/[0.08] bg-white/[0.03]"
                >
                  <div className="text-[10px] text-slate-500">{m.label}</div>
                  <div className="text-[13px] font-medium text-slate-200 mt-0.5">{m.value}</div>
                </div>
              ))}
            </div>

            <div className="border border-white/[0.08] bg-white/[0.03] rounded-2xl p-4 space-y-3">
              <div className="flex justify-between text-[12px]">
                <span className="text-slate-400">名称</span>
                <span className="text-slate-200 font-mono text-[10px]">{mcp.name}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-slate-400">模式</span>
                <span className="text-slate-200">{mcp.mode}</span>
              </div>
            </div>

            <div>
              <span className="text-[12px] font-semibold text-slate-200 mb-2 block">描述</span>
              <p className="text-[12px] text-slate-300 leading-relaxed">{mcp.description}</p>
            </div>
          </div>
        )}

        {/* 接口列表 */}
        {tab === 'tools' && (
          <div className="w-full max-w-3xl space-y-2">
            {tools.map((tool) => (
              <div
                key={tool.name}
                className={`border rounded-xl transition-all ${
                  expandedTool === tool.name
                    ? 'border-primary/30 bg-primary/[0.03]'
                    : 'border-white/[0.08] bg-white/[0.03]'
                }`}
              >
                <div
                  onClick={() => setExpandedTool(expandedTool === tool.name ? null : tool.name)}
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
                >
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-bold shrink-0 ${METHOD_STYLE[tool.method] || ''}`}
                  >
                    {tool.method}
                  </span>
                  <span className="text-[12px] font-mono font-medium text-slate-200 flex-1">
                    {tool.name}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">{tool.path}</span>
                  <Icon
                    name={expandedTool === tool.name ? 'expand_less' : 'expand_more'}
                    size={16}
                    className="text-slate-500 shrink-0"
                  />
                </div>
                {expandedTool === tool.name && (
                  <div className="px-3 pb-3 border-t border-white/[0.06] space-y-3 pt-3">
                    <p className="text-[11px] text-slate-300">{tool.desc}</p>
                    {tool.params.length > 0 && (
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase font-semibold mb-1 block">
                          参数
                        </span>
                        <div className="border border-white/[0.06] rounded-lg overflow-hidden">
                          {tool.params.map((p) => (
                            <div
                              key={p.name}
                              className="flex items-center gap-3 px-3 py-1.5 border-b border-white/[0.04] last:border-0 text-[10px]"
                            >
                              <span className="text-primary font-mono w-20 shrink-0">{p.name}</span>
                              <span className="text-slate-500 w-14 shrink-0">{p.type}</span>
                              <span
                                className={`w-6 shrink-0 ${p.required ? 'text-red-400' : 'text-slate-600'}`}
                              >
                                {p.required ? '✓' : '—'}
                              </span>
                              <span className="text-slate-400">{p.desc}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase font-semibold mb-1 block">
                        响应示例
                      </span>
                      <pre className="p-2.5 bg-[#0d1117] rounded-lg text-[10px] font-mono text-emerald-300 whitespace-pre-wrap">
                        {tool.response}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 使用指南 */}
        {tab === 'guide' && (
          <div className="w-full max-w-3xl space-y-5">
            <div className="border border-white/[0.08] bg-white/[0.03] rounded-2xl p-5">
              <h3 className="text-[13px] font-semibold text-slate-100 mb-3">接入步骤</h3>
              <ol className="space-y-3 text-[12px] text-slate-300">
                <li className="flex gap-2">
                  <span className="text-primary font-bold shrink-0">1.</span>在 Agent
                  编排页面打开「工具 (MCP)」面板
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold shrink-0">2.</span>点击「+
                  添加」搜索并选择此工具
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold shrink-0">3.</span>配置认证凭证（如需要）
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold shrink-0">4.</span>保存后 Agent
                  即可调用此工具的接口
                </li>
              </ol>
            </div>
            <div className="border border-white/[0.08] bg-white/[0.03] rounded-2xl p-5">
              <h3 className="text-[13px] font-semibold text-slate-100 mb-3">
                在 System Prompt 中引用
              </h3>
              <pre className="p-3 bg-[#0d1117] rounded-lg text-[10px] font-mono text-sky-300 whitespace-pre-wrap">{`你可以使用 ${mcp.name} 工具来执行以下操作：
${tools
  .slice(0, 3)
  .map((t) => `- ${t.name}: ${t.desc}`)
  .join('\n')}

调用工具时请使用 tool_call 格式。`}</pre>
            </div>
            <div className="border border-white/[0.08] bg-white/[0.03] rounded-2xl p-5">
              <h3 className="text-[13px] font-semibold text-slate-100 mb-3">注意事项</h3>
              <ul className="space-y-1.5 text-[12px] text-slate-300">
                <li>• 单次查询结果限制 10MB</li>
                <li>• 写操作（execute）需要额外授权</li>
                <li>• 限流：100 请求/分钟</li>
                <li>• 连接超时 30 秒，建议大查询使用 LIMIT</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
