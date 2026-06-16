/**
 * SubscriptionManagerPanel — 管理外部订阅 (stitch_5 对齐)
 * 右侧面板：订阅数据源 + 跟踪主题 + 发送设置 + 发送时间
 */
import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import { useToastStore } from '../../../application/stores/toastStore';

interface TrackedTopic {
  id: string;
  label: string;
  icon: string;
}

const INITIAL_TOPICS: TrackedTopic[] = [
  { id: 't1', label: '低空经济', icon: '📊' },
  { id: 't2', label: 'AI手机市场', icon: '📱' },
];

interface SubscriptionManagerPanelProps {
  onClose?: () => void;
}

type DeliveryFreq = 'realtime' | 'daily' | 'weekly';

export function SubscriptionManagerPanel({ onClose }: SubscriptionManagerPanelProps) {
  const [deliveryFreq, setDeliveryFreq] = useState<DeliveryFreq>('daily');
  const [desktopPush, setDesktopPush] = useState(true);
  const [emailNotify, setEmailNotify] = useState(false);
  const [topics, setTopics] = useState<TrackedTopic[]>(INITIAL_TOPICS);
  const [sendTime, setSendTime] = useState('18:00');

  const removeTopic = (id: string) => {
    setTopics((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="w-80 border-l border-border bg-bg-secondary overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-text-primary">管理外部订阅</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => useToastStore.getState().addToast('设置已保存', 'success')}
            className="px-3 py-1.5 text-[11px] font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
          >
            保存设置
          </button>
          {onClose && (
            <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-bg-hover text-text-secondary">
              <Icon name="close" size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 p-4 space-y-6 overflow-y-auto">
        {/* 订阅数据源 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">订阅数据源</h4>
            <button type="button" onClick={() => useToastStore.getState().addToast('配置源功能开发中', 'info')} className="text-[11px] text-primary font-medium hover:text-primary/80">
              配置源
            </button>
          </div>
          <div className="bg-bg-white-var rounded-xl border border-border p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-[#5856D6] flex items-center justify-center">
              <Icon name="auto_awesome" size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-text-primary">AI 聚合资讯</span>
                <Icon name="verified" size={16} className="text-success" />
              </div>
              <p className="text-[11px] text-text-secondary mt-0.5">行业趋势与市场信息</p>
            </div>
          </div>
        </section>

        {/* 跟踪主题 */}
        <section>
          <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">
            跟踪主题 (TRACKED TOPICS)
          </h4>
          <div className="flex items-center gap-2 flex-wrap">
            {topics.map((topic) => (
              <span
                key={topic.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-bg-white-var border border-border text-xs font-medium text-text-primary"
              >
                {topic.icon} {topic.label}
                <button
                  type="button"
                  onClick={() => removeTopic(topic.id)}
                  className="text-text-muted hover:text-text-primary ml-0.5"
                >
                  <Icon name="close" size={14} />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => useToastStore.getState().addToast('添加关键词功能开发中', 'info')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-border text-xs text-text-muted hover:border-primary hover:text-primary transition-colors"
            >
              <Icon name="add" size={14} />
              添加关键词
            </button>
          </div>
          <p className="text-[10px] text-text-muted mt-2.5 leading-relaxed">
            已通过自然语言识别为您自动提取核心监控主题
          </p>
        </section>

        <div className="h-px bg-border" />

        {/* 投递频率 */}
        <section>
          <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">投递频率</h4>
          <div className="bg-bg-white-var rounded-xl border border-border divide-y divide-border overflow-hidden">
            {([
              { key: 'realtime' as DeliveryFreq, icon: 'bolt', label: '实时推送', desc: '检测到新内容立即发送' },
              { key: 'daily' as DeliveryFreq, icon: 'today', label: '每日汇总', desc: '每天定时发送一份摘要报告' },
              { key: 'weekly' as DeliveryFreq, icon: 'calendar_view_week', label: '每周精选', desc: '每周一上午发送上周深度分析' },
            ]).map((opt) => (
              <label
                key={opt.key}
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-bg-hover/50 transition-colors"
              >
                <Icon name={opt.icon} size={18} className="text-text-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-text-primary">{opt.label}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">{opt.desc}</p>
                </div>
                <input
                  type="radio"
                  name="freq"
                  checked={deliveryFreq === opt.key}
                  onChange={() => setDeliveryFreq(opt.key)}
                  className="w-4 h-4 text-primary focus:ring-primary border-border shrink-0"
                />
              </label>
            ))}
          </div>
        </section>

        {/* 发送时间 (仅每日/每周生效) */}
        {deliveryFreq !== 'realtime' && (
          <section>
            <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">投递时间</h4>
            <div className="bg-bg-white-var rounded-xl border border-border p-3 flex items-center gap-3">
              <Icon name="schedule" size={18} className="text-text-muted" />
              <span className="text-xs text-text-secondary flex-1">汇总报告生成时间</span>
              <input
                type="time"
                value={sendTime}
                onChange={(e) => setSendTime(e.target.value)}
                className="px-2 py-1 text-sm border border-border rounded-lg bg-bg-secondary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <p className="text-[10px] text-text-muted mt-1.5 px-1">
              仅在选择"每日汇总"或"每周精选"时生效
            </p>
          </section>
        )}

        <div className="h-px bg-border" />

        {/* 通知渠道 */}
        <section>
          <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">通知渠道</h4>
          <div className="space-y-2">
            <div className="bg-bg-white-var rounded-xl border border-border p-3 flex items-center gap-3">
              <Icon name="desktop_windows" size={18} className="text-text-muted shrink-0" />
              <span className="text-xs font-medium text-text-primary flex-1">桌面端推送</span>
              <ToggleSwitch checked={desktopPush} onChange={setDesktopPush} />
            </div>
            <div className="bg-bg-white-var rounded-xl border border-border p-3 flex items-center gap-3">
              <Icon name="mail" size={18} className="text-text-muted shrink-0" />
              <span className="text-xs font-medium text-text-primary flex-1">电子邮件通知</span>
              <ToggleSwitch checked={emailNotify} onChange={setEmailNotify} />
            </div>
          </div>
        </section>
      </div>

      {/* Bottom status bar */}
      <div className="px-4 py-2.5 border-t border-border flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
        <span className="text-[10px] text-text-muted">外部源监控运行中</span>
        <span className="text-[10px] text-text-muted ml-auto">上次检查：刚刚</span>
      </div>
    </div>
  );
}
