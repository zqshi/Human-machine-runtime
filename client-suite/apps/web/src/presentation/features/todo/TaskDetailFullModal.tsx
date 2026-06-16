/**
 * TaskDetailFullModal — 任务详情全屏模态 (stitch_3 对齐)
 * 左栏: 子任务列表 + 任务属性 + 协作成员
 * 右栏: 进展同步富文本 + 活动记录流 (含文件/图片/系统日志)
 */
import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useToastStore } from '../../../application/stores/toastStore';

interface SubTask {
  text: string;
  done: boolean;
  status?: string;
  statusColor?: string;
}

interface Activity {
  user: string;
  avatar: string;
  time: string;
  content: string;
  attachment?: { type: 'file' | 'images'; name?: string; count?: number };
  isSystem?: boolean;
}

const SUBTASKS: SubTask[] = [
  { text: '完成基础组件树审计', done: true, status: '已完成', statusColor: '#34C759' },
  { text: '合并依赖冲突解决方案', done: true, status: '已完成', statusColor: '#34C759' },
  { text: '响应式布局边界测试', done: false, status: '进行中', statusColor: '#007AFF' },
  { text: '暗黑模式色彩变量校验', done: false, status: '待办', statusColor: '#8E8E93' },
];

const ACTIVITIES: Activity[] = [
  {
    user: '李明',
    avatar: '李',
    time: '10分钟前',
    content: '已完成 #依赖冲突解决方案 的修复，附上测试报告。',
    attachment: { type: 'file', name: 'Test_Report_v2.pdf' },
  },
  {
    user: 'Sarah Chen',
    avatar: 'S',
    time: '1小时前',
    content: '新的主题引擎分支 feat/theme-engine 已经推送，请查看截图。',
    attachment: { type: 'images', count: 4 },
  },
  {
    user: 'Alex Rivera',
    avatar: 'A',
    time: '2小时前',
    content: '任务由 Alex Rivera 标记为 进行中',
    isSystem: true,
  },
];

interface TaskDetailFullModalProps {
  onClose?: () => void;
  onComplete?: () => void;
}

