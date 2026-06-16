/**
 * McpDatabaseFlow — Database 直连模式
 *
 * 设计源模式：左表单配置 + 右表结构/工具预览（两Tab）
 * 流程：填写连接信息 → 测试连接 → 探测表结构 → 勾选表 → 确认发布
 */
import { useState } from 'react';
import { useToastStore } from '../../../../application/stores/toastStore';
import { Icon } from '../../../components/ui/Icon';

interface Props {
  onBack: () => void;
}

interface TableInfo {
  name: string;
  columns: { name: string; type: string; pk: boolean }[];
}

const MOCK_TABLES: TableInfo[] = [
  {
    name: 'users',
    columns: [
      { name: 'id', type: 'INT', pk: true },
      { name: 'name', type: 'VARCHAR(100)', pk: false },
      { name: 'email', type: 'VARCHAR(200)', pk: false },
      { name: 'department', type: 'VARCHAR(50)', pk: false },
    ],
  },
  {
    name: 'orders',
    columns: [
      { name: 'id', type: 'BIGINT', pk: true },
      { name: 'user_id', type: 'INT', pk: false },
      { name: 'amount', type: 'DECIMAL', pk: false },
      { name: 'status', type: 'ENUM', pk: false },
    ],
  },
  {
    name: 'products',
    columns: [
      { name: 'id', type: 'INT', pk: true },
      { name: 'name', type: 'VARCHAR(200)', pk: false },
      { name: 'price', type: 'DECIMAL', pk: false },
    ],
  },
  {
    name: 'departments',
    columns: [
      { name: 'id', type: 'INT', pk: true },
      { name: 'name', type: 'VARCHAR(100)', pk: false },
      { name: 'manager_id', type: 'INT', pk: false },
    ],
  },
];

const DB_TYPES = ['MySQL', 'PostgreSQL', 'SQLite'] as const;

type RightTab = 'schema' | 'tools';
type Step = 'form' | 'testing' | 'introspecting' | 'done';

