/**
 * CollaborativeEditConflict — 文档协同编辑冲突提示 (stitch_6 对齐)
 * 文档正文中显示多人光标 + "内容冲突"提示弹窗
 * (查看差异/保留我的 按钮)
 */
import { Icon } from '../../components/ui/Icon';

interface CollaborativeEditConflictProps {
  onViewDiff?: () => void;
  onKeepMine?: () => void;
  onDismiss?: () => void;
}

export function CollaborativeEditConflict({ onViewDiff, onKeepMine, onDismiss }: CollaborativeEditConflictProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-white-var relative">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text-primary">年度报告 FY2024</span>
          <span className="px-2 py-0.5 text-[9px] font-medium text-success bg-success/10 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success" /> 实时同步中
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Collaborator cursors */}
          <div className="flex items-center -space-x-1.5">
            <div className="w-6 h-6 rounded-full bg-primary/20 border-2 border-white flex items-center justify-center text-[8px] font-bold text-primary">张</div>
            <div className="w-6 h-6 rounded-full bg-warning/20 border-2 border-white flex items-center justify-center text-[8px] font-bold text-warning">你</div>
          </div>
          <span className="text-[10px] text-text-muted">2人正在编辑</span>
        </div>
      </div>

      {/* Document content with cursors */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-text-primary/40 mb-4">年度报告 FY2024</h1>
          <p className="text-xs text-text-muted font-medium mb-3">执行摘要</p>

          <div className="text-sm text-text-secondary leading-relaxed relative">
            <p className="mb-4">
              2024财年是企业转型的重要时期。随着新集成消息平台的推出，我们看到跨部门协作增加了45%，
              {/* Zhang San's cursor */}
              <span className="relative inline-block">
                <span className="absolute -top-5 left-0 px-1.5 py-0.5 text-[8px] text-white bg-primary rounded whitespace-nowrap">Alice</span>
                <span className="w-0.5 h-4 bg-primary inline-block animate-pulse" />
              </span>
              沟通壁垒显著减少。
            </p>

            <p className="mb-4">
              为了进一步提升整体效率，团队计划在下一阶段
              <span className="bg-warning/10 text-warning px-1 rounded font-medium">引入全自动化的AI评审机制</span>
              {/* My cursor */}
              <span className="relative inline-block">
                <span className="absolute -top-5 left-0 px-1.5 py-0.5 text-[8px] text-white bg-warning rounded whitespace-nowrap">你</span>
                <span className="w-0.5 h-4 bg-warning inline-block animate-pulse" />
              </span>
              以确保文档质量与合规性。
            </p>
          </div>

          {/* Placeholder for more content */}
          <div className="mt-6 w-full h-40 rounded-xl border border-border bg-fill-tertiary/20 flex items-center justify-center">
            <Icon name="more_horiz" size={24} className="text-text-muted" />
          </div>
        </div>
      </div>

      {/* Conflict dialog overlay */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-80 bg-bg-white-var rounded-2xl shadow-2xl border border-error/20 p-5 space-y-3 z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-error/10 flex items-center justify-center">
            <Icon name="warning" size={18} className="text-error" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">内容冲突</p>
            <p className="text-[10px] text-text-muted">Alice 与你正在编辑同一位置</p>
          </div>
          {onDismiss && (
            <button type="button" onClick={onDismiss} className="ml-auto p-1 text-text-muted hover:text-text-secondary">
              <Icon name="close" size={14} />
            </button>
          )}
        </div>

        <p className="text-xs text-text-secondary leading-relaxed">
          检测到你们正在编辑文档的同一段落。为避免数据丢失，请选择处理方式。
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onViewDiff}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary/90 flex items-center justify-center gap-1"
          >
            <Icon name="compare" size={14} /> 查看差异
          </button>
          <button
            type="button"
            onClick={onKeepMine}
            className="flex-1 py-2.5 rounded-xl border border-border text-xs font-medium text-text-primary hover:bg-bg-hover flex items-center justify-center gap-1"
          >
            <Icon name="person" size={14} /> 保留我的
          </button>
        </div>
      </div>
    </div>
  );
}
