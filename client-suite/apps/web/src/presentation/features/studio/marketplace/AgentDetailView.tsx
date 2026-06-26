/**
 * AgentDetailView — 共享中心 Agent 完整详情
 *
 * Tab: 介绍 | 能力 | 对话示例 | 评价
 */
import { useState } from 'react';
import { Icon } from '../../../components/ui/Icon';
import type { MarketplaceAgentDTO } from '../../../../infrastructure/api/marketplaceApiClient';

interface Props {
  agent: MarketplaceAgentDTO;
}

/* 去mock:移除 MOCK_SCENARIOS/MOCK_TOOLS_BOUND/MOCK_SKILLS_BOUND/MOCK_CONVERSATIONS 假数据。
 * marketplace agent 未安装时无真实工具/技能/对话数据(这些是 AgentDefinition 安装后才有)。
 * 详情页只展示真字段(name/description/version/author/capabilities),工具/技能/对话示例
 * 引导安装后体验(点"对话"走 installAgent→真 AgentDefinition+instance+真 LLM 对话)。 */

type DetailTab = 'intro' | 'capabilities' | 'examples' | 'reviews';

export function AgentDetailView({ agent }: Props) {
  const [tab, setTab] = useState<DetailTab>('intro');

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 border-b border-white/[0.06]">
        <div className="flex items-center gap-1">
          {[
            { key: 'intro' as const, label: '介绍' },
            { key: 'capabilities' as const, label: '能力' },
            { key: 'examples' as const, label: '对话示例' },
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
        {/* 介绍 */}
        {tab === 'intro' && (
          <div className="w-full max-w-3xl space-y-5">
            {/* 简介卡片 */}
            <div className="border border-white/[0.08] bg-white/[0.03] rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-primary/20 flex items-center justify-center">
                  <Icon
                    name={((agent as Record<string, unknown>).icon as string) || 'smart_toy'}
                    size={24}
                    className="text-slate-200"
                  />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-slate-100">{agent.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {agent.version && (
                      <span className="text-[10px] text-slate-400 font-mono">{agent.version}</span>
                    )}
                    {agent.author && (
                      <span className="text-[10px] text-slate-500">by {agent.author}</span>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-[13px] text-slate-300 leading-relaxed">{agent.description}</p>
            </div>

            {/* 适用人群 */}
            <div>
              <span className="text-[12px] font-semibold text-slate-200 mb-2 block">适用人群</span>
              <div className="flex flex-wrap gap-2">
                {['数据分析师', '产品经理', '运营人员', '管理层', '技术负责人'].map((r) => (
                  <span
                    key={r}
                    className="px-3 py-1.5 rounded-full text-[11px] bg-white/[0.06] text-slate-300"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 能力 */}
        {tab === 'capabilities' && (
          <div className="w-full max-w-3xl space-y-5">
            {/* 能力标签(真字段) */}
            {agent.capabilities && (agent.capabilities as string[]).length > 0 ? (
              <div>
                <span className="text-[12px] font-semibold text-slate-200 mb-2 block">
                  核心能力
                </span>
                <div className="flex flex-wrap gap-2">
                  {(agent.capabilities as string[]).map((cap) => (
                    <span
                      key={cap}
                      className="px-3 py-1.5 rounded-full text-[11px] bg-primary/10 text-primary font-medium"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 text-sm">
                该 Agent 未声明能力标签
              </div>
            )}

            {/* 工具/技能/模型配置:marketplace agent 未安装时无此数据(AgentDefinition 安装后才有),
                不展示假数据。安装后在管理页查看真实配置。 */}
            <div className="border border-white/[0.08] bg-white/[0.03] rounded-xl p-4">
              <span className="text-[11px] text-slate-400">
                工具、技能、模型配置在安装后于管理页查看（市场模板未声明具体配置）
              </span>
            </div>
          </div>
        )}

        {/* 对话示例:marketplace 未安装无真实对话数据。引导安装后体验真对话(走 installAgent→真LLM) */}
        {tab === 'examples' && (
          <div className="w-full max-w-2xl">
            <div className="border border-white/[0.08] bg-white/[0.03] rounded-2xl p-8 text-center">
              <Icon name="chat" size={32} className="text-slate-500 mx-auto mb-3" />
              <p className="text-[13px] text-slate-300 mb-1">安装后体验真实对话</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                点击「对话」安装此 Agent 到你的工作区,即可与它真实交互(经 LiteLLM 真模型调用)。
                市场模板不预置演示对话,避免误导。
              </p>
            </div>
          </div>
        )}

        {/* 评价 */}
        {/* 评价:无真实评价数据源(marketplace 无评价 API),空态 */}
        {tab === 'reviews' && (
          <div className="w-full max-w-2xl">
            <div className="border border-white/[0.08] bg-white/[0.03] rounded-2xl p-8 text-center">
              <Icon name="star_outline" size={32} className="text-slate-500 mx-auto mb-3" />
              <p className="text-[13px] text-slate-300 mb-1">暂无评价</p>
              <p className="text-[11px] text-slate-500">安装使用后可提交评价</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
