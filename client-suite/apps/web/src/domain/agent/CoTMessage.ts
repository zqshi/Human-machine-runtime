export type CoTStepStatus = 'pending' | 'running' | 'done' | 'error';

/** 推理步骤中的工具调用 */
export interface ToolCall {
  id: string;
  /** 工具名称，如 "IM 消息检索"、"部署状态查询" */
  name: string;
  /** Material icon 名称 */
  icon: string;
  status: CoTStepStatus;
  /** 调用摘要 / 输入描述 */
  input?: string;
  /** 工具返回结果摘要 */
  result?: string;
}

/** 知识引用的具体文档条目 */
export interface KnowledgeCitation {
  title: string;
  type?: 'document' | 'wiki' | 'sop' | 'api-doc' | 'regulation';
  /** 命中的关键片段 */
  snippet?: string;
}

/** 推理步骤中的知识检索 */
export interface KnowledgeRef {
  id: string;
  /** 知识库 / 文档名称 */
  name: string;
  /** Material icon 名称 */
  icon: string;
  status: CoTStepStatus;
  /** 检索查询 */
  query?: string;
  /** 检索结果摘要 */
  result?: string;
  /** 来源标注 */
  source?: string;
  /** 具体引用了哪些篇文档 */
  citations?: KnowledgeCitation[];
}

export interface CoTStep {
  id: string;
  label: string;
  status: CoTStepStatus;
  detail: string;
  /** 该步骤调用的工具 */
  toolCalls?: ToolCall[];
  /** 该步骤引用的知识 */
  knowledgeRefs?: KnowledgeRef[];
}

import type { MessageBlock } from './MessageBlock';

export interface Attachment {
  id: string;
  type: 'image' | 'file' | 'audio';
  name: string;
  size: number;
  mimeType: string;
  url: string;
}

export interface CoTMessageProps {
  id: string;
  agentId: string;
  sessionId: string;
  role: 'user' | 'agent';
  text: string;
  html?: string;
  timestamp: number;
  cotSteps?: CoTStep[];
  blocks?: MessageBlock[];
  attachments?: Attachment[];
}

export class CoTMessage {
  readonly id: string;
  readonly agentId: string;
  readonly sessionId: string;
  readonly role: 'user' | 'agent';
  readonly text: string;
  readonly html?: string;
  readonly timestamp: number;
  readonly cotSteps?: CoTStep[];
  readonly blocks?: MessageBlock[];
  readonly attachments?: Attachment[];

  private constructor(props: CoTMessageProps) {
    this.id = props.id;
    this.agentId = props.agentId;
    this.sessionId = props.sessionId;
    this.role = props.role;
    this.text = props.text;
    this.html = props.html;
    this.timestamp = props.timestamp;
    this.cotSteps = props.cotSteps;
    this.blocks = props.blocks;
    this.attachments = props.attachments;
  }

  static create(props: CoTMessageProps): CoTMessage {
    return new CoTMessage(props);
  }

  appendText(chunk: string): CoTMessage {
    return new CoTMessage({ ...this.toProps(), text: this.text + chunk });
  }

  withText(text: string): CoTMessage {
    return new CoTMessage({ ...this.toProps(), text });
  }

  withHtml(html: string): CoTMessage {
    return new CoTMessage({ ...this.toProps(), html });
  }

  withSteps(steps: CoTStep[]): CoTMessage {
    return new CoTMessage({ ...this.toProps(), cotSteps: steps });
  }

  withBlocks(blocks: MessageBlock[]): CoTMessage {
    return new CoTMessage({ ...this.toProps(), blocks });
  }

  appendBlock(block: MessageBlock): CoTMessage {
    return new CoTMessage({ ...this.toProps(), blocks: [...(this.blocks ?? []), block] });
  }

  withAttachments(attachments: Attachment[]): CoTMessage {
    return new CoTMessage({ ...this.toProps(), attachments });
  }

  private toProps(): CoTMessageProps {
    return {
      id: this.id,
      agentId: this.agentId,
      sessionId: this.sessionId,
      role: this.role,
      text: this.text,
      html: this.html,
      timestamp: this.timestamp,
      cotSteps: this.cotSteps,
      blocks: this.blocks,
      attachments: this.attachments,
    };
  }
}
