import { describe, it, expect } from 'vitest';
import { ChatService } from '../ChatService';
import { ChatRoom } from '../ChatRoom';

describe('ChatService', () => {
  const rooms = [
    ChatRoom.create({ id: '!dm1:s', name: 'Alice', type: 'dm' }),
    ChatRoom.create({ id: '!bot1:s', name: 'DCF Bot', type: 'bot' }),
    ChatRoom.create({ id: '!grp1:s', name: 'Team', type: 'group' }),
    ChatRoom.create({ id: '!bot2:s', name: 'Agent X', type: 'bot' }),
  ];

  it('filters rooms by type', () => {
    expect(ChatService.filterRooms(rooms, 'all').length).toBe(4);
    expect(ChatService.filterRooms(rooms, 'dm').length).toBe(1);
    expect(ChatService.filterRooms(rooms, 'bot').length).toBe(2);
    expect(ChatService.filterRooms(rooms, 'group').length).toBe(1);
  });

  it('filters rooms by search query', () => {
    const result = ChatService.filterRooms(rooms, 'all', 'alice');
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Alice');
  });

  it('sorts rooms by last message timestamp', () => {
    const r1 = rooms[0].withLastMessage('hi', 100);
    const r2 = rooms[1].withLastMessage('hello', 300);
    const r3 = rooms[2].withLastMessage('hey', 200);
    const sorted = ChatService.sortByRecent([r1, r2, r3]);
    expect(sorted[0].id).toBe('!bot1:s');
    expect(sorted[1].id).toBe('!grp1:s');
    expect(sorted[2].id).toBe('!dm1:s');
  });

  it('classifies room type from userId', () => {
    expect(ChatService.classifyRoomType('@dcf-bot:s')).toBe('bot');
    expect(ChatService.classifyRoomType('@factory:s')).toBe('bot');
    expect(ChatService.classifyRoomType('@agent-code:s')).toBe('bot');
    expect(ChatService.classifyRoomType('@alice:s')).toBe('dm');
    expect(ChatService.classifyRoomType(undefined)).toBe('group');
  });
});