export function TaskDetailFullModal({ onClose, onComplete }: TaskDetailFullModalProps) {
  const [progressNote, setProgressNote] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-[900px] max-h-[85vh] bg-bg-white-var rounded-2xl shadow-2xl flex overflow-hidden">
        {/* Left column */}
        <div className="w-[400px] border-r border-border flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <button type="button" onClick={onClose} className="p-1 text-text-muted hover:text-text-secondary">
              <Icon name="arrow_back" size={18} />
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onComplete}
                className="px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90 flex items-center gap-1"
              >
                <Icon name="check" size={14} /> 完成任务
              </button>
              <button type="button" onClick={() => useToastStore.getState().addToast('更多操作开发中', 'info')} className="p-1 text-text-muted hover:text-text-secondary">
                <Icon name="more_horiz" size={18} />
              </button>
              <button type="button" onClick={onClose} className="p-1 text-text-muted hover:text-text-secondary">
                <Icon name="close" size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-text-primary">审核桌面客户端重构 PR</h2>
              <p className="text-xs text-text-muted mt-1">项目：前端架构重构 2024</p>
            </div>

            {/* Subtasks */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-text-secondary">子任务 ({SUBTASKS.filter(s => s.done).length}/{SUBTASKS.length})</h4>
                <span className="text-[10px] text-text-muted">{Math.round((SUBTASKS.filter(s => s.done).length / SUBTASKS.length) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-fill-tertiary rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${(SUBTASKS.filter(s => s.done).length / SUBTASKS.length) * 100}%` }}
                />
              </div>
              <div className="space-y-2">
                {SUBTASKS.map((st, i) => (
                  <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border/50">
                    <span
                      className={`w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        st.done ? 'bg-primary border-primary' : 'border-border'
                      }`}
                    >
                      {st.done && <Icon name="check" size={10} className="text-white" />}
                    </span>
                    <span className={`flex-1 text-xs ${st.done ? 'text-text-muted' : 'text-text-primary'}`}>{st.text}</span>
                    {st.status && (
                      <span className="px-2 py-0.5 text-[9px] font-medium rounded-full" style={{ color: st.statusColor, backgroundColor: `${st.statusColor}15` }}>
                        {st.status}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Properties */}
            <section className="space-y-3">
              <h4 className="text-xs font-semibold text-text-secondary">任务属性</h4>
              <div className="flex items-center gap-2 text-xs">
                <Icon name="calendar_today" size={14} className="text-text-muted" />
                <span className="text-text-muted w-16">截止时间</span>
                <span className="text-text-primary">10月24日 18:00</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Icon name="flag" size={14} className="text-error" />
                <span className="text-text-muted w-16">优先级</span>
                <span className="text-error font-medium">最高</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Icon name="person" size={14} className="text-text-muted" />
                <span className="text-text-muted w-16">负责人</span>
                <span className="text-text-primary">李明 (我)</span>
              </div>
            </section>

            {/* Collaborators */}
            <section>
              <h4 className="text-xs font-semibold text-text-secondary mb-2">协作成员</h4>
              <div className="flex items-center gap-1">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">李</div>
                <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center text-xs font-bold text-warning">S</div>
                <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center text-xs font-bold text-success">A</div>
                <button type="button" onClick={() => useToastStore.getState().addToast('添加协作成员功能开发中', 'info')} className="w-8 h-8 rounded-full border-2 border-dashed border-border flex items-center justify-center text-text-muted">
                  <Icon name="add" size={14} />
                </button>
              </div>
            </section>
          </div>
        </div>

        {/* Right column - Activity */}
        <div className="flex-1 flex flex-col">
          {/* Rich text input */}
          <div className="p-4 border-b border-border">
            <div className="border border-border rounded-xl p-3">
              <textarea
                placeholder="同步任务进度，@提及他人..."
                value={progressNote}
                onChange={(e) => setProgressNote(e.target.value)}
                className="w-full text-xs text-text-secondary resize-none focus:outline-none min-h-[60px]"
              />
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => useToastStore.getState().addToast('插入图片功能开发中', 'info')} className="p-1 text-text-muted hover:text-text-secondary"><Icon name="image" size={14} /></button>
                  <button type="button" onClick={() => useToastStore.getState().addToast('添加附件功能开发中', 'info')} className="p-1 text-text-muted hover:text-text-secondary"><Icon name="attach_file" size={14} /></button>
                  <button type="button" onClick={() => useToastStore.getState().addToast('插入表情功能开发中', 'info')} className="p-1 text-text-muted hover:text-text-secondary"><Icon name="sentiment_satisfied" size={14} /></button>
                </div>
                <button type="button" onClick={() => { useToastStore.getState().addToast('进展已更新', 'success'); setProgressNote(''); }} className="px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90">
                  更新进展
                </button>
              </div>
            </div>
          </div>

          {/* Activity feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {ACTIVITIES.map((act, i) => (
              <div key={i} className={`flex gap-3 ${act.isSystem ? 'items-center' : 'items-start'}`}>
                {act.isSystem ? (
                  <div className="flex-1 flex items-center gap-2 text-xs text-text-muted">
                    <div className="flex-1 h-px bg-border" />
                    <span>{act.content} · {act.time}</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {act.avatar}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-text-primary">{act.user}</span>
                        <span className="text-[10px] text-text-muted">{act.time}</span>
                      </div>
                      <p className="text-xs text-text-secondary leading-relaxed">{act.content}</p>
                      {act.attachment?.type === 'file' && (
                        <div className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-fill-tertiary/20">
                          <Icon name="description" size={16} className="text-error" />
                          <span className="text-xs text-text-primary">{act.attachment.name}</span>
                          <button type="button" onClick={() => useToastStore.getState().addToast('文件下载功能开发中', 'info')} className="p-0.5 text-text-muted hover:text-primary">
                            <Icon name="download" size={14} />
                          </button>
                        </div>
                      )}
                      {act.attachment?.type === 'images' && (
                        <div className="mt-2 flex gap-2">
                          <div className="w-20 h-14 rounded-lg bg-fill-tertiary/30 border border-border" />
                          <div className="w-20 h-14 rounded-lg bg-fill-tertiary/30 border border-border flex items-center justify-center text-xs text-text-muted">
                            +{(act.attachment.count ?? 2) - 1} 图片
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
