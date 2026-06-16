import { useChatStore } from '../stores/chatStore';

export function useTimeline() {
  const messages = useChatStore((s) => s.messages);
  const currentRoomId = useChatStore((s) => s.currentRoomId);
  const typingUsers = useChatStore((s) => s.typingUsers);

  const currentTyping = currentRoomId ? (typingUsers[currentRoomId] ?? []) : [];

  return { messages, currentRoomId, typingUsers: currentTyping };
}
