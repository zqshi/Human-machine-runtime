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

/* ─── Mock 完整详情 ─── */

const MOCK_SCENARIOS = [
  '日常数据查询：快速获取业务指标和报表数据',
  '异常分析：定位数据异常原因并给出修复建议',
  '报表自动化：按模板定期生成分析报告',
  '数据迁移：辅助设计数据迁移方案和验证脚本',
  'A/B 测试分析：对比实验组数据并判断显著性',
];

const MOCK_TOOLS_BOUND = [
  { name: 'db-query', icon: 'storage', desc: '数据库查询，支持 MySQL/PostgreSQL' },
  { name: '云文档', icon: 'description', desc: '搜索和查询云文档内容' },
  { name: '多维表格', icon: 'table_chart', desc: '读写多维表格数据' },
];

const MOCK_SKILLS_BOUND = [
  { name: '报告生成', desc: '自动生成结构化分析报告' },
  { name: '数据可视化', desc: '生成图表和数据看板' },
];

const MOCK_CONVERSATIONS = [
  {
    scenario: '日常数据查询',
    messages: [
      { role: 'user' as const, text: '帮我查一下昨天的订单总量和 GMV' },
      {
        role: 'agent' as const,
        text: '好的，我来查询昨天的订单数据。\n\n**查询结果：**\n- 订单总量：12,847 笔\n- GMV：¥3,256,800\n- 同比增长：+12.3%\n- 客单价：¥253.5\n\n相比前天增长了 8.2%，主要增量来自下午 14:00-18:00 的促销活动。需要我进一步分析具体品类的贡献吗？',
      },
    ],
  },
  {
    scenario: '异常分析',
    messages: [
      { role: 'user' as const, text: '今天下午退款率突然升高了，帮我分析下原因' },
      {
        role: 'agent' as const,
        text: '正在分析今日退款数据...\n\n**异常发现：**\n\n📊 退款率从正常的 2.1% 升至 5.8%\n\n**根因分析：**\n1. 集中在品类「数码配件」（占退款 67%）\n2. 退款原因 TOP1：商品描述不符（48 单）\n3. 关联批次：BN-20260605-003（供应商：深圳XX科技）\n\n**建议：**\n- 立即下架该批次商品\n- 联系供应商核实质量问题\n- 为已购用户主动推送补偿方案\n\n需要我生成详细的退款分析报告吗？',
      },
    ],
  },
  {
    scenario: '报表生成',
    messages: [
      { role: 'user' as const, text: '生成本周的运营周报' },
      {
        role: 'agent' as const,
        text: '正在汇总本周运营数据...\n\n📋 **运营周报 (06.01 - 06.05)**\n\n| 指标 | 本周 | 上周 | 环比 |\n|------|------|------|------|\n| DAU | 45,200 | 42,100 | +7.4% |\n| 订单量 | 68,500 | 63,200 | +8.4% |\n| GMV | ¥16.8M | ¥15.2M | +10.5% |\n| 客诉率 | 1.8% | 2.1% | -14.3% |\n\n**本周亮点：**\n- 新用户转化率提升至 12.3%\n- 会员复购率创新高 34.5%\n\n**待关注：**\n- 物流时效下降 0.3 天\n- 华南区库存告急\n\n报告已同步到云文档，需要我发送给团队吗？',
      },
    ],
  },
];

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

            {/* 应用场景 */}
            <div>
              <span className="text-[12px] font-semibold text-slate-200 mb-3 block">应用场景</span>
              <div className="space-y-2">
                {MOCK_SCENARIOS.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 p-3 border border-white/[0.08] bg-white/[0.03] rounded-xl"
                  >
                    <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] text-primary font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-[12px] text-slate-300">{s}</span>
                  </div>
                ))}
              </div>
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
            {/* 能力标签 */}
            {agent.capabilities && (agent.capabilities as string[]).length > 0 && (
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
            )}

            {/* 工具 (MCP) */}
            <div>
              <span className="text-[12px] font-semibold text-slate-200 mb-3 block">
                已配置工具 (MCP)
              </span>
              <div className="space-y-1.5">
                {MOCK_TOOLS_BOUND.map((t) => (
                  <div
                    key={t.name}
                    className="flex items-center gap-3 p-3 border border-white/[0.08] bg-white/[0.03] rounded-xl"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon name={t.icon} size={16} className="text-primary" />
                    </div>
                    <div>
                      <div className="text-[12px] font-medium text-slate-200">{t.name}</div>
                      <div className="text-[10px] text-slate-500">{t.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 技能 (Skill) */}
            <div>
              <span className="text-[12px] font-semibold text-slate-200 mb-3 block">
                已配置技能 (Skill)
              </span>
              <div className="space-y-1.5">
                {MOCK_SKILLS_BOUND.map((s) => (
                  <div
                    key={s.name}
                    className="flex items-center gap-3 p-3 border border-white/[0.08] bg-white/[0.03] rounded-xl"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Icon name="bolt" size={16} className="text-amber-400" />
                    </div>
                    <div>
                      <div className="text-[12px] font-medium text-slate-200">{s.name}</div>
                      <div className="text-[10px] text-slate-500">{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 模型信息 */}
            <div className="border border-white/[0.08] bg-white/[0.03] rounded-xl p-4">
              <span className="text-[11px] font-semibold text-slate-300 mb-2 block">模型配置</span>
              <div className="flex items-center gap-4 text-[11px]">
                <span className="text-slate-400">
                  模型: <span className="text-slate-200">Claude Sonnet 4</span>
                </span>
                <span className="text-slate-400">
                  Temperature: <span className="text-slate-200">0.7</span>
                </span>
                <span className="text-slate-400">
                  Max Tokens: <span className="text-slate-200">4096</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 对话示例 */}
        {tab === 'examples' && (
          <div className="w-full max-w-3xl space-y-6">
            {MOCK_CONVERSATIONS.map((conv, ci) => (
              <div
                key={ci}
                className="border border-white/[0.08] bg-white/[0.03] rounded-2xl overflow-hidden"
              >
                <div className="px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.06]">
                  <span className="text-[11px] font-medium text-slate-300">
                    场景：{conv.scenario}
                  </span>
                </div>
                <div className="p-4 space-y-3">
                  {conv.messages.map((msg, mi) => (
                    <div
                      key={mi}
                      className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      {msg.role === 'agent' && (
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-sky-600 flex items-center justify-center shrink-0">
                          <Icon
                            name={
                              ((agent as Record<string, unknown>).icon as string) || 'smart_toy'
                            }
                            size={12}
                            className="text-white"
                          />
                        </div>
                      )}
                      <div
                        className={`rounded-xl px-3 py-2 text-[12px] leading-[1.6] max-w-[85%] whitespace-pre-wrap ${
                          msg.role === 'user'
                            ? 'bg-primary text-white rounded-br-[3px]'
                            : 'border border-white/[0.1] bg-white/[0.04] text-slate-200 rounded-bl-[3px]'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 评价 */}
        {tab === 'reviews' && (
          <div className="w-full max-w-2xl space-y-4">
            <div className="flex items-center gap-6 p-4 border border-white/[0.08] bg-white/[0.03] rounded-xl">
              <div className="text-center">
                <div className="text-[28px] font-bold text-slate-100">4.8</div>
                <div className="text-[10px] text-amber-400">★★★★★</div>
                <div className="text-[10px] text-slate-500 mt-0.5">256 评价</div>
              </div>
              <div className="flex-1 space-y-1">
                {[5, 4, 3, 2, 1].map((star) => (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 w-3">{star}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-400"
                        style={{ width: `${[70, 20, 7, 2, 1][5 - star]}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-center">
                <div className="text-[18px] font-bold text-slate-100">1,520</div>
                <div className="text-[10px] text-slate-500">总调用次数</div>
              </div>
            </div>
            {[
              {
                user: '数据部-张明',
                rating: 5,
                text: '每天都在用，查数据、做报表效率提升了 3 倍以上，SQL 生成质量很高',
                time: '2 天前',
              },
              {
                user: '运营-李婷',
                rating: 5,
                text: '异常分析功能太强了，之前需要半天才能定位的问题，现在 5 分钟搞定',
                time: '5 天前',
              },
              {
                user: '产品-王磊',
                rating: 4,
                text: '非常好用，唯一建议是对接更多数据源，目前只支持主库',
                time: '1 周前',
              },
            ].map((r, i) => (
              <div key={i} className="p-3 border border-white/[0.08] bg-white/[0.03] rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium text-slate-200">{r.user}</span>
                  <span className="text-[10px] text-slate-500">{r.time}</span>
                </div>
                <div className="text-[10px] text-amber-400 mb-1">
                  {'★'.repeat(r.rating)}
                  {'☆'.repeat(5 - r.rating)}
                </div>
                <p className="text-[11px] text-slate-300">{r.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
