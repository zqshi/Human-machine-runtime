import React from 'react';
import { Icon } from '../../components/ui/Icon';
import type { AppTemplate } from './AICreationPanel';
import { APP_TEMPLATES } from './AICreationPanel';

export function PreviewIdle({
  hoveredTemplate,
  onSelect,
}: {
  hoveredTemplate: AppTemplate | null;
  onSelect: (tpl: AppTemplate) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full max-w-2xl mx-auto">
      {hoveredTemplate ? (
        <div className="w-full animate-in fade-in duration-200">
          <div className="mb-4 text-center">
            <p className="text-xs text-text-muted">模板预览</p>
            <p className="text-sm font-semibold text-text-primary mt-0.5">{hoveredTemplate.name}</p>
          </div>
          <div className="transform scale-90 origin-top">
            <TemplatePreview template={hoveredTemplate} isMobile={false} />
          </div>
        </div>
      ) : (
        <div className="text-center space-y-6">
          <div className="space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-fill-tertiary flex items-center justify-center mx-auto">
              <Icon name="dashboard_customize" size={28} className="text-text-muted" />
            </div>
            <p className="text-sm font-medium text-text-primary">选择模板开始创建</p>
            <p className="text-xs text-text-muted">点击模板卡片快速生成，或在左侧输入自定义需求</p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {APP_TEMPLATES.map((tpl) => (
              <button
                key={tpl.key}
                type="button"
                onClick={() => onSelect(tpl)}
                className="group flex flex-col items-center gap-3 p-5 rounded-2xl border border-border bg-bg-white-var hover:border-primary/40 hover:shadow-lg transition-all"
              >
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ background: `${tpl.color}12` }}
                >
                  <Icon name={tpl.icon} size={28} style={{ color: tpl.color }} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-text-primary group-hover:text-primary transition-colors">
                    {tpl.name}
                  </p>
                  <p className="text-[11px] text-text-muted leading-relaxed">{tpl.description}</p>
                </div>
                <span className="text-[10px] text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  点击生成 <Icon name="arrow_forward" size={10} />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function PreviewLoading() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-2xl bg-primary/10 animate-pulse" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon name="hourglass_top" size={28} className="text-primary animate-spin" />
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-text-primary">应用加载中</p>
        <p className="text-xs text-text-muted">请稍候，界面即将呈现</p>
      </div>
    </div>
  );
}

export function MobileFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className="w-[375px] bg-bg-white-var rounded-[2.5rem] shadow-2xl border border-border overflow-hidden"
        style={{ minHeight: '680px' }}
      >
        <div className="h-11 bg-fill-tertiary flex items-center justify-between px-6">
          <span className="text-[11px] font-semibold text-text-primary">9:41</span>
          <div className="w-20 h-5 rounded-full bg-black mx-auto" />
          <div className="flex items-center gap-1">
            <Icon name="signal_cellular_alt" size={12} className="text-text-primary" />
            <Icon name="wifi" size={12} className="text-text-primary" />
            <Icon name="battery_full" size={12} className="text-text-primary" />
          </div>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(680px - 2.75rem - 1.5rem)' }}>
          {children}
        </div>
        <div className="flex justify-center py-2">
          <div className="w-32 h-1 rounded-full bg-text-muted/30" />
        </div>
      </div>
    </div>
  );
}

export function TemplatePreview({
  template,
  isMobile,
}: {
  template: AppTemplate;
  isMobile: boolean;
}) {
  const tpl = template.key;
  return (
    <div
      className={
        isMobile ? '' : 'bg-bg-white-var rounded-2xl shadow-lg border border-border overflow-hidden'
      }
    >
      <div
        className={`border-b border-border flex items-center justify-between ${isMobile ? 'px-4 py-2.5 bg-bg-white-var' : 'bg-fill-tertiary px-6 py-3'}`}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`rounded-lg flex items-center justify-center ${isMobile ? 'w-7 h-7' : 'w-8 h-8'}`}
            style={{ background: `${template.color}14` }}
          >
            <Icon
              name={template.icon}
              size={isMobile ? 16 : 18}
              style={{ color: template.color }}
            />
          </div>
          <div>
            <p className={`font-semibold text-text-primary ${isMobile ? 'text-xs' : 'text-sm'}`}>
              {tpl === 'form-query'
                ? '剩余年假查询'
                : tpl === 'daily-report'
                  ? '团队日报'
                  : '设备报修'}
            </p>
            <p className={`text-text-muted ${isMobile ? 'text-[9px]' : 'text-[10px]'}`}>
              {template.tagline}
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-border text-[10px] text-text-muted">
          <Icon name="auto_awesome" size={10} className="text-primary" />
          AI 生成
        </span>
      </div>
      <div className={isMobile ? 'p-4 space-y-4' : 'p-8 space-y-6'}>
        {tpl === 'form-query' && <FormQueryBody isMobile={isMobile} />}
        {tpl === 'daily-report' && <DailyReportBody isMobile={isMobile} />}
        {tpl === 'ticket-system' && <TicketSystemBody isMobile={isMobile} />}
      </div>
    </div>
  );
}

