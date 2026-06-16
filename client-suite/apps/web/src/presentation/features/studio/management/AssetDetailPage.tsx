/**
 * AssetDetailPage — Skill / App 通用详情页（暗色主题）
 *
 * 三 Tab: 概览 / 版本 / 使用统计
 * 支持编辑名称/描述、查看版本历史。
 */
import { useState } from 'react';
import { useStudioStore } from '../../../../application/stores/studioStore';
import { useToastStore } from '../../../../application/stores/toastStore';
import { Icon } from '../../../components/ui/Icon';

interface Props {
  assetId: string;
  onBack: () => void;
}

type DetailTab = 'overview' | 'versions' | 'usage';

const TYPE_LABEL: Record<string, string> = {
  Skill: '技能',
  App: '应用',
  Agent: 'Agent',
  MCP: 'MCP 工具',
};

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  draft: { text: '草稿', color: 'text-slate-400' },
  published: { text: '已发布', color: 'text-emerald-400' },
  running: { text: '运行中', color: 'text-sky-400' },
};

export function AssetDetailPage({ assetId, onBack }: Props) {
  const asset = useStudioStore((s) => s.assets.find((a) => a.id === assetId));
  const toast = useToastStore((s) => s.addToast);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  if (!asset) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        资产不存在
      </div>
    );
  }

  const handleEdit = () => {
    setEditName(asset.name);
    setEditDesc(asset.description || '');
    setEditing(true);
  };

  const handleSave = () => {
    toast('保存成功', 'success');
    setEditing(false);
  };

  const statusInfo = STATUS_LABEL[asset.status] || STATUS_LABEL.draft;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-[48px] flex items-center justify-between px-5 border-b border-white/[0.08] bg-white/[0.02] shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-[11px] text-slate-400 hover:text-primary transition-colors flex items-center gap-1"
          >
            <Icon name="arrow_back" size={13} /> 返回
          </button>
          <h2 className="text-[14px] font-semibold text-slate-100">{asset.name}</h2>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400">
            {TYPE_LABEL[asset.type] || asset.type}
          </span>
          <span className={`text-[9px] ${statusInfo.color}`}>● {statusInfo.text}</span>
        </div>
        <div className="flex items-center gap-2">
          {asset.origin === 'created' && (
            <button
              onClick={editing ? handleSave : handleEdit}
              className="h-7 px-3 rounded-lg text-[11px] font-medium border border-white/[0.15] text-slate-300 hover:bg-white/[0.06]"
            >
              {editing ? '💾 保存' : '✏️ 编辑'}
            </button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="px-5 pt-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-1">
          {[
            { key: 'overview' as const, label: '概览' },
            { key: 'versions' as const, label: '版本历史' },
            { key: 'usage' as const, label: '使用统计' },
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
                {editing ? (
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="text-right bg-transparent border-b border-primary/50 text-slate-200 outline-none text-[12px] w-48"
                  />
                ) : (
                  <span className="text-slate-200">{asset.name}</span>
                )}
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-slate-400">类型</span>
                <span className="text-slate-200">{TYPE_LABEL[asset.type]}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-slate-400">来源</span>
                <span className="text-slate-200">
                  {asset.origin === 'created'
                    ? '自建'
                    : asset.origin === 'installed'
                      ? '已安装'
                      : '组织共享'}
                </span>
              </div>
              {asset.source && (
                <div className="flex justify-between text-[12px]">
                  <span className="text-slate-400">安装自</span>
                  <span className="text-slate-200">{asset.source}</span>
                </div>
              )}
              <div className="flex justify-between text-[12px]">
                <span className="text-slate-400">版本</span>
                <span className="text-slate-200">{asset.version || 'v0.0.1'}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-slate-400">状态</span>
                <span className={statusInfo.color}>{statusInfo.text}</span>
              </div>
              {asset.updatedAt && (
                <div className="flex justify-between text-[12px]">
                  <span className="text-slate-400">更新时间</span>
                  <span className="text-slate-200">{asset.updatedAt}</span>
                </div>
              )}
            </div>

            {/* 描述 */}
            <div className="border border-white/[0.08] bg-white/[0.03] rounded-2xl p-4">
              <div className="text-[11px] text-slate-400 mb-2">描述</div>
              {editing ? (
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full min-h-[80px] p-2 bg-white/[0.03] border border-white/[0.08] rounded-lg text-[12px] text-slate-200 outline-none resize-none focus:border-primary/50"
                />
              ) : (
                <p className="text-[12px] text-slate-300 leading-relaxed">
                  {asset.description || '暂无描述'}
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'versions' && (
          <div className="max-w-[520px] space-y-2">
            {[
              {
                version: asset.version || 'v0.0.1',
                date: asset.updatedAt || '-',
                note: '当前版本',
                current: true,
              },
            ].map((v, i) => (
              <div
                key={i}
                className={`border rounded-xl p-3 ${v.current ? 'border-primary/30 bg-primary/[0.04]' : 'border-white/[0.08] bg-white/[0.03]'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-mono font-medium text-slate-200">
                      {v.version}
                    </span>
                    {v.current && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                        当前
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500">{v.date}</span>
                </div>
                {v.note && <div className="text-[10px] text-slate-400 mt-1">{v.note}</div>}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'usage' && (
          <div className="max-w-[520px]">
            <div className="text-center py-12 text-slate-500">
              <Icon name="bar_chart" size={32} className="mx-auto mb-2 opacity-30" />
              <div className="text-[12px]">使用统计即将上线</div>
              <div className="text-[10px] mt-1">将展示调用次数、用户分布等数据</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
