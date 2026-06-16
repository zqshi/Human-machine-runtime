/**
 * ApprovalWithDocPreview — 权限审批 + 文档预览 (stitch_16 对齐)
 * 左栏: 权限申请审批卡片 (批准/拒绝)
 * 右栏: 文档预览抽屉 (财务报表数据表格 + 指标卡片)
 */
import { Icon } from '../../components/ui/Icon';
import { useToastStore } from '../../../application/stores/toastStore';

interface FinancialRow {
  dept: string;
  amount: string;
  status: string;
  statusColor: string;
}

const STATS = [
  { label: '总营收 (CNY)', value: '¥12,450,000', color: '#007AFF' },
  { label: '净利润 (CNY)', value: '¥3,120,000', color: '#5856D6' },
  { label: '增长率 (YOY)', value: '+12.4%', color: '#34C759' },
];

const TABLE_DATA: FinancialRow[] = [
  { dept: '核心业务部', amount: '¥4,500,000', status: '正常', statusColor: '#34C759' },
  { dept: '创新研发部', amount: '¥2,100,000', status: '待核销', statusColor: '#FF9500' },
  { dept: '市场营销部', amount: '待李明更新...', status: '锁定中', statusColor: '#FF3B30' },
];

interface ApprovalWithDocPreviewProps {
  onApprove?: () => void;
  onReject?: () => void;
}

export function ApprovalWithDocPreview({ onApprove, onReject }: ApprovalWithDocPreviewProps) {
  return (
    <div className="flex-1 flex overflow-hidden bg-bg-white-var">
      {/* Left: Approval card in chat */}
      <div className="flex-1 flex flex-col border-r border-border">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-text-primary">系统通知</h3>
          <span className="text-xs text-text-muted">/ SYSTEM NOTIFICATION</span>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <p className="text-xs text-text-muted text-center mb-6">2024年4月12日</p>

          {/* Approval request card */}
          <div className="max-w-md mx-auto rounded-2xl border border-border p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon name="shield" size={16} className="text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-text-primary">权限申请</p>
                <p className="text-[10px] text-text-muted">10:45</p>
              </div>
            </div>

            <p className="text-xs text-text-secondary">
              <span className="font-medium text-text-primary">李明</span> 申请编辑权限
            </p>

            <div className="flex items-center gap-2 text-xs">
              <Icon name="description" size={14} className="text-primary" />
              <span className="text-text-primary font-medium">2024Q1_财务报表汇总</span>
            </div>

            <div className="p-3 rounded-lg bg-fill-tertiary/20 text-xs text-text-secondary leading-relaxed">
              <span className="text-text-muted">申请理由:</span> 需要更新Q1报表数据，含税务抵扣明细和各事业部利润核算，截止日期临近需紧急处理。
            </div>

            <button type="button" onClick={() => useToastStore.getState().addToast('文档预览已打开', 'info')} className="text-xs text-primary hover:underline flex items-center gap-1">
              查看文档 <Icon name="open_in_new" size={12} />
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onApprove}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90"
              >
                批准
              </button>
              <button
                type="button"
                onClick={onReject}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-text-primary hover:bg-bg-hover"
              >
                拒绝
              </button>
            </div>

            <p className="text-[10px] text-text-muted text-center">只有管理员可见此操作</p>
          </div>
        </div>
      </div>

      {/* Right: Document preview drawer */}
      <div className="w-[420px] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Icon name="description" size={16} className="text-primary" />
            <span className="text-sm font-medium text-text-primary">2024Q1_财务报表汇总.xlsx</span>
            <span className="px-2 py-0.5 text-[9px] font-medium text-warning bg-warning/10 rounded-full">待审核</span>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => useToastStore.getState().addToast('版本历史功能开发中', 'info')} className="p-1 text-text-muted hover:text-text-secondary flex items-center gap-1 text-xs">
              <Icon name="history" size={14} /> 版本
            </button>
            <button type="button" onClick={() => useToastStore.getState().addToast('更多操作开发中', 'info')} className="p-1 text-text-muted hover:text-text-secondary">
              <Icon name="more_horiz" size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-text-primary">2024年第一季度财务报表</h2>
            <span className="text-[10px] text-text-muted">最后更新: 2024-03-31</span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {STATS.map((stat) => (
              <div key={stat.label} className="p-3 rounded-xl border text-center" style={{ backgroundColor: `${stat.color}08`, borderColor: `${stat.color}20` }}>
                <p className="text-[10px] text-text-muted mb-1">{stat.label}</p>
                <p className="text-base font-bold" style={{ color: stat.color }}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Table */}
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-2 py-2 text-left text-xs font-medium text-text-muted">事业部</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-text-muted">支出额</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-text-muted">状态</th>
              </tr>
            </thead>
            <tbody>
              {TABLE_DATA.map((row) => (
                <tr key={row.dept} className="border-b border-border/30">
                  <td className="px-2 py-2 text-xs text-text-primary">{row.dept}</td>
                  <td className="px-2 py-2 text-xs text-text-secondary">{row.amount}</td>
                  <td className="px-2 py-2">
                    <span className="px-2 py-0.5 text-[10px] font-medium rounded-full" style={{ color: row.statusColor, backgroundColor: `${row.statusColor}15` }}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Notice */}
          <div className="p-3 rounded-lg bg-fill-tertiary/20 text-[11px] text-text-muted">
            部分数据由于权限原因未显示，请在获得批准后查看完整明细。
          </div>
        </div>
      </div>
    </div>
  );
}