export function McpDatabaseFlow({ onBack }: Props) {
  const toast = useToastStore((s) => s.addToast);

  const [dbType, setDbType] = useState<string>('MySQL');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('3306');
  const [dbName, setDbName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [rightTab, setRightTab] = useState<RightTab>('schema');
  const [expandedTable, setExpandedTable] = useState<string | null>(null);

  const handleTestConnection = async () => {
    if (!host.trim()) {
      toast('请输入主机地址', 'error');
      return;
    }
    if (!dbName.trim()) {
      toast('请输入数据库名', 'error');
      return;
    }
    setStep('testing');
    await new Promise((r) => setTimeout(r, 1200));
    setStep('introspecting');
    await new Promise((r) => setTimeout(r, 1500));
    setSelectedTables(new Set(MOCK_TABLES.map((t) => t.name)));
    setStep('done');
    toast('连接成功，表结构探测完成', 'success');
  };

  const toggleTable = (name: string) => {
    setSelectedTables((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const generatedTools = [...selectedTables].flatMap((t) => [`query_${t}`, `count_${t}`]);

  const handlePublish = () => {
    if (selectedTables.size === 0) {
      toast('请至少选择一张表', 'error');
      return;
    }
    toast(`MCP 工具集已创建（${generatedTools.length} 个工具）`, 'success');
    onBack();
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
          <h2 className="text-[13px] font-semibold text-slate-100">Database 直连</h2>
          <p className="text-[9px] text-slate-500">连接数据库，自动探测表结构生成查询工具</p>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Form */}
        <div className="w-[340px] shrink-0 border-r border-white/[0.06] p-5 overflow-y-auto dcf-scrollbar">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] text-slate-400 mb-2">数据库类型</label>
              <div className="flex gap-1">
                {DB_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setDbType(t);
                      setPort(t === 'MySQL' ? '3306' : t === 'PostgreSQL' ? '5432' : '');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                      dbType === t
                        ? 'bg-primary text-white'
                        : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <FormField label="主机地址 *" placeholder="localhost" value={host} onChange={setHost} />
            <FormField
              label="端口"
              placeholder={dbType === 'MySQL' ? '3306' : '5432'}
              value={port}
              onChange={setPort}
            />
            <FormField
              label="数据库名 *"
              placeholder="my_database"
              value={dbName}
              onChange={setDbName}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="用户名"
                placeholder="root"
                value={username}
                onChange={setUsername}
              />
              <div>
                <label className="text-[10px] text-slate-400 mb-1 block">密码</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full h-9 px-3 border border-white/[0.1] bg-white/[0.04] rounded-lg text-[12px] outline-none text-slate-200 placeholder:text-slate-500 focus:border-primary/50"
                />
              </div>
            </div>

            <button
              onClick={handleTestConnection}
              disabled={step === 'testing' || step === 'introspecting'}
              className="w-full h-9 rounded-xl text-[12px] font-medium bg-primary text-white disabled:opacity-50 transition-all"
            >
              {step === 'form'
                ? '测试连接并探测表结构'
                : step === 'testing'
                  ? '正在连接...'
                  : step === 'introspecting'
                    ? '正在探测表结构...'
                    : '✓ 探测完成 · 重新探测'}
            </button>

            {step === 'done' && (
              <div className="bg-emerald-500/[0.06] border border-emerald-500/20 rounded-xl p-3 text-[11px] text-emerald-400 flex items-center gap-2">
                ✓ 连接成功，发现 {MOCK_TABLES.length} 张表，将生成 {generatedTools.length} 个工具
              </div>
            )}
          </div>
        </div>

        {/* Right: Schema & Tools */}
        <div className="flex-1 flex flex-col min-w-[340px]">
          <div className="flex px-4 pt-2 gap-0 border-b border-white/[0.06]">
            <button
              onClick={() => setRightTab('schema')}
              className={`px-3.5 py-2.5 text-[10px] font-medium border-b-2 transition-colors ${rightTab === 'schema' ? 'text-primary border-primary' : 'text-slate-500 border-transparent'}`}
            >
              表结构
            </button>
            <button
              onClick={() => setRightTab('tools')}
              className={`px-3.5 py-2.5 text-[10px] font-medium border-b-2 transition-colors ${rightTab === 'tools' ? 'text-primary border-primary' : 'text-slate-500 border-transparent'}`}
            >
              生成的工具 ({generatedTools.length})
            </button>
          </div>
          <div className="flex-1 p-4 overflow-y-auto dcf-scrollbar">
            {step !== 'done' ? (
              <div className="flex items-center justify-center h-full text-[11px] text-slate-500">
                {step === 'testing'
                  ? '正在连接...'
                  : step === 'introspecting'
                    ? '正在探测表结构...'
                    : '填写连接信息后点击"测试连接"'}
              </div>
            ) : rightTab === 'schema' ? (
              <div className="space-y-2">
                {MOCK_TABLES.map((t) => (
                  <div
                    key={t.name}
                    className="border border-white/[0.08] bg-white/[0.03] rounded-xl overflow-hidden"
                  >
                    <div
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-white/[0.03]"
                      onClick={() => setExpandedTable(expandedTable === t.name ? null : t.name)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTables.has(t.name)}
                        onChange={() => toggleTable(t.name)}
                        onClick={(e) => e.stopPropagation()}
                        className="accent-primary"
                      />
                      <span className="text-[12px] font-mono font-medium text-slate-200 flex-1">
                        {t.name}
                      </span>
                      <span className="text-[9px] text-slate-500">{t.columns.length} 列</span>
                      <span
                        className={`text-[10px] text-slate-500 transition-transform ${expandedTable === t.name ? 'rotate-180' : ''}`}
                      >
                        ▾
                      </span>
                    </div>
                    {expandedTable === t.name && (
                      <div className="border-t border-white/[0.06] px-4 py-2">
                        {t.columns.map((c) => (
                          <div key={c.name} className="flex items-center gap-2 py-0.5 text-[10px]">
                            <span
                              className={
                                c.pk
                                  ? 'text-primary font-semibold font-mono'
                                  : 'text-slate-300 font-mono'
                              }
                            >
                              {c.name}
                            </span>
                            {c.pk && (
                              <span className="text-[8px] px-1 py-0.5 rounded bg-primary/10 text-primary">
                                PK
                              </span>
                            )}
                            <span className="text-slate-500 ml-auto">{c.type}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {generatedTools.map((tool) => (
                  <div
                    key={tool}
                    className="border border-white/[0.08] bg-white/[0.03] rounded-xl px-3 py-2.5 flex items-center gap-2"
                  >
                    <span
                      className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${tool.startsWith('query') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-sky-500/10 text-sky-400'}`}
                    >
                      {tool.startsWith('query') ? 'SELECT' : 'COUNT'}
                    </span>
                    <span className="text-[11px] font-mono text-slate-300">{tool}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {step === 'done' && (
            <div className="px-4 pb-3 pt-2 border-t border-white/[0.06] flex justify-between items-center">
              <span className="text-[10px] text-slate-500">
                已选 {selectedTables.size} / {MOCK_TABLES.length} 张表
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

function FormField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[10px] text-slate-400 mb-1 block">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 px-3 border border-white/[0.1] bg-white/[0.04] rounded-lg text-[12px] outline-none text-slate-200 placeholder:text-slate-500 focus:border-primary/50 transition-colors"
      />
    </div>
  );
}
