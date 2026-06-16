import type { AgentCategory } from '../shared/types';
import { AGENT_CATEGORY_CONFIG } from './AgentCategoryConfig';

export interface CapabilityTemplateProps {
  id: string;
  name: string;
  category: AgentCategory;
  description: string;
  icon: string;
  color: string;
  systemPrompt: string;
}

export class CapabilityTemplate {
  readonly id: string;
  readonly name: string;
  readonly category: AgentCategory;
  readonly description: string;
  readonly icon: string;
  readonly color: string;
  readonly systemPrompt: string;

  private constructor(props: CapabilityTemplateProps) {
    this.id = props.id;
    this.name = props.name;
    this.category = props.category;
    this.description = props.description;
    this.icon = props.icon;
    this.color = props.color;
    this.systemPrompt = props.systemPrompt;
  }

  static create(props: CapabilityTemplateProps): CapabilityTemplate {
    return new CapabilityTemplate(props);
  }
}

/** 8 preset capability templates matching AgentCategory */
export const DEFAULT_CAPABILITY_TEMPLATES: CapabilityTemplate[] = [
  CapabilityTemplate.create({
    id: 'cap-dev',
    name: '代码开发',
    category: 'dev',
    description: '编程、代码审查、技术架构设计',
    icon: AGENT_CATEGORY_CONFIG.dev.icon,
    color: AGENT_CATEGORY_CONFIG.dev.color,
    systemPrompt: '你是一个代码开发助手，擅长编程、代码审查和技术架构设计。',
  }),
  CapabilityTemplate.create({
    id: 'cap-docs',
    name: '文档写作',
    category: 'docs',
    description: '文档撰写、内容编辑、知识整理',
    icon: AGENT_CATEGORY_CONFIG.docs.icon,
    color: AGENT_CATEGORY_CONFIG.docs.color,
    systemPrompt: '你是一个文档写作助手，擅长撰写技术文档、编辑内容和整理知识库。',
  }),
  CapabilityTemplate.create({
    id: 'cap-data',
    name: '数据分析',
    category: 'data',
    description: '数据处理、统计分析、可视化报表',
    icon: AGENT_CATEGORY_CONFIG.data.icon,
    color: AGENT_CATEGORY_CONFIG.data.color,
    systemPrompt: '你是一个数据分析专家，擅长数据处理、统计分析和生成可视化报表。',
  }),
  CapabilityTemplate.create({
    id: 'cap-design',
    name: '设计',
    category: 'design',
    description: 'UI/UX 设计、视觉规范、原型制作',
    icon: AGENT_CATEGORY_CONFIG.design.icon,
    color: AGENT_CATEGORY_CONFIG.design.color,
    systemPrompt: '你是一个设计助手，擅长 UI/UX 设计、视觉规范和原型制作。',
  }),
  CapabilityTemplate.create({
    id: 'cap-test',
    name: '测试',
    category: 'test',
    description: '自动化测试、质量保障、Bug 分析',
    icon: AGENT_CATEGORY_CONFIG.test.icon,
    color: AGENT_CATEGORY_CONFIG.test.color,
    systemPrompt: '你是一个测试工程师，擅长自动化测试、质量保障和 Bug 分析。',
  }),
  CapabilityTemplate.create({
    id: 'cap-ops',
    name: '运维',
    category: 'ops',
    description: 'DevOps、部署运维、监控告警',
    icon: AGENT_CATEGORY_CONFIG.ops.icon,
    color: AGENT_CATEGORY_CONFIG.ops.color,
    systemPrompt: '你是一个运维工程师，擅长 DevOps、部署运维和监控告警处理。',
  }),
  CapabilityTemplate.create({
    id: 'cap-translate',
    name: '翻译',
    category: 'translate',
    description: '多语言翻译、本地化、术语管理',
    icon: AGENT_CATEGORY_CONFIG.translate.icon,
    color: AGENT_CATEGORY_CONFIG.translate.color,
    systemPrompt: '你是一个翻译专家，擅长多语言翻译、本地化和术语管理。',
  }),
  CapabilityTemplate.create({
    id: 'cap-security',
    name: '安全审计',
    category: 'security',
    description: '漏洞扫描、安全分析、合规检查',
    icon: AGENT_CATEGORY_CONFIG.security.icon,
    color: AGENT_CATEGORY_CONFIG.security.color,
    systemPrompt: '你是一个安全审计专家，擅长漏洞扫描、安全分析和合规检查。',
  }),
];
