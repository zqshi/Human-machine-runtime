/**
 * PromptEditor — System Prompt 编辑器（左栏，暗色主题）
 */
import { useOrchestrationStore } from '../../../../application/stores/orchestrationStore';

export function PromptEditor() {
  const systemPrompt = useOrchestrationStore((s) => s.systemPrompt);
  const updateField = useOrchestrationStore((s) => s.updateField);

  const tokenEstimate = Math.ceil(systemPrompt.length / 4);

  return (
    <div className="p-4">
      <div className="border border-white/[0.08] bg-white/[0.03] rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-semibold text-slate-100">系统提示词</span>
          <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-md cursor-pointer hover:bg-primary/20 transition-colors">
            ✨ AI 生成
          </span>
        </div>
        <textarea
          value={systemPrompt}
          onChange={(e) => updateField('systemPrompt', e.target.value)}
          className="w-full border border-white/[0.08] bg-white/[0.03] rounded-xl min-h-[420px] p-4 text-[13px] leading-[1.75] resize-y outline-none text-slate-200 placeholder:text-slate-500 focus:border-primary/50 focus:ring-[3px] focus:ring-primary/10 transition-all font-mono"
          placeholder="在这里编写系统提示词...&#10;&#10;描述 Agent 的角色、能力边界、回复风格等。"
        />
        <div className="flex justify-between mt-2 text-[10px] text-slate-500">
          <span>
            {systemPrompt.length} 字符 · ~{tokenEstimate} tokens
          </span>
        </div>
      </div>
    </div>
  );
}
