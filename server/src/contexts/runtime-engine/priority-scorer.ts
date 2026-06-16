import type { NormalizedMessage, MessageIntent, MessageUrgency } from './message-normalizer.js';

export interface PriorityScore {
  messageId: string;
  score: number;
  factors: PriorityFactor[];
  decidedAt: Date;
}

export interface PriorityFactor {
  name: string;
  weight: number;
  value: number;
  reason: string;
}

interface SenderProfile {
  id: string;
  importance: number;
  responseRate?: number;
}

const INTENT_WEIGHT: Record<MessageIntent, number> = {
  alert: 95,
  approval: 80,
  command: 70,
  report: 40,
  inquiry: 30,
  chat: 10,
};

const URGENCY_WEIGHT: Record<MessageUrgency, number> = {
  critical: 100,
  high: 75,
  normal: 50,
  low: 20,
};

export class PriorityScorer {
  private senderProfiles = new Map<string, SenderProfile>();

  registerSenderProfile(profile: SenderProfile): void {
    this.senderProfiles.set(profile.id, profile);
  }

  score(msg: NormalizedMessage): PriorityScore {
    const factors: PriorityFactor[] = [];

    const intentScore = INTENT_WEIGHT[msg.intent];
    factors.push({
      name: 'intent',
      weight: 0.35,
      value: intentScore,
      reason: `消息意图: ${msg.intent}`,
    });

    const urgencyScore = URGENCY_WEIGHT[msg.urgency];
    factors.push({
      name: 'urgency',
      weight: 0.3,
      value: urgencyScore,
      reason: `紧急度: ${msg.urgency}`,
    });

    const senderProfile = this.senderProfiles.get(msg.sender.id);
    const senderScore = senderProfile ? senderProfile.importance : 50;
    factors.push({
      name: 'sender',
      weight: 0.2,
      value: senderScore,
      reason: senderProfile ? `发送者权重: ${senderScore}` : '未知发送者',
    });

    const ageMinutes = (Date.now() - msg.receivedAt.getTime()) / 60_000;
    const freshnessScore = Math.max(0, 100 - ageMinutes * 2);
    factors.push({
      name: 'freshness',
      weight: 0.15,
      value: freshnessScore,
      reason: `消息年龄: ${Math.round(ageMinutes)} 分钟`,
    });

    const totalScore = factors.reduce((sum, f) => sum + f.weight * f.value, 0);

    return {
      messageId: msg.id,
      score: Math.round(totalScore),
      factors,
      decidedAt: new Date(),
    };
  }

  scoreBatch(messages: NormalizedMessage[]): PriorityScore[] {
    return messages.map((msg) => this.score(msg)).sort((a, b) => b.score - a.score);
  }
}
