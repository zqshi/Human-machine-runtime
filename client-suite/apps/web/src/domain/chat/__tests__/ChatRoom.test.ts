import { describe, it, expect } from 'vitest';
import { ChatRoom } from '../ChatRoom';

describe('ChatRoom', () => {
  it('creates a DM room', () => {
    const room = ChatRoom.create({
      id: '!dm:server',
      name: 'Alice',
      type: 'dm',
      avatarLetter: 'A',
    });
    expect(room.id).toBe('!dm:server');
    expect(room.type).toBe('dm');
    expect(room.isDm).toBe(true);
    expect(room.isBot).toBe(false);
  });

  it('creates a bot room', () => {
    const room = ChatRoom.create({
      id: '!bot:server',
      name: 'DCF Bot',
      type: 'bot',
      avatarLetter: 'D',
    });
    expect(room.isBot).toBe(true);
  });

  it('creates a group room', () => {
    const room = ChatRoom.create({
      id: '!group:server',
      name: 'Team Chat',
      type: 'group',
      memberCount: 5,
    });
    expect(room.type).toBe('group');
    expect(room.memberCount).toBe(5);
  });

  it('updates last message', () => {
    const room = ChatRoom.create({
      id: '!room:server',
      name: 'Test',
      type: 'dm',
    });
    expect(room.lastMessage).toBeUndefined();

    const updated = room.withLastMessage('Hello', 1700000000000);
    expect(updated.lastMessage).toBe('Hello');
    expect(updated.lastMessageTs).toBe(1700000000000);
    // Original is unchanged (immutable)
    expect(room.lastMessage).toBeUndefined();
  });

  it('increments unread count', () => {
    const room = ChatRoom.create({
      id: '!room:server',
      name: 'Test',
      type: 'group',
    });
    expect(room.unreadCount).toBe(0);

    const updated = room.withUnread(3);
    expect(updated.unreadCount).toBe(3);
  });

  it('matches search query', () => {
    const room = ChatRoom.create({
      id: '!room:server',
      name: '前端开发群',
      type: 'group',
    });
    expect(room.matchesSearch('前端')).toBe(true);
    expect(room.matchesSearch('后端')).toBe(false);
    expect(room.matchesSearch('')).toBe(true);
  });
});
