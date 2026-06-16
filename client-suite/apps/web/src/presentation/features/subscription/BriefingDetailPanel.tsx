/**
 * BriefingDetailPanel — 简报详情面板 (stitch_21 对齐)
 * 右侧面板：AI 深度解析 + 趋势柱状图 + 关键结论 + 潜在影响 + 相关研报
 */
import { Icon } from '../../components/ui/Icon';
import { useToastStore } from '../../../application/stores/toastStore';

interface BriefingDetailPanelProps {
  onClose?: () => void;
}

const TREND_BARS = [
  { label: '05/18', height: 30 },
  { label: '', height: 40 },
  { label: '', height: 35 },
  { label: '', height: 50 },
  { label: '', height: 45 },
  { label: '', height: 55 },
  { label: '', height: 60 },
  { label: '', height: 70 },
  { label: '', height: 80 },
  { label: '今日', height: 100 },
];

export function BriefingDetailPanel({ onClose }: BriefingDetailPanelProps) {
  return (
    <div className="w-80 border-l border-border bg-bg-secondary overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-text-primary">简报详情</h3>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => useToastStore.getState().addToast('分享功能开发中', 'info')} className="p-1 rounded-md text-text-secondary hover:bg-bg-hover">
            <Icon name="share" size={18} />
          </button>
          {onClose && (
            <button type="button" onClick={onClose} className="p-1 rounded-md text-text-secondary hover:bg-bg-hover">
              <Icon name="close" size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 p-4 space-y-5 overflow-y-auto">
        {/* Badge + tracking ID */}
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-md bg-primary text-white text-[10px] font-semibold">AI 深度解析</span>
          <span className="text-[10px] text-text-muted">追踪 ID: INTEL-2024-0524</span>
        </div>

        {/* Title */}
        <h2 className="text-base font-bold text-text-primary leading-snug">
          端侧大模型对 AI 手机市场格局的重塑分析
        </h2>

        {/* Trend line chart (SVG) */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-secondary">市场趋势 (6个月)</span>
            <span className="text-xs font-bold text-success bg-success/10 px-2 py-0.5 rounded">+12.5%</span>
          </div>
          <div className="bg-fill-tertiary rounded-xl p-3">
            <svg className="w-full h-28" viewBox="0 0 400 100" fill="none" preserveAspectRatio="none">
              <defs>
                <linearGradient id="trendGrad" x1="0" x2="400" y1="0" y2="0">
                  <stop offset="0%" stopColor="#007AFF" />
                  <stop offset="100%" stopColor="#5856D6" />
                </linearGradient>
                <linearGradient id="trendFill" x1="200" x2="200" y1="0" y2="100">
                  <stop offset="0%" stopColor="#007AFF" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#007AFF" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0 80 Q50 70,100 85 T200 60 T300 40 T400 20" stroke="url(#trendGrad)" strokeWidth="2.5" />
              <path d="M0 80 Q50 70,100 85 T200 60 T300 40 T400 20 L400 100 L0 100 Z" fill="url(#trendFill)" />
            </svg>
            <div className="flex justify-between text-[9px] text-text-muted mt-1">
              <span>1月</span><span>3月</span><span>5月</span><span>6月</span>
            </div>
          </div>
        </section>

        {/* Bar chart (original) */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-secondary">市场关注度趋势</span>
          </div>
          <div className="flex items-end gap-1 h-20">
            {TREND_BARS.map((bar, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-full rounded-sm transition-all ${
                    i === TREND_BARS.length - 1 ? 'bg-primary' : 'bg-primary/20'
                  }`}
                  style={{ height: `${bar.height}%` }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-text-muted">05/18</span>
            <span className="text-[9px] text-text-muted">今日</span>
          </div>
        </section>

        <div className="h-px bg-border" />

        {/* 关键结论 */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Icon name="target" size={16} className="text-primary" />
            <h4 className="text-xs font-bold text-text-primary">关键结论</h4>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            端侧 7B 模型的成熟标志着 AI 手机从"云端调用"进入"本地常驻"时代。
            头部厂商已在内存管理与 NPU 调度上建立技术壁垒。
          </p>
        </section>

        {/* 潜在影响 */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Icon name="warning" size={16} className="text-warning" />
            <h4 className="text-xs font-bold text-text-primary">潜在影响</h4>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            中端机型普及 AI 功能将加速存量市场换机周期，预计 Q3
            季度 AI 相关机型出货量将增长 25%。
          </p>
        </section>

        <div className="h-px bg-border" />

        {/* 相关情报 */}
        <section>
          <h4 className="text-xs font-bold text-text-primary mb-3">相关情报</h4>
          <div className="grid grid-cols-2 gap-2">
            <div onClick={() => useToastStore.getState().addToast('查看 ASML 财报详情', 'info')} className="p-2.5 bg-bg-white-var rounded-xl border border-border cursor-pointer hover:shadow-sm transition-shadow">
              <p className="text-[11px] font-bold text-text-primary mb-0.5">ASML 财报</p>
              <span className="text-[10px] text-text-muted">相关影响: 84%</span>
            </div>
            <div onClick={() => useToastStore.getState().addToast('查看台积电扩张详情', 'info')} className="p-2.5 bg-bg-white-var rounded-xl border border-border cursor-pointer hover:shadow-sm transition-shadow">
              <p className="text-[11px] font-bold text-text-primary mb-0.5">台积电扩张</p>
              <span className="text-[10px] text-text-muted">相关影响: 72%</span>
            </div>
          </div>
        </section>

        <div className="h-px bg-border" />

        {/* 相关研报与信源 */}
        <section>
          <h4 className="text-xs font-bold text-text-primary mb-3">相关研报与信源</h4>
          <div className="space-y-2">
            <div className="bg-bg-white-var rounded-xl border border-border p-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-text-primary">《2024 AI 手机端侧大模型技术白皮书》</p>
                <p className="text-[10px] text-text-muted mt-0.5">PDF · 4.2 MB</p>
              </div>
              <button type="button" onClick={() => useToastStore.getState().addToast('PDF 下载功能开发中', 'info')} className="p-1.5 text-text-muted hover:text-primary">
                <Icon name="download" size={16} />
              </button>
            </div>
            <div className="bg-bg-white-var rounded-xl border border-border p-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-text-primary">Counterpoint 季度智能手机出货追踪</p>
                <p className="text-[10px] text-text-muted mt-0.5">Web · 实时链接</p>
              </div>
              <button type="button" onClick={() => useToastStore.getState().addToast('链接打开功能开发中', 'info')} className="p-1.5 text-text-muted hover:text-primary">
                <Icon name="open_in_new" size={16} />
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Bottom action */}
      <div className="p-4 border-t border-border">
        <button
          type="button"
          onClick={() => useToastStore.getState().addToast('PDF 报告生成功能开发中', 'info')}
          className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
        >
          <Icon name="print" size={16} />
          生成 PDF 报告存档
        </button>
      </div>
    </div>
  );
}
