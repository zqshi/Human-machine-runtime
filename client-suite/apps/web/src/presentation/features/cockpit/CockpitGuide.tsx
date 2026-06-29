/**
 * CockpitGuideTour — 首次登录蒙层引导
 *
 * 全屏遮罩 + 高亮区域 + 步骤说明的经典 onboarding tour。
 * 通过 data-guide 属性定位目标元素，box-shadow 挖洞高亮。
 * localStorage 持久化已完成状态。
 */
import { useState, useEffect, useCallback } from 'react';
import { Icon } from '../../components/ui/Icon';

const LS_KEY = 'hmr_oc_guide_done';

interface TourStep {
  target: string;
  fallback?: string;
  title: string;
  description: string;
  icon: string;
  position: 'bottom' | 'right' | 'left' | 'top';
}

const STEPS: TourStep[] = [
  {
    target: '[data-guide="attention-column"]',
    title: '事件雷达',
    description:
      '左侧面板汇聚所有待处理事项：战略目标、待决策、进行中任务和外部消息，按优先级排列。',
    icon: 'radar',
    position: 'right',
  },
  {
    target: '[data-guide="attention-notifications"]',
    fallback: '[data-guide="attention-column"]',
    title: '通知模式 — 消息处理',
    description:
      '点击「外部消息」卡片，中间面板展示邮件/飞书等渠道的完整内容，你可以指示 Agent 如何回复。',
    icon: 'mail',
    position: 'right',
  },
  {
    target: '[data-guide="attention-decisions"]',
    fallback: '[data-guide="attention-column"]',
    title: '讨论模式 — 决策协作',
    description:
      '点击「待决策」「任务」或「目标」，顶部展示背景方案，下方与 Agent 对话讨论后执行操作。',
    icon: 'forum',
    position: 'right',
  },
  {
    target: '[data-guide="composer"]',
    fallback: '[data-guide="main-content"]',
    title: '对话输入',
    description: '在此输入消息与 Agent 协商。输入 / 可唤起快捷指令，Agent 会给出方案建议。',
    icon: 'chat',
    position: 'top',
  },
  {
    target: '[data-guide="main-content"]',
    title: '智能面板',
    description: '对话区右侧可展开详情面板，查看 Agent 推理过程、任务日志和协作链路。',
    icon: 'dock_to_right',
    position: 'left',
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getTooltipStyle(rect: Rect, position: TourStep['position']): React.CSSProperties {
  const gap = 16;
  switch (position) {
    case 'right':
      return {
        top: rect.top + rect.height / 2,
        left: rect.left + rect.width + gap,
        transform: 'translateY(-50%)',
      };
    case 'left':
      return {
        top: rect.top + rect.height / 2,
        right: window.innerWidth - rect.left + gap,
        transform: 'translateY(-50%)',
      };
    case 'bottom':
      return {
        top: rect.top + rect.height + gap,
        left: rect.left + rect.width / 2,
        transform: 'translateX(-50%)',
      };
    case 'top':
      return {
        bottom: window.innerHeight - rect.top + gap,
        left: rect.left + rect.width / 2,
        transform: 'translateX(-50%)',
      };
  }
}

export function CockpitGuideTour({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);

  const measureTarget = useCallback(() => {
    const current = STEPS[step];
    const el =
      document.querySelector(current.target) ??
      (current.fallback ? document.querySelector(current.fallback) : null);
    if (el) {
      const r = el.getBoundingClientRect();
      setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    } else {
      setTargetRect(null);
    }
  }, [step]);

  useEffect(() => {
    // Defer initial measurement to avoid synchronous setState in effect
    const rafId = requestAnimationFrame(measureTarget);
    window.addEventListener('resize', measureTarget);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', measureTarget);
    };
  }, [measureTarget]);

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleFinish = () => {
    try {
      localStorage.setItem(LS_KEY, '1');
    } catch {
      /* ignore */
    }
    onComplete();
  };

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-[9999]" onClick={(e) => e.stopPropagation()}>
      {/* Overlay with hole */}
      <div className="absolute inset-0 pointer-events-none">
        {targetRect ? (
          <div
            className="absolute rounded-xl border-2 border-primary/60 transition-all duration-300 ease-out"
            style={{
              top: targetRect.top - 6,
              left: targetRect.left - 6,
              width: targetRect.width + 12,
              height: targetRect.height + 12,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)',
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-black/65" />
        )}
      </div>

      {/* Tooltip */}
      {targetRect && (
        <div
          className="absolute z-10 w-[320px] rounded-2xl border border-white/15 bg-[#1c1c2e]/95 backdrop-blur-xl p-5 shadow-2xl transition-all duration-300 ease-out"
          style={getTooltipStyle(targetRect, current.position)}
        >
          {/* Step icon + title */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <Icon name={current.icon} size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">{current.title}</h3>
              <span className="text-[10px] text-slate-500">
                {step + 1} / {STEPS.length}
              </span>
            </div>
          </div>

          {/* Description */}
          <p className="text-xs text-slate-300 leading-relaxed mb-4">{current.description}</p>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleFinish}
              className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
            >
              跳过引导
            </button>
            <div className="flex gap-2">
              {step > 0 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="h-8 px-3 rounded-lg border border-white/10 text-xs text-slate-300 hover:bg-white/[0.06] transition-colors flex items-center gap-1"
                >
                  <Icon name="arrow_back" size={14} />
                  上一步
                </button>
              )}
              <button
                type="button"
                onClick={handleNext}
                className="h-8 px-4 rounded-lg bg-primary text-xs text-white font-medium hover:bg-primary/90 transition-colors flex items-center gap-1"
              >
                {step < STEPS.length - 1 ? (
                  <>
                    下一步
                    <Icon name="arrow_forward" size={14} />
                  </>
                ) : (
                  <>
                    开始使用
                    <Icon name="check" size={14} />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-1.5 mt-3">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === step ? 'bg-primary' : i < step ? 'bg-primary/40' : 'bg-white/20'
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
