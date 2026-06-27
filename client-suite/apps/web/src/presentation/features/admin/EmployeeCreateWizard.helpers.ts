import type { OrganizationEmployeeCreateDraft } from '../../../application/use-cases/createOrganizationEmployee';

export type Step = 'basic' | 'capabilities' | 'evaluation' | 'version';

export const STEPS: { key: Step; label: string; icon: string }[] = [
  { key: 'basic', label: '基础信息', icon: 'info' },
  { key: 'capabilities', label: '能力配置', icon: 'extension' },
  { key: 'evaluation', label: '评测配置', icon: 'fact_check' },
  { key: 'version', label: '初始版本', icon: 'new_releases' },
];

export const MODEL_OPTIONS = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
  { value: 'claude-3-haiku', label: 'Claude 3 Haiku' },
];

export const RUNTIME_OPTIONS = [
  { value: 'cockpit', label: 'Cockpit' },
  { value: 'harness', label: 'Harness' },
] as const;

export function buildDefaultPrompt(draft: OrganizationEmployeeCreateDraft): string {
  const { name, department, description, modelId, agentRuntime } = draft.basic;
  return [
    `你是组织级数字员工「${name || '未命名数字员工'}」。`,
    department ? `你归属于「${department}」部门。` : '你服务于组织内的通用业务场景。',
    `你的运行类型是 ${agentRuntime}，默认模型是 ${modelId}。`,
    '',
    '你的工作目标：',
    description || '根据组织授权，为员工提供准确、稳定、可追踪的任务处理和信息支持。',
    '',
    '行为要求：',
    '1. 优先基于已配置的工具、Skill 和评测标准完成任务。',
    '2. 遇到缺少权限、缺少上下文或高不确定性的请求时，明确说明限制，不编造结果。',
    '3. 对关键操作保持可审计表达，必要时提示用户确认。',
    '4. 回复应专业、简洁，并说明下一步建议。',
  ].join('\n');
}
