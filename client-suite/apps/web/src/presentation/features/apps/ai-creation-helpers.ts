export type MsgType = 'user' | 'ai-thinking' | 'ai-action' | 'ai-text' | 'ai-code';

export interface ChatMessage {
  id: string;
  type: MsgType;
  content: string;
  actionIcon?: string;
  actionLabel?: string;
  streaming?: boolean;
}

export type PreviewState = 'idle' | 'loading' | 'ready';
export type ViewportMode = 'desktop' | 'mobile';

export type TemplateKey = 'form-query' | 'daily-report' | 'ticket-system';

export interface AppTemplate {
  key: TemplateKey;
  name: string;
  icon: string;
  color: string;
  tagline: string;
  description: string;
  prompt: string;
  keywords: string[];
  codeSnippet: string;
  thinkingDetail: string;
}

export const APP_TEMPLATES: AppTemplate[] = [
  {
    key: 'form-query',
    name: '数据查询',
    icon: 'search',
    color: '#007AFF',
    tagline: '表单查询 · 数据展示',
    description: '自动生成表单输入 + 后端查询 + 结果展示的完整应用',
    prompt: '创建一个剩余年假查询应用',
    keywords: ['查询', '搜索', '年假', '余额', '工资', '考勤', '数据', '统计', '报表'],
    codeSnippet: `// screens/leave-query/index.tsx
export default function LeaveQueryApp() {
  const [name, setName] = useState("");
  return (
    <div className="app-container">
      <Header title="剩余年假查询" />
      <QueryForm onSubmit={handleQuery} />
      <ResultPanel data={result} />
    </div>
  );
}`,
    thinkingDetail:
      '这是一个需要表单和数据查询的应用。让我先分析一下：\n1. 这是一个单页应用，需要表单输入\n2. 需要对接后端查询接口\n3. 需要结果展示区域',
  },
  {
    key: 'daily-report',
    name: '信息录入',
    icon: 'edit_note',
    color: '#34C759',
    tagline: '富文本编辑 · 表单提交',
    description: '带模板的内容编辑器，支持富文本、附件和定时提交',
    prompt: '做一个团队日报提交工具',
    keywords: ['日报', '周报', '提交', '填写', '编辑', '记录', '笔记', '文档', '报告', '汇报'],
    codeSnippet: `// screens/daily-report/index.tsx
export default function DailyReportApp() {
  const [sections, setSections] = useState(TEMPLATE);
  return (
    <div className="report-container">
      <DatePicker value={today} />
      <SectionEditor sections={sections} />
      <SubmitBar onSubmit={handleSubmit} />
    </div>
  );
}`,
    thinkingDetail:
      '这是一个内容编辑类应用。需要：\n1. 日期选择和模板切换\n2. 多段落富文本编辑区\n3. 提交/暂存操作和历史记录',
  },
  {
    key: 'ticket-system',
    name: '工单流程',
    icon: 'assignment',
    color: '#FF9500',
    tagline: '工单创建 · 流程流转',
    description: '支持创建、流转、处理的完整工单生命周期管理',
    prompt: '生成设备报修工单系统',
    keywords: ['工单', '报修', '审批', '流程', '申请', '维修', '报障', '服务', '请假', '采购'],
    codeSnippet: `// screens/ticket/index.tsx
export default function TicketApp() {
  const [tickets, setTickets] = useState([]);
  return (
    <div className="ticket-container">
      <TicketHeader onNew={openForm} />
      <TicketList items={tickets} />
      <TicketDetail selected={current} />
    </div>
  );
}`,
    thinkingDetail:
      '这是一个工单流程类应用。需要：\n1. 工单列表和状态筛选\n2. 创建工单表单（含分类/优先级）\n3. 流转状态追踪和处理反馈',
  },
];

export function matchTemplate(prompt: string): AppTemplate {
  const lower = prompt.toLowerCase();
  let best: AppTemplate = APP_TEMPLATES[0];
  let bestScore = 0;
  for (const tpl of APP_TEMPLATES) {
    const score = tpl.keywords.filter((kw) => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      best = tpl;
    }
  }
  return best;
}

export interface WorkflowStep {
  delay: number;
  msg: Omit<ChatMessage, 'id'>;
}

export function buildInitialWorkflow(prompt: string, template: AppTemplate): WorkflowStep[] {
  const shortPrompt = prompt.slice(0, 30) + (prompt.length > 30 ? '…' : '');
  return [
    {
      delay: 300,
      msg: { type: 'ai-thinking', content: '正在分析需求，规划实现方案…', streaming: true },
    },
    {
      delay: 1200,
      msg: {
        type: 'ai-thinking',
        content: `用户要求创建「${shortPrompt}」，${template.thinkingDetail}`,
      },
    },
    {
      delay: 1800,
      msg: {
        type: 'ai-action',
        content: '更新计划',
        actionIcon: 'checklist',
        actionLabel: '更新计划',
      },
    },
    {
      delay: 2200,
      msg: {
        type: 'ai-action',
        content: '分析数据模型与接口依赖',
        actionIcon: 'schema',
        actionLabel: '思考过程',
      },
    },
    {
      delay: 2800,
      msg: {
        type: 'ai-action',
        content: '正在生成页面布局与交互逻辑…',
        actionIcon: 'code',
        actionLabel: '创建文件',
      },
    },
    { delay: 3600, msg: { type: 'ai-code', content: template.codeSnippet } },
    {
      delay: 4200,
      msg: {
        type: 'ai-action',
        content: '优化样式与响应式布局',
        actionIcon: 'palette',
        actionLabel: '思考过程',
      },
    },
    {
      delay: 4800,
      msg: {
        type: 'ai-text',
        content:
          '应用已生成完毕！右侧是实时预览。\n\n你可以继续用自然语言告诉我需要修改的地方，例如：\n- 「把配色改成深色主题」\n- 「增加一个日期范围选择器」\n- 「底部加上数据来源说明」',
      },
    },
  ];
}

export function buildIterationWorkflow(prompt: string): WorkflowStep[] {
  return [
    {
      delay: 300,
      msg: { type: 'ai-thinking', content: `正在理解修改需求：「${prompt}」`, streaming: true },
    },
    {
      delay: 1000,
      msg: {
        type: 'ai-action',
        content: '分析变更影响范围',
        actionIcon: 'manage_search',
        actionLabel: '思考过程',
      },
    },
    {
      delay: 1600,
      msg: {
        type: 'ai-action',
        content: '正在修改界面代码…',
        actionIcon: 'edit_note',
        actionLabel: '修改文件',
      },
    },
    {
      delay: 2200,
      msg: { type: 'ai-text', content: '已完成修改，右侧预览已更新。还有其他需要调整的吗？' },
    },
  ];
}

let _msgId = 0;
export function nextMsgId() {
  return `msg-${++_msgId}`;
}
