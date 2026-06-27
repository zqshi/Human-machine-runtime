/**
 * SkillDetailView — 共享中心 Skill 完整详情
 *
 * Tab: 概览 | 文件结构 | 参数&示例 | 评价
 *
 * 去mock:移除 MOCK_SKILL_MD/MOCK_FILES/MOCK_PARAMS/MOCK_EXAMPLES + reviews 假数据。
 * MarketplaceSkillDTO 无 files/params 字段(文件结构/参数/示例是 skill 内容,需 downloadSkill
 * 拉真内容后展示,当前无详情接口返文件结构→空态)。overview 用 skill 真字段。reviews 无真接口→空态。
 */
import { useState } from 'react';
import { Icon } from '../../../components/ui/Icon';
import type { MarketplaceSkillDTO } from '../../../../application/services/adminApi';

interface Props {
  skill: MarketplaceSkillDTO;
}

type DetailTab = 'overview' | 'files' | 'params' | 'reviews';

function EmptyState({ icon, title, hint }: { icon: string; title: string; hint: string }) {
  return (
    <div className="w-full max-w-2xl">
      <div className="border border-white/[0.08] bg-white/[0.03] rounded-2xl p-8 text-center">
        <Icon name={icon} size={32} className="text-slate-500 mx-auto mb-3" />
        <p className="text-[13px] text-slate-300 mb-1">{title}</p>
        <p className="text-[11px] text-slate-500">{hint}</p>
      </div>
    </div>
  );
}

export function SkillDetailView({ skill }: Props) {
  const [tab, setTab] = useState<DetailTab>('overview');

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tabs */}
      <div className="px-6 border-b border-white/[0.06]">
        <div className="flex items-center gap-1">
          {[
            { key: 'overview' as const, label: '概览' },
            { key: 'files' as const, label: '文件结构' },
            { key: 'params' as const, label: '参数 & 示例' },
            { key: 'reviews' as const, label: '评价' },
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
        {/* 概览(真字段) */}
        {tab === 'overview' && (
          <div className="w-full max-w-3xl space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: '版本', value: skill.version || 'v1.0.0' },
                { label: '作者', value: skill.author || '—' },
                { label: '分类', value: skill.category || '—' },
                { label: '下载量', value: String(skill.downloads ?? 0) },
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

            {/* 描述(真字段) */}
            {skill.description && (
              <div>
                <span className="text-[11px] font-medium text-slate-400 mb-2 block">描述</span>
                <p className="text-[12px] text-slate-300 leading-relaxed">{skill.description}</p>
              </div>
            )}

            <div className="border border-white/[0.08] bg-white/[0.03] rounded-xl p-4">
              <span className="text-[11px] text-slate-400">
                文件结构、参数、SKILL.md 内容在安装技能后查看(市场模板未返文件详情)
              </span>
            </div>
          </div>
        )}

        {/* 文件结构:无真接口(marketplace 未返文件详情),空态 */}
        {tab === 'files' && (
          <EmptyState icon="folder" title="暂无文件结构" hint="安装技能后查看完整文件内容" />
        )}

        {/* 参数 & 示例:无真接口,空态 */}
        {tab === 'params' && (
          <EmptyState
            icon="settings"
            title="暂无参数与示例"
            hint="安装技能后查看输入参数与使用示例"
          />
        )}

        {/* 评价:无真接口,空态 */}
        {tab === 'reviews' && (
          <EmptyState icon="star_outline" title="暂无评价" hint="安装使用后可提交评价" />
        )}
      </div>
    </div>
  );
}
