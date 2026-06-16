/**
 * AgentReleasePage — 发布管理
 *
 * Tab: 版本管理 / 可用范围
 * 版本列表：状态(已发布/审核中/草稿) + 回滚 + 删除
 * 可用范围：组织/部门/自定义 + 开关
 * 新建版本入口
 */
import { useState } from 'react';
import { useToastStore } from '../../../../application/stores/toastStore';

interface Version {
  v: string;
  desc: string;
  status: '已发布' | '审核中' | '草稿';
  time: string;
}

interface ScopeItem {
  id: string;
  name: string;
  type: '组织' | '部门' | '自定义';
  enabled: boolean;
}

type ReleaseTab = 'versions' | 'scope';

export function AgentReleasePage() {
  const toast = useToastStore((s) => s.addToast);
  const [tab, setTab] = useState<ReleaseTab>('versions');

  // 版本管理
  const [versions, setVersions] = useState<Version[]>([
    { v: 'v1.2.0', desc: '新增索引优化分析能力', status: '已发布', time: '2026-06-01 14:30' },
    {
      v: 'v1.3.0-beta',
      desc: '集成慢查询日志自动分析',
      status: '审核中',
      time: '2026-06-02 09:00',
    },
    { v: 'v2.0.0-draft', desc: '大版本重构', status: '草稿', time: '—' },
  ]);
  const [showNewVersion, setShowNewVersion] = useState(false);
  const [newVersionNum, setNewVersionNum] = useState('');
  const [newVersionDesc, setNewVersionDesc] = useState('');

  // 可用范围
  const [scopeItems, setScopeItems] = useState<ScopeItem[]>([
    { id: 's1', name: '全公司', type: '组织', enabled: true },
    { id: 's2', name: '技术部', type: '部门', enabled: true },
    { id: 's3', name: '产品部', type: '部门', enabled: false },
  ]);
  const [showAddScope, setShowAddScope] = useState(false);
  const [newScopeName, setNewScopeName] = useState('');
  const [newScopeType, setNewScopeType] = useState<ScopeItem['type']>('部门');

  const deleteVersion = (v: string) => {
    setVersions((prev) => prev.filter((ver) => ver.v !== v));
    toast('版本已删除', 'success');
  };

  const rollbackVersion = (v: string) => {
    setVersions((prev) =>
      prev.map((ver) => ({
        ...ver,
        status:
          ver.v === v
            ? ('已发布' as const)
            : ver.status === '已发布'
              ? ('草稿' as const)
              : ver.status,
      }))
    );
    toast(`已回滚到 ${v}`, 'success');
  };

  const createVersion = () => {
    if (!newVersionNum.trim()) {
      toast('请输入版本号', 'error');
      return;
    }
    setVersions((prev) => [
      {
        v: newVersionNum.trim(),
        desc: newVersionDesc.trim() || '无变更说明',
        status: '审核中',
        time: '刚刚',
      },
      ...prev,
    ]);
    setShowNewVersion(false);
    setNewVersionNum('');
    setNewVersionDesc('');
    toast(`版本 ${newVersionNum} 已创建`, 'success');
  };

  const toggleScope = (id: string) => {
    setScopeItems((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
  };

  const addScope = () => {
    if (!newScopeName.trim()) return;
    setScopeItems((prev) => [
      ...prev,
      {
        id: `s${Date.now()}`,
        name: newScopeName.trim(),
        type: newScopeType,
        enabled: true,
      },
    ]);
    setNewScopeName('');
    setShowAddScope(false);
    toast('已添加范围', 'success');
  };

  const removeScope = (id: string) => {
    setScopeItems((prev) => prev.filter((s) => s.id !== id));
    toast('已移除', 'success');
  };

  const statusColor = (s: Version['status']) =>
    s === '已发布'
      ? 'bg-emerald-500/10 text-emerald-400'
      : s === '审核中'
        ? 'bg-amber-500/10 text-amber-400'
        : 'bg-slate-500/10 text-slate-400';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-[48px] flex items-center justify-between px-6 border-b border-white/[0.08] bg-white/[0.02] shrink-0">
        <h2 className="text-[14px] font-semibold text-slate-100">发布管理</h2>
        <button
          onClick={() => setShowNewVersion(true)}
          className="h-7 px-3 rounded-lg text-[11px] font-medium bg-primary text-white hover:opacity-90 transition-opacity"
        >
          + 新建版本
        </button>
      </header>

      {/* Tabs */}
      <div className="px-6 pt-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-1">
          {[
            { key: 'versions' as const, label: '版本管理' },
            { key: 'scope' as const, label: '可用范围' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-[12px] font-medium border-b-2 transition-all ${
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
        {/* 新建版本弹窗 */}
        {showNewVersion && (
          <div className="mb-6 border border-primary/30 bg-primary/[0.04] rounded-2xl p-4 w-full max-w-2xl mx-auto">
            <div className="text-[13px] font-semibold text-slate-100 mb-3">新建版本</div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-slate-400 mb-1 block">版本号 *</label>
                <input
                  value={newVersionNum}
                  onChange={(e) => setNewVersionNum(e.target.value)}
                  placeholder="如 v2.0.0"
                  className="w-full h-8 px-3 border border-white/[0.1] bg-white/[0.04] rounded-lg text-[12px] outline-none text-slate-200 placeholder:text-slate-500 focus:border-primary/50 font-mono"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 mb-1 block">变更说明</label>
                <textarea
                  value={newVersionDesc}
                  onChange={(e) => setNewVersionDesc(e.target.value)}
                  placeholder="描述本次版本的变更内容"
                  className="w-full h-20 px-3 py-2 border border-white/[0.1] bg-white/[0.04] rounded-lg text-[12px] outline-none text-slate-200 placeholder:text-slate-500 focus:border-primary/50 resize-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={createVersion}
                  className="h-8 px-4 rounded-lg text-[11px] font-medium bg-primary text-white hover:opacity-90"
                >
                  确认发布
                </button>
                <button
                  onClick={() => setShowNewVersion(false)}
                  className="h-8 px-4 rounded-lg text-[11px] font-medium border border-white/[0.15] text-slate-300 hover:bg-white/[0.06]"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'versions' && (
          <div className="w-full max-w-3xl mx-auto space-y-2">
            {versions.map((ver) => (
              <div
                key={ver.v}
                className="group flex items-center gap-4 p-4 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[13px] font-mono font-semibold text-slate-100">
                      {ver.v}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${statusColor(ver.status)}`}
                    >
                      {ver.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">{ver.desc}</div>
                  <div className="text-[10px] text-slate-500 mt-1">{ver.time}</div>
                </div>
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {ver.status !== '已发布' && (
                    <button
                      onClick={() => rollbackVersion(ver.v)}
                      className="h-6 px-2 rounded text-[10px] text-slate-300 border border-white/[0.15] hover:bg-white/[0.06]"
                    >
                      发布
                    </button>
                  )}
                  {ver.status === '已发布' &&
                    versions.filter((v) => v.status !== '已发布').length > 0 && (
                      <span className="text-[10px] text-emerald-400 px-2">当前线上</span>
                    )}
                  <button
                    onClick={() => deleteVersion(ver.v)}
                    className="h-6 px-2 rounded text-[10px] text-red-400 border border-red-500/20 hover:bg-red-500/[0.06]"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'scope' && (
          <div className="w-full max-w-2xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-slate-200 font-medium">可用范围</span>
              <button
                onClick={() => setShowAddScope(true)}
                className="text-[11px] text-primary font-medium hover:underline"
              >
                + 添加范围
              </button>
            </div>

            {showAddScope && (
              <div className="p-3 border border-primary/30 bg-primary/[0.04] rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    value={newScopeName}
                    onChange={(e) => setNewScopeName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addScope()}
                    placeholder="范围名称"
                    className="flex-1 h-7 px-2 border border-white/[0.08] bg-white/[0.03] rounded text-[11px] outline-none text-slate-200 placeholder:text-slate-500 focus:border-primary/50"
                    autoFocus
                  />
                  <select
                    value={newScopeType}
                    onChange={(e) => setNewScopeType(e.target.value as ScopeItem['type'])}
                    className="h-7 px-2 border border-white/[0.08] bg-white/[0.03] rounded text-[11px] text-slate-200 outline-none"
                  >
                    <option value="组织">组织</option>
                    <option value="部门">部门</option>
                    <option value="自定义">自定义</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={addScope} className="text-[10px] text-primary font-medium">
                    确认
                  </button>
                  <button
                    onClick={() => {
                      setShowAddScope(false);
                      setNewScopeName('');
                    }}
                    className="text-[10px] text-slate-400"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              {scopeItems.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center gap-3 p-3 rounded-xl border border-white/[0.08] bg-white/[0.03]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-medium text-slate-200">{item.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400">
                        {item.type}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleScope(item.id)}
                    className={`w-[30px] h-[16px] rounded-full relative transition-colors shrink-0 ${item.enabled ? 'bg-emerald-500' : 'bg-slate-600'}`}
                  >
                    <div
                      className={`w-[14px] h-[14px] rounded-full bg-white shadow-sm absolute top-[1px] transition-transform ${item.enabled ? 'translate-x-[14px]' : 'translate-x-[1px]'}`}
                    />
                  </button>
                  <button
                    onClick={() => removeScope(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-red-400 text-[9px] transition-opacity"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
