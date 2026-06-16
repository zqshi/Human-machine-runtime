/**
 * openclawPersistence — 会话级对话持久化
 *
 * 使用 sessionStorage 保存对话内容和会话列表，
 * 防止页面刷新丢失已有对话。
 * 不保存 runtime 状态等可从后端恢复的数据。
 */
import { CoTMessage, type CoTMessageProps } from '../../domain/agent/CoTMessage';
import type { ConversationSession } from './openclawTypes';

const CONVERSATIONS_KEY = 'openclaw:conversations';
const SESSIONS_KEY = 'openclaw:sessions';
const ACTIVE_CONV_KEY = 'openclaw:activeConversationId';

function serializeMessage(m: CoTMessage): CoTMessageProps {
  return {
    id: m.id,
    agentId: m.agentId,
    sessionId: m.sessionId,
    role: m.role,
    text: m.text,
    html: m.html,
    timestamp: m.timestamp,
    cotSteps: m.cotSteps,
    blocks: m.blocks,
    attachments: m.attachments,
  };
}

export function persistConversations(
  conversations: Record<string, CoTMessage[]>,
  sessions: ConversationSession[],
  activeConversationId: string
): void {
  try {
    const serializable: Record<string, CoTMessageProps[]> = {};
    for (const [key, msgs] of Object.entries(conversations)) {
      if (msgs.length === 0) continue;
      serializable[key] = msgs.map(serializeMessage);
    }
    sessionStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(serializable));
    sessionStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    sessionStorage.setItem(ACTIVE_CONV_KEY, activeConversationId);
  } catch {
    // sessionStorage full or unavailable
  }
}

interface RestoredState {
  conversations: Record<string, CoTMessage[]>;
  sessions: ConversationSession[];
  activeConversationId: string | null;
}

export function restoreConversations(): RestoredState | null {
  try {
    const rawConv = sessionStorage.getItem(CONVERSATIONS_KEY);
    const rawSessions = sessionStorage.getItem(SESSIONS_KEY);
    const activeId = sessionStorage.getItem(ACTIVE_CONV_KEY);
    if (!rawConv || !rawSessions) return null;

    const rawConversations = JSON.parse(rawConv) as Record<string, CoTMessageProps[]>;
    const sessions = JSON.parse(rawSessions) as ConversationSession[];
    if (Object.keys(rawConversations).length === 0 && sessions.length === 0) return null;

    const conversations: Record<string, CoTMessage[]> = {};
    for (const [key, props] of Object.entries(rawConversations)) {
      conversations[key] = props.map((p) => CoTMessage.create(p));
    }

    return {
      conversations,
      sessions,
      activeConversationId: activeId,
    };
  } catch {
    return null;
  }
}

export function clearPersistedConversations(): void {
  try {
    sessionStorage.removeItem(CONVERSATIONS_KEY);
    sessionStorage.removeItem(SESSIONS_KEY);
    sessionStorage.removeItem(ACTIVE_CONV_KEY);
  } catch {
    // ignore
  }
}