function FormQueryBody({ isMobile }: { isMobile: boolean }) {
  return (
    <>
      <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 gap-4'}`}>
        <div
          className={`rounded-xl bg-fill-tertiary border border-border ${isMobile ? 'p-3.5' : 'p-5'}`}
        >
          <p className={`text-text-muted mb-1 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>当前年份</p>
          <p className={`font-bold text-text-primary ${isMobile ? 'text-base' : 'text-xl'}`}>
            2024 年度
          </p>
        </div>
        <div
          className={`rounded-xl bg-success/10 border border-success/20 ${isMobile ? 'p-3.5' : 'p-5'}`}
        >
          <p className={`text-success mb-1 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>剩余天数</p>
          <div className="flex items-baseline gap-1">
            <span className={`font-bold text-success ${isMobile ? 'text-2xl' : 'text-3xl'}`}>
              12.5
            </span>
            <span className={`text-text-muted ${isMobile ? 'text-xs' : 'text-sm'}`}>天</span>
          </div>
        </div>
      </div>
      <div className={isMobile ? 'space-y-3' : 'space-y-4'}>
        <div>
          <label
            className={`text-text-secondary mb-1.5 block font-medium ${isMobile ? 'text-[11px]' : 'text-xs'}`}
          >
            查询员工姓名
          </label>
          <input
            type="text"
            value="Alice (current)"
            readOnly
            className={`w-full border border-border rounded-xl bg-fill-tertiary text-text-primary ${isMobile ? 'px-3 py-2.5 text-xs' : 'px-4 py-3 text-sm'}`}
          />
        </div>
        <div>
          <label
            className={`text-text-secondary mb-1.5 block font-medium ${isMobile ? 'text-[11px]' : 'text-xs'}`}
          >
            休假类型
          </label>
          <div
            className={`w-full border border-border rounded-xl bg-fill-tertiary text-text-primary ${isMobile ? 'px-3 py-2.5 text-xs' : 'px-4 py-3 text-sm'}`}
          >
            带薪年假
          </div>
        </div>
      </div>
      <button
        type="button"
        className={`w-full rounded-xl bg-primary text-white font-semibold flex items-center justify-center gap-2 ${isMobile ? 'py-3 text-xs' : 'py-3.5 text-sm'}`}
      >
        立即查询 <Icon name="arrow_forward" size={isMobile ? 14 : 16} />
      </button>
      <p className={`text-text-muted text-center ${isMobile ? 'text-[9px]' : 'text-[10px]'}`}>
        数据来源于公司 HR Core 系统
      </p>
    </>
  );
}

function DailyReportBody({ isMobile }: { isMobile: boolean }) {
  const sz = isMobile ? 'text-xs' : 'text-sm';
  const szSm = isMobile ? 'text-[10px]' : 'text-xs';
  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="calendar_today" size={isMobile ? 14 : 16} className="text-primary" />
          <span className={`font-semibold text-text-primary ${sz}`}>2024-03-14（周四）</span>
        </div>
        <span className={`px-2 py-0.5 rounded-full border border-border ${szSm} text-text-muted`}>
          日报模板
        </span>
      </div>
      {[
        {
          title: '今日完成',
          icon: 'check_circle',
          color: '#34C759',
          items: ['完成用户认证模块开发', '修复工单列表分页 bug'],
        },
        { title: '进行中', icon: 'pending', color: '#FF9500', items: ['数据报表页面联调'] },
        {
          title: '明日计划',
          icon: 'event_upcoming',
          color: '#007AFF',
          items: ['集成测试 + 代码 review', '准备周五 demo 演示'],
        },
      ].map((sec) => (
        <div key={sec.title} className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Icon name={sec.icon} size={isMobile ? 14 : 16} style={{ color: sec.color }} />
            <span className={`font-semibold text-text-primary ${szSm}`}>{sec.title}</span>
          </div>
          <div
            className={`rounded-xl border border-border bg-fill-tertiary ${isMobile ? 'p-3' : 'p-4'} space-y-1.5`}
          >
            {sec.items.map((item) => (
              <div key={item} className={`flex items-start gap-2 ${szSm} text-text-secondary`}>
                <span className="text-text-muted mt-0.5">•</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className={`flex gap-2 ${isMobile ? 'flex-col' : ''}`}>
        <button
          type="button"
          className={`flex-1 rounded-xl bg-[#34C759] text-white font-semibold flex items-center justify-center gap-2 ${isMobile ? 'py-3 text-xs' : 'py-3.5 text-sm'}`}
        >
          <Icon name="send" size={isMobile ? 14 : 16} />
          提交日报
        </button>
        <button
          type="button"
          className={`rounded-xl border border-border text-text-secondary font-medium flex items-center justify-center gap-2 ${isMobile ? 'py-3 text-xs' : 'py-3.5 text-sm px-6'}`}
        >
          暂存草稿
        </button>
      </div>
    </>
  );
}

function TicketSystemBody({ isMobile }: { isMobile: boolean }) {
  const sz = isMobile ? 'text-xs' : 'text-sm';
  const szSm = isMobile ? 'text-[10px]' : 'text-xs';
  const TICKETS = [
    {
      id: 'TK-0042',
      title: '打印机卡纸',
      status: '处理中',
      statusColor: '#FF9500',
      priority: '中',
      time: '2 小时前',
    },
    {
      id: 'TK-0041',
      title: '网络连接不稳定',
      status: '待分配',
      statusColor: '#FF3B30',
      priority: '高',
      time: '3 小时前',
    },
    {
      id: 'TK-0040',
      title: '笔记本电池鼓包',
      status: '已完成',
      statusColor: '#34C759',
      priority: '中',
      time: '昨天',
    },
  ];
  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {['全部', '待分配', '处理中', '已完成'].map((tab, i) => (
            <button
              key={tab}
              type="button"
              className={`px-3 py-1 rounded-full ${szSm} font-medium transition-colors ${
                i === 0 ? 'bg-[#FF9500]/10 text-[#FF9500]' : 'text-text-muted hover:bg-bg-hover'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#FF9500] text-white ${szSm} font-medium`}
        >
          <Icon name="add" size={14} />
          新建工单
        </button>
      </div>
      <div className="space-y-2">
        {TICKETS.map((tk) => (
          <div
            key={tk.id}
            className={`flex items-center gap-3 ${isMobile ? 'p-3' : 'p-4'} rounded-xl border border-border bg-bg-white-var hover:shadow-sm transition-shadow`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`font-mono ${szSm} text-text-muted`}>{tk.id}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-medium text-white`}
                  style={{ background: tk.statusColor }}
                >
                  {tk.status}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-medium border border-border text-text-muted`}
                >
                  P: {tk.priority}
                </span>
              </div>
              <p className={`font-medium text-text-primary ${sz}`}>{tk.title}</p>
            </div>
            <span className={`${szSm} text-text-muted shrink-0`}>{tk.time}</span>
            <Icon name="chevron_right" size={16} className="text-text-muted shrink-0" />
          </div>
        ))}
      </div>
      <div
        className={`flex items-center justify-between rounded-xl bg-fill-tertiary border border-border ${isMobile ? 'p-3' : 'p-4'}`}
      >
        {[
          { label: '待分配', value: '3', color: '#FF3B30' },
          { label: '处理中', value: '5', color: '#FF9500' },
          { label: '本周完成', value: '12', color: '#34C759' },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <p
              className={`font-bold ${isMobile ? 'text-lg' : 'text-xl'}`}
              style={{ color: s.color }}
            >
              {s.value}
            </p>
            <p className={`${szSm} text-text-muted`}>{s.label}</p>
          </div>
        ))}
      </div>
    </>
  );
}
