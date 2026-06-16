/**
 * McpDetailPage — MCP 工具集详情管理
 *
 * 三 Tab: 概览 / 工具列表 / 调用日志
 * 功能: 查看信息、编辑、工具启停、在线测试、同步源、日志查看
 */
import { useState } from 'react';
import { useToastStore } from '../../../../application/stores/toastStore';
import { Icon } from '../../../components/ui/Icon';

interface Props {
  onBack: () => void;
}

interface McpTool {
  name: string;
  method: string;
  desc: string;
  enabled: boolean;
}

interface LogEntry {
  time: string;
  method: string;
  path: string;
  status: number;
  duration: string;
}

type DetailTab = 'overview' | 'tools' | 'logs';

export function McpDetailPage({ onBack }: Props) {
  const toast = useToastStore((s) => s.addToast);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [enabled, setEnabled] = useState(true);

  // 概览
  const [name] = useState('用户管理 API');
  const [description] = useState('用户服务 MCP 工具集，基于 OpenAPI 自动生成');
  const [endpoint] = useState('https://mcp.clawmate.cn/user-service-mcp/sse');
  const [sourceType] = useState<'openapi' | 'database' | 'gateway'>('openapi');
  const [createdAt] = useState('2026-05-28');

  // 工具列表
  const [tools, setTools] = useState<McpTool[]>([
    { name: 'listUsers', method: 'GET', desc: '获取用户列表', enabled: true },
    { name: 'createUser', method: 'POST', desc: '创建用户', enabled: true },
    { name: 'getUser', method: 'GET', desc: '获取用户详情', enabled: true },
    { name: 'updateUser', method: 'PUT', desc: '更新用户信息', enabled: true },
    { name: 'deleteUser', method: 'DELETE', desc: '删除用户', enabled: false },
  ]);

  // 测试面板
  const [testingTool, setTestingTool] = useState<string | null>(null);
  const [testParams, setTestParams] = useState('{}');
  const [testResult, setTestResult] = useState('');
  const [testRunning, setTestRunning] = useState(false);

  // 日志
  const [logs] = useState<LogEntry[]>([
    { time: '10:32:01', method: 'POST', path: '/createUser', status: 200, duration: '120ms' },
    { time: '10:31:45', method: 'GET', path: '/listUsers', status: 200, duration: '45ms' },
    { time: '10:30:12', method: 'GET', path: '/getUser', status: 200, duration: '230ms' },
    { time: '10:28:55', method: 'DELETE', path: '/deleteUser', status: 403, duration: '12ms' },
    { time: '10:25:30', method: 'PUT', path: '/updateUser', status: 200, duration: '67ms' },
  ]);

  const toggleTool = (toolName: string) => {
    setTools((prev) => prev.map((t) => (t.name === toolName ? { ...t, enabled: !t.enabled } : t)));
  };

  const runTest = () => {
    setTestRunning(true);
    setTestResult('');
    setTimeout(() => {
      setTestResult(
        JSON.stringify(
          { success: true, data: { id: 1, name: 'Alice', email: 'test@example.com' } },
          null,
          2
        )
      );
      setTestRunning(false);
    }, 800);
  };

  const METHOD_STYLE: Record<string, string> = {
    GET: 'bg-emerald-500/10 text-emerald-400',
    POST: 'bg-sky-500/10 text-sky-400',
    PUT: 'bg-amber-500/10 text-amber-400',
    DELETE: 'bg-red-500/10 text-red-400',
  };

  const SOURCE_LABEL: Record<string, string> = {
    openapi: 'OpenAPI 导入',
    database: 'Database 直连',
    gateway: 'Gateway 对接',
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-[48px] flex items-center justify-between px-5 border-b border-white/[0.08] bg-white/[0.02] shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-[11px] text-slate-400 hover:text-primary transition-colors flex items-center gap-1"
          >
            <Icon name="arrow_back" size={13} /> 返回
          </button>
          <h2 className="text-[13px] font-semibold text-slate-100">{name}</h2>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400">
            {SOURCE_LABEL[sourceType]}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500">启用</span>
            <button
              onClick={() => {
                setEnabled(!enabled);
                toast(enabled ? '已停用' : '已启用', 'info');
              }}
              className={`w-[30px] h-[16px] rounded-full relative transition-colors ${enabled ? 'bg-emerald-500' : 'bg-slate-600'}`}
            >
              <div
                className={`w-[14px] h-[14px] rounded-full bg-white shadow-sm absolute top-[1px] transition-transform ${enabled ? 'translate-x-[14px]' : 'translate-x-[1px]'}`}
              />
            </button>
          </div>
          <button
            onClick={() => toast('同步功能即将上线', 'info')}
            className="h-7 px-3 rounded-lg text-[11px] font-medium border border-white/[0.15] text-slate-300 hover:bg-white/[0.06]"
          >
            🔄 同步
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="px-5 pt-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-1">
          {[
            { key: 'overview' as const, label: '概览' },
            { key: 'tools' as const, label: `工具 (${tools.length})` },
            { key: 'logs' as const, label: '调用日志' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-3 py-2 text-[11px] font-medium border-b-2 transition-all ${
                activeTab === t.key
                  ? 'text-primary border-primary'
                  : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 dcf-scrollbar">
        {activeTab === 'overview' && (
          <div className="max-w-[520px] space-y-4">
            <div className="border border-white/[0.08] bg-white/[0.03] rounded-2xl p-4 space-y-3">
              <div className="flex justify-between text-[12px]">
                <span className="text-slate-400">名称</span>
                <span className="text-slate-200">{name}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-slate-400">描述</span>
                <span className="text-slate-200 text-right max-w-[280px]">{description}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-slate-400">来源</span>
                <span className="text-slate-200">{SOURCE_LABEL[sourceType]}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-slate-400">端点</span>
                <span className="text-slate-200 font-mono text-[10px] truncate max-w-[280px]">
                  {endpoint}
                </span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-slate-400">工具数</span>
                <span className="text-slate-200">
                  {tools.filter((t) => t.enabled).length} / {tools.length} 启用
                </span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-slate-400">创建时间</span>
                <span className="text-slate-200">{createdAt}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tools' && (
          <div className="max-w-[600px]">
            <div className="space-y-1.5">
              {tools.map((tool) => (
                <div
                  key={tool.name}
                  className="border border-white/[0.08] bg-white/[0.03] rounded-xl p-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${METHOD_STYLE[tool.method] || ''}`}
                    >
                      {tool.method}
                    </span>
                    <span className="text-[12px] font-mono font-medium text-slate-200 flex-1">
                      {tool.name}
                    </span>
                    <button
                      onClick={() => setTestingTool(testingTool === tool.name ? null : tool.name)}
                      className="text-[9px] text-primary hover:underline mr-2"
                    >
                      测试
                    </button>
                    <button
                      onClick={() => toggleTool(tool.name)}
                      className={`w-[28px] h-[14px] rounded-full relative transition-colors ${tool.enabled ? 'bg-emerald-500' : 'bg-slate-600'}`}
                    >
                      <div
                        className={`w-[12px] h-[12px] rounded-full bg-white shadow-sm absolute top-[1px] transition-transform ${tool.enabled ? 'translate-x-[14px]' : 'translate-x-[1px]'}`}
                      />
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 ml-11">{tool.desc}</div>

                  {/* 测试面板 */}
                  {testingTool === tool.name && (
                    <div className="mt-3 ml-11 p-3 border border-primary/20 bg-primary/[0.03] rounded-xl space-y-2">
                      <div className="text-[10px] text-slate-300 font-medium">测试参数 (JSON)</div>
                      <textarea
                        value={testParams}
                        onChange={(e) => setTestParams(e.target.value)}
                        className="w-full h-16 px-2 py-1.5 border border-white/[0.08] bg-[#0d1117] rounded-lg text-[10px] font-mono outline-none text-emerald-300 resize-none"
                      />
                      <button
                        onClick={runTest}
                        disabled={testRunning}
                        className="h-6 px-3 rounded text-[10px] font-medium bg-primary text-white disabled:opacity-50"
                      >
                        {testRunning ? '执行中...' : '▶ 执行'}
                      </button>
                      {testResult && (
                        <pre className="mt-2 p-2 bg-[#0d1117] rounded-lg text-[9px] font-mono text-emerald-300 whitespace-pre-wrap">
                          {testResult}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="max-w-[600px]">
            <div className="border border-white/[0.08] bg-white/[0.03] rounded-xl overflow-hidden">
              <div className="grid grid-cols-[60px_50px_1fr_50px_60px] gap-2 px-4 py-2 border-b border-white/[0.06] text-[9px] text-slate-500 font-medium">
                <span>时间</span>
                <span>方法</span>
                <span>路径</span>
                <span>状态</span>
                <span>耗时</span>
              </div>
              {logs.map((log, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[60px_50px_1fr_50px_60px] gap-2 px-4 py-2 border-b border-white/[0.04] text-[10px]"
                >
                  <span className="text-slate-500 font-mono">{log.time}</span>
                  <span
                    className={`font-bold text-[8px] ${METHOD_STYLE[log.method]?.split(' ')[1] || 'text-slate-400'}`}
                  >
                    {log.method}
                  </span>
                  <span className="text-slate-300 font-mono">{log.path}</span>
                  <span className={log.status === 200 ? 'text-emerald-400' : 'text-red-400'}>
                    {log.status}
                  </span>
                  <span className="text-slate-400">{log.duration}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
