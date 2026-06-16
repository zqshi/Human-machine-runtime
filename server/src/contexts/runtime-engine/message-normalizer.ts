import type { InboundMessage, ChannelType } from '../channel/channel-adapter.js';

export type MessageIntent = 'command' | 'report' | 'approval' | 'inquiry' | 'alert' | 'chat';

export type MessageUrgency = 'critical' | 'high' | 'normal' | 'low';

export interface NormalizedMessage {
  id: string;
  originalId: string;
  channelType: ChannelType;
  sender: { id: string; name?: string; channel: string };
  intent: MessageIntent;
  urgency: MessageUrgency;
  subject?: string;
  body: string;
  entities: ExtractedEntity[];
  relatedMessageIds: string[];
  receivedAt: Date;
  normalizedAt: Date;
  metadata: Record<string, unknown>;
}

export interface ExtractedEntity {
  type: 'person' | 'date' | 'amount' | 'project' | 'action';
  value: string;
  confidence: number;
}

const INTENT_PATTERNS: Array<{ pattern: RegExp; intent: MessageIntent }> = [
  { pattern: /请(?:批准|审批|确认)|审批|approve/i, intent: 'approval' },
  { pattern: /报警|告警|alert|异常|故障|宕机/i, intent: 'alert' },
  { pattern: /请(?:帮|执行|处理)|安排|部署|发布|上线/i, intent: 'command' },
  { pattern: /汇报|进展|完成|已(?:处理|修复|上线)|报告/i, intent: 'report' },
  { pattern: /怎么|如何|为什么|什么时候|请问/i, intent: 'inquiry' },
];

const URGENCY_PATTERNS: Array<{ pattern: RegExp; urgency: MessageUrgency }> = [
  { pattern: /紧急|urgent|立即|马上|P0|critical/i, urgency: 'critical' },
  { pattern: /尽快|优先|ASAP|P1|重要/i, urgency: 'high' },
  { pattern: /有空|不急|方便时|P3|低优/i, urgency: 'low' },
];

const ENTITY_PATTERNS: Array<{ pattern: RegExp; type: ExtractedEntity['type'] }> = [
  { pattern: /@(\w+)/g, type: 'person' },
  { pattern: /(\d{4}[-/]\d{1,2}[-/]\d{1,2})/g, type: 'date' },
  { pattern: /[¥$€]\s*[\d,.]+/g, type: 'amount' },
  { pattern: /(?:项目|project)\s*[：:]\s*(\S+)/gi, type: 'project' },
];

export class MessageNormalizer {
  normalize(msg: InboundMessage): NormalizedMessage {
    const intent = this.classifyIntent(msg.content);
    const urgency = this.assessUrgency(msg.content, intent);
    const entities = this.extractEntities(msg.content);

    return {
      id: `norm_${msg.id}`,
      originalId: msg.id,
      channelType: msg.channelType,
      sender: msg.sender,
      intent,
      urgency,
      subject: this.extractSubject(msg.content),
      body: msg.content,
      entities,
      relatedMessageIds: [],
      receivedAt: msg.receivedAt,
      normalizedAt: new Date(),
      metadata: msg.rawPayload ? { rawPayload: msg.rawPayload } : {},
    };
  }

  private classifyIntent(content: string): MessageIntent {
    for (const { pattern, intent } of INTENT_PATTERNS) {
      if (pattern.test(content)) return intent;
    }
    return 'chat';
  }

  private assessUrgency(content: string, intent: MessageIntent): MessageUrgency {
    if (intent === 'alert') return 'critical';
    for (const { pattern, urgency } of URGENCY_PATTERNS) {
      if (pattern.test(content)) return urgency;
    }
    if (intent === 'approval') return 'high';
    if (intent === 'command') return 'normal';
    return 'low';
  }

  private extractEntities(content: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    for (const { pattern, type } of ENTITY_PATTERNS) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        entities.push({
          type,
          value: match[1] ?? match[0],
          confidence: 0.8,
        });
      }
    }
    return entities;
  }

  private extractSubject(content: string): string | undefined {
    const firstLine = content.split('\n')[0]?.trim();
    if (firstLine && firstLine.length <= 80) return firstLine;
    return content.slice(0, 60).trim() + (content.length > 60 ? '...' : '');
  }
}
