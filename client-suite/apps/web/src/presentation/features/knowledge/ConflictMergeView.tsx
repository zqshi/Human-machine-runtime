/**
 * ConflictMergeView — 文档冲突合并 Diff 视图 (stitch_4 对齐)
 * 顶部警告栏 + 双栏对比(Alice 的修改 vs 我的修改) + 差异高亮 + 合并并保存
 */
import { Icon } from '../../components/ui/Icon';
import { useToastStore } from '../../../application/stores/toastStore';

interface DiffSegment {
  text: string;
  type: 'normal' | 'added' | 'removed';
}

interface ConflictMergeViewProps {
  onCancel?: () => void;
  onMerge?: () => void;
}

const LEFT_CONTENT: DiffSegment[] = [
  { text: '2024财年是企业转型的重要时期。随着新集成消息平台的推出，我们看到跨部门协作增加了45% 沟通壁垒显著减少。', type: 'normal' },
  { text: '\n\n为了进一步提升整体效率，团队计划在下一阶段', type: 'normal' },
  { text: '引入全自动化的AI评审机制', type: 'removed' },
  { text: ' 以确保文档质量与合规性。', type: 'normal' },
];

const RIGHT_CONTENT: DiffSegment[] = [
  { text: '2024财年是企业转型的重要时期。随着新集成消息平台的推出，我们看到跨部门协作增加了45% 沟通壁垒显著减少。', type: 'normal' },
  { text: '\n\n为了进一步提升整体效率，团队计划在下一阶段', type: 'normal' },
  { text: '优化现有的智能辅助审核流程', type: 'added' },
  { text: ' 以确保文档质量与合规性。', type: 'normal' },
];

export function ConflictMergeView({ onCancel, onMerge }: ConflictMergeViewProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-white-var">
      {/* Warning header */}
      <div className="flex items-center gap-3 px-6 py-2.5 bg-error/5 border-b border-error/20">
        <Icon name="warning" size={18} className="text-error" />
        <span className="text-sm font-semibold text-text-primary">内容冲突合并</span>
        <div className="w-px h-4 bg-border" />
        <span className="text-xs text-text-secondary">检测到 1 处差异需要手动处理</span>
      </div>

      {/* Dual-pane diff */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: their changes */}
        <div className="flex-1 border-r border-border overflow-auto">
          <div className="px-4 py-2 bg-fill-tertiary/30 border-b border-border flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-error" />
            <span className="text-xs font-semibold text-text-primary">Alice 的修改</span>
          </div>
          <div className="p-8">
            <h2 className="text-xl font-bold text-text-primary/40 mb-4">年度报告 FY2024</h2>
            <p className="text-xs text-text-muted font-medium mb-3">执行摘要</p>
            <div className="text-sm text-text-secondary leading-relaxed">
              {LEFT_CONTENT.map((seg, i) => (
                <span
                  key={i}
                  className={
                    seg.type === 'removed'
                      ? 'bg-error/10 text-error underline decoration-[#FF3B30] font-medium'
                      : seg.type === 'added'
                        ? 'bg-success/10 text-success underline decoration-[#34C759] font-medium'
                        : ''
                  }
                >
                  {seg.text}
                </span>
              ))}
            </div>
            <div className="mt-6 w-full h-40 rounded-xl border border-border bg-fill-tertiary/20 flex items-center justify-center">
              <Icon name="more_horiz" size={24} className="text-text-muted" />
            </div>
          </div>
        </div>

        {/* Navigation arrows */}
        <div className="flex flex-col items-center justify-center gap-2 px-2 bg-fill-tertiary/10">
          <button type="button" onClick={() => useToastStore.getState().addToast('冲突导航功能开发中', 'info')} className="w-8 h-8 rounded-full border border-border bg-bg-white-var flex items-center justify-center text-text-muted hover:text-primary hover:border-primary transition-colors">
            <Icon name="chevron_right" size={16} />
          </button>
          <button type="button" onClick={() => useToastStore.getState().addToast('冲突导航功能开发中', 'info')} className="w-8 h-8 rounded-full border border-border bg-bg-white-var flex items-center justify-center text-text-muted hover:text-primary hover:border-primary transition-colors">
            <Icon name="chevron_left" size={16} />
          </button>
        </div>

        {/* Right: my changes */}
        <div className="flex-1 overflow-auto">
          <div className="px-4 py-2 bg-fill-tertiary/30 border-b border-border flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-success" />
            <span className="text-xs font-semibold text-text-primary">我的修改</span>
          </div>
          <div className="p-8">
            <h2 className="text-xl font-bold text-text-primary/40 mb-4">年度报告 FY2024</h2>
            <p className="text-xs text-text-muted font-medium mb-3">执行摘要</p>
            <div className="text-sm text-text-secondary leading-relaxed">
              {RIGHT_CONTENT.map((seg, i) => (
                <span
                  key={i}
                  className={
                    seg.type === 'added'
                      ? 'bg-success/10 text-success underline decoration-[#34C759] font-medium'
                      : seg.type === 'removed'
                        ? 'bg-error/10 text-error underline decoration-[#FF3B30] font-medium'
                        : ''
                  }
                >
                  {seg.text}
                </span>
              ))}
            </div>
            <div className="mt-6 w-full h-40 rounded-xl border border-border bg-fill-tertiary/20 flex items-center justify-center">
              <Icon name="more_horiz" size={24} className="text-text-muted" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="flex items-center justify-end gap-3 px-6 py-3 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover rounded-lg transition-colors"
        >
          取消
        </button>
        <button
          type="button"
          onClick={onMerge}
          className="px-5 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5"
        >
          <Icon name="check" size={16} />
          合并并保存
        </button>
      </div>
    </div>
  );
}
