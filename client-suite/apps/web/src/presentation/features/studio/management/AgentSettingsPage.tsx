/**
 * AgentSettingsPage — 基础管理
 *
 * Agent 名称编辑 / 应用凭证(AK/SK) / 协作成员管理 / 应用转让&删除
 */
import { useState } from 'react';
import { useToastStore } from '../../../../application/stores/toastStore';
import { Icon } from '../../../components/ui/Icon';

interface Member {
  id: string;
  name: string;
  role: '所有者' | '管理员';
  joined: string;
  avatar: string;
}

export function AgentSettingsPage() {
  const toast = useToastStore((s) => s.addToast);
  const [tab, setTab] = useState<'info' | 'members'>('info');

  // 基础信息
  const [name, setName] = useState('SQL 优化助手');
  const [editing, setEditing] = useState(false);

  // 凭证
  const [ak, setAk] = useState('');
  const [sk, setSk] = useState('');
  const [showSk, setShowSk] = useState(false);
  const [credentialEditing, setCredentialEditing] = useState(false);

  // 成员
  const [members, setMembers] = useState<Member[]>([
    { id: '1', name: '张秋实', role: '所有者', joined: '2026-05-15', avatar: '🧑‍💻' },
    { id: '2', name: '李明', role: '管理员', joined: '2026-05-20', avatar: '👨‍💼' },
  ]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMember, setNewMember] = useState('');

  const saveCredentials = () => {
    if (!ak.trim()) {
      toast('请填写 AK', 'error');
      return;
    }
    setCredentialEditing(false);
    toast('凭证已保存', 'success');
  };

  const addMember = () => {
    if (!newMember.trim()) return;
    setMembers((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        name: newMember.trim(),
        role: '管理员',
        joined: '2026-06-05',
        avatar: '👤',
      },
    ]);
    setNewMember('');
    setShowAddMember(false);
    toast('已添加成员', 'success');
  };

  const removeMember = (id: string) => {
    if (members.find((m) => m.id === id)?.role === '所有者') {
      toast('不能移除所有者', 'error');
      return;
    }
    setMembers((prev) => prev.filter((m) => m.id !== id));
    toast('已移除成员', 'success');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-[48px] flex items-center px-6 border-b border-white/[0.08] bg-white/[0.02] shrink-0">
        <h2 className="text-[14px] font-semibold text-slate-100">基础管理</h2>
      </header>

      {/* Tabs */}
      <div className="px-6 pt-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-1">
          {[
            { key: 'info' as const, label: '基础信息' },
            { key: 'members' as const, label: '协作成员' },
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

      <div className="flex-1 overflow-y-auto p-6 dcf-scrollbar">
        {tab === 'info' && (
          <div className="w-full max-w-2xl mx-auto space-y-6">
            {/* 名称 */}
            <section className="border border-white/[0.08] bg-white/[0.03] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[12px] font-semibold text-slate-100">Agent 名称</span>
                <button
                  onClick={() => {
                    if (editing) toast('已保存', 'success');
                    setEditing(!editing);
                  }}
                  className="text-[10px] text-primary font-medium hover:underline"
                >
                  {editing ? '保存' : '编辑'}
                </button>
              </div>
              {editing ? (
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-9 px-3 border border-white/[0.1] bg-white/[0.04] rounded-lg text-[13px] outline-none text-slate-200 placeholder:text-slate-500 focus:border-primary/50"
                />
              ) : (
                <div className="text-[13px] text-slate-200">{name}</div>
              )}
              <div className="text-[10px] text-slate-500 mt-2">创建时间: 2026-05-15</div>
            </section>

            {/* 应用凭证 */}
            <section className="border border-white/[0.08] bg-white/[0.03] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[12px] font-semibold text-slate-100">应用凭证</span>
                <button
                  onClick={() =>
                    credentialEditing ? saveCredentials() : setCredentialEditing(true)
                  }
                  className="text-[10px] text-primary font-medium hover:underline"
                >
                  {credentialEditing ? '保存' : '编辑'}
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-slate-400 mb-1 block">App Key</label>
                  {credentialEditing ? (
                    <input
                      value={ak}
                      onChange={(e) => setAk(e.target.value)}
                      placeholder="输入 App Key"
                      className="w-full h-8 px-3 border border-white/[0.1] bg-white/[0.04] rounded-lg text-[12px] outline-none text-slate-200 placeholder:text-slate-500 focus:border-primary/50 font-mono"
                    />
                  ) : (
                    <div className="text-[12px] text-slate-300 font-mono">{ak || '未配置'}</div>
                  )}
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 mb-1 block">App Secret</label>
                  {credentialEditing ? (
                    <input
                      type={showSk ? 'text' : 'password'}
                      value={sk}
                      onChange={(e) => setSk(e.target.value)}
                      placeholder="输入 App Secret"
                      className="w-full h-8 px-3 border border-white/[0.1] bg-white/[0.04] rounded-lg text-[12px] outline-none text-slate-200 placeholder:text-slate-500 focus:border-primary/50 font-mono"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-slate-300 font-mono">
                        {sk ? (showSk ? sk : '••••••••••••') : '未配置'}
                      </span>
                      {sk && (
                        <button
                          onClick={() => setShowSk(!showSk)}
                          className="text-[9px] text-slate-500 hover:text-primary"
                        >
                          {showSk ? '隐藏' : '显示'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-[9px] text-slate-500 mt-3">
                凭证用于外部系统调用此 Agent 时的身份验证
              </div>
            </section>

            {/* 应用管理 */}
            <section className="border border-white/[0.08] bg-white/[0.03] rounded-2xl p-4">
              <div className="text-[12px] font-semibold text-slate-100 mb-3">应用管理</div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => toast('转让功能即将上线', 'info')}
                  className="flex items-center gap-2 p-3 rounded-xl border border-white/[0.08] hover:bg-white/[0.04] transition-colors text-left"
                >
                  <Icon name="swap_horiz" size={16} className="text-slate-400" />
                  <div>
                    <div className="text-[12px] text-slate-200">转让应用</div>
                    <div className="text-[10px] text-slate-500">将所有权转移给其他管理员</div>
                  </div>
                </button>
                <button
                  onClick={() => toast('确认删除？此操作不可逆', 'error')}
                  className="flex items-center gap-2 p-3 rounded-xl border border-red-500/20 hover:bg-red-500/[0.04] transition-colors text-left"
                >
                  <Icon name="delete" size={16} className="text-red-400" />
                  <div>
                    <div className="text-[12px] text-red-300">删除应用</div>
                    <div className="text-[10px] text-slate-500">永久删除此 Agent 及其所有数据</div>
                  </div>
                </button>
              </div>
            </section>
          </div>
        )}

        {tab === 'members' && (
          <div className="w-full max-w-2xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-slate-200 font-medium">
                成员 ({members.length})
              </span>
              <button
                onClick={() => setShowAddMember(true)}
                className="text-[11px] text-primary font-medium hover:underline"
              >
                + 添加成员
              </button>
            </div>

            {showAddMember && (
              <div className="flex items-center gap-2 p-3 border border-primary/30 bg-primary/[0.04] rounded-xl">
                <input
                  value={newMember}
                  onChange={(e) => setNewMember(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addMember()}
                  placeholder="输入成员名称"
                  className="flex-1 h-7 px-2 border border-white/[0.08] bg-white/[0.03] rounded text-[11px] outline-none text-slate-200 placeholder:text-slate-500 focus:border-primary/50"
                  autoFocus
                />
                <button onClick={addMember} className="text-[10px] text-primary font-medium">
                  确认
                </button>
                <button
                  onClick={() => {
                    setShowAddMember(false);
                    setNewMember('');
                  }}
                  className="text-[10px] text-slate-400"
                >
                  取消
                </button>
              </div>
            )}

            <div className="space-y-1.5">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="group flex items-center gap-3 p-3 rounded-xl border border-white/[0.08] bg-white/[0.03]"
                >
                  <span className="text-lg">{m.avatar}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-slate-200">{m.name}</div>
                    <div className="text-[10px] text-slate-500">加入于 {m.joined}</div>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      m.role === '所有者'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-white/[0.06] text-slate-400'
                    }`}
                  >
                    {m.role}
                  </span>
                  {m.role !== '所有者' && (
                    <button
                      onClick={() => removeMember(m.id)}
                      className="opacity-0 group-hover:opacity-100 text-red-400 text-[9px] transition-opacity"
                    >
                      移除
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
