import type { AgentCategory } from '../shared/types';

export interface CategoryDisplay {
  color: string;
  icon: string;
  label: string;
}

export const AGENT_CATEGORY_CONFIG: Record<AgentCategory, CategoryDisplay> = {
  dev:       { color: '#007AFF', icon: 'code',       label: '开发' },
  docs:      { color: '#34C759', icon: 'edit_note',   label: '文档' },
  data:      { color: '#AF52DE', icon: 'analytics',   label: '数据' },
  design:    { color: '#FF9500', icon: 'palette',     label: '设计' },
  test:      { color: '#5856D6', icon: 'bug_report',  label: '测试' },
  ops:       { color: '#FF9500', icon: 'settings',    label: '运维' },
  translate: { color: '#00C7BE', icon: 'translate',   label: '翻译' },
  security:  { color: '#FF3B30', icon: 'shield',      label: '安全' },
};

const DEFAULT_DISPLAY: CategoryDisplay = {
  color: '#64748b',
  icon: 'smart_toy',
  label: '通用',
};

export function getCategoryDisplay(category: string): CategoryDisplay {
  return AGENT_CATEGORY_CONFIG[category as AgentCategory] ?? DEFAULT_DISPLAY;
}
