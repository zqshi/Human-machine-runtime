/**
 * McpCreateFlow — MCP 工具创建入口
 *
 * Step 1: 模式选择 — OpenAPI / Database / Gateway
 * 不同模式进入完全不同的交互页面：
 * - OpenAPI: 对话式（左对话 + 右4Tab实时面板）
 * - Database: 表单式（左配置 + 右表结构/工具预览）
 * - Gateway: 表单式（左配置 + 右路由发现列表）
 */
import { useState } from 'react';
import { Icon } from '../../../components/ui/Icon';
import { McpOpenApiFlow } from './McpOpenApiFlow';
import { McpDatabaseFlow } from './McpDatabaseFlow';
import { McpGatewayFlow } from './McpGatewayFlow';

interface Props {
  onBack: () => void;
}

type Mode = 'openapi' | 'database' | 'gateway' | null;

const MODES: {
  key: Exclude<Mode, null>;
  label: string;
  desc: string;
  icon: string;
  color: string;
}[] = [
  {
    key: 'openapi',
    label: 'OpenAPI 导入',
    desc: '提供 API 文档链接或描述，AI 自动解析并完成全部接入',
    icon: 'description',
    color: 'rgba(0,122,255,0.12)',
  },
  {
    key: 'database',
    label: 'Database 直连',
    desc: '填写数据库连接信息，自动探测表结构并生成查询工具',
    icon: 'storage',
    color: 'rgba(52,199,89,0.12)',
  },
  {
    key: 'gateway',
    label: 'Gateway 对接',
    desc: '连接 API 网关 Admin API，自动发现已有路由转为工具',
    icon: 'hub',
    color: 'rgba(255,149,0,0.12)',
  },
];

export function McpCreateFlow({ onBack }: Props) {
  const [mode, setMode] = useState<Mode>(null);

  if (mode === 'openapi') return <McpOpenApiFlow onBack={() => setMode(null)} />;
  if (mode === 'database') return <McpDatabaseFlow onBack={() => setMode(null)} />;
  if (mode === 'gateway') return <McpGatewayFlow onBack={() => setMode(null)} />;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="shrink-0 px-6 pt-5 pb-4 border-b border-white/[0.06]">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-primary mb-2 transition-colors"
        >
          <Icon name="arrow_back" size={14} /> 返回
        </button>
        <h2 className="text-[15px] font-bold text-slate-100">创建 MCP 工具</h2>
        <p className="text-[12px] text-slate-400 mt-1">选择接入方式</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-[560px] w-full space-y-3">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className="w-full flex items-center gap-4 p-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] text-left hover:border-primary/30 hover:bg-white/[0.06] transition-all group"
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: m.color }}
              >
                <Icon name={m.icon} size={22} className="text-slate-200" />
              </div>
              <div className="flex-1">
                <div className="text-[14px] font-semibold text-slate-100">{m.label}</div>
                <div className="text-[12px] text-slate-400 mt-0.5">{m.desc}</div>
              </div>
              <Icon
                name="chevron_right"
                size={16}
                className="text-slate-600 group-hover:text-primary transition-colors"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
